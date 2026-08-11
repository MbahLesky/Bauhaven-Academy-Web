import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageToggle } from "./LanguageToggle";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mockRefresh }) }));

const mockUpdate = vi.fn();
vi.mock("@/lib/profile-actions", () => ({
  updateLanguage: (language: unknown) => mockUpdate(language),
}));

beforeEach(() => {
  mockRefresh.mockReset();
  mockUpdate.mockReset();
  mockUpdate.mockResolvedValue({ error: null });
});

describe("the language toggle", () => {
  it("shows which language is currently set", () => {
    render(<LanguageToggle current="en" />);

    expect(screen.getByRole("radio", { name: "English" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Français" })).not.toBeChecked();
  });

  /**
   * **The persistence test.** This is the toggle actually writing
   * `users.preferred_language`, not a visual-only placeholder — and that column already
   * has a consumer: the testimony form reads it to decide whether a student's words go to
   * `content_en` or `content_fr`.
   */
  it("persists the new language through the Server Action", async () => {
    const user = userEvent.setup();
    render(<LanguageToggle current="en" />);

    await user.click(screen.getByRole("radio", { name: "Français" }));

    expect(mockUpdate).toHaveBeenCalledWith("fr");
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  // Writing the value that's already stored is a round trip for nothing.
  it("writes nothing when the current language is tapped again", async () => {
    const user = userEvent.setup();
    render(<LanguageToggle current="en" />);

    await user.click(screen.getByRole("radio", { name: "English" }));

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  /**
   * A preference toggle that silently fails is worse than one that refuses: the student
   * walks away believing their language is set, and their next testimony files under the
   * wrong column.
   */
  it("says so when the preference couldn't be saved", async () => {
    mockUpdate.mockResolvedValue({ error: "Couldn't save that. Try again in a moment." });
    const user = userEvent.setup();
    render(<LanguageToggle current="en" />);

    await user.click(screen.getByRole("radio", { name: "Français" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't save/i);
    // And falls back to what the database actually says, rather than showing FR selected.
    await waitFor(() => expect(screen.getByRole("radio", { name: "English" })).toBeChecked());
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  // One setting with two states, so a screen reader says "Language, English selected"
  // rather than announcing two unrelated buttons.
  it("is one labelled group, not two loose buttons", () => {
    render(<LanguageToggle current="fr" />);

    expect(screen.getByRole("radiogroup", { name: "Language" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Français" })).toBeChecked();
  });
});
