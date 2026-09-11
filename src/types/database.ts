/**
 * The tables and views Academy reads and writes on the Bauhaven database, hand-written to
 * match its live structure (see Bauhaven-Platform/docs/Bauhaven-Database-Schema.md).
 * Only what this app touches is here. `node scripts/check-app-names.mjs` in
 * Bauhaven-Platform checks every name and column in this file against the live schema.
 *
 * Every table needs Row + Insert + Update + Relationships to satisfy postgrest-js's
 * GenericTable shape — a Row-only entry compiles fine on its own but silently degrades
 * every query against that table to `never` at the call site.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type ProfilesRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  bio: string | null;
  status: "pending" | "active" | "suspended" | "deactivated";
  created_at: string;
};

type ParticipantProfilesRow = {
  profile_id: string;
  city: string | null;
  country_code: string | null;
  education_level: string | null;
  institution_name: string | null;
  bio: string | null;
};

export type EnrolmentStatus = "pending_activation" | "active" | "paused" | "completed" | "withdrawn" | "cancelled";

type EnrolmentsRow = {
  id: string;
  profile_id: string;
  offering_id: string | null;
  cohort_id: string | null;
  // "Intern", "Student", "Holiday-maker" — the kind of learner on this enrolment.
  assigned_role: string;
  status: EnrolmentStatus;
  started_at: string | null;
  ends_at: string | null;
  created_at: string;
};

type OfferingsRow = {
  id: string;
  title: string;
  offering_type: string;
};

type CohortsRow = {
  id: string;
  offering_id: string;
  name: string;
  starts_at: string | null;
  ends_at: string | null;
};

type TasksRow = {
  id: string;
  offering_id: string | null;
  cohort_id: string | null;
  title: string;
  instructions: string;
  status: "draft" | "scheduled" | "published" | "closed" | "archived";
  due_at: string | null;
  submission_type: string;
  allow_resubmission: boolean;
  max_resubmissions: number | null;
  created_at: string;
};

export type AssignmentStatus =
  | "assigned"
  | "in_progress"
  | "submitted"
  | "changes_requested"
  | "completed"
  | "overdue"
  | "cancelled";

type TaskAssignmentsRow = {
  id: string;
  task_id: string;
  enrolment_id: string;
  status: AssignmentStatus;
  due_at_override: string | null;
  assigned_at: string;
  completed_at: string | null;
};

export type SubmissionStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "changes_requested"
  | "resubmitted"
  | "accepted"
  | "completed"
  | "withdrawn";

type SubmissionsRow = {
  id: string;
  task_assignment_id: string;
  participant_id: string;
  version_number: number;
  status: SubmissionStatus;
  text_content: string | null;
  link_url: string | null;
  submitted_at: string | null;
  is_late: boolean;
  idempotency_key: string | null;
  created_at: string;
};

type AttendanceSessionsRow = {
  id: string;
  cohort_id: string;
  title: string;
  session_type: string;
  starts_at: string;
  status: "draft" | "open" | "closed" | "cancelled";
};

type AttendanceRecordsRow = {
  id: string;
  attendance_session_id: string;
  enrolment_id: string;
  status: "not_recorded" | "present" | "absent" | "late" | "excused";
  note: string | null;
  corrected_at: string | null;
  correction_reason: string | null;
};

type WebsiteReviewsRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  user_type: "Student" | "Intern" | "Professional" | "Parent/Guardian" | "Other";
  category:
    | "Overall website experience"
    | "Courses & programs"
    | "Internship page"
    | "Design & layout"
    | "Content clarity"
    | "Performance / bugs"
    | "Other";
  message: string;
  rating: number | null;
  allow_public_use: boolean | null;
  created_at: string;
  user_id: string | null;
};

// Proposed (Bauhaven-Platform/supabase/proposed/04): not on the database until applied.
// The screens using them stay switched off until then — see database-readiness.ts.

type AbsenceRequestsRow = {
  id: string;
  requester_id: string;
  enrolment_id: string | null;
  type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

type IssueReportsRow = {
  id: string;
  reporter_id: string;
  category: string;
  description: string;
  status: "open" | "in_progress" | "resolved";
  offering_id: string | null;
  created_at: string;
};

type TableShape<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: never[];
};

/**
 * Released feedback only, with the reviewer's private note left out. Learners read this
 * view, never the `feedback` table.
 */
type ParticipantFeedbackRow = {
  id: string | null;
  submission_id: string | null;
  reviewer_name: string | null;
  visible_feedback: string | null;
  result: string | null;
  score: number | null;
  allow_resubmission: boolean | null;
  released_at: string | null;
  task_title: string | null;
};

export type Database = {
  public: {
    Tables: {
      profiles: TableShape<ProfilesRow>;
      participant_profiles: TableShape<ParticipantProfilesRow>;
      enrolments: TableShape<EnrolmentsRow>;
      offerings: TableShape<OfferingsRow>;
      cohorts: TableShape<CohortsRow>;
      tasks: TableShape<TasksRow>;
      task_assignments: TableShape<TaskAssignmentsRow>;
      submissions: TableShape<SubmissionsRow>;
      attendance_sessions: TableShape<AttendanceSessionsRow>;
      attendance_records: TableShape<AttendanceRecordsRow>;
      website_reviews: TableShape<WebsiteReviewsRow>;
      absence_requests: TableShape<AbsenceRequestsRow>;
      issue_reports: TableShape<IssueReportsRow>;
    };
    Views: {
      participant_feedback: { Row: ParticipantFeedbackRow; Relationships: never[] };
    };
    Functions: {
      /** The caller's active role assignments, answered for `auth.uid()` only. */
      get_my_active_roles: {
        Args: Record<string, never>;
        Returns: { role_code: string; scope_type: string; scope_id: string | null }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
