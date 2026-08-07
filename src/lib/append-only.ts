/**
 * Reading an append-only table.
 *
 * Two tables in this schema have no `UPDATE` policy at all — `attendance_records` and
 * `finance_records` — so a correction is a *new row* whose `corrects_id` points at the
 * row it replaces. Academy only ever reads `attendance_records`; a student has no way to
 * correct their own attendance, but Staff corrections land in the student's own record
 * set, so this app has to collapse them exactly as Admin-web does. That's enforced by the database, not by convention: an `UPDATE` is
 * rejected by RLS. See Bauhaven-Database-Schema.md, "Why append-only for Attendance and
 * Finance", and "Reading an append-only table".
 *
 * The cost lands on every reader. A plain `select` returns the corrections *and* the
 * rows they corrected, so a corrected attendance mark is counted twice in an attendance
 * rate. Ported verbatim from Admin-web rather than re-derived: this is the rule most
 * likely to come out slightly different the second time, and a rate that quietly
 * double-counts is not a bug anyone notices from the UI.
 */

/** The columns the resolution needs. Every append-only table in this schema has them. */
export interface AppendOnlyRecord {
  id: string;
  corrects_id: string | null;
  created_at: string;
}

/**
 * The rows still standing — those no other row in the set claims to correct — most
 * recent first.
 *
 * Correctness comes from the supersession graph, not from timestamps. Ordering by
 * `created_at desc` and taking the first would be wrong in the ordinary case, because
 * two rows written in the same statement share a timestamp exactly, so it would pick
 * between an original and its correction arbitrarily.
 *
 * `created_at` only ever *orders* what survives, and breaks ties between rows that are
 * all still standing — which is a genuine concurrent write (two people correcting the
 * same record, neither insert having seen the other). There, last-write-wins is the only
 * answer available; ordering by id after it keeps the result stable across renders
 * rather than dependent on however the rows arrived.
 *
 * Callers that partition first (attendance resolves per student) must do that *before*
 * calling this, so one partition's `corrects_id` can never retire another's row.
 */
export function resolveStandingRecords<T extends AppendOnlyRecord>(
  records: readonly T[]
): T[] {
  if (records.length === 0) return [];

  const superseded = new Set(
    records.map((record) => record.corrects_id).filter((id): id is string => id !== null)
  );

  const standing = records.filter((record) => !superseded.has(record.id));

  // Everything superseded means the chain loops — impossible while the table is
  // insert-only, but falling back to the whole set beats rendering nothing at all for
  // records that plainly exist.
  const candidates = standing.length > 0 ? standing : records;

  return [...candidates].sort(compareByRecency);
}

/** The single row still standing out of an already-partitioned set, or null if none. */
export function resolveStandingRecord<T extends AppendOnlyRecord>(
  records: readonly T[]
): T | null {
  return resolveStandingRecords(records)[0] ?? null;
}

/** Whether a row supersedes an earlier one — i.e. it *is* a correction. */
export function isCorrection(record: AppendOnlyRecord): boolean {
  return record.corrects_id !== null;
}

/** Most recent first; id descending only to make ties deterministic, not meaningful. */
function compareByRecency(a: AppendOnlyRecord, b: AppendOnlyRecord): number {
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
  return a.id < b.id ? 1 : -1;
}
