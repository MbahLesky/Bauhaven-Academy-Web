import Link from "next/link";
import { getDueSoon, type MyTask } from "@/lib/task-queries";
import { getAttendanceStats } from "@/lib/attendance-queries";
import { formatEnrolmentStatus, getLearnerContext, programmeLabel } from "@/lib/enrolment";
import { formatAssignmentStatus, STATUS_VARIANTS } from "@/lib/task-format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Per-user dashboard — never statically cached across users, and this also means
// `npm run build` doesn't need real Supabase credentials to succeed.
export const dynamic = "force-dynamic";

/** Enough to be useful on a phone without turning Home into the Tasks screen. */
const PREVIEW_TASK_COUNT = 3;

const QUICK_ACTIONS = [
  { href: "/requests", label: "Request absence" },
  { href: "/report", label: "Report an issue" },
  { href: "/testimony", label: "Share feedback" },
] as const;

export default async function DashboardPage() {
  const [learner, dueSoon, attendance] = await Promise.all([
    getLearnerContext(),
    // Home degrades rather than fails: a broken preview shouldn't cost the whole screen.
    getDueSoon(PREVIEW_TASK_COUNT).catch((error: unknown) => {
      console.error("Due-soon preview failed:", error);
      return null;
    }),
    getAttendanceStats(),
  ]);

  const enrolment = learner?.current ?? null;

  return (
    <div className="pt-2">
      <h1 className="font-display text-xl font-bold">Hey there 👋</h1>
      <p className="mb-5 text-sm text-neutral-500">
        {new Date().toLocaleDateString("en-GB", { weekday: "long", month: "long", day: "numeric", timeZone: "Africa/Douala" })}
      </p>

      {enrolment && (
        <Card className="mb-5 border-none bg-gradient-to-br from-accent to-accent-2 p-5 text-white">
          <div className="text-[11px] font-semibold uppercase tracking-wide opacity-75">
            Your programme · {enrolment.assignedRole}
          </div>
          <div className="font-display mt-1 text-lg font-bold">{programmeLabel(enrolment)}</div>
          <div className="mt-1 text-xs opacity-90">{formatEnrolmentStatus(enrolment.status)}</div>
        </Card>
      )}

      <div className="mb-5 grid grid-cols-3 gap-2">
        {QUICK_ACTIONS.map((action) => (
          <Link key={action.href} href={action.href}>
            <Card className="h-full transition-colors hover:border-accent">
              {/* Tight padding and small type: three labels have to fit the 360px floor. */}
              <CardContent className="flex min-h-16 items-center px-3 py-3 text-xs font-semibold leading-snug">
                {action.label}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-neutral-400">Due soon</span>
        <Link href="/tasks" className="text-xs font-semibold text-accent">
          See all
        </Link>
      </div>
      <DueSoon tasks={dueSoon} />

      {attendance.rate !== null && (
        <>
          <div className="mb-2 mt-5 flex items-baseline justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-neutral-400">Your attendance</span>
            <Link href="/attendance" className="text-xs font-semibold text-accent">
              History
            </Link>
          </div>
          <Card>
            <CardContent className="text-center">
              <div className="font-display text-2xl font-bold">{attendance.rate}%</div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function DueSoon({ tasks }: { tasks: MyTask[] | null }) {
  if (tasks === null) {
    return (
      <Card className="mb-5">
        <CardContent className="text-sm text-neutral-500">Couldn&apos;t load your tasks — open Tasks to try again.</CardContent>
      </Card>
    );
  }

  if (tasks.length === 0) {
    return (
      <Card className="mb-5">
        <CardContent className="text-sm text-neutral-500">Nothing due right now.</CardContent>
      </Card>
    );
  }

  return (
    <>
      {tasks.map((task) => (
        <Card key={task.assignmentId} className="mb-2.5">
          <CardContent className="flex items-center justify-between gap-3 py-3.5">
            <div className="min-w-0">
              <div className="text-sm font-semibold">{task.title}</div>
              {/* Already formatted in Africa/Douala by the shared query. */}
              <div className="text-xs text-neutral-500">{task.due ? `Due ${task.due}` : "No deadline"}</div>
            </div>
            <Badge variant={STATUS_VARIANTS[task.status]} className="shrink-0">
              {formatAssignmentStatus(task.status)}
            </Badge>
          </CardContent>
        </Card>
      ))}
    </>
  );
}
