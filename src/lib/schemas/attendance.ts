import { z } from "zod";

// Its own module, not attendance-actions.ts — a "use server" file can only export async
// functions, and a schema exported from one silently isn't the real schema by the time a
// client component imports it. Same rule the auth and task schemas follow.

/** Mirrors `attendance_records.status`'s check constraint exactly. */
export const ATTENDANCE_STATUSES = ["present", "absent", "excused"] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/**
 * Checking in.
 *
 * The session id is the only input — `user_id` comes from the session and `status` is
 * always 'present', because that is the only thing self-check-in can mean. A student
 * marking themselves absent or excused would be asserting something only Staff can
 * decide, and `attendance_records_insert`'s self arm doesn't distinguish statuses, so
 * the restriction has to be here.
 */
export const checkInSchema = z.object({
  session_id: z.uuid("That isn't a valid session reference"),
});

export type CheckInInput = z.infer<typeof checkInSchema>;
