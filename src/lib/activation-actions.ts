"use server";

import { createClient } from "@/lib/supabase/server";

export interface VerifyCodeResult {
  ok: boolean;
  email?: string;
  error?: string;
}

export interface ActivateResult {
  ok: boolean;
  error?: string;
}

/**
 * Checks if a participant invitation activation code (e.g. BAUHAVEN-LUHAT9)
 * is valid and redeemable.
 */
export async function verifyActivationCode(rawCode: string): Promise<VerifyCodeResult> {
  const token = rawCode.trim().toUpperCase();
  if (!token || token.length < 5) {
    return { ok: false, error: "Please enter a valid activation code." };
  }

  const supabase = await createClient();

  try {
    const { data, error } = await supabase.functions.invoke("verify-participant-invitation", {
      body: { token },
    });

    if (error || !data || !data.email) {
      return {
        ok: false,
        error: "This activation code is invalid, expired, or has already been used.",
      };
    }

    return {
      ok: true,
      email: data.email,
    };
  } catch (err) {
    console.error("verifyActivationCode exception:", err);
    return { ok: false, error: "Could not verify code. Please try again." };
  }
}

/**
 * Activates the participant account with the chosen password and signs them in.
 */
export async function activateWithCode(
  rawCode: string,
  password: string
): Promise<ActivateResult> {
  const token = rawCode.trim().toUpperCase();
  if (!token) {
    return { ok: false, error: "Activation code is required." };
  }

  if (!password || password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();

  try {
    // 1. Activate via Edge Function
    const { data, error } = await supabase.functions.invoke("activate-participant-account", {
      body: { token, password },
    });

    if (error || !data || !data.email) {
      console.error("activate-participant-account error:", error, data);
      return {
        ok: false,
        error: data?.error || "This activation code could not be redeemed.",
      };
    }

    // 2. Sign in with the newly activated credentials to set session cookies
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password,
    });

    if (signInError) {
      console.error("Post-activation sign-in error:", signInError);
      return {
        ok: false,
        error: "Account activated, but sign-in failed. Please sign in on the login page.",
      };
    }

    return { ok: true };
  } catch (err) {
    console.error("activateWithCode exception:", err);
    return { ok: false, error: "Activation failed. Please try again." };
  }
}
