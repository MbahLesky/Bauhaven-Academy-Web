"use server";

import { createClient } from "@/lib/supabase/server";
import { newPasswordSchema, type NewPasswordInput } from "@/lib/schemas/password-reset";

export type SetPasswordResult = { error: string | null };

const GENERIC_MESSAGE = "Couldn't do that. Try again in a moment.";
const EXPIRED_LINK_MESSAGE = "That invitation link has expired or has already been used. Ask for a new one.";

/**
 * Sets the first password of an invited account, using the session the emailed invitation
 * link established — `updateUser` acts on `auth.uid()`, so the link is what proves who this
 * is. They stay signed in and go straight in: the invitation was their welcome, and the
 * app's gate then shows them their programme.
 */
export async function setInitialPassword(input: NewPasswordInput): Promise<SetPasswordResult> {
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_MESSAGE };

  const supabase = await createClient();

  const { data: sessionUser } = await supabase.auth.getUser();
  if (!sessionUser.user) return { error: EXPIRED_LINK_MESSAGE };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    console.error("Initial password update failed:", error.code, error.message);
    return { error: GENERIC_MESSAGE };
  }

  return { error: null };
}
