import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDeadline } from "@/lib/date-format";
import type { TaskStatus } from "@/lib/schemas/task";

/**
 * Every read of a student's own tasks, in one place.
 *
 * **RLS does the scoping.** `tasks_select` is
 * `assigned_to = auth.uid() or created_by = auth.uid() or auth_is_admin_or_staff()`, so a
 * student's session already sees exactly their own rows. Adding `.eq("assigned_to", …)`
 * on top would be duplicating the policy in the client — which
 * `Bauhaven-Coding-Standards.md` rules out, and which would also silently hide a
 * self-created task, since those are matched by `created_by`, not `assigned_to`.
 *
 * The Home screen's "Due soon" preview and the Tasks screen read through the same
 * functions here rather than each writing their own query, so the two can't start
 * disagreeing about what counts as open or how a deadline is rendered.
 */

/** The columns every task view needs. Kept together so the two callers can't drift. */
const TASK_COLUMNS = "id, title, description, assigned_to, created_by, deadline, status";

export interface TaskSummary {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  /** Preformatted in Bauhaven's timezone; null when the task has no deadline. */
  deadline: string | null;
  /**
   * Created by the student themselves, via the individual `tasks:create` override.
   * The wireframe flags these distinctly from staff-assigned work.
   */
  isSelfCreated: boolean;
}

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  created_by: string;
  deadline: string | null;
  status: TaskStatus;
}

function toSummary(row: TaskRow, currentUserId: string | null): TaskSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    deadline: formatDeadline(row.deadline),
    // Self-created means the student is both author and assignee. Comparing against the
    // session rather than assuming any row RLS returned is theirs keeps this honest if
    // an Admin ever loads the same screen.
    isSelfCreated: currentUserId !== null && row.created_by === currentUserId,
  };
}

/**
 * The Home screen's "Due soon" preview: the next few open tasks by deadline.
 *
 * Tasks with no deadline sort last — `nullsFirst: false` — because "due soon" is a list
 * about urgency, and an undated self-created task has none.
 */
export async function getOpenTasksPreview(limit: number): Promise<{
  tasks: TaskSummary[];
  error: unknown;
}> {
  const supabase = await createClient();

  const [{ data, error }, currentUserId] = await Promise.all([
    supabase
      .from("tasks")
      .select(TASK_COLUMNS)
      .eq("status", "open")
      .order("deadline", { ascending: true, nullsFirst: false })
      .limit(limit),
    getCurrentUserId(),
  ]);

  if (error) return { tasks: [], error };

  return { tasks: (data as TaskRow[]).map((row) => toSummary(row, currentUserId)), error: null };
}

export interface SubmissionSummary {
  /** The link the student submitted. */
  contentUrl: string | null;
  submittedOn: string | null;
  /** Free text — "88%", "A-", "Pass". Null until a grader writes one. */
  grade: string | null;
  /** What the grader wrote back, newest last. Empty until someone has commented. */
  feedback: { id: string; comment: string; rating: number | null }[];
}

export interface TaskWithSubmission extends TaskSummary {
  /** Null when nothing has been submitted for this task yet. */
  submission: SubmissionSummary | null;
}

/**
 * The Tasks screen: every task this student can see, with the latest submission and its
 * feedback attached.
 *
 * Three queries matched in memory rather than embedded joins, consistent with how every
 * list in this product is built: a fixed number of round trips regardless of row count,
 * and no hand-written PostgREST relationship in a types file due to be regenerated.
 */
export async function getMyTasks(): Promise<{ tasks: TaskWithSubmission[]; error: unknown }> {
  const supabase = await createClient();

  const [tasksResult, currentUserId] = await Promise.all([
    supabase
      .from("tasks")
      .select(TASK_COLUMNS)
      // Newest first. Archived rows are excluded — they're retired work, and nothing in
      // Academy archives a task, so any that appear came from elsewhere.
      .neq("status", "archived")
      .order("created_at", { ascending: false }),
    getCurrentUserId(),
  ]);

  if (tasksResult.error) return { tasks: [], error: tasksResult.error };

  const rows = tasksResult.data as TaskRow[];
  if (rows.length === 0) return { tasks: [], error: null };

  // `submissions_select` is `user_id = auth.uid() or admin/staff`, so this is already
  // scoped to the student's own work without an explicit filter.
  const submissionsResult = await supabase
    .from("submissions")
    .select("id, task_id, content_url, submitted_at, grade")
    .in(
      "task_id",
      rows.map((row) => row.id)
    )
    .order("submitted_at", { ascending: false });

  if (submissionsResult.error) return { tasks: [], error: submissionsResult.error };

  // Newest per task. A resubmission is a new row — `submissions` has no student-writable
  // update path — and Admin-web grades the newest too, so both apps look at the same one.
  const latestByTask = new Map<string, (typeof submissionsResult.data)[number]>();
  for (const submission of submissionsResult.data) {
    if (!latestByTask.has(submission.task_id)) latestByTask.set(submission.task_id, submission);
  }

  const feedbackBySubmission = await getFeedback(
    [...latestByTask.values()].map((submission) => submission.id)
  );

  const tasks: TaskWithSubmission[] = rows.map((row) => {
    const submission = latestByTask.get(row.id);

    return {
      ...toSummary(row, currentUserId),
      submission: submission
        ? {
            contentUrl: submission.content_url,
            submittedOn: formatDate(submission.submitted_at),
            grade: submission.grade,
            feedback: feedbackBySubmission.get(submission.id) ?? [],
          }
        : null,
    };
  });

  return { tasks, error: null };
}

/**
 * Feedback on the given submissions.
 *
 * `feedback_select` lets a student read comments on their own submissions, so no explicit
 * filter is needed. Degrades to "no feedback shown" rather than failing the page: a grade
 * with the comment missing is still worth seeing, and the alternative is a blank screen.
 */
async function getFeedback(submissionIds: string[]) {
  const bySubmission = new Map<string, { id: string; comment: string; rating: number | null }[]>();
  if (submissionIds.length === 0) return bySubmission;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feedback")
    .select("id, submission_id, comment, rating, created_at")
    .in("submission_id", submissionIds)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Feedback lookup failed:", error.code, error.message);
    return bySubmission;
  }

  for (const row of data) {
    const existing = bySubmission.get(row.submission_id);
    const entry = { id: row.id, comment: row.comment, rating: row.rating };
    if (existing) existing.push(entry);
    else bySubmission.set(row.submission_id, [entry]);
  }

  return bySubmission;
}

async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
