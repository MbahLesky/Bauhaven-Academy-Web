import Link from "next/link";
import { canCreateOwnTasks } from "@/lib/task-permissions";
import { SelfTaskForm } from "@/components/tasks/SelfTaskForm";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function NewSelfTaskPage() {
  // The list hides the link that gets here, but a direct URL still has to be refused —
  // hiding a control is not authorization, and the Server Action re-checks it too.
  if (!(await canCreateOwnTasks())) return <NoPermissionNotice />;

  return (
    <div className="pt-2">
      <Link href="/tasks" className="text-sm text-neutral-500">
        ← Tasks
      </Link>
      <h1 className="font-display mt-2 text-xl font-bold">New task</h1>
      <p className="mb-5 text-sm text-neutral-500">
        Something you&apos;re working on that nobody assigned you.
      </p>

      <SelfTaskForm />
    </div>
  );
}

/**
 * A plain explanation rather than a 404: the route isn't a secret, and creating your own
 * tasks is a real thing an Admin or Staff member can grant — so this says who to ask
 * instead of pretending the page doesn't exist.
 */
function NoPermissionNotice() {
  return (
    <div className="pt-2">
      <Card>
        <CardContent className="py-8 text-center">
          <p className="font-display mb-1.5 text-sm font-bold">You can&apos;t create tasks yet</p>
          <p className="mx-auto mb-5 max-w-xs text-sm text-neutral-500">
            Creating your own tasks is granted person by person. Ask a mentor or an admin
            if you&apos;d like it turned on for your account.
          </p>
          <Link href="/tasks" className="text-sm font-semibold text-accent">
            Back to tasks
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
