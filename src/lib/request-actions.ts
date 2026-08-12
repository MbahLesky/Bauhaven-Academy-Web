"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  ABSENCE_REQUEST_TYPE,
  absenceRequestSchema,
  type AbsenceRequestInput,
} from "@/lib/schemas/request";

export type RequestMutationResult = { error: string | null };

// "What happened + what they can do" — the technical detail goes to the log.
const SIGNED_OUT_MESSAGE = "Your session has expired. Sign in again to continue.";
const VALIDATION_MESSAGE = "Check the dates and reason, then try again.";
const REFUSED_MESSAGE =
  "That request wasn't accepted. Reload the page and try again — if it keeps happening, speak to a mentor.";
const GENERIC_MESSAGE = "Couldn't send that request. Try again in a moment.";

const RLS_VIOLATION_CODE = "42501";

/**
 * Submits an absence request for the signed-in student.
 *
 * **`requester_id` comes from the session, never from the client.** `requests_insert` is
 * `with check (requester_id = auth.uid())`, so a forged id would be refused by the
 * database anyway — but the value is filled server-side so the app never depends on that
 * refusal, and so a 42501 here means something has genuinely gone wrong rather than
 * routine tampering being caught late.
 *
 * **`status` is deliberately not sent.** The column defaults to 'pending' (checked, not
 * assumed: `001_initial_schema.sql` line 140), and the workflow state is the approval
 * side's to own, not this form's. It matters more than it looks: the Core Feature Spec's
 * quorum rule says a request auto-approves when the company has exactly one Admin (zero
 * *other* Admins = quorum trivially met), and whatever eventually implements that — a
 * trigger, a different default, an edge function — would be fighting a client that
 * hardcodes 'pending'. Omitting the column lets the schema decide.
 *
 * **No `request_approvals` rows are created here.** The table needs one row per required
 * approver, and *who* those approvers are depends on routing rules that don't exist yet:
 * no Admin-web approval screen has been built, and whether approver rows are created at
 * submission time or lazily when a Staff member first opens the queue is a decision that
 * belongs with that screen. Guessing here would seed rows the approval side then has to
 * work around. See the report and `Bauhaven-Core-Feature-Spec.md` §8.
 */
export async function submitAbsenceRequest(
  input: AbsenceRequestInput
): Promise<RequestMutationResult> {
  const parsed = absenceRequestSchema.safeParse(input);
  if (!parsed.success) {
    console.error("Absence request rejected by validation:", parsed.error.issues);
    return { error: VALIDATION_MESSAGE };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: SIGNED_OUT_MESSAGE };

  const { error } = await supabase.from("requests").insert({
    requester_id: user.id,
    // The one thing this screen can mean. `requests.type` has no check constraint, so
    // the value is named rather than left to the column default.
    type: ABSENCE_REQUEST_TYPE,
    start_date: parsed.data.start_date,
    end_date: parsed.data.end_date,
    reason: parsed.data.reason,
  });

  if (error) {
    console.error("Absence request insert failed:", error.code, error.message);
    // A policy refusal shouldn't be reachable — requester_id is filled from the session
    // just above, which is the only condition `requests_insert` checks. Handled anyway,
    // because a signed-out-mid-submit race would land here rather than at the check above.
    return { error: error.code === RLS_VIOLATION_CODE ? REFUSED_MESSAGE : GENERIC_MESSAGE };
  }

  revalidatePath("/requests");

  return { error: null };
}
