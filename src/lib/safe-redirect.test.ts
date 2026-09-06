import { describe, it, expect } from "vitest";
import { safeNextPath } from "./safe-redirect";

const FALLBACK = "/reset-password";

describe("safeNextPath", () => {
  it("allows a plain path on this site", () => {
    expect(safeNextPath("/reset-password", FALLBACK)).toBe("/reset-password");
    expect(safeNextPath("/users?tab=invites", FALLBACK)).toBe("/users?tab=invites");
  });

  it("falls back when nothing was given", () => {
    expect(safeNextPath(null, FALLBACK)).toBe(FALLBACK);
    expect(safeNextPath(undefined, FALLBACK)).toBe(FALLBACK);
    expect(safeNextPath("", FALLBACK)).toBe(FALLBACK);
  });

  /**
   * The case this exists for. `/auth/confirm` mints a session and *then* honours `next`, so
   * an unchecked value is an open redirect with a fresh session attached — reached from a
   * link in a genuine Bauhaven email, which is what makes it convincing.
   */
  it("refuses an absolute URL to somewhere else", () => {
    expect(safeNextPath("https://evil.example/steal", FALLBACK)).toBe(FALLBACK);
    expect(safeNextPath("http://evil.example", FALLBACK)).toBe(FALLBACK);
  });

  // A browser reads a leading `//` as a host, not a path — this is an absolute URL wearing
  // a path's clothes, and it's the one that slips past a naive `startsWith("/")` check.
  it("refuses a protocol-relative URL", () => {
    expect(safeNextPath("//evil.example/steal", FALLBACK)).toBe(FALLBACK);
  });

  it("refuses the backslash variant of the same trick", () => {
    expect(safeNextPath("/\\evil.example", FALLBACK)).toBe(FALLBACK);
  });

  it("refuses a scheme smuggled into a path", () => {
    expect(safeNextPath("/redirect?to=javascript:alert(1)", FALLBACK)).toBe(FALLBACK);
    expect(safeNextPath("/https://evil.example", FALLBACK)).toBe(FALLBACK);
  });

  it("refuses credentials in the value", () => {
    expect(safeNextPath("/@evil.example", FALLBACK)).toBe(FALLBACK);
  });

  it("refuses traversal", () => {
    expect(safeNextPath("/../../etc/passwd", FALLBACK)).toBe(FALLBACK);
  });

  // A newline in a redirect target is how a value becomes a second header.
  it("refuses control characters", () => {
    expect(safeNextPath("/reset\nLocation: https://evil.example", FALLBACK)).toBe(FALLBACK);
    expect(safeNextPath("/reset\r\nSet-Cookie: a=b", FALLBACK)).toBe(FALLBACK);
  });
});
