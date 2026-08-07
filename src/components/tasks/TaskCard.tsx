"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SubmitForm } from "@/components/tasks/SubmitForm";
import { formatTaskBadge, STATUS_VARIANTS } from "@/lib/task-format";
import type { TaskWithSubmission } from "@/lib/task-queries";

export interface TaskCardProps {
  task: TaskWithSubmission;
}

/**
 * One task, matching the wireframe's card: title and a meta line on the left, a status
 * badge on the right. Open tasks expand to reveal the submit form rather than navigating
 * to a detail route — there's one field to fill in, and a whole screen transition for a
 * single input is a lot of ceremony on a phone.
 */
export function TaskCard({ task }: TaskCardProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <Card className="mb-2.5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{task.title}</div>
          <div className="mt-0.5 text-xs text-neutral-500">
            <TaskMeta task={task} />
          </div>
        </div>
        <Badge variant={STATUS_VARIANTS[task.status]} className="flex-shrink-0">
          {formatTaskBadge(task.status, task.submission?.grade ?? null)}
        </Badge>
      </div>

      {task.status === "open" &&
        (isSubmitting ? (
          <SubmitForm
            taskId={task.id}
            taskTitle={task.title}
            onCancel={() => setIsSubmitting(false)}
          />
        ) : (
          <Button
            variant="secondary"
            onClick={() => setIsSubmitting(true)}
            className="mt-3 min-h-11 w-full"
          >
            Submit work
          </Button>
        ))}

      {task.submission && <SubmissionDetail submission={task.submission} />}
    </Card>
  );
}

/**
 * The wireframe's meta line, which says a different thing per state: a deadline while
 * open, the feedback once graded, when it was handed in while waiting.
 */
function TaskMeta({ task }: { task: TaskWithSubmission }) {
  // The wireframe flags self-created work distinctly from staff-assigned — it's the one
  // thing on this screen nobody else asked the student to do.
  const selfCreated = task.isSelfCreated ? "Self-created" : null;

  if (task.status === "graded") {
    const comment = task.submission?.feedback[0]?.comment;
    return (
      <span>
        {selfCreated && `${selfCreated} · `}
        {comment ? `Feedback: “${comment}”` : "Graded"}
      </span>
    );
  }

  if (task.status === "submitted") {
    return (
      <span>
        {selfCreated && `${selfCreated} · `}
        {task.submission?.submittedOn ? `Submitted ${task.submission.submittedOn}` : "Submitted"}
      </span>
    );
  }

  const deadline = task.deadline ? `Due ${task.deadline}` : "No deadline";
  return <span>{selfCreated ? `${selfCreated} · ${deadline.toLowerCase()}` : deadline}</span>;
}

/**
 * What was submitted, and everything the grader said back.
 *
 * Every feedback row, not just the first: `feedback` has no unique constraint on
 * `submission_id`, so several comments on one submission are the design rather than a
 * bug. The meta line above shows only the first, which is why the rest live here.
 */
function SubmissionDetail({
  submission,
}: {
  submission: NonNullable<TaskWithSubmission["submission"]>;
}) {
  return (
    <div className="mt-3 border-t border-neutral-200 pt-3">
      {submission.contentUrl && (
        <a
          href={submission.contentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block break-all text-xs font-semibold text-accent underline"
        >
          {submission.contentUrl}
        </a>
      )}

      {submission.grade && (
        <p className="mt-2 text-xs">
          <span className="text-neutral-500">Grade: </span>
          <span className="font-semibold">{submission.grade}</span>
        </p>
      )}

      {submission.feedback.map((entry) => (
        <div key={entry.id} className="mt-2 rounded-md bg-background p-2.5">
          <p className="whitespace-pre-line text-xs">{entry.comment}</p>
          {entry.rating !== null && (
            <p className="mt-1 text-[11px] text-neutral-500">Rated {entry.rating}/5</p>
          )}
        </div>
      ))}
    </div>
  );
}
