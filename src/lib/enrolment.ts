import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { EnrolmentStatus } from "@/types/database";

/**
 * Who the signed-in learner is on Bauhaven's programmes.
 *
 * An enrolment is created when an application is approved, as `pending_activation`, and
 * staff make it `active` when the programme starts. Academy opens for either, and for a
 * `paused` one: the learner still has their history and their place.
 */
export const OPEN_ENROLMENT_STATUSES: readonly EnrolmentStatus[] = ["active", "pending_activation", "paused"];

export interface MyEnrolment {
  id: string;
  status: EnrolmentStatus;
  offeringId: string | null;
  cohortId: string | null;
  /** "Intern", "Student", "Holiday-maker". */
  assignedRole: string;
  /** "Web Development Internship". Null when the programme can't be read. */
  programmeTitle: string | null;
  /** "September 2026". */
  cohortName: string | null;
}

export interface LearnerContext {
  userId: string;
  enrolments: MyEnrolment[];
  /** The enrolment screens default to: the active one first, then pending, then paused. */
  current: MyEnrolment | null;
}

const STATUS_PRIORITY: Record<string, number> = { active: 0, pending_activation: 1, paused: 2 };

/**
 * The signed-in person's open enrolments, with programme and cohort names. Null when no one
 * is signed in.
 *
 * Filtered by `profile_id` explicitly: the database also shows a mentor the enrolments they
 * mentor and staff the ones they manage, and this app's screens are about the person
 * holding the session, not about everyone they can see.
 *
 * Wrapped in React's `cache` so the layout's gate and the page resolve it once per request.
 */
export const getLearnerContext = cache(async (): Promise<LearnerContext | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("enrolments")
    .select("id, status, offering_id, cohort_id, assigned_role, created_at")
    .eq("profile_id", user.id)
    .in("status", [...OPEN_ENROLMENT_STATUSES])
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Enrolment lookup failed:", error.code, error.message);
    throw new Error("Couldn't load your enrolment.");
  }

  const offeringIds = [...new Set(data.map((row) => row.offering_id).filter((id): id is string => id !== null))];
  const cohortIds = [...new Set(data.map((row) => row.cohort_id).filter((id): id is string => id !== null))];

  // Names degrade to null rather than failing the gate: the enrolment is what matters.
  const [offerings, cohorts] = await Promise.all([
    offeringIds.length > 0
      ? supabase.from("offerings").select("id, title").in("id", offeringIds)
      : Promise.resolve({ data: [], error: null }),
    cohortIds.length > 0
      ? supabase.from("cohorts").select("id, name").in("id", cohortIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (offerings.error || cohorts.error) {
    console.error("Programme name lookup failed:", offerings.error?.message, cohorts.error?.message);
  }

  const titles = new Map((offerings.data ?? []).map((row) => [row.id, row.title]));
  const cohortNames = new Map((cohorts.data ?? []).map((row) => [row.id, row.name]));

  const enrolments: MyEnrolment[] = data
    .map((row) => ({
      id: row.id,
      status: row.status,
      offeringId: row.offering_id,
      cohortId: row.cohort_id,
      assignedRole: row.assigned_role,
      programmeTitle: row.offering_id ? (titles.get(row.offering_id) ?? null) : null,
      cohortName: row.cohort_id ? (cohortNames.get(row.cohort_id) ?? null) : null,
    }))
    .sort((a, b) => (STATUS_PRIORITY[a.status] ?? 9) - (STATUS_PRIORITY[b.status] ?? 9));

  return { userId: user.id, enrolments, current: enrolments[0] ?? null };
});

/** "Web Development Internship · September 2026", or whichever half is known. */
export function programmeLabel(enrolment: MyEnrolment): string {
  return [enrolment.programmeTitle, enrolment.cohortName].filter(Boolean).join(" · ") || "Your programme";
}

const ENROLMENT_STATUS_LABELS: Partial<Record<EnrolmentStatus, string>> = {
  active: "In progress",
  pending_activation: "Starting soon",
  paused: "Paused",
};

export function formatEnrolmentStatus(status: EnrolmentStatus): string {
  return ENROLMENT_STATUS_LABELS[status] ?? status;
}
