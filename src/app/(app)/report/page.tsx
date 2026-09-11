import Link from "next/link";
import { getMyIssueReports } from "@/lib/issue-report-queries";
import { isDatabaseReady } from "@/lib/database-readiness";
import { IssueReportForm } from "@/components/report/IssueReportForm";
import { IssueReportCard } from "@/components/report/IssueReportCard";
import { PendingFeatureNotice } from "@/components/app-shell/PendingFeatureNotice";
import { Card, CardContent } from "@/components/ui/card";

// Per-user, never statically cached across users — same reason the other app routes are.
export const dynamic = "force-dynamic";

export default async function ReportPage() {
  if (!isDatabaseReady("issueReports")) {
    return (
      <PendingFeatureNotice
        title="Report a problem"
        fallback="Reporting a problem here isn't switched on yet. Tell your coordinator directly for now."
      />
    );
  }

  // A failed read throws to error.tsx rather than rendering an empty list.
  const reports = await getMyIssueReports();

  return (
    <div className="pt-2">
      <Link href="/dashboard" className="text-sm text-neutral-500">
        ← Home
      </Link>
      <h1 className="font-display mt-2 text-xl font-bold">Report a problem</h1>
      <p className="mb-5 text-sm text-neutral-500">Goes to Bauhaven staff for review.</p>

      <IssueReportForm />

      <div className="mb-2 mt-8 text-xs font-bold uppercase tracking-wide text-neutral-400">Your reports</div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="text-sm text-neutral-500">You haven&apos;t reported anything yet.</CardContent>
        </Card>
      ) : (
        reports.map((report) => <IssueReportCard key={report.id} report={report} />)
      )}
    </div>
  );
}
