import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/date-format";

/** A term's worth of history without turning the screen into an archive. */
const HISTORY_LIMIT = 30;

export interface MyTestimony {
  id: string;
  content: string;
  rating: number | null;
  /** Whether the learner allowed Bauhaven to feature it. */
  publicUse: boolean;
  /** Preformatted "12 Jul 2026". Null when the timestamp won't parse. */
  sharedOn: string | null;
}

/**
 * The learner's own feedback, newest first.
 *
 * **Filtered by the caller explicitly.** The website's reviews are one table for everyone
 * who leaves one, and a screen headed "Your feedback" must only ever list the learner's own.
 *
 * Throws on a failed read: an empty list would say "you've never shared anything" and could
 * prompt the same thing twice.
 */
export async function getMyTestimonies(): Promise<MyTestimony[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("website_reviews")
    .select("id, message, rating, allow_public_use, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  if (error) {
    console.error("Testimonies query failed:", error.code, error.message);
    throw new Error("Couldn't load your feedback.");
  }

  return data.map((row) => ({
    id: row.id,
    content: row.message,
    rating: row.rating,
    publicUse: row.allow_public_use === true,
    sharedOn: formatDate(row.created_at),
  }));
}
