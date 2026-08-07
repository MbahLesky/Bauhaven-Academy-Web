import type { TaskStatus } from "@/lib/schemas/task";

const STATUS_LABELS: Record<TaskStatus, string> = {
  open: "Open",
  // "Grading" rather than "Submitted" on this screen: from the student's side the
  // interesting fact is that someone else now has it, not that they handed it over.
  // Admin-web calls the same state "Submitted", which is equally true from its side.
  submitted: "Grading",
  graded: "Graded",
  archived: "Archived",
};

export function formatTaskStatus(status: TaskStatus): string {
  return STATUS_LABELS[status];
}

/**
 * Badge colours, **aligned with Admin-web** rather than with Academy's own wireframe.
 *
 * The wireframe had Open as `warning` and Grading as `neutral` — the inverse of Admin's,
 * so the same task would have shown a different colour depending on which app you opened.
 * Admin's reading is the semantically correct one and matches the brand guidelines'
 * colour table: Open is nothing wrong, just work to do (neutral); Grading is waiting on
 * someone (warning); Graded is done (success). Wireframe corrected to match.
 */
export const STATUS_VARIANTS: Record<TaskStatus, "neutral" | "warning" | "success"> = {
  open: "neutral",
  submitted: "warning",
  graded: "success",
  archived: "neutral",
};

/**
 * What the badge says.
 *
 * A graded task shows the grade itself — the wireframe's "92%" badge — because a grade
 * nobody can see without opening the row is a grade they'll open every row to find.
 * Falls back to the plain label when a graded task has no grade recorded, which is
 * possible: Admin-web's grading writes the grade, the feedback and the status as three
 * separate statements with no transaction across them.
 */
export function formatTaskBadge(status: TaskStatus, grade: string | null): string {
  if (status === "graded" && grade) return grade;
  return formatTaskStatus(status);
}

/** The two groups the wireframe splits the list into. */
export function isOpenSection(status: TaskStatus): boolean {
  return status === "open";
}
