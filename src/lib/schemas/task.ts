import { z } from "zod";

// Its own module, not task-actions.ts — a "use server" file can only export async
// functions, and a schema exported from one silently isn't the real schema by the time a
// client component imports it. Same rule the auth schema follows, for the same reason.

/** Mirrors `tasks.status`'s check constraint exactly. */
export const TASK_STATUSES = ["open", "submitted", "graded", "archived"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

const MAX_URL_LENGTH = 2000;
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;

/**
 * Submitting work.
 *
 * `submissions.content_url` is the only column on the table that carries the work
 * itself — there is no file storage and no body text, so a submission *is* a link to
 * something hosted elsewhere (a repo, a deployed page, a design file). The column is
 * nullable in the schema, but a submission with no link is a row that says "I'm done"
 * and gives a grader nothing to look at, so this requires one.
 */
export const submissionSchema = z.object({
  content_url: z
    .string()
    .trim()
    .min(1, "Add a link to your work")
    .max(MAX_URL_LENGTH, "That link is too long")
    .refine((value) => /^https?:\/\//.test(value), {
      error: "Use a full link starting with http:// or https://",
    }),
});

export type SubmissionInput = z.infer<typeof submissionSchema>;

export const EMPTY_SUBMISSION: SubmissionInput = { content_url: "" };

/**
 * Creating your own task.
 *
 * Only reachable by someone holding the individual `auth_has_permission('tasks','create')`
 * override — see Bauhaven-Admin-Feature-Spec.md §8. No `program_id` and no `assigned_to`
 * field: a self-created task is assigned to its creator by definition, and the Server
 * Action fills both from the session rather than trusting either from the client.
 */
export const selfTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give your task a title")
    .max(MAX_TITLE_LENGTH, `Keep the title under ${MAX_TITLE_LENGTH} characters`),
  description: z
    .string()
    .trim()
    .max(MAX_DESCRIPTION_LENGTH, "That description is too long")
    .nullable()
    .transform((value) => (value === null || value === "" ? null : value)),
  /** `datetime-local` wall-clock time, read as Cameroon's zone by the Server Action. */
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Use the date and time picker")
    .nullable(),
});

export type SelfTaskInput = z.infer<typeof selfTaskSchema>;

export const EMPTY_SELF_TASK: SelfTaskInput = { title: "", description: null, deadline: null };

export const taskIdSchema = z.uuid("That isn't a valid task reference");
