import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRequestStatus, REQUEST_STATUS_VARIANTS } from "@/lib/request-format";
import type { MyRequest } from "@/lib/request-queries";

/**
 * One row in "Your requests" — dates, reason, status badge.
 *
 * Read-only by design, with no cancel or edit control: `requests` has SELECT and INSERT
 * policies and nothing else, so a student cannot withdraw a request they've sent. A
 * control that always failed would be worse than its absence.
 */
export function RequestCard({ request }: { request: MyRequest }) {
  return (
    <Card className="mb-2.5">
      <CardContent className="flex items-start justify-between gap-3 py-3.5">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{request.dates}</div>
          {request.reason && (
            <div className="mt-0.5 text-xs text-neutral-500">{request.reason}</div>
          )}
        </div>
        <Badge variant={REQUEST_STATUS_VARIANTS[request.status]} className="flex-shrink-0">
          {formatRequestStatus(request.status)}
        </Badge>
      </CardContent>
    </Card>
  );
}
