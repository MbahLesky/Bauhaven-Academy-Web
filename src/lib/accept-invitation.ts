import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS, type InvitableRole } from "@/lib/schemas/invitation";

export interface InvitationPreview {
  email: string;
  role: InvitableRole;
  roleLabel: string;
  programId: string | null;
}

/**
 * What the accept screen can show before anyone has signed in.
 *
 * Goes through the `invitation_preview` RPC rather than reading the table, because
 * `invitations_select` is Admin/Staff only — an anonymous invitee has no other way to see
 * what they were sent. The function is `security definer` and returns rows only for a
 * token that is valid, unused and unexpired, so it can't be used to check whether an
 * address was invited.
 *
 * Returns null for anything invalid, which the page renders identically whether the token
 * is wrong, already used or expired. Distinguishing them would tell whoever found the link
 * which one it is.
 */
export async function previewInvitation(token: string): Promise<InvitationPreview | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("invitation_preview", { p_token: token });

  if (error) {
    console.error("Invitation preview failed:", error.code, error.message);
    return null;
  }

  const invitation = data?.[0];
  if (!invitation) return null;

  const role = invitation.invited_role as InvitableRole;

  return {
    email: invitation.email,
    role,
    roleLabel: ROLE_LABELS[role] ?? role,
    programId: invitation.program_id,
  };
}
