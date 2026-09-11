"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SubmitForm } from "@/components/tasks/SubmitForm";
import { formatAssignmentStatus, formatFeedbackResult, STATUS_VARIANTS } from "@/lib/task-format";
import type { MyTask } from "@/lib/task-queries";

/**
 * One task: title and a meta line, a status badge, the instructions, and — when it's the
 * learner's move — a way to hand it in. Everything they've handed in and all released
 * feedback sit underneath, newest first.
 */
export function TaskCard({ task }: { task: MyTask }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const resubmitting = task.submissions.some((submission) => submission.status !== "draft");

  return (
    <Card className="mb-2.5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{task.title}</div>
          <div className="mt-0.5 text-xs text-neutral-500">
            <TaskMeta task={task} />
          </div>
        </div>
        <Badge variant={STATUS_VARIANTS[task.status]} className="shrink-0">
          {formatAssignmentStatus(task.status)}
        </Badge>
      </div>

      {task.instructions && (
        <div className="mt-2">
          {showInstructions ? (
            <p className="whitespace-pre-line text-xs text-neutral-700">{task.instructions}</p>
          ) : (
            <button
              type="button"
              onClick={() => setShowInstructions(true)}
              className="text-xs font-semibold text-accent"
            >
              Read the instructions
            </button>
          )}
        </div>
      )}

      {task.canSubmit &&
        (isSubmitting ? (
          <SubmitForm
            assignmentId={task.assignmentId}
            taskTitle={task.title}
            submissionType={task.submissionType}
            onCancel={() => setIsSubmitting(false)}
          />
        ) : (
          <Button variant="secondary" onClick={() => setIsSubmitting(true)} className="mt-3 min-h-11 w-full">
            {resubmitting ? "Hand in again" : "Hand in work"}
          </Button>
        ))}

      {(task.submissions.length > 0 || task.feedback.length > 0) && <History task={task} />}
    </Card>
  );
}

function TaskMeta({ task }: { task: MyTask }) {
  const latest = task.submissions.find((submission) => submission.status !== "draft");

  if (task.status === "submitted" && latest) {
    return <span>{latest.submittedOn ? `Handed in ${latest.submittedOn}` : "Handed in"}{latest.isLate && " · late"}</span>;
  }
  if (task.status === "completed") return <span>Done</span>;
  return <span>{task.due ? `Due ${task.due}` : "No deadline"}</span>;
}

/** What was handed in, version by version, and every released comment. */
function History({ task }: { task: MyTask }) {
  return (
    <div className="mt-3 border-t border-neutral-200 pt-3">
      {task.feedback.map((entry) => (
        <div key={entry.id} className="mb-2 rounded-md bg-background p-2.5">
          <p className="text-[11px] font-semibold text-neutral-600">
            {entry.reviewer}
            {formatFeedbackResult(entry.result) && ` · ${formatFeedbackResult(entry.result)}`}
            {entry.score !== null && ` · ${entry.score}`}
          </p>
          {entry.text && <p className="mt-1 whitespace-pre-line text-xs">{entry.text}</p>}
        </div>
      ))}

      {task.submissions
        .filter((submission) => submission.status !== "draft")
        .map((submission) => (
          <div key={submission.id} className="mb-2 text-xs">
            <p className="text-neutral-500">
              Version {submission.version}
              {submission.submittedOn && ` · ${submission.submittedOn}`}
              {submission.isLate && " · late"}
            </p>
            {submission.text && <p className="mt-0.5 line-clamp-3 whitespace-pre-line">{submission.text}</p>}
            {submission.link && (
              <a
                href={submission.link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 block break-all font-semibold text-accent underline"
              >
                {submission.link}
              </a>
            )}
          </div>
        ))}
    </div>
  );
}
