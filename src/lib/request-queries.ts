import { createClient } from "@/lib/supabase/server";
import { formatRequestDates } from "@/lib/request-format";
import type { RequestStatus } from "@/lib/schemas/request";

/** A term's worth of history without turning the screen into an archive. */
const HISTORY_LIMIT = 30;

export interface MyRequest {
  id: string;
  status: RequestStatus;
  /** Preformatted "6 – 7 Aug 2026". */
  dates: string;
  reason: string | null;
  startDate: string;
  endDate: string;
}

/**
 * The learner's own absence requests, newest first.
 *
 * Filtered to the requester explicitly: the database also shows a request to the people who
 * decide it, and this screen is only ever the learner's own list.
 *
 * Throws on a failed read: an empty list could prompt a duplicate request.
 */
export async function getMyRequests(): Promise<MyRequest[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("absence_requests")
    .select("id, status, start_date, end_date, reason, created_at")
    .eq("requester_id", user.id)
    .order("start_date", { ascending: false })
    .limit(HISTORY_LIMIT);

  if (error) {
    console.error("Requests query failed:", error.code, error.message);
    throw new Error("Couldn't load your requests.");
  }

  return data.map((row) => ({
    id: row.id,
    status: row.status,
    dates: formatRequestDates(row.start_date, row.end_date),
    reason: row.reason,
    startDate: row.start_date,
    endDate: row.end_date,
  }));
}
