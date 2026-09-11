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

beforeEach(() => {
  mockRefresh.mockReset();
  mockSubmit.mockReset();
  mockSubmit.mockResolvedValue({ error: null });
});

describe("TestimonyForm", () => {
  it("sends the words, with no consent unless it was given", async () => {
    const user = userEvent.setup();
    render(<TestimonyForm />);

    await user.type(screen.getByLabelText(/your experience/i), CONTENT);
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(mockSubmit).toHaveBeenCalledWith({ content: CONTENT, rating: null, allow_public_use: false });
  });

  // Consent is asked, never assumed: the box starts unticked.
  it("sends consent and a rating when the learner gives them", async () => {
    const user = userEvent.setup();
    render(<TestimonyForm />);

    expect(screen.getByRole("checkbox", { name: /may feature what i wrote/i })).not.toBeChecked();

    await user.type(screen.getByLabelText(/your experience/i), CONTENT);
    await user.click(screen.getByRole("button", { name: "4 out of 5" }));
    await user.click(screen.getByRole("checkbox", { name: /may feature what i wrote/i }));
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(mockSubmit).toHaveBeenCalledWith({ content: CONTENT, rating: 4, allow_public_use: true });
  });

  it("thanks the learner and clears the form", async () => {
    const user = userEvent.setup();
    render(<TestimonyForm />);

    await user.type(screen.getByLabelText(/your experience/i), CONTENT);
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("status")).toHaveTextContent(/thank you/i);
    await waitFor(() => expect(screen.getByLabelText(/your experience/i)).toHaveValue(""));
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("shows a server failure and keeps what was typed", async () => {
    mockSubmit.mockResolvedValue({ error: "Couldn't send that. Try again in a moment." });
    const user = userEvent.setup();
    render(<TestimonyForm />);

    await user.type(screen.getByLabelText(/your experience/i), CONTENT);
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't send/i);
    expect(screen.getByLabelText(/your experience/i)).toHaveValue(CONTENT);
  });

  it("refuses something too short to act on", async () => {
    const user = userEvent.setup();
    render(<TestimonyForm />);

    await user.type(screen.getByLabelText(/your experience/i), "Good");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText(/tell us a little more/i)).toBeInTheDocument();
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});
