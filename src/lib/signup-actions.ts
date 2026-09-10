"use server";

import { createClient } from "@/lib/supabase/server";
import { signUpSchema, type SignUpInput } from "@/lib/schemas/signup";

export type SignUpOutcome =
  /** Account created, application filed, session live — straight into the pending screen. */
  | "applied"
  /**
   * Account created and application filed, but email confirmation is on so there's no
   * session yet. Nothing is lost; confirming and signing in lands them on the same screen.
   */
  | "check-your-email"
  /** The address already has an account. They should sign in, not sign up. */
  | "already-registered"
  | "failed";

export interface SignUpResult {
  outcome: SignUpOutcome;
  message: string;
}

const ALREADY_REGISTERED_MESSAGE =
  "There's already an account for this email. Sign in instead — if you've applied before, you'll see where it stands.";
const CONFIRM_MESSAGE =
  "Check your email to confirm your address, then sign in. Your application is already with us.";
const VALIDATION_MESSAGE = "Check the form and try again.";
const FAILED_MESSAGE = "Couldn't create your account. Try again in a moment.";
const APPLICATION_FAILED_MESSAGE =
  "Your account was created, but the application didn't save. Sign in and try applying again.";

/**
 * Creates an account and files an application in one step.
 *
 * **Signing up is applying.** There's no separate apply step and no account that exists
 * without an application — that's the simplification this replaced the invitation-only
 * student path with. An Admin approves the application, which grants the role and the
 * enrolment together.
 *
 * **No service-role key**, consistent with the invitation flow: this runs as the person
 * signing up. `applications_insert_public` is `with check (true)`, so an authenticated
 * caller can insert their own row, and `012` added the `applicant_id = auth.uid()` arm to
 * `applications_select` so they can then read it back on the pending screen.
 *
 * **The account is created before the application, deliberately.** If the application
 * insert fails, they have a usable account with no application — recoverable by applying
 * again once signed in. The reverse (an application naming an account that doesn't exist)
 * is not recoverable by them at all.
 *
 * **`applicant_id` comes from the session, never the form.** An application naming
 * somebody else's account would be noise rather than escalation — approving it grants a
 * role to *them*, not the submitter — but the app shouldn't produce that confusion.
 */
export async function signUpAndApply(input: SignUpInput): Promise<SignUpResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    console.error("Sign-up rejected by validation:", parsed.error.issues);
    return { outcome: "failed", message: VALIDATION_MESSAGE };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    // `handle_new_user()` reads `raw_user_meta_data->>'name'`, falling back to the local
    // part of the address — so passing it means the reviewer sees a person, not an inbox.
    options: { data: { name: parsed.data.name } },
  });

  if (error) {
    console.error("Sign-up failed:", error.code, error.message);
    if (error.code === "user_already_exists") {
      return { outcome: "already-registered", message: ALREADY_REGISTERED_MESSAGE };
    }
    return { outcome: "failed", message: FAILED_MESSAGE };
  }

  const applicantId = data.user?.id ?? null;

  const { error: applicationError } = await supabase.from("applications").insert({
    applicant_name: parsed.data.name,
    applicant_email: parsed.data.email,
    applicant_phone: parsed.data.phone,
    // A real programme, not the marketing site's category slug — Academy can offer the
    // actual catalogue, so an approved application already knows which cohort to enrol on.
    program_id: parsed.data.program_id,
    applicant_id: applicantId,
    message: parsed.data.message,
    // `status` is never sent: it defaults to 'submitted', and the review flow owns it.
  });

  if (applicationError) {
    console.error(
      "Application insert failed after sign-up:",
      applicationError.code,
      applicationError.message
    );
    return { outcome: "failed", message: APPLICATION_FAILED_MESSAGE };
  }

  // With email confirmation on, `signUp` returns a user but no session. The application is
  // filed either way — confirming and signing in lands them on the same pending screen.
  if (!data.session) {
    return { outcome: "check-your-email", message: CONFIRM_MESSAGE };
  }

  return { outcome: "applied", message: "Your application is in." };
}
