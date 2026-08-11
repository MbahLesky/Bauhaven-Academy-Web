import { z } from "zod";

// Its own module, not testimony-actions.ts — a "use server" file can only export async
// functions, so a schema exported from one silently isn't the real schema by the time a
// client component imports it. Same rule the auth, task, request and issue schemas follow.

/** Mirrors `testimonies.status`'s check constraint exactly. */
export const TESTIMONY_STATUSES = ["submitted", "published"] as const;

export type TestimonyStatus = (typeof TESTIMONY_STATUSES)[number];

/** Mirrors `users.preferred_language`'s check constraint exactly. */
export const CONTENT_LANGUAGES = ["en", "fr"] as const;

export type ContentLanguage = (typeof CONTENT_LANGUAGES)[number];

const MIN_CONTENT_LENGTH = 20;
const MAX_CONTENT_LENGTH = 2000;

/**
 * Sharing a testimony.
 *
 * **One field, not two**, matching the wireframe. `testimonies` has separate `content_en`
 * and `content_fr` columns, but which one a student's words belong in is not a question to
 * put to the student — it's already answered by `users.preferred_language`, and the Server
 * Action reads it there. Asking someone to fill in two boxes would be asking them to
 * translate their own testimonial, which is a translator's job and not a condition of
 * saying something nice.
 *
 * `program_id` is likewise absent: the action fills it from the student's active
 * enrollment, because a pull-quote on the public Site is about a *program*, and the
 * student already told us which one by enrolling.
 */
export const testimonySchema = z.object({
  /**
   * A floor, because a testimony is destined for a public Site pull-quote. "It was good"
   * is not a quote anyone can feature, and there is no way for a curator to ask for more —
   * `testimonies` has no comment thread and no UPDATE policy for the student.
   */
  content: z
    .string()
    .trim()
    .min(MIN_CONTENT_LENGTH, "Tell us a little more about your experience")
    .max(MAX_CONTENT_LENGTH, "Keep it under 2000 characters"),
});

export type TestimonyInput = z.infer<typeof testimonySchema>;

export const EMPTY_TESTIMONY: TestimonyInput = { content: "" };
