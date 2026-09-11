import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Runs on every request. Two jobs: (1) refresh the Supabase session so server
// components always see a fresh token, (2) gate everything that isn't /login
// behind an authenticated session. See Bauhaven-Architecture-Plan.md §6, "Auth
// strategy" — same shared Supabase Auth instance and the same pattern as
// Admin-web, deliberately: one login works everywhere, so the gate that
// protects it should behave identically in both apps.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Required even though the result isn't read directly — this call is what
  // actually triggers the token refresh via the setAll callback above.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute = request.nextUrl.pathname.startsWith("/login");

  // Invitation links have to work for somebody who has no account yet — that's the whole
  // point of them — so /invite is reachable without a session. It's also reachable *with*
  // one, unlike /login: an existing account can be invited to a second role, and someone
  // who confirmed their email comes back to the same link to finish. The token itself is
  // the credential, checked by `invitation_preview` and `redeem_invitation`.
  const isInviteRoute = request.nextUrl.pathname.startsWith("/invite");

  /*
   * The password-reset chain, all of which has to work for somebody who cannot sign in —
   * which is the entire reason they're here.
   *
   * `/auth/confirm` is where Supabase's emailed link lands, and it runs *before* a session
   * exists: it's the thing that creates one. `/reset-password` is reached with a recovery
   * session, so it would pass the check below anyway; it's named here so the rule reads as
   * one flow rather than two coincidences.
   */
  const isPasswordResetRoute =
    request.nextUrl.pathname.startsWith("/forgot-password") ||
    request.nextUrl.pathname.startsWith("/reset-password") ||
    request.nextUrl.pathname.startsWith("/auth/confirm");

  if (!user && !isAuthRoute && !isInviteRoute && !isPasswordResetRoute) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // `isPasswordResetRoute` is excluded: a recovery session *is* a session, and bouncing it
  // to the dashboard would end the reset at the last step — leaving the old password in
  // place and the person inside the app wondering whether it worked.
  if (user && isAuthRoute && !isPasswordResetRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Skip static assets and Next internals — no session check needed there.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
