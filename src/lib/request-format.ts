import { formatDateOnly } from "@/lib/date-format";
import type { RequestStatus } from "@/lib/schemas/request";

const STATUS_LABELS: Record<RequestStatus, string> = {
  // "Waiting" rather than "Pending": from the student's side the useful fact is that
  // nothing has happened yet, and "pending" is the kind of word that reads as jargon to
  // someone whose second language this is.
  pending: "Waiting",
  approved: "Approved",
  rejected: "Not approved",
};

export function formatRequestStatus(status: RequestStatus): string {
  return STATUS_LABELS[status];
}

/**
 * Badge colours, following the same semantic table Tasks uses.
 *
 * A rejected request is `danger` rather than `neutral` because it changes what the
 * student has to do — they are expected in, and an attendance record will say so.
 */
export const REQUEST_STATUS_VARIANTS: Record<RequestStatus, "warning" | "success" | "danger"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

/**
 * Renders a request's dates as one line: "6 Aug 2026" for a single day, "6 – 7 Aug 2026"
 * across a range, "30 Jul – 2 Aug 2026" when the month changes too.
 *
 * A single-day absence is stored as start and end on the same date, so rendering the
 * range verbatim would give "6 Aug 2026 – 6 Aug 2026" for the commonest case.
 */
export function formatRequestDates(startDate: string, endDate: string): string {
  const start = formatDateOnly(startDate);
  const end = formatDateOnly(endDate);

  // Anything unparseable is shown as-is rather than hidden — a date the student can read
  // and query beats an empty row.
  if (!start || !end) return start ?? end ?? `${startDate} – ${endDate}`;
  if (startDate === endDate) return start;

  const sameMonth = startDate.slice(0, 7) === endDate.slice(0, 7);
  // "6 Aug 2026" → "6"; drop the repeated month and year from the opening date.
  return sameMonth ? `${start.split(" ")[0]} – ${end}` : `${dropYear(start)} – ${end}`;
}

/** "30 Jul 2026" → "30 Jul". Only used when the closing date carries the year. */
function dropYear(formatted: string): string {
  return formatted.split(" ").slice(0, 2).join(" ");
}
