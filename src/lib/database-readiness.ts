/**
 * Screens whose database side is tracked in `Bauhaven-Platform/supabase/migrations/`
 * (`0034_absence_requests_and_issue_reports.sql`, mirrored in `Bauhaven-Platform/supabase/proposed/04_`).
 *
 * Both features are enabled now that the platform migrations are unified in `Bauhaven-Platform`.
 */
export const DATABASE_READY = {
  absenceRequests: true,
  issueReports: true,
} as const;

export type PendingFeature = keyof typeof DATABASE_READY;

export const PENDING_CHANGES: Record<PendingFeature, { file: string }> = {
  absenceRequests: { file: "04_absence_requests_and_issue_reports.sql" },
  issueReports: { file: "04_absence_requests_and_issue_reports.sql" },
};

export function isDatabaseReady(feature: PendingFeature): boolean {
  return DATABASE_READY[feature];
}
