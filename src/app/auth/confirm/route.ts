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

function resolveSafeOrigin(request: NextRequest): string {
  const envUrl = (process.env.NEXT_PUBLIC_HUB_URL || process.env.NEXT_PUBLIC_ACADEMY_URL || "").trim().replace(/\/$/, "");
  if (envUrl && !envUrl.includes("0.0.0.0") && !envUrl.includes("localhost")) {
    return envUrl;
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host");
  if (host && !host.includes("0.0.0.0") && !host.includes("localhost")) {
    const proto = request.headers.get("x-forwarded-proto") || "https";
    return `${proto}://${host}`;
  }

  if (request.nextUrl.origin && !request.nextUrl.origin.includes("0.0.0.0") && !request.nextUrl.origin.includes("localhost")) {
    return request.nextUrl.origin;
  }

  // Local development fallback
  if (envUrl && envUrl.includes("localhost")) {
    return envUrl;
  }

  return "https://hub.bauhaven.com";
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const safeOrigin = resolveSafeOrigin(request);

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
      return NextResponse.redirect(new URL(next, safeOrigin));
    }
    console.error("PKCE code exchange failed:", error.code, error.message);
  }

  // 2. Handle token hash OTP verification
  if (tokenHash && (type === "recovery" || type === "invite")) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(next, safeOrigin));
    }
    console.error(`${type} link verification failed:`, error.code, error.message);
  }

  return NextResponse.redirect(new URL("/forgot-password?error=link", safeOrigin));
}
