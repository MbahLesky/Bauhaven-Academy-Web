import { describe, it, expect } from "vitest";
import {
  formatRequestDates,
  formatRequestStatus,
  REQUEST_STATUS_VARIANTS,
} from "./request-format";

describe("formatRequestDates", () => {
  // A one-day absence is stored with start and end on the same date, and it's the
  // commonest case — rendering the range verbatim gives "6 Aug 2026 – 6 Aug 2026".
  it("shows a single day once", () => {
    expect(formatRequestDates("2026-08-06", "2026-08-06")).toBe("6 Aug 2026");
  });

  it("drops the repeated month and year within one month", () => {
    expect(formatRequestDates("2026-08-06", "2026-08-07")).toBe("6 – 7 Aug 2026");
  });

  it("keeps both months when the range crosses one", () => {
    expect(formatRequestDates("2026-07-30", "2026-08-02")).toBe("30 Jul – 2 Aug 2026");
  });

  it("keeps both years when the range crosses one", () => {
    expect(formatRequestDates("2026-12-30", "2027-01-02")).toBe("30 Dec – 2 Jan 2027");
  });

  /**
   * A `date` column has no time and no zone. Formatting it through Bauhaven's zone is
   * exactly how the 1st renders as the previous day — the bug `formatDateOnly` exists to
   * prevent, checked here because this is where a student would notice it.
   */
  it("never shifts a date across a month boundary", () => {
    expect(formatRequestDates("2026-08-01", "2026-08-01")).toBe("1 Aug 2026");
    expect(formatRequestDates("2026-01-01", "2026-01-01")).toBe("1 Jan 2026");
  });

  // A row that can't be formatted is still shown — a date the student can read and query
  // beats a blank row.
  it("falls back to the raw values rather than rendering nothing", () => {
    expect(formatRequestDates("nonsense", "nonsense")).toBe("nonsense – nonsense");
  });
});

describe("formatRequestStatus", () => {
  it("says what a pending request means in plain words", () => {
    expect(formatRequestStatus("pending")).toBe("Waiting");
  });

  it("covers every status the check constraint allows", () => {
    expect(formatRequestStatus("approved")).toBe("Approved");
    expect(formatRequestStatus("rejected")).toBe("Not approved");
  });

  // A rejection changes what the student has to do — they're expected in, and an
  // attendance record will say so.
  it("colours a rejection as danger, not as a neutral fact", () => {
    expect(REQUEST_STATUS_VARIANTS.rejected).toBe("danger");
    expect(REQUEST_STATUS_VARIANTS.pending).toBe("warning");
    expect(REQUEST_STATUS_VARIANTS.approved).toBe("success");
  });
});
