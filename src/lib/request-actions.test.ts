import { describe, it, expect, vi, beforeEach } from "vitest";
import { submitAbsenceRequest } from "./request-actions";
import { absenceRequestSchema, type AbsenceRequestInput } from "./schemas/request";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: () => mockCreateClient() }));

const STUDENT_ID = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";

interface InsertedRow extends Record<string, unknown> {
  requester_id?: string;
  type?: string;
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

function input(overrides: Partial<AbsenceRequestInput> = {}): AbsenceRequestInput {
  return {
    start_date: "2026-08-06",
    end_date: "2026-08-07",
    reason: "Family event out of town",
    ...overrides,
  };
}

beforeEach(() => {
  mockCreateClient.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("submitAbsenceRequest", () => {
  it("records the request against the signed-in student", async () => {
    const db = fakeDatabase();

    const result = await submitAbsenceRequest(input());

    expect(result.error).toBeNull();
    expect(db.inserted).toHaveLength(1);
    expect(db.inserted[0]).toMatchObject({
      start_date: "2026-08-06",
      end_date: "2026-08-07",
      reason: "Family event out of town",
      type: "absence",
    });
  });

  /**
   * `requests_insert` is `with check (requester_id = auth.uid())`, so a forged id would
   * be refused anyway — but the app must never depend on that refusal to be correct.
   */
  it("takes requester_id from the session, not from the caller", async () => {
    const db = fakeDatabase();

    await submitAbsenceRequest({
      ...input(),
      // A client trying to file a request in someone else's name.
      requester_id: "00000000-0000-4000-8000-000000000000",
    } as AbsenceRequestInput);

    expect(db.inserted[0].requester_id).toBe(STUDENT_ID);
  });

  /**
   * The column defaults to 'pending', and the workflow state belongs to the approval side
   * — which doesn't exist yet. The Core Feature Spec's quorum rule auto-approves when the
   * company has exactly one Admin; whatever implements that would be fighting a client
   * that hardcodes 'pending'.
   */
  it("sends no status at all, leaving the column default to decide", async () => {
    const db = fakeDatabase();

    await submitAbsenceRequest(input());

    expect(db.inserted[0]).not.toHaveProperty("status");
  });

  /**
   * `request_approvals` needs one row per required approver, and who those approvers are
   * depends on routing rules no screen has defined yet. Seeding rows speculatively would
   * leave the approval side working around guesses.
   */
  it("creates no request_approvals rows", async () => {
    const inserts: string[] = [];
    mockCreateClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: STUDENT_ID } } }) },
      from: (table: string) => {
        inserts.push(table);
        return { insert: () => Promise.resolve({ error: null }) };
      },
    });

    await submitAbsenceRequest(input());

    expect(inserts).toEqual(["requests"]);
  });

  it("refuses a signed-out caller without writing", async () => {
    const db = fakeDatabase({ signedIn: false });

    const result = await submitAbsenceRequest(input());

    expect(result.error).toMatch(/session has expired/i);
    expect(db.inserted).toHaveLength(0);
  });

  it("rejects a backwards date range without touching the database", async () => {
    const db = fakeDatabase();

    const result = await submitAbsenceRequest(
      input({ start_date: "2026-08-07", end_date: "2026-08-06" })
    );

    expect(result.error).toMatch(/check the dates/i);
    expect(db.inserted).toHaveLength(0);
  });

  it("rejects an empty reason without touching the database", async () => {
    const db = fakeDatabase();

    const result = await submitAbsenceRequest(input({ reason: "   " }));

    expect(result.error).not.toBeNull();
    expect(db.inserted).toHaveLength(0);
  });

  it("explains a write failure without leaking a Postgres code", async () => {
    fakeDatabase({ insertError: { code: "08006" } });

    const result = await submitAbsenceRequest(input());

    expect(result.error).toMatch(/try again/i);
    expect(result.error).not.toMatch(/08006/);
  });

  it("reports a policy refusal in plain language", async () => {
    fakeDatabase({ insertError: { code: "42501" } });

    const result = await submitAbsenceRequest(input());

    expect(result.error).toMatch(/wasn't accepted/i);
    expect(result.error).not.toMatch(/42501|policy|violat/i);
  });
});

describe("absenceRequestSchema", () => {
  it("accepts a single-day absence", () => {
    const parsed = absenceRequestSchema.safeParse(
      input({ start_date: "2026-08-06", end_date: "2026-08-06" })
    );

    expect(parsed.success).toBe(true);
  });

  /** "I was ill yesterday" is an ordinary request, not an edge case to block. */
  it("accepts a date in the past", () => {
    const parsed = absenceRequestSchema.safeParse(
      input({ start_date: "2020-01-01", end_date: "2020-01-02" })
    );

    expect(parsed.success).toBe(true);
  });

  // Nobody can edit a request after sending it — there is no UPDATE policy on `requests`
  // for anyone — so a mistyped year would sit in the queue uncorrectable.
  it("catches a mistyped year as an implausibly long absence", () => {
    const parsed = absenceRequestSchema.safeParse(
      input({ start_date: "2026-08-06", end_date: "2062-08-07" })
    );

    expect(parsed.success).toBe(false);
  });

  it("rejects a date the picker didn't produce", () => {
    expect(absenceRequestSchema.safeParse(input({ start_date: "6 Aug 2026" })).success).toBe(
      false
    );
  });
});
