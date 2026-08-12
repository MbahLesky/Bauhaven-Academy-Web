import { z } from "zod";

// Its own module, not the actions file — a "use server" file can only export async
// functions, and a schema exported from one silently isn't the real schema by the time a
// client component imports it.

/**
 * Supabase Auth's own minimum is 6 characters. Eight is this project's floor because the
 * one thing a password on a shared, low-end Android device has to survive is a guess from
 * somebody standing nearby, and six digits is a PIN.
 */
const MIN_PASSWORD_LENGTH = 8;

const MAX_NAME_LENGTH = 120;

/**
 * Accepting an invitation.
 *
 * There is no email field: the address comes from the invitation, and `redeem_invitation`
 * checks the signed-in account's address against it. Letting someone type an email here
 * would let them redeem an invitation issued to somebody else — the token would be theirs
 * but the account wouldn't be.
 */
export const acceptInvitationSchema = z
  .object({
    token: z.string().min(20, "That invitation link doesn't look right"),
    name: z
      .string()
      .trim()
      .min(1, "Tell us your name")
      .max(MAX_NAME_LENGTH, "That name is too long"),
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    // A mistyped password on a screen with no "forgot password" flow yet is a locked-out
    // account, so it's worth the second field.
    error: "Those don't match",
    path: ["confirmPassword"],
  });

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

export const EMPTY_ACCEPT: AcceptInvitationInput = {
  token: "",
  name: "",
  password: "",
  confirmPassword: "",
};
