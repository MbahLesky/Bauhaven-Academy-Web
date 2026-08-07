import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckInCard } from "./CheckInCard";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mockRefresh }) }));

const mockCheckIn = vi.fn();
vi.mock("@/lib/attendance-actions", () => ({
  checkIn: (input: unknown) => mockCheckIn(input),
}));

const SESSION_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

function renderCard(currentStatus: "present" | "absent" | "excused" | null = null) {
  return render(
    <CheckInCard sessionId={SESSION_ID} sessionLabel="Mon, 4 Aug" currentStatus={currentStatus} />
  );
}

beforeEach(() => {
  mockRefresh.mockReset();
  mockCheckIn.mockReset();
  mockCheckIn.mockResolvedValue({ outcome: "checked-in", message: "You're checked in." });
});

describe("before checking in", () => {
  it("says so and offers the button", () => {
    renderCard(null);

    expect(screen.getByText(/haven't checked in yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /check in now/i })).toBeInTheDocument();
  });

  it("checks in through the Server Action and refreshes", async () => {
    const user = userEvent.setup();
    renderCard(null);

    await user.click(screen.getByRole("button", { name: /check in now/i }));

    expect(mockCheckIn).toHaveBeenCalledWith({ session_id: SESSION_ID });
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it("hides the button once the check-in lands", async () => {
    const user = userEvent.setup();
    renderCard(null);

    await user.click(screen.getByRole("button", { name: /check in now/i }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /check in now/i })).not.toBeInTheDocument()
    );
  });
});

describe("when a record already stands", () => {
  it("shows the checked-in state with no button to press again", () => {
    renderCard("present");

    expect(screen.getByText(/you're checked in/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /check in now/i })).not.toBeInTheDocument();
  });

  // A Staff decision the student can't override by checking in over the top.
  it("shows a status a mentor set, rather than offering to check in", () => {
    renderCard("excused");

    expect(screen.getByText(/marked you excused/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /check in now/i })).not.toBeInTheDocument();
  });

  /**
   * "Already recorded" is **not** an error — nothing failed and nothing was lost — so it
   * must not be announced as an alert. Telling a student their attendance failed when it
   * had already recorded is the wrong way round.
   */
  it("announces an already-recorded result as status, not as an alert", async () => {
    mockCheckIn.mockResolvedValue({
      outcome: "already-recorded",
      message: "You're already checked in for this session.",
    });
    const user = userEvent.setup();
    renderCard(null);

    await user.click(screen.getByRole("button", { name: /check in now/i }));

    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent(/already checked in/i);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // Still refreshes, because the database really does say something this screen should
    // re-read.
    expect(mockRefresh).toHaveBeenCalled();
  });
});

describe("when the policy refuses", () => {
  /**
   * `attendance_records_insert` blocks a student who isn't actively enrolled in the
   * session's program. Expected and handled — see the Server Action.
   */
  it("explains an enrolment refusal as an alert, with no retry", async () => {
    mockCheckIn.mockResolvedValue({
      outcome: "not-enrolled",
      message:
        "You're not on the enrolment list for this session's program, so it wouldn't record. Speak to your mentor — they can mark you present themselves.",
    });
    const user = userEvent.setup();
    renderCard(null);

    await user.click(screen.getByRole("button", { name: /check in now/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/enrolment list/i);
    // Retrying wouldn't help — the policy isn't going to change on a second tap.
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("offers a retry when the connection dropped", async () => {
    mockCheckIn.mockResolvedValue({
      outcome: "failed",
      message: "Couldn't check you in — the connection may have dropped. Try again.",
    });
    const user = userEvent.setup();
    renderCard(null);

    await user.click(screen.getByRole("button", { name: /check in now/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/connection may have dropped/i);
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("retries through the same action", async () => {
    mockCheckIn
      .mockResolvedValueOnce({ outcome: "failed", message: "Couldn't check you in." })
      .mockResolvedValueOnce({ outcome: "checked-in", message: "You're checked in." });
    const user = userEvent.setup();
    renderCard(null);

    await user.click(screen.getByRole("button", { name: /check in now/i }));
    await user.click(await screen.findByRole("button", { name: /try again/i }));

    expect(mockCheckIn).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });
});

describe("the offline boundary", () => {
  /**
   * The wireframe originally promised "Works offline — syncs when you're back online".
   * Web clients get best-effort caching only per `Bauhaven-Architecture-Plan.md` §3;
   * genuine queued writes are the native clients' Drift-backed capability. Promising a
   * sync this app can't guarantee is the worst kind of lie for attendance specifically —
   * a student believes they're marked present when the register disagrees.
   */
  it("never claims the check-in works offline or will sync later", () => {
    renderCard(null);

    expect(screen.queryByText(/works offline/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/syncs when/i)).not.toBeInTheDocument();
    expect(screen.getByText(/needs a connection/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing is saved until it succeeds/i)).toBeInTheDocument();
  });
});
