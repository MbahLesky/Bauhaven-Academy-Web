import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Whether the signed-in student may create their own tasks.
 *
 * This is an **individual** grant, not a role: `tasks_insert` is
 * `auth_is_admin_or_staff() or auth_has_permission('tasks','create')`, and
 * `Bauhaven-Admin-Feature-Spec.md` §8 records the decision behind it — "A Student can
 * only create their own Task/Project if an Admin/Staff member has granted that specific
 * permission — not open to all students by default."
 *
 * **Why an RPC and not a table read:** `permissions` and `user_permission_overrides` are
 * both `for all using (auth_is_admin())`, so a student cannot read their own grant. The
 * app physically cannot compute this from table data as the user in question, and
 * re-implementing the precedence in TypeScript would be a second copy of the rule free to
 * drift from the SQL. Calling the same `security definer` function the policy calls means
 * the UI and the database cannot disagree. Same approach Admin-web uses for finance.
 *
 * Fails **closed** — an unreachable permission check is not a grant.
 */
export const canCreateOwnTasks = cache(async (): Promise<boolean> => {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("auth_has_permission", {
    p_module: "tasks",
    p_action: "create",
  });

  if (error) {
    console.error("Task-creation permission check failed:", error.message);
    return false;
  }

  return data === true;
});
