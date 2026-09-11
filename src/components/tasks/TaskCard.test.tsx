import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskCard } from "./TaskCard";
import type { MyTask } from "@/lib/task-queries";

const mockSubmit = vi.fn();
vi.mock("@/lib/task-actions", () => ({
  submitWork: (...args: unknown[]) => mockSubmit(...args),
}));

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mockRefresh }) }));

const OPEN: MyTask = {
  assignmentId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
  title: "Build a landing page",
  instructions: "One page, responsive, deployed.",
  submissionType: "link",
  status: "assigned",
  dueAt: "2026-08-06T22:59:00Z",
  due: "6 Aug, 11:59pm",
  canSubmit: true,
  submissions: [],
  feedback: [],
};

const WITH_MENTOR: MyTask = {
  ...OPEN,
  status: "submitted",
  canSubmit: false,
  submissions: [
    {
      id: "s1",
      version: 1,
      status: "submitted",
      text: null,
      link: "https://github.com/sam/landing",
      submittedOn: "5 Aug 2026",
      isLate: false,
    },
  ],
};

beforeEach(() => {
  mockSubmit.mockReset();
  mockSubmit.mockResolvedValue({ error: null });
  mockRefresh.mockReset();
});

describe("TaskCard", () => {
  it("shows an open task's deadline and a way to hand it in", () => {
    render(<TaskCard task={OPEN} />);

    expect(screen.getByText("Due 6 Aug, 11:59pm")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hand in work" })).toBeInTheDocument();
  });

  it("offers nothing to hand in once it's with the mentor", () => {
    render(<TaskCard task={WITH_MENTOR} />);

    expect(screen.queryByRole("button", { name: /hand in/i })).not.toBeInTheDocument();
    expect(screen.getByText("With your mentor")).toBeInTheDocument();
    expect(screen.getByText("Handed in 5 Aug 2026")).toBeInTheDocument();
  });

  it("hands in a link through the Server Action with a retry key", async () => {
    const user = userEvent.setup();
    render(<TaskCard task={OPEN} />);

    await user.click(screen.getByRole("button", { name: "Hand in work" }));
    await user.type(screen.getByLabelText(/link to your work for/i), "https://github.com/sam/landing");
    await user.click(screen.getByRole("button", { name: "Hand in" }));

    expect(mockSubmit).toHaveBeenCalledWith(
      OPEN.assignmentId,
      { text_content: null, link_url: "https://github.com/sam/landing" },
      expect.stringMatching(/^[0-9a-f-]{36}$/)
    );
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("refuses a link that isn't a web address without calling the server", async () => {
    const user = userEvent.setup();
    render(<TaskCard task={OPEN} />);

    await user.click(screen.getByRole("button", { name: "Hand in work" }));
    await user.type(screen.getByLabelText(/link to your work for/i), "github.com/sam");
    await user.click(screen.getByRole("button", { name: "Hand in" }));

    expect(await screen.findByText(/full link starting with http/i)).toBeInTheDocument();
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("shows a refusal instead of looking like it saved", async () => {
    mockSubmit.mockResolvedValue({ error: "This task isn't taking submissions now." });
    const user = userEvent.setup();
    render(<TaskCard task={OPEN} />);

    await user.click(screen.getByRole("button", { name: "Hand in work" }));
    await user.type(screen.getByLabelText(/link to your work for/i), "https://github.com/sam/landing");
    await user.click(screen.getByRole("button", { name: "Hand in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/isn't taking submissions/i);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("asks for an answer on a text task", async () => {
    const user = userEvent.setup();
    render(<TaskCard task={{ ...OPEN, submissionType: "text" }} />);

    await user.click(screen.getByRole("button", { name: "Hand in work" }));

    expect(screen.getByLabelText(/your answer/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/link to your work/i)).not.toBeInTheDocument();
  });

  it("shows released feedback and what was handed in", () => {
    render(
      <TaskCard
        task={{
          ...WITH_MENTOR,
          status: "changes_requested",
          canSubmit: true,
          feedback: [
            { id: "f1", reviewer: "Ana Mentor", text: "Make it work on phones.", result: "changes_requested", score: null, releasedOn: "6 Aug 2026" },
          ],
        }}
      />
    );

    expect(screen.getByText(/ana mentor · changes requested/i)).toBeInTheDocument();
    expect(screen.getByText("Make it work on phones.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "https://github.com/sam/landing" })).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("button", { name: "Hand in again" })).toBeInTheDocument();
  });
});
