import { z } from "zod";

// Its own module, not testimony-actions.ts — a "use server" file can only export async
// functions, so a schema exported from one silently isn't the real schema by the time a
// client component imports it.

const MIN_CONTENT_LENGTH = 20;
const MAX_CONTENT_LENGTH = 2000;

/**
 * Sharing feedback about your programme. It's stored with the website's reviews
 * (`website_reviews`), where Bauhaven's team reads it and may pick it for the website.
 */
export const testimonySchema = z.object({
  /** A floor, because a line like "It was good" can't be featured or acted on. */
  content: z
    .string()
    .trim()
    .min(MIN_CONTENT_LENGTH, "Tell us a little more about your experience")
    .max(MAX_CONTENT_LENGTH, `Keep it under ${MAX_CONTENT_LENGTH} characters`),
  /** 1–5, optional. */
  rating: z.number().int().min(1).max(5).nullable(),
  /**
   * Consent to feature the words on the website, asked every time and never assumed. The
   * table has a column for exactly this (`allow_public_use`).
   */
  allow_public_use: z.boolean(),
});

export type TestimonyInput = z.infer<typeof testimonySchema>;

export const EMPTY_TESTIMONY: TestimonyInput = { content: "", rating: null, allow_public_use: false };
