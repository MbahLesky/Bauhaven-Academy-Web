"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getLearnerContext } from "@/lib/enrolment";
import { isDatabaseReady } from "@/lib/database-readiness";
import { issueReportSchema, type IssueReportInput } from "@/lib/schemas/issue-report";

export type IssueReportMutationResult = { error: string | null };

// "What happened + what they can do" — the technical detail goes to the log.
const SIGNED_OUT_MESSAGE = "Your session has expired. Sign in again to continue.";
const NOT_READY_MESSAGE = "Reporting a problem here isn't available yet. Tell your coordinator directly for now.";
const VALIDATION_MESSAGE = "Pick a category and describe the problem, then try again.";
const REFUSED_MESSAGE =
  "That report wasn't accepted. Reload the page and try again — if it keeps happening, tell your coordinator directly.";
const GENERIC_MESSAGE = "Couldn't send that report. Try again in a moment.";

const RLS_VIOLATION_CODE = "42501";

/**
 * Files an issue report for the signed-in learner. `reporter_id` comes from the session,
 * never the client; `status` is left to the database's default ('open'). The learner's
 * programme is attached so staff know where the problem is.
 */
export async function submitIssueReport(input: IssueReportInput): Promise<IssueReportMutationResult> {
  if (!isDatabaseReady("issueReports")) return { error: NOT_READY_MESSAGE };

  const parsed = issueReportSchema.safeParse(input);
  if (!parsed.success) {
    console.error("Issue report rejected by validation:", parsed.error.issues);
    return { error: VALIDATION_MESSAGE };
  }

  const learner = await getLearnerContext();
  if (!learner) return { error: SIGNED_OUT_MESSAGE };

  const supabase = await createClient();

  const { error } = await supabase.from("issue_reports").insert({
    reporter_id: learner.userId,
    category: parsed.data.category,
    description: parsed.data.description,
    offering_id: learner.current?.offeringId ?? null,
  });

  if (error) {
    console.error("Issue report insert failed:", error.code, error.message);
    return { error: error.code === RLS_VIOLATION_CODE ? REFUSED_MESSAGE : GENERIC_MESSAGE };
  }

  revalidatePath("/report");
  return { error: null };
}
