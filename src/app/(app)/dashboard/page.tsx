import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOpenTasksPreview } from "@/lib/task-queries";
import { getAttendanceStats } from "@/lib/attendance-queries";
import { formatTaskStatus, STATUS_VARIANTS } from "@/lib/task-format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Per-user dashboard — never statically cached across users, and this also means
// `npm run build` doesn't need real Supabase credentials to succeed.
export const dynamic = "force-dynamic";

/** Enough to be useful on a phone without turning Home into the Tasks screen. */
const PREVIEW_TASK_COUNT = 3;

/** The wireframe's quick actions, minus the ones with no screen behind them yet. */
const QUICK_ACTIONS = [
  { href: "/requests", label: "Request absence" },
  { href: "/report", label: "Report an issue" },
] as const;

async function getDashboardData() {
  const supabase = await createClient();

  // RLS scopes these to the current user automatically — no explicit .eq("user_id", ...)
  // needed, per Bauhaven-Coding-Standards.md: trust the policy, don't duplicate it here.
  //
  // The task read goes through the shared `getOpenTasksPreview` rather than its own
  // query, so this preview and the Tasks screen can't disagree about what counts as open
  // or how a deadline is rendered — they were already diverging on the second one.
  const [enrollment, openTasks, attendance] = await Promise.all([
    supabase.from("enrollments").select("id, program_id, status").eq("status", "active").limit(1).maybeSingle(),
    getOpenTasksPreview(PREVIEW_TASK_COUNT),
    // Shared with the Attendance screen rather than computed here. This preview used to
    // do `present / all rows`, which was wrong twice over: it counted a Staff correction
    // and the row it corrected as two separate sessions, and it counted an excused
    // absence against the student. Both screens now read one function.
    getAttendanceStats(),
  ]);

  return {
    hasActiveProgram: !!enrollment.data,
    openTasks: openTasks.tasks,
    attendanceRate: attendance.stats.rate,
    errors: [enrollment.error, openTasks.error, attendance.error].filter(Boolean),
  };
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  if (data.errors.length > 0) {
    console.error("Academy dashboard fetch errors:", data.errors);
  }

  return (
    <div className="pt-2">
      <h1 className="font-display text-xl font-bold">Hey there 👋</h1>
      <p className="mb-5 text-sm text-neutral-500">
        {new Date().toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })}
      </p>

      {data.hasActiveProgram ? (
        <Card className="mb-5 border-none bg-gradient-to-br from-accent to-accent-2 p-5 text-white">
          <div className="text-[11px] font-semibold uppercase tracking-wide opacity-75">
            Your program
          </div>
          <div className="font-display mt-1 text-lg font-bold">In progress</div>
        </Card>
      ) : (
        <Card className="mb-5">
          <CardContent className="text-sm text-neutral-500">
            No active program enrollment yet — check back once you&apos;re enrolled.
          </CardContent>
        </Card>
      )}

      {/*
        The wireframe's quick-action row has three entries — Request absence, Report an
        issue, Share feedback. The first two now have screens behind them; Share feedback
        (`testimonies`) is a separate feature nobody has built, so it's left out rather
        than rendered as a dead button and slots into the third column once it exists.
      */}
      <div className="mb-5 grid grid-cols-2 gap-2.5">
        {QUICK_ACTIONS.map((action) => (
          <Link key={action.href} href={action.href}>
            <Card className="h-full transition-colors hover:border-accent">
              <CardContent className="flex min-h-16 items-center px-4 py-3.5 text-sm font-semibold">
                {action.label}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-neutral-400">
          Due soon
        </span>
        <Link href="/tasks" className="text-xs font-semibold text-accent">
          See all
        </Link>
      </div>
      {data.openTasks.length === 0 ? (
        <Card className="mb-5">
          <CardContent className="text-sm text-neutral-500">Nothing due right now.</CardContent>
        </Card>
      ) : (
        data.openTasks.map((task) => (
          <Card key={task.id} className="mb-2.5">
            <CardContent className="flex items-center justify-between gap-3 py-3.5">
              <div className="min-w-0">
                <div className="text-sm font-semibold">{task.title}</div>
                <div className="text-xs text-neutral-500">
                  {task.isSelfCreated && "Self-created · "}
                  {/* Already formatted in Africa/Douala by the shared query. Rendering
                      the raw timestamp with toLocaleDateString here meant the server and
                      the browser could disagree, and told a travelling student the wrong
                      day. */}
                  {task.deadline ? `Due ${task.deadline}` : "No deadline"}
                </div>
              </div>
              {/* Aligned with Admin-web: open is neutral, not warning. Nothing is wrong
                  with an open task — it's just work to do. */}
              <Badge variant={STATUS_VARIANTS.open} className="flex-shrink-0">
                {formatTaskStatus("open")}
              </Badge>
            </CardContent>
          </Card>
        ))
      )}

      {data.attendanceRate !== null && (
        <>
          <div className="mb-2 mt-5 flex items-baseline justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-neutral-400">
              Your attendance
            </span>
            <Link href="/attendance" className="text-xs font-semibold text-accent">
              Check in
            </Link>
          </div>
          <Card>
            <CardContent className="text-center">
              <div className="font-display text-2xl font-bold">{data.attendanceRate}%</div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
