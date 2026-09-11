import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabase, hasFilter, type FakeResult, type RecordedOp } from "@/test/fake-supabase";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: () => mockCreateClient() }));

const mockLearner = vi.fn();
vi.mock("@/lib/enrolment", () => ({ getLearnerContext: () => mockLearner() }));

import { submitWork } from "./task-actions";

const ME = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
const ASSIGNMENT = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const ENROLMENT = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";
const KEY = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";

const LINK = { text_content: null, link_url: "https://github.com/sam/portfolio" };

interface Setup {
  assignmentStatus?: string;
  enrolmentId?: string;
  task?: Record<string, unknown> | null;
  versions?: { id: string; version_number: number; status: string }[];
  retried?: { id: string; status: string } | null;
  writeError?: FakeResult["error"];
}

function database({
  assignmentStatus = "assigned",
  enrolmentId = ENROLMENT,
  task = { status: "published", submission_type: "link", allow_resubmission: true, max_resubmissions: null },
  versions = [],
  retried = null,
  writeError = null,
}: Setup = {}) {
  const fake = createFakeSupabase((op: RecordedOp) => {
    if (op.table === "submissions" && op.action === "select") {
      return hasFilter(op, "eq", "idempotency_key", KEY) ? { data: retried } : { data: versions };
    }
    if (op.table === "task_assignments") {
      return { data: { id: ASSIGNMENT, task_id: "task-1", enrolment_id: enrolmentId, status: assignmentStatus } };
    }
    if (op.table === "tasks") return { data: task };
    return { error: writeError };
  });
  mockCreateClient.mockResolvedValue(fake.client);
  return fake;
}

beforeEach(() => {
  mockCreateClient.mockReset();
  mockLearner.mockReset();
  mockLearner.mockResolvedValue({ userId: ME, enrolments: [{ id: ENROLMENT }], current: { id: ENROLMENT } });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("submitWork", () => {
  it("hands in a first version as the signed-in learner", async () => {
    const db = database();

    await expect(submitWork(ASSIGNMENT, LINK, KEY)).resolves.toEqual({ error: null });

    const [write] = db.writes();
    expect(write.action).toBe("insert");
    expect(write.payload).toMatchObject({
      task_assignment_id: ASSIGNMENT,
      participant_id: ME,
      version_number: 1,
      status: "submitted",
      link_url: LINK.link_url,
      idempotency_key: KEY,
    });
  });

  it("numbers a resubmission after the last version", async () => {
    const db = database({
      assignmentStatus: "changes_requested",
      versions: [{ id: "s1", version_number: 1, status: "changes_requested" }],
    });

    await submitWork(ASSIGNMENT, LINK, KEY);

    expect(db.writes()[0].payload).toMatchObject({ version_number: 2 });
  });

  // A draft saved in the mobile app is what gets handed in, not a second version beside it.
  it("hands in a draft saved on the phone rather than adding a version", async () => {
    const db = database({ versions: [{ id: "draft-1", version_number: 1, status: "draft" }] });

    await submitWork(ASSIGNMENT, LINK, KEY);

    const [write] = db.writes();
    expect(write.action).toBe("update");
    expect(write.payload).toMatchObject({ status: "submitted" });
    expect(hasFilter(write, "eq", "id", "draft-1")).toBe(true);
  });

  // The crash-and-retry case: the server accepted it, the response never arrived.
  it("writes nothing on a retry of something already accepted", async () => {
    const db = database({ retried: { id: "s1", status: "submitted" } });

    await expect(submitWork(ASSIGNMENT, LINK, KEY)).resolves.toEqual({ error: null });
    expect(db.writes()).toEqual([]);
  });

  it("refuses an assignment that isn't one of the learner's", async () => {
    const db = database({ enrolmentId: "someone-elses-enrolment" });

    const result = await submitWork(ASSIGNMENT, LINK, KEY);

    expect(result.error).toMatch(/can't hand in work for this task/i);
    expect(db.writes()).toEqual([]);
  });

  it("refuses work already with the mentor", async () => {
    const db = database({ assignmentStatus: "submitted" });

    const result = await submitWork(ASSIGNMENT, LINK, KEY);

    expect(result.error).toMatch(/isn't taking submissions/i);
    expect(db.writes()).toEqual([]);
  });

  it("asks for what the task needs", async () => {
    const db = database({ task: { status: "published", submission_type: "text", allow_resubmission: true, max_resubmissions: null } });

    const result = await submitWork(ASSIGNMENT, LINK, KEY);

    expect(result.error).toMatch(/write your answer/i);
    expect(db.writes()).toEqual([]);
  });

  it("stops at the resubmission limit", async () => {
    const db = database({
      assignmentStatus: "changes_requested",
      task: { status: "published", submission_type: "link", allow_resubmission: true, max_resubmissions: 1 },
      versions: [
        { id: "s2", version_number: 2, status: "changes_requested" },
        { id: "s1", version_number: 1, status: "changes_requested" },
      ],
    });

    const result = await submitWork(ASSIGNMENT, LINK, KEY);

    expect(result.error).toMatch(/can't be handed in again/i);
    expect(db.writes()).toEqual([]);
  });

  it("refuses a link that isn't a web address without touching the database", async () => {
    const db = database();

    const result = await submitWork(ASSIGNMENT, { text_content: null, link_url: "github.com/sam" }, KEY);

    expect(result.error).toMatch(/check what you're handing in/i);
    expect(db.ops).toEqual([]);
  });

  it("explains a version race in plain words", async () => {
    database({ writeError: { code: "23505", message: "duplicate" } });

    const result = await submitWork(ASSIGNMENT, LINK, KEY);

    expect(result.error).toMatch(/at the same moment/i);
  });

  it("refuses a signed-out caller", async () => {
    mockLearner.mockResolvedValue(null);
    const db = database();

    const result = await submitWork(ASSIGNMENT, LINK, KEY);

    expect(result.error).toMatch(/session has expired/i);
    expect(db.ops).toEqual([]);
  });
});
