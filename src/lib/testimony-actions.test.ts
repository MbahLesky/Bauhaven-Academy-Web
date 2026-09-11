import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabase, type FakeResult, type RecordedOp } from "@/test/fake-supabase";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: () => mockCreateClient() }));

const mockLearner = vi.fn();
vi.mock("@/lib/enrolment", () => ({ getLearnerContext: () => mockLearner() }));

import { submitTestimony } from "./testimony-actions";

const ME = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
const INPUT = {
  content: "This bootcamp completely changed how I think about building things.",
  rating: 5,
  allow_public_use: true,
};

function database(insertResult: FakeResult = {}) {
  const fake = createFakeSupabase((op: RecordedOp) =>
    op.table === "profiles" ? { data: { full_name: "Sam Student" } } : insertResult
  );
  mockCreateClient.mockResolvedValue(fake.client);
  return fake;
}

function asLearner(assignedRole = "Student") {
  mockLearner.mockResolvedValue({ userId: ME, enrolments: [{ id: "e1" }], current: { id: "e1", assignedRole } });
}

beforeEach(() => {
  mockCreateClient.mockReset();
  mockLearner.mockReset();
  asLearner();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("submitTestimony", () => {
  it("stores the feedback with the website's reviews, under the learner's name", async () => {
    const db = database();

    await expect(submitTestimony(INPUT)).resolves.toEqual({ error: null });

    const [write] = db.writes();
    expect(write.table).toBe("website_reviews");
    expect(write.payload).toEqual({
      user_id: ME,
      full_name: "Sam Student",
      email: null,
      user_type: "Student",
      category: "Courses & programs",
      message: INPUT.content,
      rating: 5,
      allow_public_use: true,
    });
  });

  // The team already has the learner's address; a review isn't the place to copy it.
  it("never copies the learner's email", async () => {
    const db = database();

    await submitTestimony(INPUT);

    expect(db.writes()[0].payload).toMatchObject({ email: null });
  });

  it("files an intern's feedback as an intern's", async () => {
    asLearner("Intern");
    const db = database();

    await submitTestimony(INPUT);

    expect(db.writes()[0].payload).toMatchObject({ user_type: "Intern" });
  });

  it("stores only the consent the learner gave", async () => {
    const db = database();

    await submitTestimony({ ...INPUT, allow_public_use: false });

    expect(db.writes()[0].payload).toMatchObject({ allow_public_use: false });
  });

  it("refuses a signed-out caller without writing", async () => {
    mockLearner.mockResolvedValue(null);
    const db = database();

    const result = await submitTestimony(INPUT);

    expect(result.error).toMatch(/session has expired/i);
    expect(db.ops).toEqual([]);
  });

  it("refuses something too short without writing", async () => {
    const db = database();

    const result = await submitTestimony({ ...INPUT, content: "Good" });

    expect(result.error).toMatch(/check what you've written/i);
    expect(db.ops).toEqual([]);
  });

  it("reports a failed save in plain words", async () => {
    database({ error: { code: "XX000", message: "boom" } });

    const result = await submitTestimony(INPUT);

    expect(result.error).toMatch(/couldn't send that/i);
  });
});
