import { ISSUE_CATEGORIES, type IssueCategory, type IssueStatus } from "@/lib/schemas/issue-report";

const STATUS_LABELS: Record<IssueStatus, string> = {
  open: "Open",
  // "Being looked at" rather than "In progress": the useful fact for the person who
  // reported it is that a human has picked it up, not the name of a workflow state.
  in_progress: "Being looked at",
  resolved: "Resolved",
};

export function formatIssueStatus(status: IssueStatus): string {
  return STATUS_LABELS[status];
}

/**
 * Badge colours, following the same semantic table Tasks and Requests use.
 *
 * Open is `warning` — something is wrong and nobody has picked it up. It's the one state
 * where the colour is doing real work on this screen.
 */
export const ISSUE_STATUS_VARIANTS: Record<IssueStatus, "warning" | "neutral" | "success"> = {
  open: "warning",
  in_progress: "neutral",
  resolved: "success",
};

const CATEGORY_LABELS = new Map<string, string>(
  ISSUE_CATEGORIES.map((category) => [category.value, category.label])
);

/**
 * Renders a stored `category` value as its label.
 *
 * Falls back to the raw value rather than to "Unknown". The column has no check
 * constraint, so a row written by Admin-web, by a migration, or by a future category this
 * build doesn't know about is entirely possible — and showing a student `hardware` beats
 * telling them their own report has no category.
 */
export function formatIssueCategory(category: IssueCategory | string): string {
  return CATEGORY_LABELS.get(category) ?? category;
}
