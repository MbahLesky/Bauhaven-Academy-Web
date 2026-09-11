import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: () => mockCreateClient() }));

import { requestPasswordReset, setNewPassword } from "./password-reset-actions";

function fakeAuth({
  resetError = null as { code: string; message: string } | null,
  updateError = null as { code: string; message: string } | null,
  user = { id: "u1" } as { id: string } | null,
} = {}) {
  const resetCalls: { email: string; options: { redirectTo?: string } }[] = [];
  const updates: { password?: string }[] = [];
  let signedOut = false;

  mockCreateClient.mockResolvedValue({
    auth: {
      resetPasswordForEmail: (email: string, options: { redirectTo?: string }) => {
        resetCalls.push({ email, options });
        return Promise.resolve({ error: resetError });
      },
      getUser: () => Promise.resolve({ data: { user } }),
      updateUser: (attributes: { password?: string }) => {
        updates.push(attributes);
        return Promise.resolve({ error: updateError });
      },
      signOut: () => {
        signedOut = true;
        return Promise.resolve({ error: null });
      },
    },
  });

  return { resetCalls, updates, wasSignedOut: () => signedOut };
}

beforeEach(() => {
  mockCreateClient.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("requestPasswordReset", () => {
  it("asks Supabase to send the link", async () => {
    const auth = fakeAuth();

    const result = await requestPasswordReset({ email: "ada@example.com" });

    expect(result.error).toBeNull();
    expect(auth.resetCalls[0].email).toBe("ada@example.com");
  });

  it("lowercases the address before sending", async () => {
    const auth = fakeAuth();

    await requestPasswordReset({ email: "Ada@Example.COM" });

    expect(auth.resetCalls[0].email).toBe("ada@example.com");
  });

  /**
   * The redirect goes through our own route so the token is exchanged server-side and the
   * session cookie is set the way every other request reads it.
   */
  it("points the link at the confirm route, not straight at the form", async () => {
    const auth = fakeAuth();

    await requestPasswordReset({ email: "ada@example.com" });

    expect(auth.resetCalls[0].options.redirectTo).toContain("/auth/confirm");
    expect(auth.resetCalls[0].options.redirectTo).toContain("next=/reset-password");
  });

  /**
   * **The account-enumeration guard.** An unknown address and a rate-limited request both
   * have to look identical to a known one, or this form becomes a way to ask who is
   * enrolled at Bauhaven — the same reason the sign-in form never distinguishes a wrong
   * password from a missing account.
   */
  it("reports success even when Supabase refuses, so nothing leaks", async () => {
    fakeAuth({ resetError: { code: "over_email_send_rate_limit", message: "rate limited" } });

    const result = await requestPasswordReset({ email: "nobody@example.com" });

    expect(result.error).toBeNull();
  });

  it("rejects a malformed address without calling out", async () => {
    const auth = fakeAuth();

    const result = await requestPasswordReset({ email: "not-an-email" });

    expect(result.error).toMatch(/valid email/i);
    expect(auth.resetCalls).toHaveLength(0);
  });
});

describe("setNewPassword", () => {
  const good = { password: "harbour-mango-41", confirmPassword: "harbour-mango-41" };

  it("sets the password", async () => {
    const auth = fakeAuth();

    const result = await setNewPassword(good);

    expect(result.error).toBeNull();
    expect(auth.updates[0]).toEqual({ password: "harbour-mango-41" });
  });

  /**
   * A recovery session is a session. Left in place, it would carry somebody into the app on
   * the strength of an email link rather than a password they just proved they know.
   */
  it("signs them out afterwards, so they come back through the front door", async () => {
    const auth = fakeAuth();

    await setNewPassword(good);

    expect(auth.wasSignedOut()).toBe(true);
  });

  // Without a session the link was never verified — expired, already used, or opened in a
  // different browser from the one that requested it.
  it("says the link is spent when there's no session behind it", async () => {
    const auth = fakeAuth({ user: null });

    const result = await setNewPassword(good);

    expect(result.error).toMatch(/expired or has already been used/i);
    expect(auth.updates).toHaveLength(0);
  });

  it("refuses a password under the floor before touching the session", async () => {
    const auth = fakeAuth();

    const result = await setNewPassword({ password: "sevench", confirmPassword: "sevench" });

    expect(result.error).toMatch(/at least 8/i);
    expect(auth.updates).toHaveLength(0);
  });

  it("refuses two passwords that don't match", async () => {
    const auth = fakeAuth();

    const result = await setNewPassword({
      password: "harbour-mango-41",
      confirmPassword: "harbour-mango-42",
    });

    expect(result.error).toMatch(/don't match/i);
    expect(auth.updates).toHaveLength(0);
  });

  // Worth passing through: "try again" would leave somebody retyping the same thing.
  it("says so when the new password is the old one", async () => {
    fakeAuth({ updateError: { code: "same_password", message: "should be different" } });

    const result = await setNewPassword(good);

    expect(result.error).toMatch(/already your password/i);
  });

  it("hides an unexpected fault behind a generic message", async () => {
    fakeAuth({ updateError: { code: "08006", message: "connection to server lost" } });

    const result = await setNewPassword(good);

    expect(result.error).toMatch(/try again/i);
    expect(result.error).not.toMatch(/connection/i);
  });

  // The failed update must not look like a success, and must not end the session that
  // still lets them retry.
  it("leaves them signed in when the update failed", async () => {
    const auth = fakeAuth({ updateError: { code: "08006", message: "lost" } });

    await setNewPassword(good);

    expect(auth.wasSignedOut()).toBe(false);
  });
});
