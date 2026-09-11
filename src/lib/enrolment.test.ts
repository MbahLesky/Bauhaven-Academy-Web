import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabase, hasFilter, type RecordedOp } from "@/test/fake-supabase";

const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: () => mockCreateClient() }));

// `getLearnerContext` is wrapped in React's `cache`; call straight through in tests.
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, cache: <T,>(fn: T) => fn };
});

import { getLearnerContext, programmeLabel } from "./enrolment";

const ME = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";

function database(enrolments: Record<string, unknown>[], signedIn = true) {
  const fake = createFakeSupabase((op: RecordedOp) => {
    if (op.table === "enrolments") return { data: enrolments };
    if (op.table === "offerings") return { data: [{ id: "o1", title: "Web Development Internship" }] };
    if (op.table === "cohorts") return { data: [{ id: "c1", name: "September 2026" }] };
    return {};
  });
  const client = { ...fake.client, auth: { getUser: () => Promise.resolve({ data: { user: signedIn ? { id: ME } : null } }) } };
  mockCreateClient.mockResolvedValue(client);
  return fake;
}

function enrolment(id: string, status: string, overrides: Record<string, unknown> = {}) {
  return { id, status, offering_id: "o1", cohort_id: "c1", assigned_role: "Intern", created_at: "2026-09-01T09:00:00Z", ...overrides };
}

beforeEach(() => {
  mockCreateClient.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getLearnerContext", () => {
  // The database also shows mentors and staff other people's enrolments.
  it("asks only for the signed-in person's open enrolments", async () => {
    const db = database([]);

    await getLearnerContext();

    const query = db.ops.find((op) => op.table === "enrolments")!;
    expect(hasFilter(query, "eq", "profile_id", ME)).toBe(true);
    expect(hasFilter(query, "in", "status", ["active", "pending_activation", "paused"])).toBe(true);
  });

  it("names the programme and cohort", async () => {
    database([enrolment("e1", "active")]);

    const learner = await getLearnerContext();

    expect(learner?.current).toMatchObject({ programmeTitle: "Web Development Internship", cohortName: "September 2026" });
    expect(programmeLabel(learner!.current!)).toBe("Web Development Internship · September 2026");
  });

  it("puts an active enrolment ahead of one still starting", async () => {
    database([enrolment("pending", "pending_activation"), enrolment("active", "active")]);

    const learner = await getLearnerContext();

    expect(learner?.current?.id).toBe("active");
  });

  it("has no current enrolment for someone not on a programme", async () => {
    database([]);

    const learner = await getLearnerContext();

    expect(learner).toEqual({ userId: ME, enrolments: [], current: null });
  });

  it("is null when nobody is signed in", async () => {
    database([], false);

    await expect(getLearnerContext()).resolves.toBeNull();
  });
});
