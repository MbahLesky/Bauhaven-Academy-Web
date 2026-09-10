import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-redirect";

/**
 * Where Supabase's emailed links land.
 *
 * The mail contains a link to Supabase's own `/auth/v1/verify`, which checks the token and
 * then redirects here with `token_hash` and `type`. Exchanging that for a session has to
 * happen server-side so the session cookie is set through `@supabase/ssr` — the same path
 * every other request in this app reads its session from.
 *
 * **A one-time token in a URL, so it is spent here and nowhere else.** `verifyOtp` consumes
 * it and the browser is redirected without it, which keeps it out of the address bar,
 * browser history and any `Referer` sent by the page that follows.
 *
 * `next` is deliberately restricted to a path on this origin. It arrives in a query string
 * on a link that people click from their inbox, and an unchecked one is an open redirect
 * with a freshly minted session attached.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeNextPath(searchParams.get("next"), "/reset-password");

  if (!tokenHash || type !== "recovery") {
    return NextResponse.redirect(new URL("/forgot-password?error=link", origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });

  if (error) {
    // Expired, already used, or tampered with. All three are the same thing to the person
    // holding it: ask for another one.
    console.error("Recovery link verification failed:", error.code, error.message);
    return NextResponse.redirect(new URL("/forgot-password?error=link", origin));
  }

  return NextResponse.redirect(new URL(next, origin));
}
