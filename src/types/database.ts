/**
 * Hand-written subset of the schema, covering only what the current screens need.
 * Once a real Supabase project exists, replace this entirely with generated types:
 *
 *   npx supabase gen types typescript --project-id <id> > src/types/database.ts
 *
 * Don't hand-edit table shapes here once that command is available — it silently
 * drifts from the real schema otherwise. Full schema: see Bauhaven-Database-Schema.md
 * and 001_initial_schema.sql in bauhaven-core.
 *
 * Every table needs Row + Insert + Update + Relationships to satisfy postgrest-js's
 * GenericTable shape — a Row-only entry compiles fine on its own but silently
 * degrades every query against that table to `never` at the call site instead of
 * erroring here. Caught by an actual `npm run build`, not by inspection.
 */

type UsersRow = {
  id: string;
  email: string | null;
  name: string;
  created_at: string;
};

type EnrollmentsRow = {
  id: string;
  user_id: string;
  program_id: string;
  status: "active" | "completed" | "withdrawn";
  start_date: string | null;
  end_date: string | null;
};

type TasksRow = {
  id: string;
  program_id: string | null;
  title: string;
  description: string | null;
  assigned_to: string | null;
  created_by: string;
  deadline: string | null;
  status: "open" | "submitted" | "graded" | "archived";
};

type SubmissionsRow = {
  id: string;
  task_id: string;
  user_id: string;
  content_url: string | null;
  submitted_at: string;
  grade: string | null;
};

type AttendanceSessionsRow = {
  id: string;
  program_id: string;
  session_date: string;
};

type AttendanceRecordsRow = {
  id: string;
  session_id: string;
  user_id: string;
  status: "present" | "absent" | "excused";
};

type RequestsRow = {
  id: string;
  requester_id: string;
  type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
};

type TestimoniesRow = {
  id: string;
  user_id: string;
  program_id: string | null;
  content_en: string;
  content_fr: string | null;
  status: "submitted" | "published";
};

type IssueReportsRow = {
  id: string;
  reporter_id: string;
  category: string;
  description: string;
  status: "open" | "resolved";
};

// Insert/Update are loosely typed (Partial<Row>) here since the current pages only
// read data — tighten these to match real required/generated columns once mutations
// are added and this file is regenerated from a real project anyway.
type TableShape<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: never[];
};

export type Database = {
  public: {
    Tables: {
      users: TableShape<UsersRow>;
      enrollments: TableShape<EnrollmentsRow>;
      tasks: TableShape<TasksRow>;
      submissions: TableShape<SubmissionsRow>;
      attendance_sessions: TableShape<AttendanceSessionsRow>;
      attendance_records: TableShape<AttendanceRecordsRow>;
      requests: TableShape<RequestsRow>;
      testimonies: TableShape<TestimoniesRow>;
      issue_reports: TableShape<IssueReportsRow>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
