import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: () => mockCreateClient() }));

import { acceptInvitation, completeInvitation } from "./accept-actions";

const TOKEN = "Xf9Kq2mNp7RtVw3ZbYc5DhJlGnQsUvA1eOiT4uB8sEk";
const INVITED_EMAIL = "sam@example.com";

function fakeDatabase({
  invitation = { email: INVITED_EMAIL, invited_role: "student", program_id: null } as
    | { email: string; invited_role: string; program_id: string | null }
    | null,
  signUpSession = true,
  signUpError = null as { code: string; message: string } | null,
  redeemResult = true as boolean,
  signedInUser = { id: "user-1", email: INVITED_EMAIL } as { id: string; email: string } | null,
} = {}) {
  const calls: { rpc: string; args: unknown }[] = [];
  const signUps: Record<string, unknown>[] = [];

  mockCreateClient.mockResolvedValue({
    rpc: (name: string, args: unknown) => {
      calls.push({ rpc: name, args });
      if (name === "invitation_preview") {
        return Promise.resolve({ data: invitation ? [invitation] : [], error: null });
      }
      return Promise.resolve({ data: redeemResult, error: null });
    },
    auth: {
      getUser: () => Promise.resolve({ data: { user: signedInUser } }),
      signUp: (input: Record<string, unknown>) => {
        signUps.push(input);
        if (signUpError) return Promise.resolve({ data: {}, error: signUpError });
        return Promise.resolve({
          data: { session: signUpSession ? { access_token: "t" } : null },
          error: null,
        });
      },
    },
  });

  return { calls, signUps };
}

function input(overrides: Record<string, string> = {}) {
  return {
    token: TOKEN,
    name: "Sam Student",
    password: "correct-horse",
    confirmPassword: "correct-horse",
    ...overrides,
  };
}

beforeEach(() => {
  mockCreateClient.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("acceptInvitation", () => {
  it("creates the account and redeems the invitation", async () => {
    const db = fakeDatabase();

    const result = await acceptInvitation(input());

    expect(result.outcome).toBe("accepted");
    expect(db.calls.map((call) => call.rpc)).toEqual(["invitation_preview", "redeem_invitation"]);
  });

  /**
   * **The email comes from the invitation, never from the form.** A form field would let
   * whoever finds a forwarded link redeem it under their own address — the token would be
   * theirs but the account wouldn't be. `redeem_invitation` checks it again server-side.
   */
  it("signs up with the invitation's address, not one the caller chose", async () => {
    const db = fakeDatabase();

    await acceptInvitation(input());

    expect(db.signUps[0].email).toBe(INVITED_EMAIL);
  });

  // `handle_new_user()` reads `raw_user_meta_data->>'name'`, falling back to the local
  // part of the address — so passing it means the directory shows a person, not an inbox.
  it("passes the name through so the profile isn't named after an inbox", async () => {
    const db = fakeDatabase();

    await acceptInvitation(input());

    expect(db.signUps[0].options).toEqual({ data: { name: "Sam Student" } });
  });

  /**
   * The role is never in this payload. It comes from the invitation, decided by whoever
   * issued it under `invitations_insert`.
   */
  it("never sends a role", async () => {
    const db = fakeDatabase();

    await acceptInvitation(input());

    expect(JSON.stringify(db.signUps[0])).not.toMatch(/role/i);
  });

  it("re-checks the token server-side before creating anything", async () => {
    const db = fakeDatabase({ invitation: null });

    const result = await acceptInvitation(input());

    expect(result.outcome).toBe("invalid-invitation");
    // A token that expired between page load and submit must not produce an account.
    expect(db.signUps).toHaveLength(0);
  });

  /**
   * With email confirmation on, `signUp` returns a user but no session, so the RPC — which
   * needs `auth.uid()` — can't run. Nothing is lost: the invitation is untouched and
   * reopening the link once signed in finishes the job through `completeInvitation`.
   */
  it("reports a missing session as needing confirmation, not as a failure", async () => {
    const db = fakeDatabase({ signUpSession: false });

    const result = await acceptInvitation(input());

    expect(result.outcome).toBe("needs-email-confirmation");
    expect(result.message).toMatch(/confirm your email/i);
    // Crucially, the invitation was not redeemed — it's still usable.
    expect(db.calls.some((call) => call.rpc === "redeem_invitation")).toBe(false);
  });

  it("explains an address that already has an account", async () => {
    fakeDatabase({
      signUpError: { code: "user_already_exists", message: "already registered" },
    });

    const result = await acceptInvitation(input());

    expect(result.outcome).toBe("failed");
    expect(result.message).toMatch(/sign in instead/i);
  });

  it("refuses mismatched passwords without touching anything", async () => {
    const db = fakeDatabase();

    const result = await acceptInvitation(input({ confirmPassword: "something-else" }));

    expect(result.outcome).toBe("failed");
    expect(db.signUps).toHaveLength(0);
  });

  it("refuses a password too short for Supabase to accept anyway", async () => {
    const db = fakeDatabase();

    const result = await acceptInvitation(input({ password: "short", confirmPassword: "short" }));

    expect(result.outcome).toBe("failed");
    expect(db.signUps).toHaveLength(0);
  });
});

describe("completeInvitation", () => {
  it("redeems for the account already signed in", async () => {
    const db = fakeDatabase();

    const result = await completeInvitation(TOKEN);

    expect(result.outcome).toBe("accepted");
    expect(db.calls).toEqual([{ rpc: "redeem_invitation", args: { p_token: TOKEN } }]);
  });

  /**
   * The RPC returns false for an invalid, used or expired token — and for one issued to a
   * different address than the signed-in account's, which is what stops a forwarded link
   * becoming somebody else's staff account.
   */
  it("reports a refused redemption as an invalid invitation", async () => {
    fakeDatabase({ redeemResult: false });

    const result = await completeInvitation(TOKEN);

    expect(result.outcome).toBe("invalid-invitation");
    expect(result.message).toMatch(/no longer valid/i);
  });

  it("refuses when nobody is signed in", async () => {
    const db = fakeDatabase({ signedInUser: null });

    const result = await completeInvitation(TOKEN);

    expect(result.outcome).toBe("failed");
    expect(db.calls).toHaveLength(0);
  });
});
