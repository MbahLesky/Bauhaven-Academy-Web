import { getMyTasks, type MyTask } from "@/lib/task-queries";
import { getLearnerContext, programmeLabel } from "@/lib/enrolment";
import { isOpen } from "@/lib/task-format";
import { TaskCard } from "@/components/tasks/TaskCard";
import { Card, CardContent } from "@/components/ui/card";

// Per-user, never statically cached across users — same reason the dashboard is.
export const dynamic = "force-dynamic";

export default async function TasksPage() {
  // A failed read throws to error.tsx rather than rendering an empty list, which would read
  // as "you have no tasks" — a different and possibly false statement.
  const [tasks, learner] = await Promise.all([getMyTasks(), getLearnerContext()]);

  const open = tasks.filter((task) => isOpen(task.status));
  const handedIn = tasks.filter((task) => !isOpen(task.status));

  return (
    <div className="pt-2">
      <div className="mb-5">
        <h1 className="font-display text-xl font-bold">My Tasks</h1>
        <p className="text-sm text-neutral-500">
          {learner?.current ? programmeLabel(learner.current) : "Your assigned work"}
        </p>
      </div>

      {tasks.length === 0 ? (
        <NoTasksYet />
      ) : (
        <>
          <Section title="To do" tasks={open} emptyText="Nothing to hand in right now." />
          <Section title="Handed in & done" tasks={handedIn} emptyText="Nothing handed in yet." />
        </>
      )}
    </div>
  );
}

function Section({ title, tasks, emptyText }: { title: string; tasks: MyTask[]; emptyText: string }) {
  return (
    <>
      <h2 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-neutral-400">{title}</h2>
      {tasks.length === 0 ? (
        <Card className="mb-2.5">
          <CardContent className="py-3.5 text-sm text-neutral-500">{emptyText}</CardContent>
        </Card>
      ) : (
        tasks.map((task) => <TaskCard key={task.assignmentId} task={task} />)
      )}
    </>
  );
}

/** Says where tasks come from: for most learners, an empty list means nobody has set one yet. */
function NoTasksYet() {
  return (
    <Card>
      <CardContent className="py-8 text-center">
        <p className="font-display mb-1.5 text-sm font-bold">No tasks yet</p>
        <p className="mx-auto max-w-xs text-sm text-neutral-500">
          Work your mentors set shows up here, along with what you hand in and the feedback you get back.
        </p>
      </CardContent>
    </Card>
  );
}
