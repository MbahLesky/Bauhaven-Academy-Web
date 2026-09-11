import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatAttendanceStatus, NOT_MARKED_LABEL, STATUS_VARIANTS } from "@/lib/attendance-format";
import type { HistoryEntry } from "@/lib/attendance-queries";

/**
 * Sessions and the learner's mark on each. A session nobody marked shows "Not marked"
 * rather than being hidden or shown as absent: on a learner's own record, being told you
 * were absent when nobody took the register is a worse statement, and theirs to argue back.
 */
export function AttendanceHistory({ entries, emptyText }: { entries: HistoryEntry[]; emptyText: string }) {
  if (entries.length === 0) {
    return <Card className="p-5 text-center text-sm text-neutral-500">{emptyText}</Card>;
  }

  return (
    <Card className="overflow-hidden p-0">
      <ul className="divide-y divide-neutral-200">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm">{entry.title}</div>
              <div className="text-xs text-neutral-500">{entry.when}</div>
              {entry.correction && <div className="text-xs text-neutral-500">Corrected: {entry.correction}</div>}
            </div>
            {entry.status ? (
              <Badge variant={STATUS_VARIANTS[entry.status]} className="shrink-0">
                {formatAttendanceStatus(entry.status)}
              </Badge>
            ) : (
              <Badge variant="neutral" className="shrink-0">
                {NOT_MARKED_LABEL}
              </Badge>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
