import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabase, hasFilter } from "@/test/fake-supabase";

const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: () => mockCreateClient() }));

import { getMyTestimonies } from "./testimony-queries";

const ME = "me";

beforeEach(() => {
  mockCreateClient.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

function database(result: { data?: unknown; error?: { message: string } }) {
  const fake = createFakeSupabase(() => result);
  mockCreateClient.mockResolvedValue({ ...fake.client, auth: { getUser: () => Promise.resolve({ data: { user: { id: ME } } }) } });
  return fake;
}

describe("getMyTestimonies", () => {
  // The website's reviews are one table for everyone; this list must be the learner's own.
  it("asks for the learner's own feedback only", async () => {
    const db = database({ data: [] });

    await getMyTestimonies();

    expect(hasFilter(db.ops[0], "eq", "user_id", ME)).toBe(true);
  });

  it("shows whether the learner allowed it to be featured", async () => {
    database({
      data: [{ id: "r1", message: "Great programme", rating: 5, allow_public_use: true, created_at: "2026-09-01T09:00:00Z" }],
    });

    const [testimony] = await getMyTestimonies();

    expect(testimony).toMatchObject({ content: "Great programme", rating: 5, publicUse: true });
  });

  it("throws rather than claim nothing was shared", async () => {
    database({ error: { message: "lost" } });

    await expect(getMyTestimonies()).rejects.toThrow("Couldn't load your feedback.");
  });
});
