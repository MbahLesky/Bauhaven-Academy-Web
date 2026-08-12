import { z } from "zod";
import { CONTENT_LANGUAGES } from "@/lib/schemas/testimony";

// Its own module, not profile-actions.ts — a "use server" file can only export async
// functions, so a schema exported from one silently isn't the real schema by the time a
// client component imports it.

/**
 * The language preference the toggle writes.
 *
 * Reuses `CONTENT_LANGUAGES` rather than redeclaring en/fr, because there is exactly one
 * column behind both — `users.preferred_language` — and two lists that could drift apart
 * would be two lists that eventually do.
 */
export const languageSchema = z.enum(CONTENT_LANGUAGES, { error: "Pick a language" });

export const LANGUAGE_OPTIONS = [
  { value: "en", label: "EN", name: "English" },
  { value: "fr", label: "FR", name: "Français" },
] as const;
