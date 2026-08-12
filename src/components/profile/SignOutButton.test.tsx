import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignOutButton } from "./SignOutButton";

const mockReplace = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, refresh: mockRefresh }),
}));

const mockSignOut = vi.fn();
vi.mock("@/lib/auth-actions", () => ({ signOut: () => mockSignOut() }));

describe("SignOutButton", () => {
  beforeEach(() => {
    mockSignOut.mockReset();
    mockSignOut.mockResolvedValue(undefined);
    mockReplace.mockReset();
    mockRefresh.mockReset();
  });

  it("signs out and sends the user to login", async () => {
    const user = userEvent.setup();
    render(<SignOutButton />);

    await user.click(screen.getByRole("button", { name: /sign out/i }));

    expect(mockSignOut).toHaveBeenCalled();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
    expect(mockRefresh).toHaveBeenCalled();
  });

  // An unlabelled icon for signing out is a guessing game; the label is the control.
  it("says what it does in words", () => {
    render(<SignOutButton />);

    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});
