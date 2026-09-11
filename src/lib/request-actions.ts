"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getLearnerContext } from "@/lib/enrolment";
import { isDatabaseReady } from "@/lib/database-readiness";
import { ABSENCE_REQUEST_TYPE, absenceRequestSchema, type AbsenceRequestInput } from "@/lib/schemas/request";

export type RequestMutationResult = { error: string | null };

// "What happened + what they can do" — the technical detail goes to the log.
const SIGNED_OUT_MESSAGE = "Your session has expired. Sign in again to continue.";
const NOT_READY_MESSAGE = "Absence requests aren't available yet. Tell your coordinator directly for now.";
const VALIDATION_MESSAGE = "Check the dates and reason, then try again.";
const REFUSED_MESSAGE =
  "That request wasn't accepted. Reload the page and try again — if it keeps happening, speak to your coordinator.";
const GENERIC_MESSAGE = "Couldn't send that request. Try again in a moment.";

const RLS_VIOLATION_CODE = "42501";

/**
 * Sends an absence request for the signed-in learner.
 *
 * It carries the learner's current enrolment, which is what routes it to the people who
 * manage that programme. `requester_id` comes from the session, never the client, and
 * `status` is left to the database's default ('pending') — deciding is the other side's job.
 */
export async function submitAbsenceRequest(input: AbsenceRequestInput): Promise<RequestMutationResult> {
  if (!isDatabaseReady("absenceRequests")) return { error: NOT_READY_MESSAGE };

  const parsed = absenceRequestSchema.safeParse(input);
  if (!parsed.success) {
    console.error("Absence request rejected by validation:", parsed.error.issues);
    return { error: VALIDATION_MESSAGE };
  }

  const learner = await getLearnerContext();
  if (!learner) return { error: SIGNED_OUT_MESSAGE };

  const supabase = await createClient();

  const { error } = await supabase.from("absence_requests").insert({
    requester_id: learner.userId,
    enrolment_id: learner.current?.id ?? null,
    type: ABSENCE_REQUEST_TYPE,
    start_date: parsed.data.start_date,
    end_date: parsed.data.end_date,
    reason: parsed.data.reason,
  });

  if (error) {
    console.error("Absence request insert failed:", error.code, error.message);
    return { error: error.code === RLS_VIOLATION_CODE ? REFUSED_MESSAGE : GENERIC_MESSAGE };
  }

  revalidatePath("/requests");
  return { error: null };
}
