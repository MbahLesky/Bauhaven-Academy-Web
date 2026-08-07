import { createClient } from "@/lib/supabase/server";
import { formatSessionDate, todayInBauhaven } from "@/lib/date-format";
import {
  resolveRecordsBySession,
  summarizeAttendance,
  type AttendanceStats,
} from "@/lib/attendance-resolve";
import type { AttendanceStatus } from "@/lib/schemas/attendance";

/**
 * Every read of a student's own attendance, in one place.
 *
 * The Home preview's rate and this screen's stats go through the same function, so the
 * two can't show different percentages for the same student — they already could,
 * because Home computed its own and didn't collapse Staff corrections.
 */

/** How much history the screen shows. A term's worth without becoming an archive. */
const HISTORY_LIMIT = 30;

export interface AttendanceSessionSummary {
  id: string;
  /** The raw `session_date` (YYYY-MM-DD), for comparing against today. */
  sessionDate: string;
  /** Preformatted "Mon, 3 Aug", matching the wireframe's history rows. */
  label: string;
}

export interface HistoryEntry extends AttendanceSessionSummary {
  /** Null when nobody has marked this session either way — not the same as absent. */
  status: AttendanceStatus | null;
}

export interface AttendanceView {
  /** Null when the student has no active enrollment at all. */
  programId: string | null;
  /** Today's session for that program, or null when none is scheduled. */
  todaySession: AttendanceSessionSummary | null;
  /** The standing record for today's session, if the student already has one. */
  todayStatus: AttendanceStatus | null;
  stats: AttendanceStats;
  history: HistoryEntry[];
}

/**
 * The student's single active enrollment.
 *
 * `.limit(1).maybeSingle()` matches how the Home screen already does this. Multi-
 * enrollment — "which program's session am I checking into?" — is profile-switcher
 * territory, deferred with the switcher itself in the Auth work.
 */
async function getActiveProgramId(): Promise<string | null> {
  const supabase = await createClient();

  // RLS scopes enrollments to the current user.
  const { data, error } = await supabase
    .from("enrollments")
    .select("program_id")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Active enrollment lookup failed:", error.code, error.message);
    return null;
  }

  return data?.program_id ?? null;
}

/**
 * Everything the Attendance screen needs, in one pass.
 *
 * **Sessions are filtered by program explicitly.** `attendance_sessions_select` is
 * `using (true)` — every authenticated user can read every session, unlike `tasks` or
 * `attendance_records`. So this is the one place in Academy where RLS does *not* do the
 * scoping and the query genuinely has to.
 */
export async function getAttendanceView(): Promise<{
  view: AttendanceView;
  error: unknown;
}> {
  const empty: AttendanceView = {
    programId: null,
    todaySession: null,
    todayStatus: null,
    stats: { rate: null, attended: 0, recorded: 0 },
    history: [],
  };

  const programId = await getActiveProgramId();
  if (!programId) return { view: empty, error: null };

  const supabase = await createClient();
  const today = todayInBauhaven();

  const [sessionsResult, recordsResult] = await Promise.all([
    supabase
      .from("attendance_sessions")
      .select("id, session_date, program_id")
      .eq("program_id", programId)
      // Future sessions aren't history and can't be checked into yet.
      .lte("session_date", today)
      .order("session_date", { ascending: false })
      .limit(HISTORY_LIMIT),
    // RLS scopes these to the student — `user_id = auth.uid()`.
    supabase.from("attendance_records").select("id, session_id, status, corrects_id, created_at"),
  ]);

  if (sessionsResult.error) {
    console.error(
      "Attendance sessions query failed:",
      sessionsResult.error.code,
      sessionsResult.error.message
    );
    return { view: empty, error: sessionsResult.error };
  }
  if (recordsResult.error) {
    console.error(
      "Attendance records query failed:",
      recordsResult.error.code,
      recordsResult.error.message
    );
    return { view: empty, error: recordsResult.error };
  }

  // The one place the correction chain is collapsed. Everything below reads this map.
  const standing = resolveRecordsBySession(recordsResult.data);

  const sessions = sessionsResult.data.map((row) => ({
    id: row.id,
    sessionDate: row.session_date,
    label: formatSessionDate(row.session_date) ?? row.session_date,
  }));

  const todaySession = sessions.find((session) => session.sessionDate === today) ?? null;

  const history: HistoryEntry[] = sessions.map((session) => ({
    ...session,
    status: standing.get(session.id)?.status ?? null,
  }));

  return {
    view: {
      programId,
      todaySession,
      todayStatus: todaySession ? (standing.get(todaySession.id)?.status ?? null) : null,
      // Computed from every standing record, not only the history window — a rate over
      // "the last 30 sessions" would silently change meaning as the term went on.
      stats: summarizeAttendance([...standing.values()]),
      history,
    },
    error: null,
  };
}

/**
 * Just the rate, for the Home screen's preview.
 *
 * Deliberately the same resolution and the same formula as the full view — Home was
 * previously computing `present / all records`, which both double-counted Staff
 * corrections and counted an excused absence against the student.
 */
export async function getAttendanceStats(): Promise<{ stats: AttendanceStats; error: unknown }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("attendance_records")
    .select("id, session_id, status, corrects_id, created_at");

  if (error) {
    console.error("Attendance stats query failed:", error.code, error.message);
    return { stats: { rate: null, attended: 0, recorded: 0 }, error };
  }

  const standing = resolveRecordsBySession(data);
  return { stats: summarizeAttendance([...standing.values()]), error: null };
}
