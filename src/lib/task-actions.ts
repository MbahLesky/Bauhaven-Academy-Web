"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getLearnerContext } from "@/lib/enrolment";
import { isOpen } from "@/lib/task-format";
import {
  assignmentIdSchema,
  idempotencyKeySchema,
  missingPart,
  submissionSchema,
  type SubmissionInput,
} from "@/lib/schemas/task";

export type TaskMutationResult = { error: string | null };

// "What happened + what they can do" — the technical detail goes to the log.
const SIGNED_OUT_MESSAGE = "Your session has expired. Sign in again to continue.";
const VALIDATION_MESSAGE = "Check what you're handing in and try again.";
const NOT_YOURS_MESSAGE = "You can't hand in work for this task — it may not be assigned to you any more.";
const CLOSED_MESSAGE = "This task isn't taking submissions now. Refresh to see where it stands.";
const NO_RESUBMIT_MESSAGE = "You've already handed this in, and it can't be handed in again.";
const RACE_MESSAGE = "That was handed in from somewhere else at the same moment. Refresh to see it.";
const GENERIC_MESSAGE = "Couldn't hand that in. Try again in a moment.";

const UNIQUE_VIOLATION_CODE = "23505";

/**
 * Hands in work against one of the learner's task assignments.
 *
 * A submission is a new **version** (`version_number`, unique per assignment); the
 * database stamps when it arrived and whether it was late, and moves the assignment to
 * "submitted", which puts it in the mentor's queue. If the learner saved a draft from the
 * mobile app, that draft is what gets handed in rather than a second version.
 *
 * `idempotencyKey` is made once per form, so a retry after a lost response returns the
 * version already accepted instead of writing another — the same rule the mobile app uses.
 */
export async function submitWork(
  assignmentId: string,
  input: SubmissionInput,
  idempotencyKey: string
): Promise<TaskMutationResult> {
  const parsedId = assignmentIdSchema.safeParse(assignmentId);
  const parsedKey = idempotencyKeySchema.safeParse(idempotencyKey);
  const parsed = submissionSchema.safeParse(input);
  if (!parsedId.success || !parsedKey.success || !parsed.success) {
    console.error("Submission rejected by validation:", parsed.error?.issues);
    return { error: VALIDATION_MESSAGE };
  }

  const learner = await getLearnerContext();
  if (!learner) return { error: SIGNED_OUT_MESSAGE };

  const supabase = await createClient();

  // A retry of something already accepted: done, nothing more to write.
  const retried = await supabase
    .from("submissions")
    .select("id, status")
    .eq("idempotency_key", parsedKey.data)
    .eq("participant_id", learner.userId)
    .maybeSingle();
  if (retried.data && retried.data.status !== "draft") return { error: null };

  const assignment = await supabase
    .from("task_assignments")
    .select("id, task_id, enrolment_id, status")
    .eq("id", parsedId.data)
    .maybeSingle();

  if (assignment.error) {
    console.error("Assignment lookup failed:", assignment.error.code, assignment.error.message);
    return { error: GENERIC_MESSAGE };
  }
  // The database would show a reviewer this row too; only the learner's own counts here.
  if (!assignment.data || !learner.enrolments.some((enrolment) => enrolment.id === assignment.data?.enrolment_id)) {
    return { error: NOT_YOURS_MESSAGE };
  }

  const [task, latest] = await Promise.all([
    supabase
      .from("tasks")
      .select("status, submission_type, allow_resubmission, max_resubmissions")
      .eq("id", assignment.data.task_id)
      .maybeSingle(),
    supabase
      .from("submissions")
      .select("id, version_number, status")
      .eq("task_assignment_id", assignment.data.id)
      .order("version_number", { ascending: false }),
  ]);

  if (task.error || latest.error) {
    console.error("Submission pre-checks failed:", task.error?.message, latest.error?.message);
    return { error: GENERIC_MESSAGE };
  }
  if (!task.data) return { error: NOT_YOURS_MESSAGE };
  if (task.data.status !== "published" || !isOpen(assignment.data.status)) return { error: CLOSED_MESSAGE };

  const missing = missingPart(task.data.submission_type, parsed.data);
  if (missing) return { error: missing };

  const versions = latest.data ?? [];
  const handedIn = versions.filter((version) => version.status !== "draft").length;
  if (
    handedIn > 0 &&
    (!task.data.allow_resubmission || (task.data.max_resubmissions !== null && handedIn > task.data.max_resubmissions))
  ) {
    return { error: NO_RESUBMIT_MESSAGE };
  }

  const draft = versions[0]?.status === "draft" ? versions[0] : null;
  const content = { text_content: parsed.data.text_content, link_url: parsed.data.link_url };

  const { error } = draft
    ? await supabase
        .from("submissions")
        .update({ ...content, status: "submitted" })
        .eq("id", draft.id)
    : await supabase.from("submissions").insert({
        ...content,
        task_assignment_id: assignment.data.id,
        // From the session, never the client.
        participant_id: learner.userId,
        version_number: (versions[0]?.version_number ?? 0) + 1,
        status: "submitted",
        idempotency_key: parsedKey.data,
      });

  if (error) {
    console.error("Submission write failed:", error.code, error.message);
    return { error: error.code === UNIQUE_VIOLATION_CODE ? RACE_MESSAGE : GENERIC_MESSAGE };
  }

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return { error: null };
}
