import { describe, it, expect } from "vitest";
import {
  formatIssueCategory,
  formatIssueStatus,
  ISSUE_STATUS_VARIANTS,
} from "./issue-report-format";
import { ISSUE_CATEGORIES, ISSUE_STATUSES } from "./schemas/issue-report";

describe("formatIssueStatus", () => {
  it("covers every status the check constraint allows", () => {
    // Guards against the bug this feature found: the row type had open|resolved, so a
    // triaged report was an impossible value the moment anything set it.
    expect(ISSUE_STATUSES).toEqual(["open", "in_progress", "resolved"]);
    for (const status of ISSUE_STATUSES) {
      expect(formatIssueStatus(status)).toBeTruthy();
    }
  });

  it("says a picked-up report is being looked at, not 'in progress'", () => {
    expect(formatIssueStatus("in_progress")).toBe("Being looked at");
  });

  // Open is the one state where the colour is doing real work: something is wrong and
  // nobody has picked it up.
  it("colours an unclaimed report as warning", () => {
    expect(ISSUE_STATUS_VARIANTS.open).toBe("warning");
    expect(ISSUE_STATUS_VARIANTS.resolved).toBe("success");
  });
});

describe("formatIssueCategory", () => {
  it("renders each offered category as its label", () => {
    for (const category of ISSUE_CATEGORIES) {
      expect(formatIssueCategory(category.value)).toBe(category.label);
    }
  });

  /**
   * `issue_reports.category` has **no check constraint**, so a value this build doesn't
   * know about is entirely possible — written by Admin-web, a migration, or a category
   * added later. Showing the raw value beats telling a student their own report has no
   * category.
   */
  it("falls back to the stored value rather than to 'Unknown'", () => {
    expect(formatIssueCategory("hardware")).toBe("hardware");
  });

  // The column default. A row written by anything that doesn't set the column has to land
  // in a bucket this screen displays, not in a nameless one.
  it("has a label for the column's own default value", () => {
    expect(formatIssueCategory("general")).toBe("Something else");
  });
});
