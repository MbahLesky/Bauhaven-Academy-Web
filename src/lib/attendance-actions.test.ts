import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkIn } from "./attendance-actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: () => mockCreateClient() }));

const SESSION_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const STUDENT_ID = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";

interface StoredRecord {
  id: string;
  session_id: string;
  user_id: string;
  status: "present" | "absent" | "excused";
  corrects_id: string | null;
  created_at: string;
  checked_in_at: string | null;
}

/**
 * A stand-in for `attendance_records`.
 *
 * There is deliberately **no unique constraint** on (session_id, user_id) in the real
 * schema, so this fake doesn't enforce one either — a second insert would genuinely
 * succeed at the database level and leave two standing rows. Preventing that is the
 * action's job, and that's what these tests check.
 */
function fakeDatabase({
  existing = [] as StoredRecord[],
  signedIn = true,
  lookupError = null as { code: string } | null,
  insertError = null as { code: string } | null,
} = {}) {
  const records = [...existing];

  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: signedIn ? { id: STUDENT_ID } : null } }),
    },
    from: () => ({
      select: () => ({
        eq: (_column: string, value: string) =>
          Promise.resolve({
            data: lookupError ? null : records.filter((row) => row.session_id === value),
            error: lookupError,
          }),
      }),
      insert: (row: Omit<StoredRecord, "id">) => {
        if (insertError) return Promise.resolve({ error: insertError });
        records.push({ ...row, id: `rec-${records.length + 1}` });
        return Promise.resolve({ error: null });
      },
    }),
  });

  return { records };
}

function record(overrides: Partial<StoredRecord> = {}): StoredRecord {
  return {
    id: "rec-existing",
    session_id: SESSION_ID,
    user_id: STUDENT_ID,
    status: "present",
    corrects_id: null,
    created_at: "2026-08-04T08:00:00Z",
    checked_in_at: "2026-08-04T08:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  mockCreateClient.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("checkIn — the happy path", () => {
  it("records the student as present, stamped from the session", async () => {
    const db = fakeDatabase();

    const result = await checkIn({ session_id: SESSION_ID });

    expect(result.outcome).toBe("checked-in");
    expect(db.records).toHaveLength(1);
    expect(db.records[0]).toMatchObject({
      session_id: SESSION_ID,
      // Never taken from the client — the policy's self arm is `user_id = auth.uid()`.
      user_id: STUDENT_ID,
      // The only status self-check-in can mean; absent or excused are Staff decisions.
      status: "present",
      // A first record, not a correction. Corrections are Staff's.
      corrects_id: null,
    });
  });

  /**
   * `checked_in_at` says when the student actually arrived, as distinct from when the row
   * was written. Admin-web leaves it null when Staff mark a roster on someone's behalf,
   * precisely so a real check-in stays distinguishable from a recorded one.
   */
  it("stamps checked_in_at, which a staff-marked row wouldn't have", async () => {
    const db = fakeDatabase();

    await checkIn({ session_id: SESSION_ID });

    expect(db.records[0].checked_in_at).toEqual(expect.any(String));
  });
});

describe("checkIn — a second attempt for the same session", () => {
  /**
   * **The case this feature has to get right.** There's no unique constraint, so a naive
   * second insert would succeed and leave two standing rows for one session — exactly the
   * double-count the append-only correction chain exists to prevent, and it would inflate
   * the student's own attendance rate.
   */
  it("writes nothing and says so, rather than duplicating or crashing", async () => {
    const db = fakeDatabase({ existing: [record({ status: "present" })] });

    const result = await checkIn({ session_id: SESSION_ID });

    expect(result.outcome).toBe("already-recorded");
    expect(result.message).toMatch(/already checked in/i);
    // Still exactly one row.
    expect(db.records).toHaveLength(1);
  });

  it("stays at one row across repeated taps", async () => {
    const db = fakeDatabase();

    await checkIn({ session_id: SESSION_ID });
    await checkIn({ session_id: SESSION_ID });
    await checkIn({ session_id: SESSION_ID });

    expect(db.records).toHaveLength(1);
  });

  // "Already recorded" is not an error — nothing failed and nothing was lost.
  it("is not reported as a failure", async () => {
    fakeDatabase({ existing: [record()] });

    const result = await checkIn({ session_id: SESSION_ID });

    expect(result.outcome).not.toBe("failed");
    expect(result.message).not.toMatch(/couldn't|error|failed/i);
  });

  /**
   * A Staff member may already have marked this student — including as absent or excused.
   * Checking in over the top would contradict a decision that isn't the student's to make.
   */
  it("respects a status a mentor already set", async () => {
    const db = fakeDatabase({ existing: [record({ status: "excused" })] });

    const result = await checkIn({ session_id: SESSION_ID });

    expect(result.outcome).toBe("already-recorded");
    expect(result.message).toMatch(/mentor has already marked you excused/i);
    expect(db.records).toHaveLength(1);
  });

  /**
   * A corrected record: the student checked in, then Staff corrected it to absent. Only
   * the correction stands, so the "already recorded" message must reflect the correction
   * rather than the row it replaced.
   */
  it("reads the standing record, not the one a correction superseded", async () => {
    const db = fakeDatabase({
      existing: [
        record({ id: "rec-1", status: "present", created_at: "2026-08-04T08:00:00Z" }),
        record({
          id: "rec-2",
          status: "absent",
          corrects_id: "rec-1",
          created_at: "2026-08-04T09:00:00Z",
        }),
      ],
    });

    const result = await checkIn({ session_id: SESSION_ID });

    expect(result.outcome).toBe("already-recorded");
    expect(result.message).toMatch(/marked you absent/i);
    expect(db.records).toHaveLength(2);
  });
});

describe("checkIn — when the policy refuses", () => {
  /**
   * `attendance_records_insert` requires `auth_enrolled_in_session_program(session_id)`
   * for the self arm. The page's own query already scopes sessions to the student's
   * program, so this shouldn't normally happen — but the policy is the authority, not the
   * page's query, and they can disagree: an enrolment withdrawn between load and tap, or
   * a stale tab. Expected and handled, not routed around.
   */
  it("explains an enrolment refusal instead of leaking a Postgres error", async () => {
    fakeDatabase({ insertError: { code: "42501" } });

    const result = await checkIn({ session_id: SESSION_ID });

    expect(result.outcome).toBe("not-enrolled");
    expect(result.message).toMatch(/enrolment list/i);
    expect(result.message).not.toMatch(/42501|policy|violat/i);
    // And points at the person who can actually fix it.
    expect(result.message).toMatch(/mentor/i);
  });

  it("treats any other write failure as retryable, not as a permission problem", async () => {
    fakeDatabase({ insertError: { code: "08006" } });

    const result = await checkIn({ session_id: SESSION_ID });

    expect(result.outcome).toBe("failed");
    expect(result.message).toMatch(/try again/i);
  });

  // Inserting blind after a failed read risks a duplicate standing row, which is worse
  // than asking the student to try again.
  it("refuses to insert when it can't check for an existing record", async () => {
    const db = fakeDatabase({ lookupError: { code: "08006" } });

    const result = await checkIn({ session_id: SESSION_ID });

    expect(result.outcome).toBe("failed");
    expect(db.records).toHaveLength(0);
  });

  it("refuses a signed-out caller", async () => {
    const db = fakeDatabase({ signedIn: false });

    const result = await checkIn({ session_id: SESSION_ID });

    expect(result.outcome).toBe("failed");
    expect(result.message).toMatch(/session has expired/i);
    expect(db.records).toHaveLength(0);
  });

  it("rejects a malformed session reference without touching the database", async () => {
    const db = fakeDatabase();

    const result = await checkIn({ session_id: "not-a-uuid" });

    expect(result.outcome).toBe("failed");
    expect(db.records).toHaveLength(0);
  });
});
