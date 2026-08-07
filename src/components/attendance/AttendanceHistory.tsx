import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatAttendanceStatus, NOT_MARKED_LABEL, STATUS_VARIANTS } from "@/lib/attendance-format";
import type { HistoryEntry } from "@/lib/attendance-queries";

/**
 * The wireframe's history list: a date on the left, a status badge on the right.
 *
 * A session nobody marked shows "Not marked" rather than being hidden or shown as
 * absent. On a student's own record that distinction matters — being told you were
 * absent when in fact the register was never taken is a different and worse statement,
 * and it's the student who'd have to argue it back.
 */
export function AttendanceHistory({ entries }: { entries: HistoryEntry[] }) {
  if (entries.length === 0) {
    return (
      <Card className="p-5 text-center text-sm text-neutral-500">
        No sessions have been held yet on your program.
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <ul className="divide-y divide-neutral-200">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm">{entry.label}</span>
            {entry.status ? (
              <Badge variant={STATUS_VARIANTS[entry.status]}>
                {formatAttendanceStatus(entry.status)}
              </Badge>
            ) : (
              <Badge variant="neutral">{NOT_MARKED_LABEL}</Badge>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
