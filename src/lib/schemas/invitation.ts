/**
 * The role vocabulary, shared with Admin-web.
 *
 * Academy **issues no invitations** — `invitations_insert` is Admin/Staff only, and this
 * app's users are neither. All it needs is the labels, so the accept screen can say what
 * someone is accepting rather than showing them `holiday_maker`.
 */
export const INVITABLE_ROLES = ["admin", "staff", "intern", "student", "holiday_maker"] as const;

export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export const ROLE_LABELS: Record<InvitableRole, string> = {
  admin: "Admin",
  staff: "Staff",
  intern: "Intern",
  student: "Student",
  // A database identifier isn't a thing to show someone.
  holiday_maker: "Holiday participant",
};
