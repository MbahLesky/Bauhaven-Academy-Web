import { describe, it, expect } from "vitest";
import {
  resolveRecordsBySession,
  summarizeAttendance,
  type AttendanceRecordLike,
} from "./attendance-resolve";

function record(
  id: string,
  overrides: Partial<AttendanceRecordLike> & { status: AttendanceRecordLike["status"] }
): AttendanceRecordLike {
  return {
    id,
    session_id: "session-1",
    corrects_id: null,
    created_at: "2026-08-04T09:00:00Z",
    ...overrides,
  };
}

/**
 * A student can't correct their own attendance — that's a Staff override — but those
 * corrections land in the student's own record set, so this app has to collapse them
 * exactly as Admin-web does. Reading the table flat inflates a rate in the student's
 * favour and disagrees with what Staff see on the roster.
 */
describe("resolveRecordsBySession", () => {
  it("has nothing to resolve from an empty record set", () => {
    expect(resolveRecordsBySession([]).size).toBe(0);
  });

  it("keeps a single uncorrected record", () => {
    const resolved = resolveRecordsBySession([record("r1", { status: "present" })]);

    expect(resolved.get("session-1")?.id).toBe("r1");
  });

  it("returns the correction, not the record it replaced", () => {
    const resolved = resolveRecordsBySession([
      record("r1", { status: "present" }),
      record("r2", { status: "absent", corrects_id: "r1" }),
    ]);

    expect(resolved.size).toBe(1);
    expect(resolved.get("session-1")?.status).toBe("absent");
  });

  it("follows a chain of corrections to its end", () => {
    const resolved = resolveRecordsBySession([
      record("r3", { status: "excused", corrects_id: "r2" }),
      record("r1", { status: "present" }),
      record("r2", { status: "absent", corrects_id: "r1" }),
    ]);

    expect(resolved.get("session-1")?.status).toBe("excused");
  });

  // Partitioned by session first, so a correction on one can't retire another's record.
  it("never lets one session's correction retire another session's record", () => {
    const resolved = resolveRecordsBySession([
      record("r1", { session_id: "session-a", status: "present" }),
      record("r2", { session_id: "session-b", status: "absent", corrects_id: "r1" }),
    ]);

    expect(resolved.get("session-a")?.id).toBe("r1");
    expect(resolved.get("session-b")?.id).toBe("r2");
  });

  // Two rows written in one statement share a timestamp exactly, so an ordering built on
  // created_at alone would pick between an original and its correction arbitrarily.
  it("resolves a correction that shares its predecessor's timestamp", () => {
    const sameInstant = "2026-08-04T09:00:00Z";
    const resolved = resolveRecordsBySession([
      record("r1", { status: "present", created_at: sameInstant }),
      record("r2", { status: "excused", corrects_id: "r1", created_at: sameInstant }),
    ]);

    expect(resolved.get("session-1")?.id).toBe("r2");
  });
});

describe("summarizeAttendance", () => {
  it("reports nothing to compute from when there are no records", () => {
    expect(summarizeAttendance([])).toEqual({ rate: null, attended: 0, recorded: 0 });
  });

  it("counts present sessions and the rate over them", () => {
    const stats = summarizeAttendance([
      { status: "present" },
      { status: "present" },
      { status: "present" },
      { status: "absent" },
    ]);

    expect(stats.attended).toBe(3);
    expect(stats.rate).toBe(75);
  });

  /**
   * An approved absence is the system saying "this one doesn't count against you".
   * Folding it into the denominator would make excusing pointless and would quietly
   * punish a student for using the Requests flow correctly.
   */
  it("leaves an excused session out of the rate entirely", () => {
    const stats = summarizeAttendance([
      { status: "present" },
      { status: "present" },
      { status: "excused" },
    ]);

    // 2/2, not 2/3.
    expect(stats.rate).toBe(100);
    expect(stats.attended).toBe(2);
    // Still counted as a session that has a record, for the history list.
    expect(stats.recorded).toBe(3);
  });

  it("reports no rate when every session was excused", () => {
    expect(summarizeAttendance([{ status: "excused" }]).rate).toBeNull();
  });

  /** The end-to-end version of the bug this module exists to prevent. */
  it("counts a corrected session once, at its corrected status", () => {
    const raw = [
      record("r1", { session_id: "s1", status: "present" }),
      record("r2", { session_id: "s1", status: "absent", corrects_id: "r1" }),
      record("r3", { session_id: "s2", status: "present" }),
    ];

    // The naive read — summarising the table directly — is the bug: it sees two present
    // out of three "sessions".
    expect(summarizeAttendance(raw).rate).toBe(67);

    // Resolving first is the fix: one absent, one present.
    const standing = [...resolveRecordsBySession(raw).values()];
    expect(summarizeAttendance(standing).rate).toBe(50);
    expect(summarizeAttendance(standing).recorded).toBe(2);
  });
});
