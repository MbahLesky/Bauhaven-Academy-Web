import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabase, type FakeResult } from "@/test/fake-supabase";
import { issueReportSchema, type IssueReportInput } from "./schemas/issue-report";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: () => mockCreateClient() }));

const mockLearner = vi.fn();
vi.mock("@/lib/enrolment", () => ({ getLearnerContext: () => mockLearner() }));

let reportsReady = true;
vi.mock("@/lib/database-readiness", () => ({ isDatabaseReady: () => reportsReady }));

import { submitIssueReport } from "./issue-report-actions";

const ME = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
const OFFERING = "6f9c1d5b-0e4a-4b8d-9f2c-3d4e5f607182";

function database(insertResult: FakeResult = {}) {
  const fake = createFakeSupabase(() => insertResult);
  mockCreateClient.mockResolvedValue(fake.client);
  return fake;
}

function input(overrides: Partial<IssueReportInput> = {}): IssueReportInput {
  return { category: "equipment", description: "Projector in Room 2 won't turn on", ...overrides };
}

beforeEach(() => {
  reportsReady = true;
  mockCreateClient.mockReset();
  mockLearner.mockReset();
  mockLearner.mockResolvedValue({ userId: ME, enrolments: [{ id: "e1" }], current: { id: "e1", offeringId: OFFERING } });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("submitIssueReport", () => {
  it("files the report as the learner, on their programme", async () => {
    const db = database();

    await expect(submitIssueReport(input())).resolves.toEqual({ error: null });

    expect(db.writes()[0]).toMatchObject({
      table: "issue_reports",
      action: "insert",
      payload: {
        reporter_id: ME,
        category: "equipment",
        description: "Projector in Room 2 won't turn on",
        offering_id: OFFERING,
      },
    });
  });

  it("sends no status, leaving the database to open it", async () => {
    const db = database();

    await submitIssueReport(input());

    expect(db.writes()[0].payload).not.toHaveProperty("status");
  });

  it("refuses everything while reporting isn't switched on", async () => {
    reportsReady = false;
    const db = database();

    const result = await submitIssueReport(input());

    expect(result.error).toMatch(/isn't available yet/i);
    expect(db.ops).toEqual([]);
  });

  it("refuses a signed-out caller without writing", async () => {
    mockLearner.mockResolvedValue(null);
    const db = database();

    const result = await submitIssueReport(input());

    expect(result.error).toMatch(/session has expired/i);
    expect(db.ops).toEqual([]);
  });

  it("rejects an empty description without touching the database", async () => {
    const db = database();

    const result = await submitIssueReport(input({ description: "   " }));

    expect(result.error).toMatch(/describe the problem/i);
    expect(db.ops).toEqual([]);
  });

  it("reports a refusal in plain language", async () => {
    database({ error: { code: "42501", message: "rls" } });

    const result = await submitIssueReport(input());

    expect(result.error).toMatch(/wasn't accepted/i);
  });
});

describe("issueReportSchema", () => {
  it("accepts a known category", () => {
    expect(issueReportSchema.safeParse(input()).success).toBe(true);
  });
});
