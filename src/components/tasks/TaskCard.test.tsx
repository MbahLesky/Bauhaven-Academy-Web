import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskCard } from "./TaskCard";
import type { TaskWithSubmission } from "@/lib/task-queries";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mockRefresh }) }));

const mockSubmitTask = vi.fn();
vi.mock("@/lib/task-actions", () => ({
  submitTask: (taskId: string, input: unknown) => mockSubmitTask(taskId, input),
}));

const OPEN: TaskWithSubmission = {
  id: "task-open",
  title: "Build a responsive landing page",
  description: null,
  status: "open",
  deadline: "6 Aug, 11:59pm",
  isSelfCreated: false,
  submission: null,
};

const SELF_CREATED: TaskWithSubmission = {
  id: "task-self",
  title: "Personal portfolio site",
  description: null,
  status: "open",
  deadline: null,
  isSelfCreated: true,
  submission: null,
};

const AWAITING_GRADE: TaskWithSubmission = {
  id: "task-submitted",
  title: "CSS Grid layout challenge",
  description: null,
  status: "submitted",
  deadline: null,
  isSelfCreated: false,
  submission: {
    contentUrl: "https://github.com/sam/grid",
    submittedOn: "2 Aug 2026",
    grade: null,
    feedback: [],
  },
};

const GRADED: TaskWithSubmission = {
  id: "task-graded",
  title: "Responsive nav bar exercise",
  description: null,
  status: "graded",
  deadline: null,
  isSelfCreated: false,
  submission: {
    contentUrl: "https://github.com/sam/nav",
    submittedOn: "28 Jul 2026",
    grade: "92%",
    feedback: [
      { id: "fb-1", comment: "Clean structure, watch spacing on mobile", rating: 4 },
      { id: "fb-2", comment: "Nice use of custom properties.", rating: null },
    ],
  },
};

beforeEach(() => {
  mockRefresh.mockReset();
  mockSubmitTask.mockReset();
  mockSubmitTask.mockResolvedValue({ error: null });
});

describe("badges", () => {
  /**
   * Aligned with Admin-web, **not** with Academy's original wireframe, which had Open as
   * warning and Grading as neutral — the inverse. The same task shouldn't change colour
   * depending on which app you open it in.
   */
  it("shows an open task as neutral, not as a warning", () => {
    render(<TaskCard task={OPEN} />);

    const badge = screen.getByText("Open");
    expect(badge.className).toContain("neutral");
    expect(badge.className).not.toContain("warning");
  });

  it("shows a task awaiting grading as a warning", () => {
    render(<TaskCard task={AWAITING_GRADE} />);

    const badge = screen.getByText("Grading");
    expect(badge.className).toContain("warning");
  });

  // The wireframe's "92%" badge — a grade nobody can see without opening the row is a
  // grade they'll open every row to find.
  it("puts the grade itself on a graded task's badge", () => {
    render(<TaskCard task={GRADED} />);

    // "92%" appears twice by design — on the badge, and again in the detail below it.
    // The badge comes first in DOM order.
    const [badge] = screen.getAllByText("92%");
    expect(badge.className).toContain("success");
  });
});

describe("self-created tasks", () => {
  // The wireframe flags these distinctly — it's the one thing on the screen nobody else
  // asked the student to do.
  it("is visually distinguished from staff-assigned work", () => {
    render(<TaskCard task={SELF_CREATED} />);

    expect(screen.getByText(/self-created/i)).toBeInTheDocument();
  });

  it("leaves staff-assigned work unflagged", () => {
    render(<TaskCard task={OPEN} />);

    expect(screen.queryByText(/self-created/i)).not.toBeInTheDocument();
  });
});

describe("the submission flow", () => {
  it("offers a way to submit only while a task is open", () => {
    const open = render(<TaskCard task={OPEN} />);
    expect(screen.getByRole("button", { name: /submit work/i })).toBeInTheDocument();
    // Unmount before the second render — otherwise the first card is still in the
    // document and the negative assertion below would be checking the wrong tree.
    open.unmount();

    render(<TaskCard task={AWAITING_GRADE} />);
    expect(screen.queryByRole("button", { name: /submit work/i })).not.toBeInTheDocument();
  });

  it("submits a link through the Server Action and refreshes", async () => {
    const user = userEvent.setup();
    render(<TaskCard task={OPEN} />);

    await user.click(screen.getByRole("button", { name: /submit work/i }));
    await user.type(
      screen.getByLabelText(/link to your work/i),
      "https://github.com/sam/landing-page"
    );
    await user.click(screen.getByRole("button", { name: /^submit$/i }));

    await waitFor(() =>
      expect(mockSubmitTask).toHaveBeenCalledWith("task-open", {
        content_url: "https://github.com/sam/landing-page",
      })
    );
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("refuses a link that isn't a URL, without calling the server", async () => {
    const user = userEvent.setup();
    render(<TaskCard task={OPEN} />);

    await user.click(screen.getByRole("button", { name: /submit work/i }));
    await user.type(screen.getByLabelText(/link to your work/i), "github.com/sam/work");
    await user.click(screen.getByRole("button", { name: /^submit$/i }));

    expect(await screen.findByText(/full link starting with http/i)).toBeInTheDocument();
    expect(mockSubmitTask).not.toHaveBeenCalled();
  });

  it("surfaces a server refusal instead of looking like it saved", async () => {
    mockSubmitTask.mockResolvedValue({
      error: "This task isn't open for submissions any more. Refresh to see where it stands.",
    });
    const user = userEvent.setup();
    render(<TaskCard task={OPEN} />);

    await user.click(screen.getByRole("button", { name: /submit work/i }));
    await user.type(screen.getByLabelText(/link to your work/i), "https://example.com/work");
    await user.click(screen.getByRole("button", { name: /^submit$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/isn't open for submissions/i);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  // A phone keyboard capitalises the first letter, which breaks a URL before validation.
  it("stops a phone keyboard from mangling the link", async () => {
    const user = userEvent.setup();
    render(<TaskCard task={OPEN} />);

    await user.click(screen.getByRole("button", { name: /submit work/i }));

    const field = screen.getByLabelText(/link to your work/i);
    expect(field).toHaveAttribute("autocapitalize", "none");
    expect(field).toHaveAttribute("inputmode", "url");
  });
});

describe("grade and feedback", () => {
  // The wireframe's `Feedback: "..."` meta line.
  it("shows the grader's comment on the summary line", () => {
    render(<TaskCard task={GRADED} />);

    expect(
      screen.getByText(/Feedback: “Clean structure, watch spacing on mobile”/)
    ).toBeInTheDocument();
  });

  /**
   * `feedback` has no unique constraint on `submission_id` — several comments on one
   * submission are the design, so showing only the first would hide the rest.
   */
  it("shows every feedback entry, not just the first", () => {
    render(<TaskCard task={GRADED} />);

    expect(screen.getByText("Nice use of custom properties.")).toBeInTheDocument();
    expect(screen.getByText(/rated 4\/5/i)).toBeInTheDocument();
  });

  it("shows the grade from the submission, alongside the link that was handed in", () => {
    render(<TaskCard task={GRADED} />);

    // The labelled line in the detail, as distinct from the badge above it.
    expect(screen.getByText("Grade:").parentElement).toHaveTextContent("92%");
    expect(screen.getByRole("link", { name: /github\.com\/sam\/nav/ })).toHaveAttribute(
      "href",
      "https://github.com/sam/nav"
    );
  });

  // Student-supplied and pointing off-site.
  it("opens the submitted link safely", () => {
    render(<TaskCard task={GRADED} />);

    const link = screen.getByRole("link", { name: /github\.com\/sam\/nav/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("says when it was handed in while it's still being graded", () => {
    render(<TaskCard task={AWAITING_GRADE} />);

    expect(screen.getByText(/submitted 2 aug 2026/i)).toBeInTheDocument();
  });
});
