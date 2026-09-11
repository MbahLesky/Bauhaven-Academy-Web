import { describe, it, expect } from "vitest";
import { summarizeAttendance, toAttendanceStatus } from "./attendance-format";

describe("summarizeAttendance", () => {
  it("counts late as attended — they came", () => {
    expect(summarizeAttendance(["present", "late", "absent", "absent"])).toEqual({ rate: 50, attended: 2, recorded: 4 });
  });

  // An approved absence mustn't count against the learner.
  it("leaves excused sessions out of the rate", () => {
    expect(summarizeAttendance(["present", "excused", "excused"]).rate).toBe(100);
  });

  it("ignores sessions nobody marked", () => {
    expect(summarizeAttendance([null, "present"])).toEqual({ rate: 100, attended: 1, recorded: 1 });
  });

  it("has no rate with nothing to compute one from", () => {
    expect(summarizeAttendance([]).rate).toBeNull();
    expect(summarizeAttendance(["excused"]).rate).toBeNull();
  });
});

describe("toAttendanceStatus", () => {
  it("reads the database's 'not recorded' as no mark", () => {
    expect(toAttendanceStatus("not_recorded")).toBeNull();
    expect(toAttendanceStatus("late")).toBe("late");
  });
});
