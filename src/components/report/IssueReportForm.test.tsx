import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IssueReportForm } from "./IssueReportForm";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mockRefresh }) }));

const mockSubmit = vi.fn();
vi.mock("@/lib/issue-report-actions", () => ({
  submitIssueReport: (input: unknown) => mockSubmit(input),
}));

const DESCRIPTION = "Projector in Room 2 won't turn on";

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  { category = "equipment", description = DESCRIPTION } = {}
) {
  if (category) await user.selectOptions(screen.getByLabelText(/category/i), category);
  // `user.type` rejects an empty string, so an intentionally-blank field is left alone —
  // which is what a student skipping it actually does.
  if (description) await user.type(screen.getByLabelText(/what's wrong/i), description);
  await user.click(screen.getByRole("button", { name: /submit report/i }));
}

beforeEach(() => {
  mockRefresh.mockReset();
  mockSubmit.mockReset();
  mockSubmit.mockResolvedValue({ error: null });
});

describe("filing a report", () => {
  it("sends the chosen category and description to the Server Action", async () => {
    const user = userEvent.setup();
    render(<IssueReportForm />);

    await fillAndSubmit(user);

    await waitFor(() =>
      expect(mockSubmit).toHaveBeenCalledWith({
        category: "equipment",
        description: DESCRIPTION,
      })
    );
  });

  it("confirms and clears the form rather than navigating away", async () => {
    const user = userEvent.setup();
    render(<IssueReportForm />);

    await fillAndSubmit(user);

    expect(await screen.findByRole("status")).toHaveTextContent(/report sent/i);
    expect(screen.getByLabelText(/what's wrong/i)).toHaveValue("");
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it("shows a server failure as an alert and keeps what was typed", async () => {
    mockSubmit.mockResolvedValue({ error: "Couldn't send that report. Try again in a moment." });
    const user = userEvent.setup();
    render(<IssueReportForm />);

    await fillAndSubmit(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't send/i);
    // Losing a typed description to a dropped connection makes the student write it twice.
    expect(screen.getByLabelText(/what's wrong/i)).toHaveValue(DESCRIPTION);
  });
});

describe("the category field", () => {
  /**
   * The wireframe drew a free-text box. `issue_reports.category` has no check constraint,
   * so free text would put every report in a category of one — unsortable for whoever
   * eventually triages them, and useless against the `(status, category)` index the
   * schema already carries.
   */
  it("is a fixed set of options, not a text box", () => {
    render(<IssueReportForm />);

    const select = screen.getByLabelText(/category/i);
    expect(select.tagName).toBe("SELECT");
    expect(screen.getByRole("option", { name: /equipment or facilities/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /safety or wellbeing/i })).toBeInTheDocument();
  });

  // A preselected category is the one everybody submits.
  it("starts on nothing, so a category is a real choice", () => {
    render(<IssueReportForm />);

    expect(screen.getByLabelText(/category/i)).toHaveValue("");
  });

  it("refuses to submit until one is picked", async () => {
    const user = userEvent.setup();
    render(<IssueReportForm />);

    await fillAndSubmit(user, { category: "" });

    expect(await screen.findByText(/pick a category/i)).toBeInTheDocument();
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});

describe("validation before anything is sent", () => {
  it("refuses a description too short for anyone to act on", async () => {
    const user = userEvent.setup();
    render(<IssueReportForm />);

    await fillAndSubmit(user, { description: "broken" });

    expect(await screen.findByText(/say a little more/i)).toBeInTheDocument();
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});

describe("what the screen promises", () => {
  /**
   * Staff can read every report — `issue_reports_select` has no category arm — so filing
   * one is useful. What doesn't exist is a screen where anyone works through them, and
   * nothing routes a report to a particular person: the category is a label, not a
   * destination. For an urgent problem "it's in a queue" is not good enough.
   */
  it("tells a student not to wait on this when something is urgent", () => {
    render(<IssueReportForm />);

    expect(screen.getByText(/tell a mentor directly as well/i)).toBeInTheDocument();
    expect(screen.getByText(/don't wait on this/i)).toBeInTheDocument();
  });
});
