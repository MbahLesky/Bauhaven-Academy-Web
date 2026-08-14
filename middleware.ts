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

  const isAuthRoute =
    request.nextUrl.pathname.startsWith("/login") ||
    // Signing up is applying — the person has no account yet, by definition.
    request.nextUrl.pathname.startsWith("/signup");

  // Invitation links have to work for somebody who has no account yet — that's the whole
  // point of them — so /invite is reachable without a session. It's also reachable *with*
  // one, unlike /login: an existing account can be invited to a second role, and someone
  // who confirmed their email comes back to the same link to finish. The token itself is
  // the credential, checked by `invitation_preview` and `redeem_invitation`.
  const isInviteRoute = request.nextUrl.pathname.startsWith("/invite");

  if (!user && !isAuthRoute && !isInviteRoute) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isAuthRoute) {
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
