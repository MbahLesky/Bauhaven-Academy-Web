import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: () => mockCreateClient() }));

import { signUpAndApply } from "./signup-actions";

const USER_ID = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
const PROGRAM = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

function fakeBackend({
  session = true,
  signUpError = null as { code: string; message: string } | null,
  applicationError = null as { code: string; message: string } | null,
} = {}) {
  const signUps: Record<string, unknown>[] = [];
  const applications: Record<string, unknown>[] = [];

  mockCreateClient.mockResolvedValue({
    auth: {
      signUp: (input: Record<string, unknown>) => {
        signUps.push(input);
        if (signUpError) return Promise.resolve({ data: {}, error: signUpError });
        return Promise.resolve({
          data: { user: { id: USER_ID }, session: session ? { access_token: "t" } : null },
          error: null,
        });
      },
    },
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        if (applicationError) return Promise.resolve({ error: applicationError });
        applications.push(row);
        return Promise.resolve({ error: null });
      },
    }),
  });

  return { signUps, applications };
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    name: "Ada Applicant",
    email: "ada@example.com",
    phone: "+237677000000",
    program_id: PROGRAM,
    message: "I'd like to learn web development.",
    password: "correct-horse",
    confirmPassword: "correct-horse",
    ...overrides,
  } as Parameters<typeof signUpAndApply>[0];
}

beforeEach(() => {
  mockCreateClient.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("signUpAndApply", () => {
  /** Signing up *is* applying — there is no account without an application. */
  it("creates the account and files the application together", async () => {
    const backend = fakeBackend();

    const result = await signUpAndApply(input());

    expect(result.outcome).toBe("applied");
    expect(backend.signUps).toHaveLength(1);
    expect(backend.applications).toHaveLength(1);
  });

  /**
   * An application naming someone else's account would be noise rather than escalation —
   * approving it grants a role to *them* — but the app shouldn't produce that confusion.
   */
  it("takes applicant_id from the new session, not the form", async () => {
    const backend = fakeBackend();

    await signUpAndApply({ ...input(), applicant_id: "someone-else" } as never);

    expect(backend.applications[0].applicant_id).toBe(USER_ID);
  });

  it("records what they applied for", async () => {
    const backend = fakeBackend();

    await signUpAndApply(input());

    expect(backend.applications[0]).toMatchObject({
      applicant_name: "Ada Applicant",
      applicant_email: "ada@example.com",
      applicant_phone: "+237677000000",
      // A real programmes row, so approval already knows the cohort to enrol on.
      program_id: PROGRAM,
    });
  });

  // The review flow owns the workflow state; it defaults to 'submitted'.
  it("never sends a status", async () => {
    const backend = fakeBackend();

    await signUpAndApply(input());

    expect(backend.applications[0]).not.toHaveProperty("status");
  });

  // `handle_new_user()` falls back to the local part of the address, so the reviewer would
  // otherwise be looking at an inbox rather than a person.
  it("passes the name through to the account", async () => {
    const backend = fakeBackend();

    await signUpAndApply(input());

    expect(backend.signUps[0].options).toEqual({ data: { name: "Ada Applicant" } });
  });

  /**
   * Email confirmation on. Not a failure: the account exists and the application is filed,
   * so the only thing outstanding is a link Supabase has already sent.
   */
  it("reports a missing session as check-your-email, with the application still filed", async () => {
    const backend = fakeBackend({ session: false });

    const result = await signUpAndApply(input());

    expect(result.outcome).toBe("check-your-email");
    expect(result.message).toMatch(/check your email/i);
    // The important half: applying still happened.
    expect(backend.applications).toHaveLength(1);
  });

  it("tells an existing account to sign in instead", async () => {
    const backend = fakeBackend({
      signUpError: { code: "user_already_exists", message: "registered" },
    });

    const result = await signUpAndApply(input());

    expect(result.outcome).toBe("already-registered");
    expect(result.message).toMatch(/sign in instead/i);
    expect(backend.applications).toHaveLength(0);
  });

  /**
   * The account is created first on purpose: a failed application leaves a usable account
   * they can apply from again. The reverse — an application naming an account that doesn't
   * exist — is not recoverable by them at all.
   */
  it("says the account survived when only the application failed", async () => {
    fakeBackend({ applicationError: { code: "08006", message: "connection lost" } });

    const result = await signUpAndApply(input());

    expect(result.outcome).toBe("failed");
    expect(result.message).toMatch(/account was created/i);
    expect(result.message).toMatch(/try applying again/i);
  });

  it("refuses mismatched passwords without creating anything", async () => {
    const backend = fakeBackend();

    const result = await signUpAndApply(input({ confirmPassword: "different" }));

    expect(result.outcome).toBe("failed");
    expect(backend.signUps).toHaveLength(0);
  });

  it("requires a programme to apply to", async () => {
    const backend = fakeBackend();

    const result = await signUpAndApply(input({ program_id: "" }));

    expect(result.outcome).toBe("failed");
    expect(backend.signUps).toHaveLength(0);
  });

  it("refuses a password shorter than the floor", async () => {
    const backend = fakeBackend();

    const result = await signUpAndApply(input({ password: "short12", confirmPassword: "short12" }));

    expect(result.outcome).toBe("failed");
    expect(backend.signUps).toHaveLength(0);
  });
});
