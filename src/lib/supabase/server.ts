import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Supabase client for use in Server Components, Server Actions, and Route Handlers.
 * Reads the session from cookies so RLS policies see the real authenticated user
 * (auth.uid()), not an anonymous session — this is what makes server-side data
 * fetching respect the same RLS policies as the browser client.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component that can't set cookies (e.g. during
            // render) — safe to ignore as long as middleware refreshes the session.
            // See error-handling-and-logging: this is a known, non-actionable case,
            // not a silently-swallowed real error.
          }
        },
      },
    }
  );
}
