import { createClient } from "@/lib/supabase/server";
import { formatEnrolmentStatus, getLearnerContext, programmeLabel } from "@/lib/enrolment";

export interface ProfileProgramme {
  id: string;
  /** "Web Development Internship · September 2026". */
  label: string;
  /** "Intern", "Student". */
  role: string;
  status: string;
}

export interface Profile {
  name: string;
  email: string;
  phone: string | null;
  photoUrl: string | null;
  /** "Douala, CM" — from the participant profile, when filled in. */
  location: string | null;
  education: string | null;
  programmes: ProfileProgramme[];
}

/**
 * Everything the Profile screen shows: the account (`profiles`), the learner details
 * (`participant_profiles`, which may not exist yet for a new learner), and their programmes.
 *
 * Filtered to the signed-in account explicitly: the database also lets staff read other
 * people's profiles, and this screen's whole subject is "you".
 *
 * Throws when the account's own profile can't be read — a signed-in person always has one.
 */
export async function getProfile(): Promise<Profile> {
  const learner = await getLearnerContext();
  if (!learner) throw new Error("Couldn't load your profile.");

  const supabase = await createClient();

  const [profileResult, detailsResult] = await Promise.all([
    supabase.from("profiles").select("full_name, email, phone, avatar_url").eq("id", learner.userId).maybeSingle(),
    supabase
      .from("participant_profiles")
      .select("city, country_code, education_level, institution_name")
      .eq("profile_id", learner.userId)
      .maybeSingle(),
  ]);

  if (profileResult.error || !profileResult.data) {
    console.error("Profile query failed:", profileResult.error?.code, profileResult.error?.message);
    throw new Error("Couldn't load your profile.");
  }

  // Learner details are optional and secondary: without them the rest is still right.
  if (detailsResult.error) {
    console.error("Participant details query failed:", detailsResult.error.code, detailsResult.error.message);
  }

  const details = detailsResult.data;

  return {
    name: profileResult.data.full_name,
    email: profileResult.data.email,
    phone: profileResult.data.phone,
    photoUrl: profileResult.data.avatar_url,
    location: [details?.city, details?.country_code].filter(Boolean).join(", ") || null,
    education: [details?.education_level, details?.institution_name].filter(Boolean).join(" · ") || null,
    programmes: learner.enrolments.map((enrolment) => ({
      id: enrolment.id,
      label: programmeLabel(enrolment),
      role: enrolment.assignedRole,
      status: formatEnrolmentStatus(enrolment.status),
    })),
  };
}
