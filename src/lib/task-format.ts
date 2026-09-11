import type { AssignmentStatus } from "@/types/database";

/** Statuses where the next move is the learner's: something to hand in. */
export const OPEN_ASSIGNMENT_STATUSES: readonly AssignmentStatus[] = [
  "assigned",
  "in_progress",
  "changes_requested",
  "overdue",
];

export function isOpen(status: AssignmentStatus): boolean {
  return OPEN_ASSIGNMENT_STATUSES.includes(status);
}

// From the learner's side: "With your mentor" rather than "Submitted", because the
// interesting fact is that someone else has it now. Admin-web calls it Submitted.
const STATUS_LABELS: Record<AssignmentStatus, string> = {
  assigned: "To do",
  in_progress: "In progress",
  submitted: "With your mentor",
  changes_requested: "Changes requested",
  completed: "Completed",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

export function formatAssignmentStatus(status: AssignmentStatus): string {
  return STATUS_LABELS[status];
}

/**
 * Badge colours, aligned with Admin-web: to-do work is neutral (nothing is wrong), waiting on
 * someone or needing another go is a warning, done is success, overdue is danger.
 */
export const STATUS_VARIANTS: Record<AssignmentStatus, "neutral" | "warning" | "success" | "danger"> = {
  assigned: "neutral",
  in_progress: "neutral",
  submitted: "warning",
  changes_requested: "warning",
  completed: "success",
  overdue: "danger",
  cancelled: "neutral",
};

const RESULT_LABELS: Record<string, string> = {
  accepted: "Accepted",
  approved: "Accepted",
  completed: "Accepted",
  changes_requested: "Changes requested",
};

/** A released feedback's outcome, in the learner's words. */
export function formatFeedbackResult(result: string | null): string | null {
  if (!result) return null;
  return RESULT_LABELS[result] ?? null;
}
