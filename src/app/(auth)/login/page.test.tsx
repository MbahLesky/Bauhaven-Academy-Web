import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "./page";

const mockReplace = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, refresh: mockRefresh }),
}));

const mockSignIn = vi.fn();
vi.mock("@/lib/auth-actions", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

// This is the one critical flow for this feature — per Bauhaven-Coding-Standards.md's
// testing priority order, a login page is exactly the kind of thing that gets a real
// test rather than being assumed to work because it compiles. Mirrors Admin-web's
// equivalent so the two apps' auth can't quietly diverge in behaviour.
describe("LoginPage", () => {
  beforeEach(() => {
    mockSignIn.mockReset();
    mockReplace.mockReset();
    mockRefresh.mockReset();
  });

  it("shows validation errors instead of submitting when the form is empty", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/enter a valid email address/i)).toBeInTheDocument();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("rejects a malformed email without calling the server", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), "not-an-email");
    await user.type(screen.getByLabelText(/password/i), "whatever");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/enter a valid email address/i)).toBeInTheDocument();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("shows a generic error message on failed sign-in, never a specific reason", async () => {
    mockSignIn.mockResolvedValue({ error: "Invalid email or password." });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), "sam@example.com");
    await user.type(screen.getByLabelText(/password/i), "wrong-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password.");
    // Never a message that reveals whether the account exists — see the
    // account-enumeration rule in Bauhaven-Coding-Standards.md.
    expect(screen.queryByText(/no account|not found|doesn't exist/i)).not.toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("passes the typed credentials to the Server Action", async () => {
    mockSignIn.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), "sam@example.com");
    await user.type(screen.getByLabelText(/password/i), "correct-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(mockSignIn).toHaveBeenCalledWith({
        email: "sam@example.com",
        password: "correct-password",
      })
    );
  });

  it("redirects to the dashboard on successful sign-in", async () => {
    mockSignIn.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), "sam@example.com");
    await user.type(screen.getByLabelText(/password/i), "correct-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/dashboard"));
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("shows a pending state while signing in, and clears a stale error first", async () => {
    let resolveSignIn: (result: { error: string | null }) => void = () => {};
    mockSignIn
      .mockResolvedValueOnce({ error: "Invalid email or password." })
      .mockReturnValueOnce(
        new Promise<{ error: string | null }>((resolve) => {
          resolveSignIn = resolve;
        })
      );

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), "sam@example.com");
    await user.type(screen.getByLabelText(/password/i), "wrong-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    // Second attempt: the previous failure must not linger next to a spinner that
    // says it's working.
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("button", { name: /signing in/i })).toBeDisabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    resolveSignIn({ error: null });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/dashboard"));
  });

  /**
   * Academy's users are on phones, where the keyboard capitalises the first letter
   * by default — which silently turns a typed address into one that fails validation
   * before the server ever sees it.
   */
  it("stops a phone keyboard from mangling the email field", () => {
    render(<LoginPage />);

    const email = screen.getByLabelText(/email/i);
    expect(email).toHaveAttribute("autocapitalize", "none");
    expect(email).toHaveAttribute("autocorrect", "off");
    expect(email).toHaveAttribute("inputmode", "email");
  });
});
