import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateLanguage } from "./profile-actions";
import { getInitials } from "./initials";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: () => mockCreateClient() }));

const STUDENT_ID = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";

function fakeDatabase({
  signedIn = true,
  updateError = null as { code: string } | null,
} = {}) {
  const updates: { values: Record<string, unknown>; whereId: string | null }[] = [];

  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: () => Promise.resolve({ data: { user: signedIn ? { id: STUDENT_ID } : null } }),
    },
    from: () => ({
      update: (values: Record<string, unknown>) => ({
        eq: (_column: string, value: string) => {
          if (updateError) return Promise.resolve({ error: updateError });
          updates.push({ values, whereId: value });
          return Promise.resolve({ error: null });
        },
      }),
    }),
  });

  return { updates };
}

beforeEach(() => {
  mockCreateClient.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("updateLanguage", () => {
  /**
   * The column this writes is not decorative: the testimony form reads
   * `users.preferred_language` to decide whether a student's words go to `content_en` or
   * `content_fr`. A toggle that didn't persist would file French testimonies as English.
   */
  it("writes the new preference to the signed-in person's row", async () => {
    const db = fakeDatabase();

    const result = await updateLanguage("fr");

    expect(result.error).toBeNull();
    expect(db.updates).toHaveLength(1);
    expect(db.updates[0].values).toEqual({ preferred_language: "fr" });
  });

  /**
   * `users_update_own` would refuse anything else, but an UPDATE with no `.eq` is one
   * typo away from being an UPDATE over the whole table — not a thing to leave RLS to
   * catch.
   */
  it("scopes the update to the session's own row", async () => {
    const db = fakeDatabase();

    await updateLanguage("fr");

    expect(db.updates[0].whereId).toBe(STUDENT_ID);
  });

  it("accepts the other direction too", async () => {
    const db = fakeDatabase();

    await updateLanguage("en");

    expect(db.updates[0].values).toEqual({ preferred_language: "en" });
  });

  // Mirrors the column's check constraint — ('en','fr') and nothing else.
  it("rejects a language the column can't hold, without writing", async () => {
    const db = fakeDatabase();

    const result = await updateLanguage("de" as never);

    expect(result.error).not.toBeNull();
    expect(db.updates).toHaveLength(0);
  });

  it("refuses a signed-out caller without writing", async () => {
    const db = fakeDatabase({ signedIn: false });

    const result = await updateLanguage("fr");

    expect(result.error).toMatch(/session has expired/i);
    expect(db.updates).toHaveLength(0);
  });

  it("explains a write failure without leaking a Postgres code", async () => {
    fakeDatabase({ updateError: { code: "08006" } });

    const result = await updateLanguage("fr");

    expect(result.error).toMatch(/try again/i);
    expect(result.error).not.toMatch(/08006/);
  });
});

describe("getInitials", () => {
  it("takes the first and last name parts", () => {
    expect(getInitials("Sam Student")).toBe("SS");
    // How the person is usually addressed, rather than first-two-words.
    expect(getInitials("Sam Kofi Student")).toBe("SS");
  });

  it("handles a single name", () => {
    expect(getInitials("Sam")).toBe("S");
  });

  it("tolerates untidy spacing", () => {
    expect(getInitials("  Sam   Student  ")).toBe("SS");
  });

  // Bauhaven's users write in French as well as English, so an accented first letter must
  // not be sliced into half a character.
  it("keeps an accented initial whole", () => {
    expect(getInitials("Émile Ndongo")).toBe("ÉN");
  });

  // `name` is `not null` in the schema, but an all-whitespace one would still get through.
  it("falls back rather than rendering an empty circle", () => {
    expect(getInitials("   ")).toBe("?");
  });
});
