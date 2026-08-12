import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  formatIssueCategory,
  formatIssueStatus,
  ISSUE_STATUS_VARIANTS,
} from "@/lib/issue-report-format";
import type { MyIssueReport } from "@/lib/issue-report-queries";

/**
 * One row in "Your reports" — category, date, description, status badge.
 *
 * Read-only. `issue_reports_update` is `using (auth_is_admin_or_staff())`, so a student
 * cannot edit or withdraw a report they've filed; a control that always failed would be
 * worse than its absence. (Unlike `requests`, the policy for the *other* side does exist
 * here — what's missing is only a screen that uses it.)
 */
export function IssueReportCard({ report }: { report: MyIssueReport }) {
  return (
    <Card className="mb-2.5">
      <CardContent className="py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold">{formatIssueCategory(report.category)}</div>
            {report.reportedOn && (
              <div className="text-xs text-neutral-400">Reported {report.reportedOn}</div>
            )}
          </div>
          <Badge variant={ISSUE_STATUS_VARIANTS[report.status]} className="flex-shrink-0">
            {formatIssueStatus(report.status)}
          </Badge>
        </div>
        {/* Wrapped, not truncated: a student re-reading their own report to check what
            they said is the main reason this list exists. */}
        <p className="mt-1.5 whitespace-pre-wrap break-words text-xs text-neutral-500">
          {report.description}
        </p>
      </CardContent>
    </Card>
  );
}
