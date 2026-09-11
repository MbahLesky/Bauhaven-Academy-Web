/**
 * Where a link from an email is allowed to send somebody.
 *
 * `next` arrives in the query string of a link people click from their inbox, and
 * `/auth/confirm` mints a session immediately before honouring it. An unchecked value there
 * is an open redirect with a fresh session attached — the shape of a credential-harvesting
 * page reached from a genuine Bauhaven email.
 *
 * So: a path on this origin, or the fallback. Pure and separate from the route handler so
 * the rule can be tested directly, which for a security control is worth more than the few
 * lines it costs.
 */
export function safeNextPath(next: string | null | undefined, fallback: string): string {
  if (!next) return fallback;

  // `//evil.com` is protocol-relative — a browser reads it as a host, not a path. The
  // backslash form is the same trick against anything that normalises `\` to `/`.
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;

  // Traversal, and anything carrying a scheme or credentials.
  if (next.includes("..") || next.includes(":") || next.includes("@")) return fallback;

  // Control characters, including the newline that would let a value split a header.
  // Explicit escapes rather than literal characters, which are invisible in a diff.
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;

  return next;
}
