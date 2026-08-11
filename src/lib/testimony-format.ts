import type { TestimonyStatus } from "@/lib/schemas/testimony";

const STATUS_LABELS: Record<TestimonyStatus, string> = {
  // "Shared" rather than "Submitted": a testimony isn't an application waiting on a
  // verdict, and nothing is owed back. Saying "pending" would imply a decision is coming.
  submitted: "Shared",
  published: "On the website",
};

export function formatTestimonyStatus(status: TestimonyStatus): string {
  return STATUS_LABELS[status];
}

/**
 * Badge colours.
 *
 * `submitted` is neutral, not warning: nothing is wrong and nobody is waiting on anything.
 * Publication is curation, not approval — a testimony that stays unpublished hasn't failed.
 */
export const TESTIMONY_STATUS_VARIANTS: Record<TestimonyStatus, "neutral" | "success"> = {
  submitted: "neutral",
  published: "success",
};
