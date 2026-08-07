"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canCreateOwnTasks } from "@/lib/task-permissions";
import { bauhavenLocalToInstant } from "@/lib/date-format";
import {
  selfTaskSchema,
  submissionSchema,
  taskIdSchema,
  type SelfTaskInput,
  type SubmissionInput,
} from "@/lib/schemas/task";

export type TaskMutationResult = { error: string | null };

// "What happened + what they can do" — the technical detail goes to the log.
const SIGNED_OUT_MESSAGE = "Your session has expired. Sign in again to continue.";
const VALIDATION_MESSAGE = "Check the form and try again.";
const NOT_YOURS_MESSAGE =
  "You can't submit for this task — it may not be assigned to you, or it may have been removed.";
const ALREADY_SUBMITTED_MESSAGE =
  "This task isn't open for submissions any more. Refresh to see where it stands.";
const NO_CREATE_PERMISSION_MESSAGE =
  "You don't have permission to create your own tasks. An Admin or Staff member grants that per person.";
const GENERIC_MESSAGE = "Couldn't save that. Try again in a moment.";

const RLS_VIOLATION_CODE = "42501";

async function requireSession(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: SIGNED_OUT_MESSAGE };
  return { userId: user.id };
}

/**
 * Submits work against a task.
 *
 * **The submission is the only write this needs.** `006_submission_marks_task_submitted.sql`
 * adds an `after insert` trigger that moves the parent task from 'open' to 'submitted',
 * which is what puts it in Admin-web's queue and what makes grading possible at all
 * (Admin's `gradeSubmission` guards on `.eq('status','submitted')`).
 *
 * That transition deliberately does **not** happen here, even though this is the code
 * that knows a submission just occurred. A student assigned a task has
 * `assigned_to = auth.uid()` but `created_by = <staff>`, and `tasks_update` requires
 * `created_by = auth.uid()` — so this app *cannot* write the status even if it wanted to,
 * and widening that policy would make every task field student-writable. The invariant
 * belongs to the schema, so it lives there; see the migration for the full reasoning.
 *
 * The status is read back afterwards purely to *report* honestly — if the trigger isn't
 * applied to the database this app is pointed at, the student is told the submission
 * saved but hasn't reached anyone, rather than being left to assume it did.
 */
export async function submitTask(
  taskId: string,
  input: SubmissionInput
): Promise<TaskMutationResult> {
  const session = await requireSession();
  if ("error" in session) return session;

  const parsedId = taskIdSchema.safeParse(taskId);
  if (!parsedId.success) return { error: GENERIC_MESSAGE };

  const parsed = submissionSchema.safeParse(input);
  if (!parsed.success) {
    console.error("Submission rejected by validation:", parsed.error.issues);
    return { error: VALIDATION_MESSAGE };
  }

  const supabase = await createClient();

  // Read the task first so an already-submitted or already-graded one is refused with a
  // useful message rather than silently appending a second submission nobody asked for.
  // RLS means a task that isn't this student's simply isn't here.
  const taskResult = await supabase
    .from("tasks")
    .select("id, status")
    .eq("id", parsedId.data)
    .maybeSingle();

  if (taskResult.error) {
    console.error("Task lookup failed:", taskResult.error.code, taskResult.error.message);
    return { error: GENERIC_MESSAGE };
  }
  if (!taskResult.data) return { error: NOT_YOURS_MESSAGE };
  if (taskResult.data.status !== "open") return { error: ALREADY_SUBMITTED_MESSAGE };

  // `user_id` comes from the session, never the client — `submissions_insert` is
  // `user_id = auth.uid()`, so anything else would be rejected anyway, but sending it
  // at all would invite the question.
  const { error } = await supabase.from("submissions").insert({
    task_id: parsedId.data,
    user_id: session.userId,
    content_url: parsed.data.content_url,
  });

  if (error) {
    console.error("Submission insert failed:", error.code, error.message);
    return { error: error.code === RLS_VIOLATION_CODE ? NOT_YOURS_MESSAGE : GENERIC_MESSAGE };
  }

  revalidatePath("/tasks");
  revalidatePath("/dashboard");

  // The work is saved either way — this only decides what the student is told.
  const settled = await supabase
    .from("tasks")
    .select("status")
    .eq("id", parsedId.data)
    .maybeSingle();

  if (!settled.error && settled.data?.status === "open") {
    console.error(
      "Submission saved but its task is still 'open' —",
      "006_submission_marks_task_submitted.sql is probably not applied to this database.",
      { taskId: parsedId.data }
    );
    return {
      error:
        "Your work was saved, but it hasn't been sent for grading yet. Let an admin know before the deadline.",
    };
  }

  return { error: null };
}

/**
 * Creates a task for yourself.
 *
 * Gated on the individual `tasks:create` override, checked here as well as in the UI:
 * a Server Action is reachable by direct POST, so hiding the button gates nothing on its
 * own. RLS refuses it a third time.
 */
export async function createSelfTask(input: SelfTaskInput): Promise<TaskMutationResult> {
  const session = await requireSession();
  if ("error" in session) return session;

  if (!(await canCreateOwnTasks())) return { error: NO_CREATE_PERMISSION_MESSAGE };

  const parsed = selfTaskSchema.safeParse(input);
  if (!parsed.success) {
    console.error("Self-created task rejected by validation:", parsed.error.issues);
    return { error: VALIDATION_MESSAGE };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("tasks").insert({
    title: parsed.data.title,
    description: parsed.data.description,
    // Both from the session: a self-created task is, by definition, assigned to whoever
    // made it. Taking either from the client would let someone assign work to a stranger.
    created_by: session.userId,
    assigned_to: session.userId,
    deadline: bauhavenLocalToInstant(parsed.data.deadline),
    // Never taken from the caller — everything starts open, so nothing can be created
    // pre-submitted or pre-graded.
    status: "open",
    // `project_id` isn't sent at all. The column is nullable with no default, so omitting
    // it stores NULL — the same row Admin-web writes, which also leaves it null because a
    // Project is a separate approvable entity nothing in either app creates yet. Not
    // naming it here keeps Academy's hand-written type subset honest about what it reads.
  });

  if (error) {
    console.error("Self-created task insert failed:", error.code, error.message);
    return {
      error: error.code === RLS_VIOLATION_CODE ? NO_CREATE_PERMISSION_MESSAGE : GENERIC_MESSAGE,
    };
  }

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return { error: null };
}
