import { z } from "zod";

// Its own module, not issue-report-actions.ts — a "use server" file can only export async
// functions, so a schema exported from one silently isn't the real schema by the time a
// client component imports it. Same rule the auth, task and request schemas follow.

/** Mirrors `issue_reports.status`'s check constraint exactly — all three values. */
export const ISSUE_STATUSES = ["open", "in_progress", "resolved"] as const;

export type IssueStatus = (typeof ISSUE_STATUSES)[number];

/**
 * The categories this screen offers.
 *
 * **Nothing upstream enumerates these.** `issue_reports.category` is `text not null
 * default 'general'` with *no check constraint*, and the word "category" appears in
 * exactly two places in the whole schema: that column and the composite index
 * `(status, category)`. So this list is a product decision made here, and these are the
 * only values Academy will ever write.
 *
 * Chosen to match what the schema already anticipates rather than invented freely:
 * `issue_reports` carries a nullable `asset_id` and a nullable `program_id`, which is the
 * schema saying the two expected kinds of problem are "a thing is broken" and "something
 * about my course". `general` is kept verbatim because it is the column default — a row
 * written by anything that doesn't set the column lands in the same bucket as a student
 * choosing "Something else", rather than in a category nothing displays.
 *
 * Stored values are stable lowercase identifiers, never the display strings: a future
 * triage filter should match on `'equipment'`, not on whatever the label happens to read
 * this month, and the label has to be translatable (EN/FR) without rewriting rows.
 */
export const ISSUE_CATEGORIES = [
  /** The wireframe's own example: "Equipment / facilities". Pairs with `asset_id`. */
  { value: "equipment", label: "Equipment or facilities" },
  /** Pairs with `program_id` — teaching, materials, timetable. */
  { value: "program", label: "Course or program" },
  { value: "access", label: "Account or access" },
  /**
   * Its own category rather than folded into "general" so that a Staff member scanning a
   * list can see it without opening rows. It does **not** get faster handling on its own:
   * nothing in this schema routes by category — see `Bauhaven-Academy-Feature-Spec.md`
   * §7, "Issue reports". The screen says so and points at a person instead.
   */
  { value: "safety", label: "Safety or wellbeing" },
  /** The column default, kept as the escape hatch rather than as a dumping ground. */
  { value: "general", label: "Something else" },
] as const;

export type IssueCategory = (typeof ISSUE_CATEGORIES)[number]["value"];

const CATEGORY_VALUES = ISSUE_CATEGORIES.map((category) => category.value) as [
  IssueCategory,
  ...IssueCategory[],
];

const MIN_DESCRIPTION_LENGTH = 10;
const MAX_DESCRIPTION_LENGTH = 2000;

/**
 * Reporting a problem.
 *
 * `asset_id` and `program_id` are deliberately absent. A student can read only the assets
 * assigned to them (`assets_select` is `assigned_to = auth.uid() or auth_is_admin_or_staff()`),
 * so an asset picker would list a broken projector for nobody except the person it's
 * signed out to — which is not who reports it. Both columns stay null until a Staff-side
 * triage screen exists to attach them, which is where that knowledge lives anyway.
 */
export const issueReportSchema = z.object({
  category: z.enum(CATEGORY_VALUES, { error: "Pick a category" }),
  /**
   * `description` is `not null` in the schema, so a minimum is enforced regardless — but
   * ten characters is the difference between "broken" and something a Staff member can
   * act on without finding the student first. There is no comment thread on
   * `issue_reports` for them to ask a follow-up question through.
   */
  description: z
    .string()
    .trim()
    .min(MIN_DESCRIPTION_LENGTH, "Say a little more about what's wrong")
    .max(MAX_DESCRIPTION_LENGTH, "Keep it under 2000 characters"),
});

export type IssueReportInput = z.infer<typeof issueReportSchema>;

export const EMPTY_ISSUE_REPORT: IssueReportInput = {
  // Not preselected — a default category is the one everybody submits.
  category: "" as IssueCategory,
  description: "",
};
