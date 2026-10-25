"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  newPasswordSchema,
  requestResetSchema,
  type NewPasswordInput,
  type RequestResetInput,
} from "@/lib/schemas/password-reset";

export type ResetRequestResult = { error: string | null };
export type NewPasswordResult = { error: string | null };

const GENERIC_MESSAGE = "Couldn't do that. Try again in a moment.";
const EXPIRED_LINK_MESSAGE =
  "That reset link has expired or has already been used. Ask for a new one.";

/**
 * Sends a password-reset email.
 */
export async function requestPasswordReset(
  input: RequestResetInput
): Promise<ResetRequestResult> {
  const parsed = requestResetSchema.safeParse(input);
  if (!parsed.success) return { error: "Enter a valid email address." };

  const supabase = await createClient();
  const redirectTo = await resetRedirectUrl();

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo,
  });

  if (error) {
    console.error("Password reset request failed:", error.code, error.message);
  }

  return { error: null };
}

/**
 * Sets the new password, using the recovery session the emailed link established.
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
 * Robust fallback chain:
 * 1. Explicit env var NEXT_PUBLIC_HUB_URL or NEXT_PUBLIC_ACADEMY_URL (if configured)
 * 2. Incoming request Host / x-forwarded-host
 * 3. Default production URL https://hub.bauhaven.com
 */
async function resetRedirectUrl(): Promise<string> {
  const envUrl = (process.env.NEXT_PUBLIC_HUB_URL || process.env.NEXT_PUBLIC_ACADEMY_URL || "").trim().replace(/\/$/, "");
  if (envUrl && !envUrl.includes("0.0.0.0") && !envUrl.includes("localhost")) {
    return `${envUrl}/auth/confirm?next=/reset-password`;
  }

  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    if (host && !host.includes("0.0.0.0") && !host.includes("localhost")) {
      const proto = h.get("x-forwarded-proto") || "https";
      return `${proto}://${host}/auth/confirm?next=/reset-password`;
    }
  } catch {}

  // Local development fallback
  if (envUrl && envUrl.includes("localhost")) {
    return `${envUrl}/auth/confirm?next=/reset-password`;
  }

  return "https://hub.bauhaven.com/auth/confirm?next=/reset-password";
}
