import { describe, it, expect, vi, beforeEach } from "vitest";
import { submitIssueReport } from "./issue-report-actions";
import { issueReportSchema, type IssueReportInput } from "./schemas/issue-report";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: () => mockCreateClient() }));

const STUDENT_ID = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
const SOMEONE_ELSE = "00000000-0000-4000-8000-000000000000";

interface InsertedRow extends Record<string, unknown> {
  reporter_id?: string;
  status?: string;
}

function fakeDatabase({
  signedIn = true,
  insertError = null as { code: string } | null,
} = {}) {
  const inserted: InsertedRow[] = [];

  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: () => Promise.resolve({ data: { user: signedIn ? { id: STUDENT_ID } : null } }),
    },
    from: () => ({
      insert: (row: InsertedRow) => {
        if (insertError) return Promise.resolve({ error: insertError });
        inserted.push(row);
        return Promise.resolve({ error: null });
      },
    }),
  });

  return { inserted };
}

function input(overrides: Partial<IssueReportInput> = {}): IssueReportInput {
  return {
    category: "equipment",
    description: "Projector in Room 2 won't turn on",
    ...overrides,
  };
}

beforeEach(() => {
  mockCreateClient.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("submitIssueReport", () => {
  it("records the report with the category and description given", async () => {
    const db = fakeDatabase();

    const result = await submitIssueReport(input());

    expect(result.error).toBeNull();
    expect(db.inserted).toHaveLength(1);
    expect(db.inserted[0]).toMatchObject({
      category: "equipment",
      description: "Projector in Room 2 won't turn on",
    });
  });

  /**
   * **The one this feature has to get right.** `issue_reports_insert` is
   * `with check (reporter_id = auth.uid())`, so a forged id would be refused by the
   * database — but the app must never depend on that refusal to be correct, and a report
   * filed in someone else's name is a particularly bad thing to get wrong.
   */
  it("takes reporter_id from the session, ignoring a client-supplied one", async () => {
    const db = fakeDatabase();

    await submitIssueReport({
      ...input(),
      reporter_id: SOMEONE_ELSE,
    } as IssueReportInput);

    expect(db.inserted[0].reporter_id).toBe(STUDENT_ID);
    expect(db.inserted[0].reporter_id).not.toBe(SOMEONE_ELSE);
  });

  /**
   * The column defaults to 'open' with a check constraint of open/in_progress/resolved.
   * Where a report sits in a workflow belongs to whoever triages it.
   */
  it("sends no status, leaving the column default to decide", async () => {
    const db = fakeDatabase();

    await submitIssueReport(input());

    expect(db.inserted[0]).not.toHaveProperty("status");
  });

  /**
   * Both columns exist and are FK'd, but a student can read only assets assigned to them
   * (`assets_select`), so an asset picker here would show the wrong list to the wrong
   * person. Attaching them belongs to a triage screen.
   */
  it("leaves asset_id and program_id off the insert entirely", async () => {
    const db = fakeDatabase();

    await submitIssueReport(input());

    expect(db.inserted[0]).not.toHaveProperty("asset_id");
    expect(db.inserted[0]).not.toHaveProperty("program_id");
  });

  it("refuses a signed-out caller without writing", async () => {
    const db = fakeDatabase({ signedIn: false });

    const result = await submitIssueReport(input());

    expect(result.error).toMatch(/session has expired/i);
    expect(db.inserted).toHaveLength(0);
  });

  it("rejects a category this screen doesn't offer", async () => {
    const db = fakeDatabase();

    const result = await submitIssueReport(input({ category: "urgent" as never }));

    expect(result.error).not.toBeNull();
    expect(db.inserted).toHaveLength(0);
  });

  it("rejects a description too short to act on", async () => {
    const db = fakeDatabase();

    const result = await submitIssueReport(input({ description: "broken" }));

    expect(result.error).not.toBeNull();
    expect(db.inserted).toHaveLength(0);
  });

  it("explains a write failure without leaking a Postgres code", async () => {
    fakeDatabase({ insertError: { code: "08006" } });

    const result = await submitIssueReport(input());

    expect(result.error).toMatch(/try again/i);
    expect(result.error).not.toMatch(/08006/);
  });

  it("reports a policy refusal in plain language", async () => {
    fakeDatabase({ insertError: { code: "42501" } });

    const result = await submitIssueReport(input());

    expect(result.error).toMatch(/wasn't accepted/i);
    expect(result.error).not.toMatch(/42501|policy|violat/i);
  });
});

describe("issueReportSchema", () => {
  it("trims a description before measuring it", () => {
    const parsed = issueReportSchema.safeParse(input({ description: "   broken     " }));

    expect(parsed.success).toBe(false);
  });

  it("requires a category to be chosen at all", () => {
    // The form's default is an empty string so nothing is preselected — a default
    // category is the one everybody submits.
    expect(issueReportSchema.safeParse(input({ category: "" as never })).success).toBe(false);
  });

  it("accepts every category the screen offers", () => {
    for (const category of ["equipment", "program", "access", "safety", "general"] as const) {
      expect(issueReportSchema.safeParse(input({ category })).success).toBe(true);
    }
  });
});
