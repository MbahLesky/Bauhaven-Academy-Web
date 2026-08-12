import Link from "next/link";
import { getMyIssueReports } from "@/lib/issue-report-queries";
import { IssueReportForm } from "@/components/report/IssueReportForm";
import { IssueReportCard } from "@/components/report/IssueReportCard";
import { Card, CardContent } from "@/components/ui/card";

// Per-user, never statically cached across users — same reason the other app routes are.
export const dynamic = "force-dynamic";

export default async function ReportPage() {
  const { reports, error } = await getMyIssueReports();

  // Throwing hands off to error.tsx rather than rendering an empty list, which would read
  // as "you've never reported anything" — a different and possibly false statement, and
  // one that could prompt a student to file the same problem twice.
  if (error) {
    console.error("Academy issue reports fetch failed:", error);
    throw new Error("Couldn't load your reports.");
  }

  return (
    <div className="pt-2">
      <Link href="/dashboard" className="text-sm text-neutral-500">
        ← Home
      </Link>
      <h1 className="font-display mt-2 text-xl font-bold">Report a problem</h1>
      <p className="mb-5 text-sm text-neutral-500">Goes to staff for review.</p>

      <IssueReportForm />

      <div className="mb-2 mt-8 text-xs font-bold uppercase tracking-wide text-neutral-400">
        Your reports
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="text-sm text-neutral-500">
            You haven&apos;t reported anything yet.
          </CardContent>
        </Card>
      ) : (
        reports.map((report) => <IssueReportCard key={report.id} report={report} />)
      )}
    </div>
  );
}
