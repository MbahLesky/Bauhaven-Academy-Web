import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-redirect";

/**
 * Where Supabase's emailed links land: password resets (`type=recovery`), invitations
 * (`type=invite`), email confirmations (`type=signup`), and email changes (`type=email_change`).
 *
 * Supports:
 *  1. PKCE auth code exchange (`?code=...`)
 *  2. Direct token verification (`?token_hash=...&type=...`)
 *  3. URL hash fragment tokens (`#access_token=...&type=...`) via client bridge
 */
const LINK_TYPES: Record<string, string> = {
  recovery: "/reset-password",
  invite: "/set-password",
  signup: "/dashboard?confirmed=true",
  email_change: "/dashboard?email_changed=true",
  magiclink: "/dashboard",
};

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
  const type = searchParams.get("type");

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
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "recovery" | "invite" | "signup" | "email_change" | "magiclink",
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(new URL(next, safeOrigin));
    }
    console.error(`${type} link verification failed:`, error.code, error.message);
  }

  // 3. Fallback for URL Hash Fragments:
  // Supabase verify redirects often carry tokens in the URL fragment (#access_token=...&type=recovery).
  // Because fragments are never sent to the server in HTTP requests, render a client bridge
  // that reads window.location.hash, syncs cookies via /auth/session, and routes cleanly.
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authenticating — Bauhaven Hub</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #f8f9fa;
      color: #1a1a1a;
    }
    .card {
      text-align: center;
      background: #fff;
      padding: 32px;
      border-radius: 12px;
      border: 1px solid #eaeaea;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
      max-width: 400px;
      width: 90%;
    }
    .spinner {
      width: 36px;
      height: 36px;
      border: 3px solid #e0e0e0;
      border-top-color: #F26B3B;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h2 style="margin: 0 0 8px; font-size: 18px; font-weight: 700;">Verifying link...</h2>
    <p style="margin: 0; font-size: 14px; color: #666;">Completing your authentication securely.</p>
  </div>
  <script>
    (async function() {
      try {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const error = params.get('error_description') || params.get('error');
        if (error) {
          window.location.replace('/forgot-password?error=' + encodeURIComponent(error));
          return;
        }

        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const authType = params.get('type') || '';

        if (!accessToken || !refreshToken) {
          window.location.replace('/forgot-password?error=link');
          return;
        }

        const res = await fetch('/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken })
        });

        if (!res.ok) {
          throw new Error('Failed to synchronize session');
        }

        let target = authType === 'recovery' ? '/reset-password' :
                     authType === 'invite' ? '/set-password' :
                     authType === 'signup' ? '/dashboard?confirmed=true' :
                     authType === 'email_change' ? '/dashboard?email_changed=true' :
                     ${JSON.stringify(next)};

        window.location.replace(target);
      } catch (err) {
        console.error(err);
        window.location.replace('/forgot-password?error=link');
      }
    })();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
