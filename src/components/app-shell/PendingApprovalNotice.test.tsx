import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PendingApprovalNotice } from "./PendingApprovalNotice";
import type { MyApplication } from "@/lib/application-status";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/auth-actions", () => ({ signOut: vi.fn() }));

function application(overrides: Partial<MyApplication> = {}): MyApplication {
  return {
    status: "submitted",
    programName: "Web Development Bootcamp",
    appliedOn: "12 Aug 2026",
    reviewedOn: null,
    ...overrides,
  };
}

/**
 * Academy had no gate at all before this: any signed-in account got the whole app. A
 * pending applicant would have seen Tasks, Attendance and Requests, all empty — which
 * reads as "broken", not "not approved yet", and the person can't tell which.
 */
describe("while an application is being reviewed", () => {
  it("says it's with Bauhaven, and names the programme", () => {
    render(<PendingApprovalNotice application={application()} />);

    expect(screen.getByRole("heading", { name: /application is with us/i })).toBeInTheDocument();
    expect(screen.getByText(/Web Development Bootcamp/)).toBeInTheDocument();
  });

  /**
   * A genuinely different state, not a nicer word for pending: Staff have read it and
   * passed it on, and only final approval is outstanding. Worth distinguishing — "someone
   * has looked at this" is different news from "it's in a queue".
   */
  it("distinguishes a confirmed application from an unread one", () => {
    render(<PendingApprovalNotice application={application({ status: "confirmed" })} />);

    expect(screen.getByRole("heading", { name: /passed the first review/i })).toBeInTheDocument();
    expect(screen.getByText(/nothing more is needed from you/i)).toBeInTheDocument();
  });
});

describe("when the application was declined", () => {
  /**
   * The recorded decision is that the account stays and they can apply again, so this has
   * to be honest about the outcome and still leave the door open.
   */
  it("says so plainly and points at applying again", () => {
    render(<PendingApprovalNotice application={application({ status: "declined" })} />);

    expect(screen.getByRole("heading", { name: /wasn't accepted/i })).toBeInTheDocument();
    expect(screen.getByText(/apply again/i)).toBeInTheDocument();
  });
});

describe("the states that mean something went wrong", () => {
  /**
   * Approved but still behind the gate means the enrolment or role grant didn't land —
   * approval writes three things with nothing making them atomic. Leaving them on a
   * "we're reviewing it" message would be telling them something now false.
   */
  it("does not claim to be reviewing an application that was approved", () => {
    render(<PendingApprovalNotice application={application({ status: "approved" })} />);

    expect(screen.getByRole("heading", { name: /one step left/i })).toBeInTheDocument();
    expect(screen.queryByText(/will look at it/i)).not.toBeInTheDocument();
  });

  /**
   * No application at all: an Admin created the account without one, it was seeded, or the
   * application insert failed right after sign-up. Saying "we're reviewing your
   * application" would be inventing one.
   */
  it("says the account isn't set up when there's no application", () => {
    render(<PendingApprovalNotice application={null} />);

    expect(screen.getByRole("heading", { name: /isn't set up yet/i })).toBeInTheDocument();
    expect(screen.getByText(/no application on file/i)).toBeInTheDocument();
  });
});

// The only thing anyone on this screen can usefully do, and there's no app shell around
// them to offer it.
describe("what they can do from here", () => {
  it("offers sign-out in every state", () => {
    for (const status of ["submitted", "confirmed", "approved", "declined"] as const) {
      const view = render(<PendingApprovalNotice application={application({ status })} />);
      expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
      view.unmount();
    }
  });
});
