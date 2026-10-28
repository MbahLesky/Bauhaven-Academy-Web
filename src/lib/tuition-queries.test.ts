import { describe, it, expect } from "vitest";
import { calculateTuitionCoverage } from "./tuition-queries";

describe("calculateTuitionCoverage", () => {
  it("calculates 3/4 partial payment (15,000 / 20,000) during week 1 as active", () => {
    const coverage = calculateTuitionCoverage({
      amountDue: 20_000,
      amountPaid: 15_000,
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      today: new Date("2026-10-08T12:00:00Z"), // Day 7 (~1st week)
    });

    expect(coverage.amountDue).toBe(20_000);
    expect(coverage.amountPaid).toBe(15_000);
    expect(coverage.outstandingBalance).toBe(5_000);
    expect(coverage.ratio).toBe(0.75);
    expect(coverage.totalDays).toBe(30);
    expect(coverage.coveredDays).toBe(23); // 30 * 0.75 = 22.5 -> 23 days
    expect(coverage.status).toBe("active");
    expect(coverage.isExpired).toBe(false);
    expect(coverage.remainingDays).toBeGreaterThan(3);
  });

  it("marks coverage expired and 100% progress at the end of the 3rd week (day 23+)", () => {
    const coverage = calculateTuitionCoverage({
      amountDue: 20_000,
      amountPaid: 15_000,
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      today: new Date("2026-10-25T12:00:00Z"), // Past 23 days covered
    });

    expect(coverage.status).toBe("expired");
    expect(coverage.isExpired).toBe(true);
    expect(coverage.progressPercent).toBe(100);
    expect(coverage.remainingDays).toBeLessThanOrEqual(0);
  });

  it("marks coverage expiring_soon when 1-3 days of coverage remain", () => {
    const coverage = calculateTuitionCoverage({
      amountDue: 20_000,
      amountPaid: 15_000,
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      today: new Date("2026-10-22T12:00:00Z"), // ~2 days left before day 24
    });

    expect(coverage.status).toBe("expiring_soon");
    expect(coverage.isExpired).toBe(false);
    expect(coverage.remainingDays).toBeGreaterThan(0);
    expect(coverage.remainingDays).toBeLessThanOrEqual(3);
  });

  it("marks full payment as fully_paid", () => {
    const coverage = calculateTuitionCoverage({
      amountDue: 20_000,
      amountPaid: 20_000,
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      today: new Date("2026-10-15T12:00:00Z"),
    });

    expect(coverage.status).toBe("fully_paid");
    expect(coverage.outstandingBalance).toBe(0);
    expect(coverage.isExpired).toBe(false);
  });

  it("marks zero payment as expired immediately", () => {
    const coverage = calculateTuitionCoverage({
      amountDue: 20_000,
      amountPaid: 0,
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      today: new Date("2026-10-02T12:00:00Z"),
    });

    expect(coverage.status).toBe("expired");
    expect(coverage.isExpired).toBe(true);
    expect(coverage.progressPercent).toBe(100);
  });
});
