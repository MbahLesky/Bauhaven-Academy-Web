import type { AttendanceStatus } from "@/lib/schemas/attendance";

// Labels and colours ported from Admin-web unchanged, so a session a student sees as
// "Excused" is the same word and the same colour a Staff member sees on the roster.
const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  excused: "Excused",
};

export function formatAttendanceStatus(status: AttendanceStatus): string {
  return STATUS_LABELS[status];
}

/** Matches the wireframe's history badges and Admin-web's roster pills. */
export const STATUS_VARIANTS: Record<AttendanceStatus, "success" | "danger" | "warning"> = {
  present: "success",
  absent: "danger",
  excused: "warning",
};

/**
 * A session nobody has marked either way.
 *
 * Not "Absent" — the distinction matters more on this screen than on Admin's roster,
 * because it's the student's own record: being told you were marked absent when in fact
 * nobody took the register is a different and worse statement.
 */
export const NOT_MARKED_LABEL = "Not marked";
