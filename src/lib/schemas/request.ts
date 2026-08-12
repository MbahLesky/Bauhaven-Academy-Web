import { z } from "zod";

// Its own module, not request-actions.ts — a "use server" file can only export async
// functions, so a schema exported from one silently isn't the real schema by the time a
// client component imports it. Same rule the auth and task schemas follow.

/** Mirrors `requests.status`'s check constraint exactly. */
export const REQUEST_STATUSES = ["pending", "approved", "rejected"] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/**
 * `requests.type` defaults to 'absence' and carries **no check constraint** — any text
 * would be accepted. This screen submits absences only, so the one value it can mean is
 * named here rather than left to the column default: what the student is asking for is a
 * fact this client knows. Where the request then sits in a workflow is not, which is why
 * `status` is deliberately absent from this schema — see `submitAbsenceRequest`.
 */
export const ABSENCE_REQUEST_TYPE = "absence";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const MAX_REASON_LENGTH = 1000;

/**
 * The longest absence this form will submit, in days.
 *
 * Not a rule from the spec — a typo guard. Nobody can edit a request after submitting it
 * (there is no UPDATE policy on `requests`, for anyone), so a mistyped year would sit in
 * the approver's queue as a 36-year absence with no way to correct it short of a database
 * write. A term is comfortably inside this.
 */
const MAX_RANGE_DAYS = 90;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** Both dates are date-only values, so this is exact — no timezone enters into it. */
function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  return Math.round((end - start) / MILLISECONDS_PER_DAY);
}

/**
 * Submitting an absence request.
 *
 * Dates are the raw `YYYY-MM-DD` strings an `<input type="date">` produces, which is
 * already the shape a `date` column wants — so they never round-trip through a parse and
 * can't shift a day on the way. (`requests.start_date` and `end_date` are `date`, not
 * `timestamptz`; the deadline-style timezone handling that `tasks` needs doesn't apply.)
 *
 * A past start date is allowed on purpose: "I was ill yesterday" is a real request, and
 * an absence you couldn't foresee is the ordinary case rather than the exception. Whether
 * a retroactive request is reasonable is the approver's judgement, not a form's.
 */
export const absenceRequestSchema = z
  .object({
    start_date: z.string().regex(ISO_DATE, "Pick a start date"),
    end_date: z.string().regex(ISO_DATE, "Pick an end date"),
    /**
     * `reason` is nullable in the schema but required here.
     *
     * A request with no reason gives the person deciding it nothing to decide on, and
     * they cannot ask a follow-up question through the app — there is no comment thread
     * on `requests`. Same call, for the same reason, as `submissions.content_url`: the
     * column allows null, the form doesn't.
     */
    reason: z
      .string()
      .trim()
      .min(1, "Say briefly why you'll be away")
      .max(MAX_REASON_LENGTH, "Keep the reason under 1000 characters"),
  })
  .refine((value) => value.end_date >= value.start_date, {
    // ISO dates compare correctly as strings, so no parsing is needed to order them.
    error: "The last day can't be before the first day",
    path: ["end_date"],
  })
  .refine((value) => daysBetween(value.start_date, value.end_date) < MAX_RANGE_DAYS, {
    error: `That's longer than ${MAX_RANGE_DAYS} days — check the dates`,
    path: ["end_date"],
  });

export type AbsenceRequestInput = z.infer<typeof absenceRequestSchema>;

export const EMPTY_ABSENCE_REQUEST: AbsenceRequestInput = {
  start_date: "",
  end_date: "",
  reason: "",
};
