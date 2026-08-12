"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { issueReportSchema, type IssueReportInput } from "@/lib/schemas/issue-report";

export type IssueReportMutationResult = { error: string | null };

// "What happened + what they can do" — the technical detail goes to the log.
const SIGNED_OUT_MESSAGE = "Your session has expired. Sign in again to continue.";
const VALIDATION_MESSAGE = "Pick a category and describe the problem, then try again.";
const REFUSED_MESSAGE =
  "That report wasn't accepted. Reload the page and try again — if it keeps happening, tell a mentor directly.";
const GENERIC_MESSAGE = "Couldn't send that report. Try again in a moment.";

const RLS_VIOLATION_CODE = "42501";

/**
 * Files an issue report for the signed-in student.
 *
 * **`reporter_id` comes from the session, never from the client.** `issue_reports_insert`
 * is `with check (reporter_id = auth.uid())`, so a forged id would be refused by the
 * database anyway — but the value is filled server-side so the app never depends on that
 * refusal, and so a 42501 here means something genuinely went wrong rather than routine
 * tampering being caught late.
 *
 * **`status` is deliberately not sent.** The column defaults to `'open'` (checked, not
 * assumed: `001_initial_schema.sql` line 174) with a check constraint of
 * open/in_progress/resolved. Where a report sits in a workflow belongs to whoever triages
 * it, and — unlike Requests — that side is *not* blocked in the database:
 * `issue_reports_update` already exists and lets any Admin or Staff member move a report
 * along. What's missing there is only the screen.
 *
 * **`asset_id` and `program_id` stay null.** Both columns exist and are FK'd, but a
 * student can read only assets assigned to them, so an asset picker here would show the
 * wrong list to the wrong person. Attaching them belongs to a triage screen.
 */
export async function submitIssueReport(
  input: IssueReportInput
): Promise<IssueReportMutationResult> {
  const parsed = issueReportSchema.safeParse(input);
  if (!parsed.success) {
    console.error("Issue report rejected by validation:", parsed.error.issues);
    return { error: VALIDATION_MESSAGE };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: SIGNED_OUT_MESSAGE };

  const { error } = await supabase.from("issue_reports").insert({
    reporter_id: user.id,
    category: parsed.data.category,
    description: parsed.data.description,
  });

  if (error) {
    console.error("Issue report insert failed:", error.code, error.message);
    // A policy refusal shouldn't be reachable — reporter_id is filled from the session
    // just above, which is the only condition `issue_reports_insert` checks. Handled
    // anyway, because a signed-out-mid-submit race would land here.
    return { error: error.code === RLS_VIOLATION_CODE ? REFUSED_MESSAGE : GENERIC_MESSAGE };
  }

  revalidatePath("/report");

  return { error: null };
}
