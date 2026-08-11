/**
 * Initials for an avatar, from a person's name.
 *
 * No photo exists for anyone yet — `users.profile_photo_url` is a URL column and no
 * storage bucket is configured on this project, so nothing in either app can produce one.
 * Initials are therefore the normal case rather than the fallback, which is why this is a
 * shared helper and not an inline expression.
 *
 * Takes the first and last name parts rather than the first two, so "Sam Kofi Student"
 * reads as SS the way the wireframe does, matching how the person is usually addressed.
 * Falls back to a single character, and finally to "?" — a name is `not null` in the
 * schema, but an all-whitespace one would still slip through.
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return firstCharacter(parts[0]);

  return `${firstCharacter(parts[0])}${firstCharacter(parts[parts.length - 1])}`;
}

// `[...part]` rather than `part[0]`, so an accented or non-Latin first letter isn't split
// into half a character — Bauhaven's users write in French as well as English.
function firstCharacter(part: string): string {
  return ([...part][0] ?? "").toUpperCase();
}
