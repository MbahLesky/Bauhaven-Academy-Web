import { createClient } from "@/lib/supabase/server";
import type { ContentLanguage } from "@/lib/schemas/testimony";

export interface ProfileRole {
  id: string;
  /** "Intern", "Student", "Mentor" — already humanised. */
  label: string;
  /** The program this role is scoped to, when it is scoped to one. */
  programName: string | null;
  status: "active" | "inactive";
}

export interface Profile {
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  photoUrl: string | null;
  language: ContentLanguage;
  roles: ProfileRole[];
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  staff: "Staff",
  intern: "Intern",
  student: "Student",
  // The schema's `holiday_maker` is a database identifier, not a thing to show someone.
  holiday_maker: "Holiday participant",
};

const SUB_ROLE_LABELS: Record<string, string> = {
  auditor: "Auditor",
  coordinator: "Internship Coordinator",
  programme_manager: "Programme Manager",
  mentor: "Mentor",
};

/**
 * Everything the Profile screen shows, in one pass.
 *
 * Three reads rather than a join: PostgREST embedding across `user_roles → programs`
 * would need a declared relationship in the generated types, and this file is hand-written
 * until a real Supabase project exists. Program names are fetched in one `in` query, not
 * per role.
 *
 * `users_select_own` is `id = auth.uid() or auth_is_admin_or_staff()` and
 * `user_roles_select` is `user_id = auth.uid() or auth_is_admin_or_staff()`, so both are
 * scoped by RLS for a student — but a **staff** member signing into Academy would read
 * everyone's rows, so the user filter is explicit here. That's the same reasoning the
 * testimony query documents, and cheap insurance on a screen whose whole subject is "you".
 */
export async function getProfile(): Promise<{ profile: Profile | null; error: unknown }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The route is behind middleware's session gate, so this is a guard against the
  // impossible rather than an expected path.
  if (!user) return { profile: null, error: null };

  const [userResult, rolesResult] = await Promise.all([
    supabase
      .from("users")
      .select("name, email, phone, location, profile_photo_url, preferred_language")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("user_roles")
      .select("id, role, staff_sub_role, program_id, status")
      .eq("user_id", user.id)
      // Read-only list of what someone *is*; an ended role isn't that.
      .eq("status", "active"),
  ]);

  if (userResult.error) {
    console.error("Profile query failed:", userResult.error.code, userResult.error.message);
    return { profile: null, error: userResult.error };
  }
  if (!userResult.data) {
    // `handle_new_user` creates this row on sign-up, so its absence is a real fault
    // rather than a new account — better surfaced than rendered as a blank screen.
    console.error("No users row for the signed-in account:", user.id);
    return { profile: null, error: new Error("Profile row missing") };
  }

  // A failed roles read shouldn't cost the student their whole profile — the name, email
  // and language toggle are all still true and useful without it.
  if (rolesResult.error) {
    console.error("Roles query failed:", rolesResult.error.code, rolesResult.error.message);
  }

  const roleRows = rolesResult.data ?? [];
  const programNames = await getProgramNames(
    roleRows.map((row) => row.program_id).filter((id): id is string => id !== null)
  );

  return {
    profile: {
      name: userResult.data.name,
      email: userResult.data.email,
      phone: userResult.data.phone,
      location: userResult.data.location,
      photoUrl: userResult.data.profile_photo_url,
      language: userResult.data.preferred_language,
      roles: roleRows.map((row) => ({
        id: row.id,
        label: formatRole(row.role, row.staff_sub_role),
        programName: row.program_id ? (programNames.get(row.program_id) ?? null) : null,
        status: row.status,
      })),
    },
    error: null,
  };
}

/** The sub-role is the more specific truth when there is one: "Mentor" beats "Staff". */
function formatRole(role: string, subRole: string | null): string {
  if (subRole && SUB_ROLE_LABELS[subRole]) return SUB_ROLE_LABELS[subRole];
  return ROLE_LABELS[role] ?? role;
}

/** One query for every program a role points at, rather than one per role. */
async function getProgramNames(programIds: string[]): Promise<Map<string, string>> {
  if (programIds.length === 0) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("programs")
    .select("id, title_en")
    .in("id", programIds);

  if (error) {
    console.error("Program names lookup failed:", error.code, error.message);
    return new Map();
  }

  return new Map(data.map((row) => [row.id, row.title_en]));
}
