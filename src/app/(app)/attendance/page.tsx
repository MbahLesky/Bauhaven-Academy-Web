import { getAttendanceView } from "@/lib/attendance-queries";
import { AttendanceHistory } from "@/components/attendance/AttendanceHistory";
import { Card } from "@/components/ui/card";

// Per-user, never statically cached across users — same reason the other screens are.
export const dynamic = "force-dynamic";

/**
 * Your attendance: today's sessions, your rate, and your history. Read-only — your mentor
 * or coordinator takes the register.
 */
export default async function AttendancePage() {
  // A failed read throws to error.tsx rather than rendering an empty screen.
  const view = await getAttendanceView();

  return (
    <div className="pt-2">
      <h1 className="font-display text-xl font-bold">Attendance</h1>
      <p className="mb-5 text-sm text-neutral-500">Taken by your mentor or coordinator at each session.</p>

      {view.today.length > 0 && (
        <>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-400">Today</h2>
          <div className="mb-5">
            <AttendanceHistory entries={view.today} emptyText="" />
          </div>
        </>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3">
        <StatBox value={view.stats.rate === null ? "—" : `${view.stats.rate}%`} label="Attendance rate" />
        <StatBox value={String(view.stats.attended)} label="Sessions attended" />
      </div>

      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-400">History</h2>
      <AttendanceHistory entries={view.history} emptyText="No sessions have been held yet on your programme." />
    </div>
  );
}

function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <Card className="p-4 text-center">
      <div className="font-display text-2xl font-bold">{value}</div>
      <div className="mt-0.5 text-[11px] text-neutral-500">{label}</div>
    </Card>
  );
}
