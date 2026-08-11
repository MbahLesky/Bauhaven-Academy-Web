import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/date-format";
import type { TestimonyStatus } from "@/lib/schemas/testimony";

/** A term's worth of history without turning the screen into an archive. */
const HISTORY_LIMIT = 30;

export interface MyTestimony {
  id: string;
  status: TestimonyStatus;
  /** Whichever language column carries this testimony's words. */
  content: string;
  /** Preformatted "12 Jul 2026". Null when the timestamp won't parse. */
  sharedOn: string | null;
}

/**
 * The student's own testimonies, newest first.
 *
 * **This is the one Academy query that must filter by the caller itself**, and the reason
 * is worth stating because it breaks the convention every other query here follows.
 * `testimonies_select` is
 * `user_id = auth.uid() or status = 'published' or auth_is_admin_or_staff()` — and that
 * middle arm is **not scoped to the caller**. Trusting RLS the way the task, request and
 * issue-report queries do would return every published testimony in the company, so a
 * screen headed "Your testimonies" would list other students' words as though they were
 * this student's. The explicit `.eq("user_id", ...)` is the fix.
 *
 * (`attendance_sessions_select` being `using (true)` is the other place a policy doesn't
 * scope; this is the second, and the more dangerous of the two, because here the rows
 * belong to identifiable other people.)
 */
export async function getMyTestimonies(): Promise<{
  testimonies: MyTestimony[];
  error: unknown;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No session means no rows to show. The route is behind middleware's gate, so this is a
  // guard against the impossible rather than an expected path.
  if (!user) return { testimonies: [], error: null };

  const { data, error } = await supabase
    .from("testimonies")
    .select("id, status, content_en, content_fr, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  if (error) {
    console.error("Testimonies query failed:", error.code, error.message);
    return { testimonies: [], error };
  }

  return {
    testimonies: data.map((row) => ({
      id: row.id,
      status: row.status,
      // Exactly one column is populated by this app, and the table's own check constraint
      // guarantees at least one is present — but a row curated in Admin-web could later
      // carry both, so this prefers whichever exists rather than assuming.
      content: row.content_en ?? row.content_fr ?? "",
      sharedOn: formatDate(row.created_at),
    })),
    error: null,
  };
}
