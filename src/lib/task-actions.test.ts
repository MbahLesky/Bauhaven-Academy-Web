import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSelfTask, submitTask } from "./task-actions";
import { EMPTY_SELF_TASK, type SelfTaskInput, type SubmissionInput } from "./schemas/task";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockCanCreate = vi.fn();
vi.mock("@/lib/task-permissions", () => ({ canCreateOwnTasks: () => mockCanCreate() }));

const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: () => mockCreateClient() }));

const TASK_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const STUDENT_ID = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
const STAFF_ID = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";

const VALID_SUBMISSION: SubmissionInput = { content_url: "https://github.com/sam/landing-page" };

const VALID_SELF_TASK: SelfTaskInput = {
  ...EMPTY_SELF_TASK,
  title: "Personal portfolio site",
};

/**
 * A stand-in for the database that models the one thing this feature turns on: the
 * `after insert on submissions` trigger from
 * `006_submission_marks_task_submitted.sql`, which advances the parent task from 'open'
 * to 'submitted'.
 *
 * `triggerApplied: false` simulates a database that hasn't had `006` run against it —
 * the state the two apps were silently in before this feature was built.
 */
function fakeDatabase({
  taskStatus = "open" as "open" | "submitted" | "graded",
  taskExists = true,
  triggerApplied = true,
  insertError = null as { code: string } | null,
} = {}) {
  const tasks = new Map<string, { id: string; status: string }>();
  if (taskExists) tasks.set(TASK_ID, { id: TASK_ID, status: taskStatus });

  const submissions: Record<string, unknown>[] = [];
  const insertedTasks: Record<string, unknown>[] = [];
  /** Every UPDATE attempted against `tasks` by app code, as opposed to by the trigger. */
  const taskUpdates: Record<string, unknown>[] = [];

  const client = {
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: STUDENT_ID } } }),
    },
    from(table: string) {
      if (table === "tasks") {
        return {
          select: () => ({
            eq: (_column: string, value: string) => ({
              maybeSingle: () =>
                Promise.resolve({ data: tasks.get(value) ?? null, error: null }),
            }),
          }),
          insert: (row: Record<string, unknown>) => {
            insertedTasks.push(row);
            return Promise.resolve({ error: insertError });
          },
          update: (values: Record<string, unknown>) => {
            taskUpdates.push(values);
            return { eq: () => Promise.resolve({ error: null }) };
          },
        };
      }

      if (table === "submissions") {
        return {
          insert: (row: Record<string, unknown>) => {
            if (insertError) return Promise.resolve({ error: insertError });
            submissions.push(row);

            // The trigger, modelled: same guard as the SQL — only 'open' advances.
            if (triggerApplied) {
              const task = tasks.get(row.task_id as string);
              if (task?.status === "open") task.status = "submitted";
            }

            return Promise.resolve({ error: null });
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };

  mockCreateClient.mockResolvedValue(client);
  return { tasks, submissions, insertedTasks, taskUpdates };
}

beforeEach(() => {
  mockCreateClient.mockReset();
  mockCanCreate.mockReset();
  mockCanCreate.mockResolvedValue(true);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("submitTask", () => {
  it("saves the link against the task, stamped with the session's user", async () => {
    const db = fakeDatabase();

    await expect(submitTask(TASK_ID, VALID_SUBMISSION)).resolves.toEqual({ error: null });

    expect(db.submissions).toHaveLength(1);
    expect(db.submissions[0]).toEqual({
      task_id: TASK_ID,
      // Never taken from the client — `submissions_insert` is `user_id = auth.uid()`.
      user_id: STUDENT_ID,
      content_url: VALID_SUBMISSION.content_url,
    });
  });

  /**
   * **The cross-app seam.** Admin-web's "Submitted" tab filters on
   * `tasks.status === 'submitted'`, and its `gradeSubmission` guards on
   * `.eq('status','submitted')` — so a submission that leaves the task 'open' is
   * invisible to staff *and* ungradeable, with no error on either side.
   *
   * Asserted as the state Admin-web actually queries, not as "the action returned ok".
   */
  it("leaves the task in the state Admin-web's Submitted queue looks for", async () => {
    const db = fakeDatabase({ taskStatus: "open" });

    await submitTask(TASK_ID, VALID_SUBMISSION);

    expect(db.tasks.get(TASK_ID)?.status).toBe("submitted");

    // Admin-web's filter, applied literally to what's now in the table.
    const adminSubmittedTab = [...db.tasks.values()].filter((task) => task.status === "submitted");
    expect(adminSubmittedTab).toHaveLength(1);

    // And Admin's grading guard would now match this row rather than zero rows.
    const gradeable = [...db.tasks.values()].filter(
      (task) => task.id === TASK_ID && task.status === "submitted"
    );
    expect(gradeable).toHaveLength(1);
  });

  /**
   * The transition is the database's job, not this app's. A student assigned a task has
   * `created_by = <staff>`, and `tasks_update` requires `created_by = auth.uid()` — so an
   * app-level update here would be rejected by RLS anyway, and asking for the policy to
   * be widened would make every task field student-writable.
   */
  it("never tries to update the task itself", async () => {
    const db = fakeDatabase();

    await submitTask(TASK_ID, VALID_SUBMISSION);

    expect(db.taskUpdates).toEqual([]);
  });

  /**
   * If `006` isn't applied, the work is still saved — but the student is told it hasn't
   * reached anyone, rather than being left to assume it has. Silence here is the failure
   * mode this whole feature exists to close.
   */
  it("says so when the submission saved but the task never advanced", async () => {
    const db = fakeDatabase({ triggerApplied: false });

    const result = await submitTask(TASK_ID, VALID_SUBMISSION);

    // Saved — not rolled back.
    expect(db.submissions).toHaveLength(1);
    // But reported honestly.
    expect(result.error).toMatch(/hasn't been sent for grading/i);
  });

  it("refuses a task that isn't open any more, without a second submission", async () => {
    const db = fakeDatabase({ taskStatus: "submitted" });

    const result = await submitTask(TASK_ID, VALID_SUBMISSION);

    expect(result.error).toMatch(/isn't open for submissions/i);
    expect(db.submissions).toHaveLength(0);
  });

  it("refuses a graded task", async () => {
    const db = fakeDatabase({ taskStatus: "graded" });

    const result = await submitTask(TASK_ID, VALID_SUBMISSION);

    expect(result.error).toMatch(/isn't open for submissions/i);
    expect(db.submissions).toHaveLength(0);
  });

  // RLS means someone else's task simply isn't in the result set — there's nothing to
  // distinguish "not yours" from "deleted", and the message says so rather than guessing.
  it("refuses a task RLS doesn't return", async () => {
    const db = fakeDatabase({ taskExists: false });

    const result = await submitTask(TASK_ID, VALID_SUBMISSION);

    expect(result.error).toMatch(/may not be assigned to you/i);
    expect(db.submissions).toHaveLength(0);
  });

  it("rejects a link that isn't a URL", async () => {
    const db = fakeDatabase();

    const result = await submitTask(TASK_ID, { content_url: "github.com/sam/work" });

    expect(result.error).toMatch(/check the form/i);
    expect(db.submissions).toHaveLength(0);
  });

  it("rejects an empty submission", async () => {
    const db = fakeDatabase();

    const result = await submitTask(TASK_ID, { content_url: "   " });

    expect(result.error).toMatch(/check the form/i);
    expect(db.submissions).toHaveLength(0);
  });

  it("rejects a malformed task reference without touching the database", async () => {
    const db = fakeDatabase();

    const result = await submitTask("not-a-uuid", VALID_SUBMISSION);

    expect(result.error).not.toBeNull();
    expect(db.submissions).toHaveLength(0);
  });
});

describe("createSelfTask", () => {
  /**
   * The individual `tasks:create` override, enforced server-side. A Server Action is
   * reachable by direct POST, so the hidden "+ New task" link is not the boundary.
   */
  it("refuses a student without the permission override", async () => {
    mockCanCreate.mockResolvedValue(false);
    const db = fakeDatabase();

    const result = await createSelfTask(VALID_SELF_TASK);

    expect(result.error).toMatch(/don't have permission/i);
    expect(db.insertedTasks).toHaveLength(0);
  });

  it("creates one for a student who holds the override", async () => {
    const db = fakeDatabase();

    await expect(createSelfTask(VALID_SELF_TASK)).resolves.toEqual({ error: null });
    expect(db.insertedTasks).toHaveLength(1);
  });

  // Self-created means author and assignee are the same person, both from the session —
  // taking either from the client would let someone assign work to a stranger.
  it("assigns the task to its creator, both from the session", async () => {
    const db = fakeDatabase();

    await createSelfTask(VALID_SELF_TASK);

    expect(db.insertedTasks[0]).toMatchObject({
      created_by: STUDENT_ID,
      assigned_to: STUDENT_ID,
    });
    expect(db.insertedTasks[0].created_by).not.toBe(STAFF_ID);
  });

  it("always starts open, never taking status from the caller", async () => {
    const db = fakeDatabase();

    await createSelfTask(VALID_SELF_TASK);

    expect(db.insertedTasks[0].status).toBe("open");
  });

  // WAT is UTC+1 with no DST, so 23:59 typed by a student in Douala is 22:59Z.
  it("reads the deadline as Cameroon time, not the browser's", async () => {
    const db = fakeDatabase();

    await createSelfTask({ ...VALID_SELF_TASK, deadline: "2026-08-06T23:59" });

    expect(db.insertedTasks[0].deadline).toBe("2026-08-06T22:59:00.000Z");
  });

  it("stores no deadline when none was given", async () => {
    const db = fakeDatabase();

    await createSelfTask({ ...VALID_SELF_TASK, deadline: null });

    expect(db.insertedTasks[0].deadline).toBeNull();
  });

  it("requires a title", async () => {
    const db = fakeDatabase();

    const result = await createSelfTask({ ...VALID_SELF_TASK, title: "  " });

    expect(result.error).toMatch(/check the form/i);
    expect(db.insertedTasks).toHaveLength(0);
  });

  it("translates an RLS refusal into the permission message, not the code", async () => {
    fakeDatabase({ insertError: { code: "42501" } });

    const result = await createSelfTask(VALID_SELF_TASK);

    expect(result.error).toMatch(/don't have permission/i);
    expect(result.error).not.toMatch(/42501/);
  });
});
