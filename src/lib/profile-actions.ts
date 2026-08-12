"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { languageSchema } from "@/lib/schemas/profile";
import type { ContentLanguage } from "@/lib/schemas/testimony";

export type ProfileMutationResult = { error: string | null };

const SIGNED_OUT_MESSAGE = "Your session has expired. Sign in again to continue.";
const VALIDATION_MESSAGE = "That isn't a language we support.";
const GENERIC_MESSAGE = "Couldn't save that. Try again in a moment.";

/**
 * Changes the signed-in person's language preference.
 *
 * **This writes a real column and has a real consumer today.**
 * `users.preferred_language` is `not null default 'en' check in ('en','fr')`, and the
 * testimony form already reads it to decide whether a student's words go to `content_en`
 * or `content_fr`. So the toggle is not a placeholder: flipping it changes where the next
 * testimony is stored, which is the difference between a French testimony being filed as
 * French and being filed as English.
 *
 * **What it does not do yet is translate the interface.** next-intl has never been set up
 * in either app — every label, button, error and empty state in Admin-web and Academy-web
 * is a hard-coded English string. Persisting the preference is the half that can be done
 * honestly in one screen; translating the chrome is cross-app work with its own scope.
 * The screen says so in plain words rather than implying the UI will switch. See
 * `Bauhaven-Project-Brief.md`, "Known open items".
 *
 * The row is filtered by `auth.uid()` rather than trusting `users_update_own` alone. The
 * policy would refuse anything else, but an UPDATE with no `.eq` is one typo away from
 * being an UPDATE over a table, and depending on RLS to catch that is not a habit worth
 * having.
 */
export async function updateLanguage(language: ContentLanguage): Promise<ProfileMutationResult> {
  const parsed = languageSchema.safeParse(language);
  if (!parsed.success) {
    console.error("Language change rejected by validation:", parsed.error.issues);
    return { error: VALIDATION_MESSAGE };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: SIGNED_OUT_MESSAGE };

  const { error } = await supabase
    .from("users")
    .update({ preferred_language: parsed.data })
    .eq("id", user.id);

  if (error) {
    console.error("Language update failed:", error.code, error.message);
    return { error: GENERIC_MESSAGE };
  }

  revalidatePath("/profile");

  return { error: null };
}
