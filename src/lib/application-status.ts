import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/date-format";

export type ApplicationStatus = "submitted" | "confirmed" | "approved" | "declined";

export interface MyApplication {
  status: ApplicationStatus;
  programName: string | null;
  appliedOn: string | null;
  reviewedOn: string | null;
}

/**
 * The signed-in person's most recent application, for the pending screen.
 *
 * Readable because `012` widened `applications_select` to
 * `applicant_id = auth.uid() or auth_is_admin_or_staff()`. Before that it was Admin/Staff
 * only, which meant an applicant couldn't read the row describing their own application —
 * so Academy could only tell them "no access" about something that was entirely theirs.
 *
 * Returns null when there is no application at all. That's a real state, not an error: an
 * account can exist without one (invited by an Admin, seeded, or an application that
 * failed to save after sign-up), and the screen says something different for each.
 */
export async function getMyApplication(): Promise<MyApplication | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("applications")
    .select("status, program_id, created_at, reviewed_at")
    .eq("applicant_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Application status lookup failed:", error.code, error.message);
    return null;
  }
  if (!data) return null;

  let programName: string | null = null;

  if (data.program_id) {
    // `programs_select_all` is `using (true)`, so this is readable while still pending —
    // which matters, since "we're reviewing your application" reads much better with the
    // programme named.
    const program = await supabase
      .from("programs")
      .select("title_en")
      .eq("id", data.program_id)
      .maybeSingle();
    programName = program.data?.title_en ?? null;
  }

  return {
    status: data.status,
    programName,
    appliedOn: formatDate(data.created_at),
    reviewedOn: formatDate(data.reviewed_at),
  };
}
