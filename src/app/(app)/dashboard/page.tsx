import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Per-user dashboard — never statically cached across users, and this also means
// `npm run build` doesn't need real Supabase credentials to succeed.
export const dynamic = "force-dynamic";

async function getDashboardData() {
  const supabase = await createClient();

  // RLS scopes these to the current user automatically — no explicit .eq("user_id", ...)
  // needed, per Bauhaven-Coding-Standards.md: trust the policy, don't duplicate it here.
  const [enrollment, openTasks, attendance] = await Promise.all([
    supabase.from("enrollments").select("id, program_id, status").eq("status", "active").limit(1).maybeSingle(),
    supabase.from("tasks").select("id, title, deadline, status").eq("status", "open").order("deadline").limit(3),
    supabase.from("attendance_records").select("id, status"),
  ]);

  const attendanceRows = attendance.data ?? [];
  const presentCount = attendanceRows.filter((r) => r.status === "present").length;
  const attendanceRate =
    attendanceRows.length > 0 ? Math.round((presentCount / attendanceRows.length) * 100) : null;

  return {
    hasActiveProgram: !!enrollment.data,
    openTasks: openTasks.data ?? [],
    attendanceRate,
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

      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-400">
        Due soon
      </div>
      {data.openTasks.length === 0 ? (
        <Card className="mb-5">
          <CardContent className="text-sm text-neutral-500">Nothing due right now.</CardContent>
        </Card>
      ) : (
        data.openTasks.map((task) => (
          <Card key={task.id} className="mb-2.5">
            <CardContent className="flex items-center justify-between py-3.5">
              <div>
                <div className="text-sm font-semibold">{task.title}</div>
                {task.deadline && (
                  <div className="text-xs text-neutral-500">
                    Due {new Date(task.deadline).toLocaleDateString()}
                  </div>
                )}
              </div>
              <Badge variant="warning">Open</Badge>
            </CardContent>
          </Card>
        ))
      )}

      {data.attendanceRate !== null && (
        <>
          <div className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-neutral-400">
            Your attendance
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
