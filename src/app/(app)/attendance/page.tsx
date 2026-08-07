import { getAttendanceView } from "@/lib/attendance-queries";
import { CheckInCard } from "@/components/attendance/CheckInCard";
import { AttendanceHistory } from "@/components/attendance/AttendanceHistory";
import { Card, CardContent } from "@/components/ui/card";

// Per-user, never statically cached across users — same reason the other screens are.
export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const { view, error } = await getAttendanceView();

  // Hand off to error.tsx rather than rendering an empty screen, which would read as
  // "you have no attendance" — a different and possibly false statement.
  if (error) {
    console.error("Academy attendance fetch failed:", error);
    throw new Error("Couldn't load your attendance.");
  }

  return (
    <div className="pt-2">
      <h1 className="font-display text-xl font-bold">Attendance</h1>
      <p className="mb-5 text-sm text-neutral-500">
        {view.todaySession ? "Today's session" : "Your check-ins and history"}
      </p>

      {view.programId === null ? (
        <NotEnrolled />
      ) : view.todaySession ? (
        <CheckInCard
          sessionId={view.todaySession.id}
          sessionLabel={view.todaySession.label}
          currentStatus={view.todayStatus}
        />
      ) : (
        <NoSessionToday />
      )}

      <div className="mb-5 grid grid-cols-2 gap-3">
        <StatBox
          value={view.stats.rate === null ? "—" : `${view.stats.rate}%`}
          label="This program"
        />
        <StatBox value={String(view.stats.attended)} label="Sessions attended" />
      </div>

      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-400">History</h2>
      <AttendanceHistory entries={view.history} />
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

/**
 * No session scheduled today.
 *
 * An empty state, not an error — most days don't have one, and a program with no session
 * today is entirely normal rather than something going wrong.
 */
function NoSessionToday() {
  return (
    <Card className="mb-5">
      <CardContent className="py-6 text-center">
        <p className="font-display mb-1 text-sm font-bold">No session scheduled today</p>
        <p className="mx-auto max-w-xs text-sm text-neutral-500">
          Check back on your next class day — your history and attendance rate are below.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * No active enrollment at all.
 *
 * Distinct from "no session today": there is no program whose sessions could appear, so
 * saying "no session today" would imply one might turn up tomorrow.
 */
function NotEnrolled() {
  return (
    <Card className="mb-5">
      <CardContent className="py-6 text-center">
        <p className="font-display mb-1 text-sm font-bold">You&apos;re not enrolled yet</p>
        <p className="mx-auto max-w-xs text-sm text-neutral-500">
          Attendance starts once you&apos;re enrolled on a program. An admin sets that up.
        </p>
      </CardContent>
    </Card>
  );
}
