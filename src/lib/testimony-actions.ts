"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getLearnerContext } from "@/lib/enrolment";
import { testimonySchema, type TestimonyInput } from "@/lib/schemas/testimony";

export type TestimonyMutationResult = { error: string | null };

// "What happened + what they can do" — the technical detail goes to the log.
const SIGNED_OUT_MESSAGE = "Your session has expired. Sign in again to continue.";
const VALIDATION_MESSAGE = "Check what you've written and try again.";
const GENERIC_MESSAGE = "Couldn't send that. Try again in a moment.";

/** The website's review categories this feedback belongs to. */
const REVIEW_CATEGORY = "Courses & programs";

/**
 * Shares the learner's feedback, stored with the website's reviews.
 *
 * - **Name, not email.** The review carries the learner's name so Bauhaven's team knows
 *   whose words these are; their email is deliberately left out — the team already has it,
 *   and a review is not the place to copy contact details.
 * - **Consent is the learner's own tick**, stored as `allow_public_use`.
 * - `user_type` follows the learner's enrolment: an intern is an Intern, everyone else a
 *   Student — the website's own two categories for Bauhaven's learners.
 */
export async function submitTestimony(input: TestimonyInput): Promise<TestimonyMutationResult> {
  const parsed = testimonySchema.safeParse(input);
  if (!parsed.success) {
    console.error("Testimony rejected by validation:", parsed.error.issues);
    return { error: VALIDATION_MESSAGE };
  }

  const learner = await getLearnerContext();
  if (!learner) return { error: SIGNED_OUT_MESSAGE };

  const supabase = await createClient();

  const profile = await supabase.from("profiles").select("full_name").eq("id", learner.userId).maybeSingle();
  if (profile.error) {
    console.error("Profile lookup failed:", profile.error.code, profile.error.message);
  }

  const isIntern = learner.current?.assignedRole.toLowerCase().includes("intern") ?? false;

  const { error } = await supabase.from("website_reviews").insert({
    // From the session, never the client.
    user_id: learner.userId,
    full_name: profile.data?.full_name ?? null,
    email: null,
    user_type: isIntern ? "Intern" : "Student",
    category: REVIEW_CATEGORY,
    message: parsed.data.content,
    rating: parsed.data.rating,
    allow_public_use: parsed.data.allow_public_use,
  });

  if (error) {
    console.error("Testimony insert failed:", error.code, error.message);
    return { error: GENERIC_MESSAGE };
  }

  revalidatePath("/testimony");
  return { error: null };
}
