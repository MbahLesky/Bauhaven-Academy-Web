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
 * The learner's own reported issues, newest first.
 *
 * Filtered to the reporter explicitly: staff who handle reports can see everyone's, and this
 * screen is only ever the learner's own. Throws on a failed read, so a failure never reads as
 * "you've reported nothing".
 */
export async function getMyIssueReports(): Promise<MyIssueReport[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("issue_reports")
    .select("id, status, category, description, created_at")
    .eq("reporter_id", user.id)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  if (error) {
    console.error("Issue reports query failed:", error.code, error.message);
    throw new Error("Couldn't load your reports.");
  }

  return data.map((row) => ({
    id: row.id,
    status: row.status,
    category: row.category,
    description: row.description,
    reportedOn: formatDate(row.created_at),
  }));
}
