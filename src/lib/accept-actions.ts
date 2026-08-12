"use server";

import { createClient } from "@/lib/supabase/server";
import { acceptInvitationSchema, type AcceptInvitationInput } from "@/lib/schemas/accept";

export type AcceptOutcome =
  /** Account created, role granted, session live. */
  | "accepted"
  /**
   * The account exists but there is no session yet — the project has email confirmation
   * switched on. The invitation is untouched and still redeemable.
   */
  | "needs-email-confirmation"
  /** The token is invalid, already used, expired, or issued to a different address. */
  | "invalid-invitation"
  | "failed";

export interface AcceptResult {
  outcome: AcceptOutcome;
  message: string;
}

const INVALID_MESSAGE =
  "This invitation link is no longer valid — it may have been used already or expired. Ask whoever invited you to send a new one.";
const CONFIRM_MESSAGE =
  "Your account was created. Confirm your email address, then open this same link again to finish setting up.";
const VALIDATION_MESSAGE = "Check the form and try again.";
const FAILED_MESSAGE = "Couldn't finish setting up your account. Try again in a moment.";
const TAKEN_MESSAGE =
  "There's already an account for this email. Sign in instead — if you've forgotten the password, ask an admin.";

/**
 * Turns an invitation into an account.
 *
 * **No service-role key anywhere in this flow.** It runs as the invitee: `signUp` creates
 * the auth user (and `handle_new_user()` the `public.users` row), then the
 * `redeem_invitation` RPC — `security definer`, and able to do exactly two things — grants
 * the role the invitation names and enrols them if it carries a program. A service-role
 * key in an app's environment is a standing bypass of RLS on every table, which is too
 * much to hold for one flow that writes two rows.
 *
 * **The role is never taken from this form.** It comes from the invitation, decided by
 * whoever issued it under `invitations_insert`. The invitee proves only that they hold the
 * token and control the address it was sent to — the RPC checks the signed-in account's
 * email against the invitation's, which is what stops a forwarded link becoming somebody
 * else's staff account.
 *
 * **Order matters, and the failure mode is deliberate.** The account is created before the
 * invitation is redeemed, so a redemption that fails leaves a usable account with no role
 * rather than a consumed invitation with no account. The former is recoverable by opening
 * the link again; the latter needs an Admin to reissue.
 */
export async function acceptInvitation(input: AcceptInvitationInput): Promise<AcceptResult> {
  const parsed = acceptInvitationSchema.safeParse(input);
  if (!parsed.success) {
    console.error("Invitation acceptance rejected by validation:", parsed.error.issues);
    return { outcome: "failed", message: VALIDATION_MESSAGE };
  }

  const supabase = await createClient();

  // Re-checked here rather than trusted from the page that rendered the form: a token can
  // expire or be revoked between load and submit, and this is a Server Action reachable
  // by direct POST.
  const preview = await supabase.rpc("invitation_preview", { p_token: parsed.data.token });

  if (preview.error) {
    console.error("Invitation preview failed:", preview.error.code, preview.error.message);
    return { outcome: "failed", message: FAILED_MESSAGE };
  }

  const invitation = preview.data?.[0];
  if (!invitation) return { outcome: "invalid-invitation", message: INVALID_MESSAGE };

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    // From the invitation, never from the form — see the doc comment.
    email: invitation.email,
    password: parsed.data.password,
    // `handle_new_user()` reads `raw_user_meta_data->>'name'`, falling back to the local
    // part of the address. Passing it means the directory shows a person, not an inbox.
    options: { data: { name: parsed.data.name } },
  });

  if (signUpError) {
    console.error("Invitation sign-up failed:", signUpError.code, signUpError.message);
    // Supabase reports an existing address this way. The invitation is still unredeemed,
    // so signing in and reopening the link will finish the job.
    if (signUpError.code === "user_already_exists") {
      return { outcome: "failed", message: TAKEN_MESSAGE };
    }
    return { outcome: "failed", message: FAILED_MESSAGE };
  }

  // With email confirmation on, `signUp` returns a user but no session. Nothing is lost —
  // the invitation is still unredeemed, and reopening the link once signed in completes
  // it through `completeInvitation` below.
  if (!signUpData.session) {
    return { outcome: "needs-email-confirmation", message: CONFIRM_MESSAGE };
  }

  return completeInvitation(parsed.data.token);
}

/**
 * Redeems an invitation for the account already signed in.
 *
 * Two paths reach this: straight after sign-up, and when somebody opens their invitation
 * link while already signed in — which is what happens after confirming an email, and what
 * happens to an existing account being given a second role by invitation.
 */
export async function completeInvitation(token: string): Promise<AcceptResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { outcome: "failed", message: FAILED_MESSAGE };

  const { data, error } = await supabase.rpc("redeem_invitation", { p_token: token });

  if (error) {
    console.error("Invitation redemption failed:", error.code, error.message);
    return { outcome: "failed", message: FAILED_MESSAGE };
  }

  // The RPC returns false for an invalid, used or expired token, and for one issued to a
  // different address than the signed-in account's.
  if (data !== true) return { outcome: "invalid-invitation", message: INVALID_MESSAGE };

  return { outcome: "accepted", message: "You're all set." };
}
