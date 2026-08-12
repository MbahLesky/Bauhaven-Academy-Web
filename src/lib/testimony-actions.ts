"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { testimonySchema, type ContentLanguage, type TestimonyInput } from "@/lib/schemas/testimony";

export type TestimonyMutationResult = { error: string | null };

// "What happened + what they can do" — the technical detail goes to the log.
const SIGNED_OUT_MESSAGE = "Your session has expired. Sign in again to continue.";
const VALIDATION_MESSAGE = "Check what you've written and try again.";
const REFUSED_MESSAGE =
  "That wasn't accepted. Reload the page and try again — if it keeps happening, tell a mentor.";
const GENERIC_MESSAGE = "Couldn't send that. Try again in a moment.";

const RLS_VIOLATION_CODE = "42501";

/**
 * The student's own content language, from their profile.
 *
 * `users_select_own` is `id = auth.uid() or auth_is_admin_or_staff()`, so a student can
 * read their own row. Falls back to 'en' on any failure, matching the column's own default
 * — a testimony stored in the wrong column is recoverable by a curator, a failed
 * submission is just lost.
 */
async function getPreferredLanguage(userId: string): Promise<ContentLanguage> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("users")
    .select("preferred_language")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Preferred language lookup failed:", error.code, error.message);
    return "en";
  }

  return data?.preferred_language ?? "en";
}

/** The program a pull-quote would be about. Null when the student has no active enrollment. */
async function getActiveProgramId(): Promise<string | null> {
  const supabase = await createClient();

  // RLS scopes enrollments to the current user.
  const { data, error } = await supabase
    .from("enrollments")
    .select("program_id")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Active enrollment lookup failed:", error.code, error.message);
    return null;
  }

  return data?.program_id ?? null;
}

/**
 * Submits a testimony for the signed-in student.
 *
 * **One form field becomes one of two columns, chosen server-side.** The wireframe shows a
 * single free-text box and that's what ships; `users.preferred_language` (`not null default
 * 'en' check in ('en','fr')`) decides whether the words land in `content_en` or
 * `content_fr`. The unused column stays null rather than holding a copy — a duplicate would
 * tell the public Site that the French text *is* the English translation, and it would be
 * rendered to English readers as such.
 *
 * This is a **content**-language decision and needs no interface translation to make. It
 * does not resolve, and must not be mistaken for, the outstanding next-intl work: no
 * interface chrome in either app is translated, and this form's own labels are still
 * English-only. See `Bauhaven-Academy-Feature-Spec.md` §7, "Testimonies".
 *
 * **`status` is deliberately not sent.** It defaults to `'submitted'` (checked, not
 * assumed: `001_initial_schema.sql` line 469) with a check constraint of
 * submitted/published. Publishing is Admin/Staff curation, that screen doesn't exist, and
 * — as with `requests` — `testimonies` has **no UPDATE policy at all**, so no row can reach
 * `'published'` by any route today.
 *
 * **No consent gate**, per the Project Brief's "Known open items": portfolio/testimony
 * consent is explicitly deferred, not decided. The screen states plainly that a testimony
 * may be featured publicly, which is the wireframe's own subtitle, and nothing more is
 * invented here.
 */
export async function submitTestimony(input: TestimonyInput): Promise<TestimonyMutationResult> {
  const parsed = testimonySchema.safeParse(input);
  if (!parsed.success) {
    console.error("Testimony rejected by validation:", parsed.error.issues);
    return { error: VALIDATION_MESSAGE };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: SIGNED_OUT_MESSAGE };

  const [language, programId] = await Promise.all([
    getPreferredLanguage(user.id),
    getActiveProgramId(),
  ]);

  const { error } = await supabase.from("testimonies").insert({
    // From the session, never the client — `testimonies_insert` is
    // `with check (user_id = auth.uid())`, but the app must not depend on that refusal.
    user_id: user.id,
    // Nullable, so a student between programs can still say something.
    program_id: programId,
    // Exactly one of these is populated. `content_en` is nullable as of
    // 007_testimonies_bilingual_content.sql, which exists precisely so a French testimony
    // doesn't have to be stored in a column named for English.
    content_en: language === "en" ? parsed.data.content : null,
    content_fr: language === "fr" ? parsed.data.content : null,
  });

  if (error) {
    console.error("Testimony insert failed:", error.code, error.message);
    return { error: error.code === RLS_VIOLATION_CODE ? REFUSED_MESSAGE : GENERIC_MESSAGE };
  }

  revalidatePath("/testimony");

  return { error: null };
}
