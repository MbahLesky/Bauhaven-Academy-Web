/**
 * Screens that are built but whose database side has not been applied yet.
 *
 * Each names the reviewed change in `Bauhaven-Platform/supabase/proposed/` it waits on.
 * Until the project owner applies it, the table doesn't exist, so the screen shows a plain
 * notice instead of an error — and its code stays here, ready.
 *
 * **To switch one on:** once its file has been applied, flip the flag to `true`.
 */
export const DATABASE_READY = {
  absenceRequests: false,
  issueReports: false,
} as const;

export type PendingFeature = keyof typeof DATABASE_READY;

export const PENDING_CHANGES: Record<PendingFeature, { file: string }> = {
  absenceRequests: { file: "04_absence_requests_and_issue_reports.sql" },
  issueReports: { file: "04_absence_requests_and_issue_reports.sql" },
};

export function isDatabaseReady(feature: PendingFeature): boolean {
  return DATABASE_READY[feature];
}
