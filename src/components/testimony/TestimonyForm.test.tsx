import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestimonyForm } from "./TestimonyForm";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mockRefresh }) }));

const mockSubmit = vi.fn();
vi.mock("@/lib/testimony-actions", () => ({
  submitTestimony: (input: unknown) => mockSubmit(input),
}));

const CONTENT = "This bootcamp completely changed how I think about building things.";

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  content: string = CONTENT
) {
  // `user.type` rejects an empty string, so an intentionally-blank field is left alone.
  if (content) await user.type(screen.getByLabelText(/your experience/i), content);
  await user.click(screen.getByRole("button", { name: /submit/i }));
}

beforeEach(() => {
  mockRefresh.mockReset();
  mockSubmit.mockReset();
  mockSubmit.mockResolvedValue({ error: null });
});

describe("sharing a testimony", () => {
  it("sends what was written to the Server Action", async () => {
    const user = userEvent.setup();
    render(<TestimonyForm />);

    await fillAndSubmit(user);

    await waitFor(() => expect(mockSubmit).toHaveBeenCalledWith({ content: CONTENT }));
  });

  it("thanks the student and clears the form", async () => {
    const user = userEvent.setup();
    render(<TestimonyForm />);

    await fillAndSubmit(user);

    expect(await screen.findByRole("status")).toHaveTextContent(/thank you/i);
    expect(screen.getByLabelText(/your experience/i)).toHaveValue("");
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it("shows a server failure as an alert and keeps what was typed", async () => {
    mockSubmit.mockResolvedValue({ error: "Couldn't send that. Try again in a moment." });
    const user = userEvent.setup();
    render(<TestimonyForm />);

    await fillAndSubmit(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't send/i);
    // Losing a paragraph someone wrote about themselves would make them write it twice.
    expect(screen.getByLabelText(/your experience/i)).toHaveValue(CONTENT);
  });

  it("refuses something too short to feature", async () => {
    const user = userEvent.setup();
    render(<TestimonyForm />);

    await fillAndSubmit(user, "It was good");

    expect(await screen.findByText(/tell us a little more/i)).toBeInTheDocument();
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});

describe("one field, not two", () => {
  /**
   * `testimonies` has separate `content_en` and `content_fr` columns, and the wireframe
   * draws one box. Which column the words belong in is answered by
   * `users.preferred_language` server-side — showing both fields would ask a student to
   * translate their own testimonial, which is a translator's job.
   */
  it("asks for the testimony once, in whatever language the student writes", () => {
    render(<TestimonyForm />);

    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.queryByLabelText(/english/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/french|français/i)).not.toBeInTheDocument();
    expect(screen.getByText(/language set on your profile/i)).toBeInTheDocument();
  });
});

describe("what the screen promises about publishing", () => {
  /**
   * Consent is explicitly deferred in the Project Brief's "Known open items", so no opt-in
   * gate is built — exactly as Content Editor left `portfolio_entries` alone. What the
   * screen can honestly say is that featuring is someone else's decision and hasn't
   * happened: `testimonies` has no UPDATE policy, so nothing reaches 'published' today.
   */
  it("says featuring is possible but never automatic", () => {
    render(<TestimonyForm />);

    expect(screen.getByText(/may feature this on the website/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing is published automatically/i)).toBeInTheDocument();
  });

  it("builds no consent checkbox, since consent is deferred and not decided", () => {
    render(<TestimonyForm />);

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
