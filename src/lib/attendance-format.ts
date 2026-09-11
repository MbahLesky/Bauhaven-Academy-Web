/** A mark someone has actually made. The database's `not_recorded` reads as not marked. */
export type AttendanceStatus = "present" | "late" | "absent" | "excused";

// The same words and colours as Admin-web's roster, so a session reads the same on both.
const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  late: "Late",
  absent: "Absent",
  excused: "Excused",
};

export function formatAttendanceStatus(status: AttendanceStatus): string {
  return STATUS_LABELS[status];
}

export const STATUS_VARIANTS: Record<AttendanceStatus, "success" | "danger" | "warning" | "neutral"> = {
  present: "success",
  late: "warning",
  absent: "danger",
  excused: "neutral",
};

/**
 * A session nobody has marked either way. Not "Absent": on the learner's own record, being
 * told you were absent when nobody took the register is a different and worse statement.
 */
export const NOT_MARKED_LABEL = "Not marked";

export function toAttendanceStatus(value: string | null | undefined): AttendanceStatus | null {
  return value === "present" || value === "late" || value === "absent" || value === "excused" ? value : null;
}

export interface AttendanceStats {
  /** Percentage attended, rounded. Null when there's nothing to compute one from. */
  rate: number | null;
  /** Sessions attended, on time or late. */
  attended: number;
  /** Sessions with a mark, the denominator's source. */
  recorded: number;
}

/**
 * The two stat boxes. Late counts as attended — they came. **Excused sessions are left out
 * of the rate**, not counted as absences: an approved absence is the system saying "this one
 * doesn't count against you".
 */
export function summarizeAttendance(statuses: readonly (AttendanceStatus | null)[]): AttendanceStats {
  let attended = 0;
  let absent = 0;
  let recorded = 0;

  for (const status of statuses) {
    if (status === null) continue;
    recorded += 1;
    if (status === "present" || status === "late") attended += 1;
    else if (status === "absent") absent += 1;
  }

  const counted = attended + absent;
  return { rate: counted > 0 ? Math.round((attended / counted) * 100) : null, attended, recorded };
}
