import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabase, type FakeResult } from "@/test/fake-supabase";
import { absenceRequestSchema, type AbsenceRequestInput } from "./schemas/request";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: () => mockCreateClient() }));

const mockLearner = vi.fn();
vi.mock("@/lib/enrolment", () => ({ getLearnerContext: () => mockLearner() }));

let requestsReady = true;
vi.mock("@/lib/database-readiness", () => ({ isDatabaseReady: () => requestsReady }));

import { submitAbsenceRequest } from "./request-actions";

const ME = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
const ENROLMENT = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";

function database(insertResult: FakeResult = {}) {
  const fake = createFakeSupabase(() => insertResult);
  mockCreateClient.mockResolvedValue(fake.client);
  return fake;
}

function input(overrides: Partial<AbsenceRequestInput> = {}): AbsenceRequestInput {
  return { start_date: "2026-08-06", end_date: "2026-08-07", reason: "Family event out of town", ...overrides };
}

beforeEach(() => {
  requestsReady = true;
  mockCreateClient.mockReset();
  mockLearner.mockReset();
  mockLearner.mockResolvedValue({ userId: ME, enrolments: [{ id: ENROLMENT }], current: { id: ENROLMENT } });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("submitAbsenceRequest", () => {
  // The enrolment is what routes a learner's request to the programme's coordinators.
  it("records the request against the learner and their enrolment", async () => {
    const db = database();

    await expect(submitAbsenceRequest(input())).resolves.toEqual({ error: null });

    expect(db.writes()[0]).toMatchObject({
      table: "absence_requests",
      action: "insert",
      payload: {
        requester_id: ME,
        enrolment_id: ENROLMENT,
        type: "absence",
        start_date: "2026-08-06",
        end_date: "2026-08-07",
        reason: "Family event out of town",
      },
    });
  });

  it("takes requester_id from the session, not from the caller", async () => {
    const db = database();

    await submitAbsenceRequest({ ...input(), requester_id: "00000000-0000-4000-8000-000000000000" } as AbsenceRequestInput);

    expect(db.writes()[0].payload).toMatchObject({ requester_id: ME });
  });

  // Deciding is the other side's job; the column default says pending.
  it("sends no status", async () => {
    const db = database();

    await submitAbsenceRequest(input());

    expect(db.writes()[0].payload).not.toHaveProperty("status");
  });

  it("refuses everything while absence requests aren't switched on", async () => {
    requestsReady = false;
    const db = database();

    const result = await submitAbsenceRequest(input());

    expect(result.error).toMatch(/aren't available yet/i);
    expect(db.ops).toEqual([]);
  });

  it("refuses a signed-out caller without writing", async () => {
    mockLearner.mockResolvedValue(null);
    const db = database();

    const result = await submitAbsenceRequest(input());

    expect(result.error).toMatch(/session has expired/i);
    expect(db.ops).toEqual([]);
  });

  it("rejects a backwards date range without touching the database", async () => {
    const db = database();

    const result = await submitAbsenceRequest(input({ start_date: "2026-08-07", end_date: "2026-08-06" }));

    expect(result.error).toMatch(/check the dates/i);
    expect(db.ops).toEqual([]);
  });

  it("reports a refusal in plain language", async () => {
    database({ error: { code: "42501", message: "rls" } });

    const result = await submitAbsenceRequest(input());

    expect(result.error).toMatch(/wasn't accepted/i);
    expect(result.error).not.toMatch(/42501|policy|violat/i);
  });
});

describe("absenceRequestSchema", () => {
  it("accepts a single-day absence", () => {
    expect(absenceRequestSchema.safeParse(input({ start_date: "2026-08-06", end_date: "2026-08-06" })).success).toBe(true);
  });

  /** "I was ill yesterday" is an ordinary request, not an edge case to block. */
  it("accepts a date in the past", () => {
    expect(absenceRequestSchema.safeParse(input({ start_date: "2020-01-01", end_date: "2020-01-02" })).success).toBe(true);
  });

  it("catches a mistyped year as an implausibly long absence", () => {
    expect(absenceRequestSchema.safeParse(input({ start_date: "2026-08-06", end_date: "2062-08-07" })).success).toBe(false);
  });
});
