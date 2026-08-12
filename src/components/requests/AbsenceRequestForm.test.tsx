import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AbsenceRequestForm } from "./AbsenceRequestForm";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mockRefresh }) }));

const mockSubmit = vi.fn();
vi.mock("@/lib/request-actions", () => ({
  submitAbsenceRequest: (input: unknown) => mockSubmit(input),
}));

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  { start = "2026-08-06", end = "2026-08-07", reason = "Family event" } = {}
) {
  // `user.type` rejects an empty string, so an intentionally-blank field is just left
  // alone — which is what a student leaving it blank actually does.
  if (start) await user.type(screen.getByLabelText(/first day away/i), start);
  if (end) await user.type(screen.getByLabelText(/last day away/i), end);
  if (reason) await user.type(screen.getByLabelText(/reason/i), reason);
  await user.click(screen.getByRole("button", { name: /submit request/i }));
}

beforeEach(() => {
  mockRefresh.mockReset();
  mockSubmit.mockReset();
  mockSubmit.mockResolvedValue({ error: null });
});

describe("submitting a request", () => {
  it("sends the dates and reason to the Server Action", async () => {
    const user = userEvent.setup();
    render(<AbsenceRequestForm />);

    await fillAndSubmit(user);

    await waitFor(() =>
      expect(mockSubmit).toHaveBeenCalledWith({
        start_date: "2026-08-06",
        end_date: "2026-08-07",
        reason: "Family event",
      })
    );
  });

  // The new request appears in the list directly below, which reads better than a
  // redirect to somewhere the student has to scan for it.
  it("confirms and clears the form rather than navigating away", async () => {
    const user = userEvent.setup();
    render(<AbsenceRequestForm />);

    await fillAndSubmit(user);

    expect(await screen.findByRole("status")).toHaveTextContent(/request sent/i);
    expect(screen.getByLabelText(/reason/i)).toHaveValue("");
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it("shows a server failure as an alert and keeps what was typed", async () => {
    mockSubmit.mockResolvedValue({ error: "Couldn't send that request. Try again in a moment." });
    const user = userEvent.setup();
    render(<AbsenceRequestForm />);

    await fillAndSubmit(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't send/i);
    // Losing a typed reason to a dropped connection would make the student write it twice.
    expect(screen.getByLabelText(/reason/i)).toHaveValue("Family event");
  });
});

describe("validation before anything is sent", () => {
  it("refuses a range that ends before it starts", async () => {
    const user = userEvent.setup();
    render(<AbsenceRequestForm />);

    await fillAndSubmit(user, { start: "2026-08-07", end: "2026-08-06" });

    expect(await screen.findByText(/can't be before the first day/i)).toBeInTheDocument();
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  /**
   * `requests.reason` is nullable, but a request with no reason gives the person deciding
   * it nothing to decide on — and there's no comment thread on `requests` for them to ask
   * a follow-up question through.
   */
  it("requires a reason even though the column allows null", async () => {
    const user = userEvent.setup();
    render(<AbsenceRequestForm />);

    await fillAndSubmit(user, { reason: "" });

    expect(await screen.findByText(/say briefly why/i)).toBeInTheDocument();
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});

describe("what the screen promises", () => {
  /**
   * Staff can read these rows — `requests_select` covers them — so submitting is useful
   * today. What doesn't exist is anywhere to record a decision: no approval screen, and
   * no UPDATE policy on `requests` for anyone. Promising a decision would be the same
   * class of lie as Attendance's since-removed "works offline — syncs when you're back
   * online".
   */
  it("says approvals aren't handled in the app yet", () => {
    render(<AbsenceRequestForm />);

    expect(screen.getByText(/isn't handled in the app yet/i)).toBeInTheDocument();
    expect(screen.getByText(/mentor will confirm with you directly/i)).toBeInTheDocument();
  });
});
