import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDeadline } from "@/lib/date-format";
import { getLearnerContext } from "@/lib/enrolment";
import { isOpen } from "@/lib/task-format";
import type { AssignmentStatus, SubmissionStatus } from "@/types/database";

/**
 * Every read of a learner's own tasks, in one place, so Home's "Due soon" and the Tasks
 * screen can't disagree about what's open or how a deadline reads.
 *
 * On the live database a task is written once and **assigned**: each learner has a
 * `task_assignments` row carrying their own progress, and hands in versioned
 * `submissions` against it. Feedback is read from `participant_feedback`, which shows
 * only released feedback and never a reviewer's private note.
 *
 * Assignments are filtered to the learner's own enrolments explicitly: the database also
 * shows a reviewer the assignments they review.
 */

export interface SubmissionSummary {
  id: string;
  version: number;
  status: SubmissionStatus;
  text: string | null;
  link: string | null;
  submittedOn: string | null;
  isLate: boolean;
}

export interface FeedbackSummary {
  id: string;
  reviewer: string;
  text: string | null;
  result: string | null;
  score: number | null;
  releasedOn: string | null;
}

export interface MyTask {
  assignmentId: string;
  title: string;
  instructions: string;
  submissionType: string;
  status: AssignmentStatus;
  /** The raw due instant (the assignment's override, else the task's), for sorting. */
  dueAt: string | null;
  /** Preformatted in Bauhaven's timezone. */
  due: string | null;
  /** The learner may hand this in now (or hand it in again). */
  canSubmit: boolean;
  /** Newest first. */
  submissions: SubmissionSummary[];
  /** Released feedback on any version, newest first. */
  feedback: FeedbackSummary[];
}

const ASSIGNMENT_COLUMNS = "id, task_id, enrolment_id, status, due_at_override, assigned_at";
const TASK_COLUMNS = "id, title, instructions, status, due_at, submission_type, allow_resubmission, max_resubmissions";

/**
 * The Tasks screen: every task assigned to the learner, with their submissions and released
 * feedback. Throws on a failed read — an empty list would say "you have no tasks".
 */
export async function getMyTasks(): Promise<MyTask[]> {
  const learner = await getLearnerContext();
  if (!learner || learner.enrolments.length === 0) return [];

  const supabase = await createClient();

  const assignmentsResult = await supabase
    .from("task_assignments")
    .select(ASSIGNMENT_COLUMNS)
    .in(
      "enrolment_id",
      learner.enrolments.map((enrolment) => enrolment.id)
    )
    .neq("status", "cancelled")
    .order("assigned_at", { ascending: false });

  if (assignmentsResult.error) fail("Assignments", assignmentsResult.error);
  const assignments = assignmentsResult.data ?? [];
  if (assignments.length === 0) return [];

  const [tasksResult, submissionsResult] = await Promise.all([
    supabase
      .from("tasks")
      .select(TASK_COLUMNS)
      .in("id", [...new Set(assignments.map((assignment) => assignment.task_id))]),
    supabase
      .from("submissions")
      .select("id, task_assignment_id, version_number, status, text_content, link_url, submitted_at, is_late")
      .eq("participant_id", learner.userId)
      .in(
        "task_assignment_id",
        assignments.map((assignment) => assignment.id)
      )
      .order("version_number", { ascending: false }),
  ]);

  if (tasksResult.error) fail("Tasks", tasksResult.error);
  if (submissionsResult.error) fail("Submissions", submissionsResult.error);

  const submissions = submissionsResult.data ?? [];
  const feedback = await getReleasedFeedback(submissions.map((submission) => submission.id));

  // A task the learner can't see (not published) drops out: the database shows learners
  // published tasks only, so an assignment without its task isn't something to act on.
  const tasks = new Map((tasksResult.data ?? []).map((task) => [task.id, task]));

  return assignments.flatMap((assignment): MyTask[] => {
    const task = tasks.get(assignment.task_id);
    if (!task) return [];

    const versions = submissions
      .filter((submission) => submission.task_assignment_id === assignment.id)
      .map((submission) => ({
        id: submission.id,
        version: submission.version_number,
        status: submission.status,
        text: submission.text_content,
        link: submission.link_url,
        submittedOn: formatDate(submission.submitted_at),
        isLate: submission.is_late,
      }));

    const dueAt = assignment.due_at_override ?? task.due_at;
    const handedIn = versions.filter((version) => version.status !== "draft").length;
    const withinResubmissions = task.max_resubmissions === null || handedIn <= task.max_resubmissions;

    return [
      {
        assignmentId: assignment.id,
        title: task.title,
        instructions: task.instructions,
        submissionType: task.submission_type,
        status: assignment.status,
        dueAt,
        due: formatDeadline(dueAt),
        canSubmit:
          task.status === "published" &&
          task.submission_type !== "none" &&
          isOpen(assignment.status) &&
          (handedIn === 0 || (task.allow_resubmission && withinResubmissions)),
        submissions: versions,
        feedback: versions.flatMap((version) => feedback.get(version.id) ?? []),
      },
    ];
  });
}

/** Home's preview: the next few open tasks by due date, undated ones last. */
export async function getDueSoon(limit: number): Promise<MyTask[]> {
  const tasks = await getMyTasks();

  return tasks
    .filter((task) => isOpen(task.status))
    .sort((a, b) => {
      if (a.dueAt === b.dueAt) return 0;
      if (a.dueAt === null) return 1;
      if (b.dueAt === null) return -1;
      return a.dueAt.localeCompare(b.dueAt);
    })
    .slice(0, limit);
}

/**
 * Released feedback on the given submissions. Degrades to "none shown" rather than failing
 * the page: the task and the learner's own work are still worth seeing without it.
 */
async function getReleasedFeedback(submissionIds: string[]): Promise<Map<string, FeedbackSummary[]>> {
  const bySubmission = new Map<string, FeedbackSummary[]>();
  if (submissionIds.length === 0) return bySubmission;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("participant_feedback")
    .select("id, submission_id, reviewer_name, visible_feedback, result, score, released_at")
    .in("submission_id", submissionIds)
    .order("released_at", { ascending: false });

  if (error) {
    console.error("Feedback lookup failed:", error.code, error.message);
    return bySubmission;
  }

  for (const row of data) {
    if (!row.id || !row.submission_id) continue;
    const entry = {
      id: row.id,
      reviewer: row.reviewer_name || "Your mentor",
      text: row.visible_feedback,
      result: row.result,
      score: row.score,
      releasedOn: formatDate(row.released_at),
    };
    const existing = bySubmission.get(row.submission_id);
    if (existing) existing.push(entry);
    else bySubmission.set(row.submission_id, [entry]);
  }

  return bySubmission;
}

function fail(what: string, error: { code?: string; message: string }): never {
  console.error(`${what} query failed:`, error.code, error.message);
  throw new Error("Couldn't load your tasks.");
}
