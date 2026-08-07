/**
 * Bauhaven operates in Cameroon (WAT, UTC+1, no DST). Pinning the zone keeps a rendered
 * time meaning the same thing regardless of where the server runs — and, on this app in
 * particular, regardless of where the *student* is, since a deadline rendered in the
 * browser's local zone would tell someone travelling that their work is due at the wrong
 * hour. Ported from Admin-web so both apps say the same thing about the same deadline.
 */
export const BAUHAVEN_TIME_ZONE = "Africa/Douala";

/** A fixed offset is only safe because WAT has no DST — it is +01:00 all year. */
export const BAUHAVEN_UTC_OFFSET = "+01:00";

const DEADLINE_DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: BAUHAVEN_TIME_ZONE,
});

const DEADLINE_TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: BAUHAVEN_TIME_ZONE,
});

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: BAUHAVEN_TIME_ZONE,
});

/**
 * Renders a `timestamptz` deadline as "6 Aug, 11:59pm", identical to Admin-web's Tasks
 * list. A deadline is the one timestamp where the zone is load-bearing: an hour out is
 * the difference between on time and late.
 */
export function formatDeadline(isoTimestamp: string | null): string | null {
  if (!isoTimestamp) return null;

  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) return null;

  // en-GB renders "11:59 pm"; the wireframes have no space and no capitals.
  const time = DEADLINE_TIME_FORMAT.format(parsed).replace(/\s/g, "").toLowerCase();

  return `${DEADLINE_DATE_FORMAT.format(parsed)}, ${time}`;
}

/** Renders a `timestamptz` as "3 Jun 2026". */
export function formatDate(isoTimestamp: string | null): string | null {
  if (!isoTimestamp) return null;
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) return null;
  return DATE_FORMAT.format(parsed);
}

/**
 * Reads "2026-08-06T23:59" from a `datetime-local` input as that wall-clock time *in
 * Bauhaven*, not in whatever zone the browser is in. Returns null for anything malformed.
 */
export function bauhavenLocalToInstant(localDateTime: string | null): string | null {
  if (!localDateTime) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localDateTime)) return null;

  const parsed = new Date(`${localDateTime}:00${BAUHAVEN_UTC_OFFSET}`);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString();
}

// "en-CA" formats as YYYY-MM-DD, which is the shape a `date` column wants — so today's
// date never round-trips through a parse.
const ISO_DATE_IN_BAUHAVEN = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: BAUHAVEN_TIME_ZONE,
});

// The wireframe's history rows: "Mon, 3 Aug". Rendered in UTC deliberately — see
// formatSessionDate.
const SESSION_DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/**
 * Today's date in Bauhaven's timezone, as YYYY-MM-DD.
 *
 * "Is there a session today?" has to be asked in Cameroon's day, not the browser's or the
 * server's — a student checking in at 00:30 local time somewhere else would otherwise be
 * offered yesterday's session, or none at all.
 */
export function todayInBauhaven(now: Date = new Date()): string {
  return ISO_DATE_IN_BAUHAVEN.format(now);
}

/**
 * Renders a `session_date` column (YYYY-MM-DD) as "Mon, 3 Aug".
 *
 * Formatted in UTC rather than Bauhaven's zone on purpose: a date-only value carries no
 * time and no zone, so running it through a timezone conversion is exactly how a session
 * on the 3rd renders as the 2nd. Parsing as UTC midnight and formatting as UTC makes the
 * round trip lossless — the same reasoning Admin-web's `formatDateOnly` documents.
 */
export function formatSessionDate(value: string | null): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return SESSION_DATE_FORMAT.format(parsed);
}
