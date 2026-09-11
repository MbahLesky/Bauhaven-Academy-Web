import { z } from "zod";

// Its own module, not task-actions.ts — a "use server" file can only export async
// functions, and a schema exported from one silently isn't the real schema by the time a
// client component imports it.

/**
 * How a task is handed in (`tasks.submission_type`). File uploads aren't available yet —
 * there's nowhere to store them — so a file task is handed in as a link to the file.
 */
export const SUBMISSION_TYPES = ["text", "link", "file", "mixed", "none"] as const;
export type SubmissionType = (typeof SUBMISSION_TYPES)[number];

const MAX_TEXT_LENGTH = 20_000;
const MAX_URL_LENGTH = 2000;

/** Empty or whitespace-only becomes null. */
const optional = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .nullable()
    .transform((value) => (value === null || value === "" ? null : value));

/**
 * Handing in work: some text, a link, or both. Which of them the task needs is checked by
 * the Server Action against the task itself (`requiredParts`), not taken from the form.
 */
export const submissionSchema = z.object({
  text_content: optional(MAX_TEXT_LENGTH, "That's too long to hand in here"),
  link_url: optional(MAX_URL_LENGTH, "That link is too long").refine(
    (value) => value === null || /^https?:\/\//.test(value),
    { error: "Use a full link starting with http:// or https://" }
  ),
});

export type SubmissionInput = z.infer<typeof submissionSchema>;

export const EMPTY_SUBMISSION: SubmissionInput = { text_content: null, link_url: null };

/** What a task's submission type asks for. `none` means nothing is handed in here. */
export function requiredParts(type: string): { text: boolean; link: boolean; either: boolean } {
  switch (type) {
    case "text":
      return { text: true, link: false, either: false };
    case "link":
    case "file":
      return { text: false, link: true, either: false };
    case "none":
      return { text: false, link: false, either: false };
    default:
      // "mixed", and anything newer: at least one of the two.
      return { text: false, link: false, either: true };
  }
}

/** The first thing missing from a submission for this type of task, or null if it's complete. */
export function missingPart(type: string, input: SubmissionInput): string | null {
  const needs = requiredParts(type);
  if (needs.text && !input.text_content) return "Write your answer before handing it in.";
  if (needs.link && !input.link_url) return "Add a link to your work before handing it in.";
  if (needs.either && !input.text_content && !input.link_url) return "Add your answer or a link to your work.";
  return null;
}

export const assignmentIdSchema = z.uuid("That isn't a valid task reference");
export const idempotencyKeySchema = z.uuid("Reload the page and try again");
