import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-redirect";

/**
 * Where Supabase's emailed links land: password resets (`type=recovery`) and invitations
 * (`type=invite`, the email an accepted applicant receives).
 *
 * Supports both:
 *  1. PKCE auth code exchange (`?code=...`)
 *  2. Direct token verification (`?token_hash=...&type=recovery|invite`)
 *
 * Exchanging or verifying server-side ensures the session cookie is set through `@supabase/ssr`.
 */
const LINK_TYPES = { recovery: "/reset-password", invite: "/set-password" } as const;

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as "recovery" | "invite" | null;

  const defaultNext = type && LINK_TYPES[type] ? LINK_TYPES[type] : "/reset-password";
  const next = safeNextPath(searchParams.get("next"), defaultNext);
  const supabase = await createClient();

  // 1. Handle PKCE auth code exchange
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
    console.error("PKCE code exchange failed:", error.code, error.message);
  }

  // 2. Handle token hash OTP verification
  if (tokenHash && (type === "recovery" || type === "invite")) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
    console.error(`${type} link verification failed:`, error.code, error.message);
  }

  return NextResponse.redirect(new URL("/forgot-password?error=link", origin));
}
