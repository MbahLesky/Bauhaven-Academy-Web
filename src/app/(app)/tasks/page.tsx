import Link from "next/link";
import { getMyTasks } from "@/lib/task-queries";
import { canCreateOwnTasks } from "@/lib/task-permissions";
import { createClient } from "@/lib/supabase/server";
import { TaskCard } from "@/components/tasks/TaskCard";
import { Card, CardContent } from "@/components/ui/card";

// Per-user, never statically cached across users — same reason the dashboard is.
export const dynamic = "force-dynamic";

/** The program name under the heading, matching the wireframe's subtitle. */
async function getProgramName(): Promise<string | null> {
  const supabase = await createClient();

  // RLS scopes enrollments to the current user.
  const { data, error } = await supabase
    .from("enrollments")
    .select("program_id")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error || !data?.program_id) return null;

  const program = await supabase
    .from("programs")
    .select("title_en")
    .eq("id", data.program_id)
    .maybeSingle();

  return program.data?.title_en ?? null;
}

export default async function TasksPage() {
  const [{ tasks, error }, canCreate, programName] = await Promise.all([
    getMyTasks(),
    canCreateOwnTasks(),
    getProgramName(),
  ]);

  // Throwing hands off to error.tsx rather than rendering an empty list, which would
  // read as "you have no tasks" — a different and possibly false statement.
  if (error) {
    console.error("Academy tasks fetch failed:", error);
    throw new Error("Couldn't load your tasks.");
  }

  const open = tasks.filter((task) => task.status === "open");
  // Everything that has left the student's hands, newest activity first. 'graded' and
  // 'submitted' share a section because the wireframe groups them that way — from here
  // they're both "handed in", differing only in whether anyone has looked yet.
  const handedIn = tasks.filter((task) => task.status !== "open");

  return (
    <div className="pt-2">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold">My Tasks</h1>
          <p className="text-sm text-neutral-500">
            {programName ?? "Your assigned and self-created work"}
          </p>
        </div>

        {/* Hidden entirely, not disabled: this is an individual grant most students
            don't hold, and a permanently greyed-out button is just a reminder of
            something they can't do. Same principle as Admin-web's role-gated controls. */}
        {canCreate && (
          <Link
            href="/tasks/new"
            className="min-h-11 flex-shrink-0 rounded-md px-3 py-2.5 text-xs font-semibold text-accent"
          >
            + New task
          </Link>
        )}
      </div>

      {tasks.length === 0 ? (
        <NoTasksYet canCreate={canCreate} />
      ) : (
        <>
          <Section title="Open" tasks={open} emptyText="Nothing open right now." />
          <Section
            title="Submitted &amp; graded"
            tasks={handedIn}
            emptyText="Nothing handed in yet."
          />
        </>
      )}
    </div>
  );
}

function Section({
  title,
  tasks,
  emptyText,
}: {
  title: string;
  tasks: Awaited<ReturnType<typeof getMyTasks>>["tasks"];
  emptyText: string;
}) {
  return (
    <>
      <h2 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-neutral-400">
        {title.replace("&amp;", "&")}
      </h2>
      {tasks.length === 0 ? (
        <Card className="mb-2.5">
          <CardContent className="py-3.5 text-sm text-neutral-500">{emptyText}</CardContent>
        </Card>
      ) : (
        tasks.map((task) => <TaskCard key={task.id} task={task} />)
      )}
    </>
  );
}

/**
 * No tasks at all.
 *
 * Says where tasks come from, because for most students the answer is "someone assigns
 * them" — an empty list here usually means nobody has yet, not that a button is missing.
 */
function NoTasksYet({ canCreate }: { canCreate: boolean }) {
  return (
    <Card>
      <CardContent className="py-8 text-center">
        <p className="font-display mb-1.5 text-sm font-bold">No tasks yet</p>
        <p className="mx-auto max-w-xs text-sm text-neutral-500">
          Work assigned to you by your mentors shows up here, along with anything you
          submit and any feedback you get back.
        </p>
        {canCreate && (
          <Link
            href="/tasks/new"
            className="mt-4 inline-block min-h-11 rounded-md px-3 py-2.5 text-xs font-semibold text-accent"
          >
            + New task
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
