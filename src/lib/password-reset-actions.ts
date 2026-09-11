"use server";

import { createClient } from "@/lib/supabase/server";
import {
  newPasswordSchema,
  requestResetSchema,
  type NewPasswordInput,
  type RequestResetInput,
} from "@/lib/schemas/password-reset";

export type ResetRequestResult = { error: string | null };
export type NewPasswordResult = { error: string | null };

/*
 * What somebody is told after asking for a reset link is **the same whether or not the
 * address has an account** — which is why `requestPasswordReset` returns no error for an
 * unknown one, and why the wording lives on the page rather than being chosen here.
 * Anything else turns the form into a way to ask who is enrolled at Bauhaven, the same
 * enumeration problem the sign-in form avoids by never distinguishing a wrong password
 * from a missing account.
 */

const GENERIC_MESSAGE = "Couldn't do that. Try again in a moment.";
const EXPIRED_LINK_MESSAGE =
  "That reset link has expired or has already been used. Ask for a new one.";

/**
 * Sends a password-reset email.
 *
 * **The one piece of mail this platform can send without a provider being configured**: it
 * goes through Supabase Auth's own mailer, the same one already sending the confirmation
 * for a new sign-up. Invitations still can't be emailed — those are arbitrary application
 * mail, which does need a provider.
 *
 * It matters most here. Academy is where the accounts an Admin created by hand end up, with
 * a password somebody else chose and read out — precisely the password nobody remembers a
 * fortnight later. Until now that meant finding an Admin.
 */
export async function requestPasswordReset(
  input: RequestResetInput
): Promise<ResetRequestResult> {
  const parsed = requestResetSchema.safeParse(input);
  // Even a malformed address gets the neutral answer — "that isn't a valid email" is fine
  // to say, but it must not become a different answer from "no account here".
  if (!parsed.success) return { error: "Enter a valid email address." };

  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    // Supabase's link lands on its own /verify endpoint, which then redirects here. The
    // route handler exchanges the token for a session and forwards to the form.
    redirectTo: resetRedirectUrl(),
  });

  if (error) {
    // Logged, not shown. A rate limit or a mailer fault is real information for us and an
    // account-existence oracle for anybody probing the form.
    console.error("Password reset request failed:", error.code, error.message);
  }

  return { error: null };
}

/**
 * Sets the new password, using the recovery session the emailed link established.
 *
 * `updateUser` acts on `auth.uid()`, so the link is what proves who this is — there is no
 * email field on this form and no way to aim it at another account.
 *
 * **Signs out afterwards on purpose.** A recovery session is a session, so without this
 * somebody lands straight in the app — or, if they aren't enrolled yet, on the pending
 * screen — while still holding a session minted by an email link rather than by a password
 * they just proved they know. Ending it costs one deliberate step and keeps a single door
 * into the app.
 */
export async function setNewPassword(input: NewPasswordInput): Promise<NewPasswordResult> {
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_MESSAGE };
  }

  const supabase = await createClient();

  const { data: sessionUser } = await supabase.auth.getUser();
  if (!sessionUser.user) return { error: EXPIRED_LINK_MESSAGE };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    console.error("Password update failed:", error.code, error.message);
    // Supabase refuses a password identical to the current one; that message is worth
    // passing through, since "try again" would leave somebody retyping the same thing.
    if (error.code === "same_password") {
      return { error: "That's already your password. Choose a different one." };
    }
    return { error: GENERIC_MESSAGE };
  }

  await supabase.auth.signOut();
  return { error: null };
}

/**
 * Where Supabase sends them after it verifies the emailed token.
 *
 * Built from the configured app URL rather than from request headers, for the same reason
 * invitation links are: `Host` is attacker-controllable, and a poisoned redirect on a
 * password-reset link is a credential-harvesting page reached from a genuine email.
 *
 * `NEXT_PUBLIC_ACADEMY_URL` is the name Admin-web already uses for this app's address, so
 * a deployment sets one value under one name rather than two under two.
 */
function resetRedirectUrl(): string {
  const base = (process.env.NEXT_PUBLIC_ACADEMY_URL ?? "").replace(/\/$/, "");
  return `${base}/auth/confirm?next=/reset-password`;
}
