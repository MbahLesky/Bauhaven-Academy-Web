import { createClient } from "@/lib/supabase/server";
import { bauhavenDateKey, formatSessionStart, todayInBauhaven } from "@/lib/date-format";
import { getLearnerContext } from "@/lib/enrolment";
import {
  summarizeAttendance,
  toAttendanceStatus,
  type AttendanceStats,
  type AttendanceStatus,
} from "@/lib/attendance-format";

/**
 * Every read of a learner's own attendance, in one place, so Home's rate and this screen's
 * can't disagree.
 *
 * Staff take the register; learners read it. Each learner has at most one record per
 * session, kept up to date by staff, so there is nothing to collapse.
 */

/** How much history the screen shows: a term's worth without becoming an archive. */
const HISTORY_LIMIT = 30;

export interface HistoryEntry {
  id: string;
  /** "Week 3 class". */
  title: string;
  /** "Mon, 3 Aug, 9:00am", in Bauhaven's timezone. */
  when: string;
  /** The Bauhaven calendar day it was held, YYYY-MM-DD. */
  sessionDate: string;
  /** Null when nobody has marked this session — not the same as absent. */
  status: AttendanceStatus | null;
  /** Set when staff corrected the mark, with their reason. */
  correction: string | null;
}

export interface AttendanceView {
  /** Sessions held today, with the learner's mark so far. */
  today: HistoryEntry[];
  stats: AttendanceStats;
  history: HistoryEntry[];
}

/**
 * Everything the Attendance screen needs. Sessions are those of the learner's own cohorts
 * that have started, newest first; records are the learner's own.
 *
 * Throws on a failed read: an empty screen would say "you have no attendance".
 */
export async function getAttendanceView(): Promise<AttendanceView> {
  const empty: AttendanceView = { today: [], stats: summarizeAttendance([]), history: [] };

  const learner = await getLearnerContext();
  if (!learner) return empty;

  const cohortIds = [...new Set(learner.enrolments.map((e) => e.cohortId).filter((id): id is string => id !== null))];
  const enrolmentIds = learner.enrolments.map((enrolment) => enrolment.id);
  if (cohortIds.length === 0) return empty;

  const supabase = await createClient();

  const [sessionsResult, recordsResult] = await Promise.all([
    supabase
      .from("attendance_sessions")
      .select("id, title, starts_at, status")
      .in("cohort_id", cohortIds)
      .neq("status", "cancelled")
      .lte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: false })
      .limit(HISTORY_LIMIT),
    supabase
      .from("attendance_records")
      .select("attendance_session_id, status, corrected_at, correction_reason")
      .in("enrolment_id", enrolmentIds),
  ]);

  if (sessionsResult.error) fail("Attendance sessions", sessionsResult.error);
  if (recordsResult.error) fail("Attendance records", recordsResult.error);

  const records = new Map((recordsResult.data ?? []).map((record) => [record.attendance_session_id, record]));
  const today = todayInBauhaven();

  const history: HistoryEntry[] = (sessionsResult.data ?? []).map((session) => {
    const record = records.get(session.id);
    return {
      id: session.id,
      title: session.title,
      when: formatSessionStart(session.starts_at) ?? session.starts_at,
      sessionDate: bauhavenDateKey(session.starts_at),
      status: toAttendanceStatus(record?.status),
      correction: record?.corrected_at ? record.correction_reason : null,
    };
  });

  return {
    today: history.filter((entry) => entry.sessionDate === today),
    // Every mark the learner has, not only the history window — a rate over "the last 30"
    // would quietly change meaning as the term went on.
    stats: summarizeAttendance((recordsResult.data ?? []).map((record) => toAttendanceStatus(record.status))),
    history,
  };
}

/** Just the rate, for Home. The same records and the same formula as the full screen. */
export async function getAttendanceStats(): Promise<AttendanceStats> {
  const learner = await getLearnerContext();
  if (!learner || learner.enrolments.length === 0) return summarizeAttendance([]);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance_records")
    .select("status")
    .in(
      "enrolment_id",
      learner.enrolments.map((enrolment) => enrolment.id)
    );

  if (error) {
    // Home degrades to no rate rather than failing: the rest of the screen is still right.
    console.error("Attendance stats query failed:", error.code, error.message);
    return summarizeAttendance([]);
  }

  return summarizeAttendance(data.map((record) => toAttendanceStatus(record.status)));
}

function fail(what: string, error: { code?: string; message: string }): never {
  console.error(`${what} query failed:`, error.code, error.message);
  throw new Error("Couldn't load your attendance.");
}
