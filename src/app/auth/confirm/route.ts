import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-redirect";

/**
 * Where Supabase's emailed links land: password resets (`type=recovery`) and invitations
 * (`type=invite`, the email an accepted applicant receives).
 *
 * The email template links here with `token_hash` and `type`. Exchanging that for a session
 * has to happen server-side so the session cookie is set through `@supabase/ssr` — the same
 * path every other request in this app reads its session from.
 *
 * **A one-time token in a URL, so it is spent here and nowhere else.** `verifyOtp` consumes
 * it and the browser is redirected without it, which keeps it out of the address bar,
 * browser history and any `Referer` sent by the page that follows.
 *
 * `next` is deliberately restricted to a path on this origin. It arrives in a query string
 * on a link that people click from their inbox, and an unchecked one is an open redirect
 * with a freshly minted session attached.
 */
const LINK_TYPES = { recovery: "/reset-password", invite: "/set-password" } as const;

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (!tokenHash || (type !== "recovery" && type !== "invite")) {
    return NextResponse.redirect(new URL("/forgot-password?error=link", origin));
  }

  const next = safeNextPath(searchParams.get("next"), LINK_TYPES[type]);
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    // Expired, already used, or tampered with. All three are the same thing to the person
    // holding it: ask for another one. That works for an invitation too — a reset link sets
    // the first password of an invited account just as well.
    console.error(`${type} link verification failed:`, error.code, error.message);
    return NextResponse.redirect(new URL("/forgot-password?error=link", origin));
  }

  return NextResponse.redirect(new URL(next, origin));
}
