import { describe, it, expect, vi, beforeEach } from "vitest";
import { submitTestimony } from "./testimony-actions";
import { testimonySchema, type TestimonyInput } from "./schemas/testimony";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: () => mockCreateClient() }));

const STUDENT_ID = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
const SOMEONE_ELSE = "00000000-0000-4000-8000-000000000000";
const PROGRAM_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

const CONTENT = "This bootcamp completely changed how I think about building things.";

interface InsertedRow extends Record<string, unknown> {
  user_id?: string;
  program_id?: string | null;
  content_en?: string | null;
  content_fr?: string | null;
  status?: string;
}

/**
 * A stand-in for the three tables this action touches: `users` (for
 * `preferred_language`), `enrollments` (for the program a pull-quote is about), and
 * `testimonies` itself.
 */
function fakeDatabase({
  signedIn = true,
  preferredLanguage = "en" as "en" | "fr",
  programId = PROGRAM_ID as string | null,
  languageError = null as { code: string } | null,
  enrollmentError = null as { code: string } | null,
  insertError = null as { code: string } | null,
} = {}) {
  const inserted: InsertedRow[] = [];

  function selectResult(table: string) {
    if (table === "users") {
      return {
        data: languageError ? null : { preferred_language: preferredLanguage },
        error: languageError,
      };
    }
    return {
      data: enrollmentError || !programId ? null : { program_id: programId },
      error: enrollmentError,
    };
  }

  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: () => Promise.resolve({ data: { user: signedIn ? { id: STUDENT_ID } : null } }),
    },
    from: (table: string) => ({
      // `users` reads .eq().maybeSingle(); `enrollments` reads .eq().limit().maybeSingle().
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve(selectResult(table)),
          limit: () => ({ maybeSingle: () => Promise.resolve(selectResult(table)) }),
        }),
      }),
      insert: (row: InsertedRow) => {
        if (insertError) return Promise.resolve({ error: insertError });
        inserted.push(row);
        return Promise.resolve({ error: null });
      },
    }),
  });

  return { inserted };
}

function input(overrides: Partial<TestimonyInput> = {}): TestimonyInput {
  return { content: CONTENT, ...overrides };
}

beforeEach(() => {
  mockCreateClient.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("submitTestimony", () => {
  /**
   * **The one this feature has to get right.** `testimonies_insert` is
   * `with check (user_id = auth.uid())`, so a forged id would be refused by the database —
   * but a testimony attributed to the wrong person could end up on a public website under
   * their name, which is bad enough that the app must not rely on that refusal.
   */
  it("takes user_id from the session, ignoring a client-supplied one", async () => {
    const db = fakeDatabase();

    await submitTestimony({ ...input(), user_id: SOMEONE_ELSE } as TestimonyInput);

    expect(db.inserted[0].user_id).toBe(STUDENT_ID);
    expect(db.inserted[0].user_id).not.toBe(SOMEONE_ELSE);
  });

  it("records the testimony and reports success", async () => {
    const db = fakeDatabase();

    const result = await submitTestimony(input());

    expect(result.error).toBeNull();
    expect(db.inserted).toHaveLength(1);
  });
});

/**
 * One form field, two columns. Which one is answered by `users.preferred_language`
 * server-side, never by asking the student to translate their own testimonial.
 */
describe("routing one field to the right language column", () => {
  it("writes an English speaker's words to content_en, leaving content_fr null", async () => {
    const db = fakeDatabase({ preferredLanguage: "en" });

    await submitTestimony(input());

    expect(db.inserted[0].content_en).toBe(CONTENT);
    expect(db.inserted[0].content_fr).toBeNull();
  });

  /**
   * This is what `007_testimonies_bilingual_content.sql` exists for. Under the original
   * `content_en text not null`, French words had to be stored in a column named for
   * English — which the public Site would render to English readers as the translation.
   */
  it("writes a French speaker's words to content_fr, leaving content_en null", async () => {
    const db = fakeDatabase({ preferredLanguage: "fr" });

    await submitTestimony(input());

    expect(db.inserted[0].content_fr).toBe(CONTENT);
    expect(db.inserted[0].content_en).toBeNull();
  });

  // Copying into both would tell the Site that the French text *is* the English
  // translation of itself.
  it("never stores the same words in both columns", async () => {
    const db = fakeDatabase({ preferredLanguage: "fr" });

    await submitTestimony(input());

    const row = db.inserted[0];
    expect([row.content_en, row.content_fr].filter(Boolean)).toHaveLength(1);
  });

  // The column's own default. A testimony saved to the wrong column is recoverable by a
  // curator; a submission refused because a lookup failed is just lost.
  it("falls back to English when the language lookup fails", async () => {
    const db = fakeDatabase({ preferredLanguage: "fr", languageError: { code: "08006" } });

    await submitTestimony(input());

    expect(db.inserted[0].content_en).toBe(CONTENT);
  });
});

describe("the fields the student never fills in", () => {
  // A pull-quote on the public Site is about a program, and enrolling already said which.
  it("fills program_id from the active enrollment", async () => {
    const db = fakeDatabase();

    await submitTestimony(input());

    expect(db.inserted[0].program_id).toBe(PROGRAM_ID);
  });

  it("still accepts a testimony from someone between programs", async () => {
    const db = fakeDatabase({ programId: null });

    const result = await submitTestimony(input());

    expect(result.error).toBeNull();
    expect(db.inserted[0].program_id).toBeNull();
  });

  /**
   * Defaults to 'submitted'. Publishing is Admin/Staff curation — and `testimonies` has no
   * UPDATE policy at all, so no row can reach 'published' by any route today.
   */
  it("sends no status, leaving the column default to decide", async () => {
    const db = fakeDatabase();

    await submitTestimony(input());

    expect(db.inserted[0]).not.toHaveProperty("status");
  });
});

describe("when it can't be saved", () => {
  it("refuses a signed-out caller without writing", async () => {
    const db = fakeDatabase({ signedIn: false });

    const result = await submitTestimony(input());

    expect(result.error).toMatch(/session has expired/i);
    expect(db.inserted).toHaveLength(0);
  });

  it("rejects something too short to feature", async () => {
    const db = fakeDatabase();

    const result = await submitTestimony(input({ content: "It was good" }));

    expect(result.error).not.toBeNull();
    expect(db.inserted).toHaveLength(0);
  });

  it("explains a write failure without leaking a Postgres code", async () => {
    fakeDatabase({ insertError: { code: "08006" } });

    const result = await submitTestimony(input());

    expect(result.error).toMatch(/try again/i);
    expect(result.error).not.toMatch(/08006/);
  });

  it("reports a policy refusal in plain language", async () => {
    fakeDatabase({ insertError: { code: "42501" } });

    const result = await submitTestimony(input());

    expect(result.error).toMatch(/wasn't accepted/i);
    expect(result.error).not.toMatch(/42501|policy|violat/i);
  });
});

describe("testimonySchema", () => {
  it("trims before measuring, so whitespace isn't a testimony", () => {
    expect(testimonySchema.safeParse(input({ content: "   short    " })).success).toBe(false);
  });

  it("accepts a real one", () => {
    expect(testimonySchema.safeParse(input()).success).toBe(true);
  });
});
