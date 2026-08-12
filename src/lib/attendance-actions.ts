"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveRecordsBySession } from "@/lib/attendance-resolve";
import { checkInSchema, type CheckInInput } from "@/lib/schemas/attendance";
import { formatAttendanceStatus } from "@/lib/attendance-format";

/**
 * Why check-in ended the way it did.
 *
 * Three real outcomes rather than ok/error, because they mean genuinely different things
 * to a student standing in a doorway: it worked, you were already marked, or the database
 * wouldn't take it. Collapsing the middle one into "error" would tell someone their
 * attendance didn't record when it already had.
 */
export type CheckInOutcome =
  | "checked-in"
  /** A record already stood for this session — nothing was written, nothing was lost. */
  | "already-recorded"
  /** `attendance_records_insert` refused: not actively enrolled in this session's program. */
  | "not-enrolled"
  | "failed";

export interface CheckInResult {
  outcome: CheckInOutcome;
  /** What to show. Always populated, including on success. */
  message: string;
}

const NOT_ENROLLED_MESSAGE =
  "You're not on the enrolment list for this session's program, so it wouldn't record. Speak to your mentor — they can mark you present themselves.";
const FAILED_MESSAGE = "Couldn't check you in — the connection may have dropped. Try again.";
const SIGNED_OUT_MESSAGE = "Your session has expired. Sign in again to continue.";
const INVALID_MESSAGE = "That session reference isn't valid. Reload the page and try again.";

/** The RLS refusal code. Expected here, not exceptional — see the doc comment below. */
const RLS_VIOLATION_CODE = "42501";

/**
 * Checks the signed-in student into a session.
 *
 * **A rejection from `attendance_records_insert` is an expected outcome, not a bug.** The
 * policy is `(user_id = auth.uid() and auth_enrolled_in_session_program(session_id)) or
 * auth_is_admin_or_staff()`, and it was tested live against a real Postgres instance —
 * enrolled student succeeds, non-enrolled student is blocked, Staff bypass. This page's
 * own query already filters sessions to the student's enrolled program, so a rejection
 * *shouldn't* normally happen — but the policy is the authority, not this page's query,
 * and the two can disagree: an enrolment withdrawn between page load and tap, or a stale
 * tab left open. So the refusal is caught and explained rather than routed around.
 *
 * **No offline queue, deliberately.** `Bauhaven-Architecture-Plan.md` §3 gives web
 * clients best-effort caching and reserves genuine queued writes for the native clients'
 * Drift-backed storage. A failed check-in here is a normal error with a retry — see
 * `CheckInCard`. A web app cannot guarantee a queued write ever syncs (the tab closes,
 * the browser evicts storage, there is no durable background sync in this stack), and
 * for attendance specifically a false "saved, will sync" is the worst possible lie: a
 * student believes they're marked present when the register says otherwise.
 */
export async function checkIn(input: CheckInInput): Promise<CheckInResult> {
  const parsed = checkInSchema.safeParse(input);
  if (!parsed.success) {
    console.error("Check-in rejected by validation:", parsed.error.issues);
    return { outcome: "failed", message: INVALID_MESSAGE };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { outcome: "failed", message: SIGNED_OUT_MESSAGE };

  // Check for an existing record first. There is **no unique constraint** on
  // (session_id, user_id), so a second insert would succeed at the database level and
  // leave two standing rows — which is exactly the double-count the correction chain
  // exists to prevent. The append-only convention means a legitimate change is a row
  // carrying `corrects_id`, and a student has no business writing one of those: adjusting
  // someone's attendance is a Staff decision.
  //
  // Scoped to this account as well as this session: `attendance_records_select` is
  // `user_id = auth.uid() or auth_is_admin_or_staff()`, so for anyone holding a Staff or
  // Admin role — an ordinary case on a platform with one login and multiple roles per
  // person — an unfiltered read returns the whole roster, and a *classmate's* record
  // would be reported back as "you're already checked in".
  const existingResult = await supabase
    .from("attendance_records")
    .select("id, session_id, status, corrects_id, created_at")
    .eq("session_id", parsed.data.session_id)
    .eq("user_id", user.id);

  if (existingResult.error) {
    console.error(
      "Existing attendance lookup failed:",
      existingResult.error.code,
      existingResult.error.message
    );
    // Inserting blind here risks a duplicate standing row, which is worse than asking
    // the student to try again.
    return { outcome: "failed", message: FAILED_MESSAGE };
  }

  const standing = resolveRecordsBySession(existingResult.data).get(parsed.data.session_id);

  if (standing) {
    return {
      outcome: "already-recorded",
      message:
        standing.status === "present"
          ? "You're already checked in for this session."
          : `Your mentor has already marked you ${formatAttendanceStatus(standing.status).toLowerCase()} for this session.`,
    };
  }

  const { error } = await supabase.from("attendance_records").insert({
    session_id: parsed.data.session_id,
    // From the session, never the client — the policy's self arm is `user_id = auth.uid()`.
    user_id: user.id,
    // The only status self-check-in can mean. Marking yourself absent or excused would be
    // asserting something only Staff can decide, and the policy doesn't distinguish
    // statuses, so the restriction lives here.
    status: "present",
    // Null: this is a first record, not a correction. Corrections are Staff's.
    corrects_id: null,
    // The one timestamp that says when the student actually arrived, as distinct from
    // `created_at`. Admin-web leaves this null when Staff mark a roster on someone's
    // behalf, precisely so a real check-in is distinguishable from a recorded one.
    checked_in_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Check-in insert failed:", error.code, error.message);

    if (error.code === RLS_VIOLATION_CODE) {
      return { outcome: "not-enrolled", message: NOT_ENROLLED_MESSAGE };
    }

    return { outcome: "failed", message: FAILED_MESSAGE };
  }

  revalidatePath("/attendance");
  revalidatePath("/dashboard");

  return { outcome: "checked-in", message: "You're checked in." };
}
