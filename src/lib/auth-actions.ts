"use server";

import { createClient } from "@/lib/supabase/server";
import { signInSchema, type SignInInput } from "@/lib/schemas/auth";

export type SignInResult = { error: string | null };

/**
 * Signs in against the shared Supabase Auth instance.
 *
 * One account works across Core, Admin and Academy — see
 * Bauhaven-Architecture-Plan.md §6. There is no Academy-specific credential
 * check here and there shouldn't be: which app someone may *use* is a question
 * about their roles and RLS, not about whether they can authenticate.
 */
export async function signIn(input: SignInInput): Promise<SignInResult> {
  // Server-side validation backstop — the client already validated this via
  // react-hook-form + the same schema, but never trust the client alone
  // (Bauhaven-Coding-Standards.md, security baseline).
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Enter a valid email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Deliberately generic — never distinguish "wrong password" from "no such
    // account" (account enumeration). The real reason is still logged
    // server-side for debugging, just not surfaced to the user.
    console.error("Sign-in failed:", error.code, error.message);
    return { error: "Invalid email or password." };
  }

  return { error: null };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
