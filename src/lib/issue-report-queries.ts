import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/date-format";
import type { IssueStatus } from "@/lib/schemas/issue-report";

/** A term's worth of history without turning the screen into an archive. */
const HISTORY_LIMIT = 30;

export interface MyIssueReport {
  id: string;
  status: IssueStatus;
  /** The stored value, not the label — the card formats it. */
  category: string;
  description: string;
  /** Preformatted "12 Jul 2026". Null when the timestamp won't parse. */
  reportedOn: string | null;
}

/**
 * The student's own reported issues, newest first.
 *
 * No `.eq("reporter_id", ...)`: `issue_reports_select` is
 * `reporter_id = auth.uid() or auth_is_admin_or_staff()`, so RLS already scopes this for a
 * student. Duplicating the filter would be a second, drift-prone copy of the policy — the
 * standing convention here, same as the task, attendance and request queries.
 *
 * Worth knowing: that policy has no category arm. A Staff member reads **every** report
 * regardless of category, which is why this function is named for the caller rather than
 * for the rows. See the spec section on what "routed by category" actually means.
 */
export async function getMyIssueReports(): Promise<{
  reports: MyIssueReport[];
  error: unknown;
}> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("issue_reports")
    .select("id, status, category, description, created_at")
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  if (error) {
    console.error("Issue reports query failed:", error.code, error.message);
    return { reports: [], error };
  }

  return {
    reports: data.map((row) => ({
      id: row.id,
      status: row.status,
      category: row.category,
      description: row.description,
      reportedOn: formatDate(row.created_at),
    })),
    error: null,
  };
}
