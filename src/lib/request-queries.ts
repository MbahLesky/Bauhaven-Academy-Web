import { createClient } from "@/lib/supabase/server";
import { formatRequestDates } from "@/lib/request-format";
import type { RequestStatus } from "@/lib/schemas/request";

/** A term's worth of history without turning the screen into an archive. */
const HISTORY_LIMIT = 30;

export interface MyRequest {
  id: string;
  status: RequestStatus;
  /** Preformatted "6 – 7 Aug 2026", matching the wireframe's past-requests rows. */
  dates: string;
  reason: string | null;
  /** The raw `start_date`, kept for grouping upcoming absences separately from past ones. */
  startDate: string;
  endDate: string;
}

/**
 * The student's own absence requests.
 *
 * No `.eq("requester_id", ...)`: `requests_select` is
 * `requester_id = auth.uid() or auth_is_admin_or_staff()`, so RLS already scopes this for
 * a student. Duplicating the filter here would be a second, drift-prone copy of the
 * policy — the standing convention in this codebase, and the same reason the task and
 * attendance queries don't filter either.
 *
 * (The one consequence worth knowing: a Staff member signing into Academy would see every
 * student's requests on this screen, because the policy lets them. Academy is the
 * student-facing app and Staff belong in Admin-web, so that isn't worth a filter — but it
 * is the reason this function is named for the caller rather than the rows.)
 */
export async function getMyRequests(): Promise<{ requests: MyRequest[]; error: unknown }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("requests")
    .select("id, status, start_date, end_date, reason, created_at")
    .order("start_date", { ascending: false })
    .limit(HISTORY_LIMIT);

  if (error) {
    console.error("Requests query failed:", error.code, error.message);
    return { requests: [], error };
  }

  return {
    requests: data.map((row) => ({
      id: row.id,
      status: row.status,
      dates: formatRequestDates(row.start_date, row.end_date),
      reason: row.reason,
      startDate: row.start_date,
      endDate: row.end_date,
    })),
    error: null,
  };
}
