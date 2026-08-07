import { resolveStandingRecord, type AppendOnlyRecord } from "@/lib/append-only";
import type { AttendanceStatus } from "@/lib/schemas/attendance";

/**
 * Collapsing `attendance_records` down to what actually stands, for one student.
 *
 * Academy is a single-student view — RLS scopes `attendance_records_select` to
 * `user_id = auth.uid()` — so there is no per-student partitioning to do here, unlike
 * Admin-web's roster. What *does* still apply is the correction chain: a student can't
 * correct their own attendance, but **Staff can**, and those corrections arrive in this
 * student's own record set. Reading the table flat would count a mark that was corrected
 * from Present to Absent as both, which inflates an attendance rate in the student's
 * favour and disagrees with the number Staff see.
 */

export interface AttendanceRecordLike extends AppendOnlyRecord {
  session_id: string;
  status: AttendanceStatus;
}

/**
 * The record still standing for each session, keyed by `session_id`.
 *
 * Partitioned by session before resolving, so a correction on one session can never
 * retire another session's record whatever ends up in the table — the same discipline
 * Admin-web applies per student.
 */
export function resolveRecordsBySession<T extends AttendanceRecordLike>(
  records: readonly T[]
): Map<string, T> {
  const bySession = new Map<string, T[]>();

  for (const record of records) {
    const existing = bySession.get(record.session_id);
    if (existing) existing.push(record);
    else bySession.set(record.session_id, [record]);
  }

  const current = new Map<string, T>();

  for (const [sessionId, sessionRecords] of bySession) {
    const resolved = resolveStandingRecord(sessionRecords);
    if (resolved) current.set(sessionId, resolved);
  }

  return current;
}

export interface AttendanceStats {
  /** Percentage present, rounded. Null when there's nothing to compute one from. */
  rate: number | null;
  /** Sessions marked present — the wireframe's "Sessions attended". */
  attended: number;
  /** Every session with a standing record, i.e. the denominator behind the rate. */
  recorded: number;
}

/**
 * The wireframe's two stat boxes.
 *
 * **Excused sessions are excluded from the denominator, not counted as absences.** An
 * approved absence is the system saying "this one doesn't count against you" — folding
 * it into the rate as a miss would make the excusing pointless, and would quietly punish
 * a student for using the Requests flow correctly. Present ÷ (present + absent).
 *
 * Takes resolved records, never raw rows. That's the whole point of this module.
 */
export function summarizeAttendance(
  records: readonly { status: AttendanceStatus }[]
): AttendanceStats {
  let present = 0;
  let absent = 0;

  for (const record of records) {
    if (record.status === "present") present += 1;
    else if (record.status === "absent") absent += 1;
  }

  const counted = present + absent;

  return {
    rate: counted > 0 ? Math.round((present / counted) * 100) : null,
    attended: present,
    recorded: records.length,
  };
}
