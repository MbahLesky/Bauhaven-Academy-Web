import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabase, hasFilter, type RecordedOp } from "@/test/fake-supabase";

const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: () => mockCreateClient() }));

const mockLearner = vi.fn();
vi.mock("@/lib/enrolment", () => ({ getLearnerContext: () => mockLearner() }));

import { getDueSoon, getMyTasks } from "./task-queries";

const ME = "me";

const PUBLISHED = { status: "published", instructions: "Do it", submission_type: "link", allow_resubmission: true, max_resubmissions: null };

function database({
  assignments,
  tasks,
  submissions = [],
  feedback = [],
}: {
  assignments: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  submissions?: Record<string, unknown>[];
  feedback?: Record<string, unknown>[];
}) {
  const fake = createFakeSupabase((op: RecordedOp) => {
    switch (op.table) {
      case "task_assignments":
        return { data: assignments };
      case "tasks":
        return { data: tasks };
      case "submissions":
        return { data: submissions };
      case "participant_feedback":
        return { data: feedback };
      default:
        return {};
    }
  });
  mockCreateClient.mockResolvedValue(fake.client);
  return fake;
}

function assignment(id: string, taskId: string, status = "assigned", due: string | null = null) {
  return { id, task_id: taskId, enrolment_id: "e1", status, due_at_override: due, assigned_at: "2026-09-01T09:00:00Z" };
}

beforeEach(() => {
  mockCreateClient.mockReset();
  mockLearner.mockReset();
  mockLearner.mockResolvedValue({ userId: ME, enrolments: [{ id: "e1" }], current: { id: "e1" } });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getMyTasks", () => {
  // A reviewer can see other people's assignments too; this screen is the learner's own.
  it("reads only the learner's own assignments and submissions", async () => {
    const db = database({ assignments: [assignment("a1", "t1")], tasks: [{ id: "t1", title: "T", due_at: null, ...PUBLISHED }] });

    await getMyTasks();

    expect(hasFilter(db.ops.find((op) => op.table === "task_assignments")!, "in", "enrolment_id", ["e1"])).toBe(true);
    expect(hasFilter(db.ops.find((op) => op.table === "submissions")!, "eq", "participant_id", ME)).toBe(true);
  });

  it("drops an assignment whose task the learner can't see", async () => {
    database({ assignments: [assignment("a1", "hidden")], tasks: [] });

    await expect(getMyTasks()).resolves.toEqual([]);
  });

  it("lets a learner hand in an open task", async () => {
    database({ assignments: [assignment("a1", "t1")], tasks: [{ id: "t1", title: "T", due_at: null, ...PUBLISHED }] });

    const [task] = await getMyTasks();

    expect(task.canSubmit).toBe(true);
  });

  it("offers a resubmission only when changes are requested and allowed", async () => {
    const submissions = [{ id: "s1", task_assignment_id: "a1", version_number: 1, status: "changes_requested", text_content: null, link_url: "https://x", submitted_at: "2026-09-02T09:00:00Z", is_late: false }];
    database({
      assignments: [assignment("a1", "t1", "changes_requested"), assignment("a2", "t2", "changes_requested")],
      tasks: [
        { id: "t1", title: "Allowed", due_at: null, ...PUBLISHED },
        { id: "t2", title: "Not allowed", due_at: null, ...PUBLISHED, allow_resubmission: false },
      ],
      submissions: [...submissions, { ...submissions[0], id: "s2", task_assignment_id: "a2" }],
    });

    const tasks = await getMyTasks();

    expect(tasks.find((task) => task.title === "Allowed")?.canSubmit).toBe(true);
    expect(tasks.find((task) => task.title === "Not allowed")?.canSubmit).toBe(false);
  });

  it("attaches released feedback to the task", async () => {
    database({
      assignments: [assignment("a1", "t1", "completed")],
      tasks: [{ id: "t1", title: "T", due_at: null, ...PUBLISHED }],
      submissions: [{ id: "s1", task_assignment_id: "a1", version_number: 1, status: "accepted", text_content: null, link_url: "https://x", submitted_at: null, is_late: false }],
      feedback: [{ id: "f1", submission_id: "s1", reviewer_name: "Ana", visible_feedback: "Great", result: "accepted", score: 90, released_at: "2026-09-03T09:00:00Z" }],
    });

    const [task] = await getMyTasks();

    expect(task.feedback).toEqual([expect.objectContaining({ reviewer: "Ana", text: "Great", score: 90 })]);
  });

  it("throws rather than show an empty list when the read fails", async () => {
    const fake = createFakeSupabase(() => ({ error: { code: "08006", message: "lost" } }));
    mockCreateClient.mockResolvedValue(fake.client);

    await expect(getMyTasks()).rejects.toThrow("Couldn't load your tasks.");
  });
});

describe("getDueSoon", () => {
  it("lists open tasks soonest first, undated last, finished ones not at all", async () => {
    database({
      assignments: [
        assignment("later", "t1", "assigned", "2026-09-20T09:00:00Z"),
        assignment("undated", "t2"),
        assignment("sooner", "t3", "assigned", "2026-09-12T09:00:00Z"),
        assignment("done", "t4", "completed", "2026-09-10T09:00:00Z"),
      ],
      tasks: ["t1", "t2", "t3", "t4"].map((id) => ({ id, title: id, due_at: null, ...PUBLISHED })),
    });

    const tasks = await getDueSoon(5);

    expect(tasks.map((task) => task.assignmentId)).toEqual(["sooner", "later", "undated"]);
  });
});
