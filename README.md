# Bauhaven Academy (Web)

Next.js App Router app for Interns/Students/Holiday-makers — dashboard, tasks, attendance, requests, testimonies, profile.

## Status

Scaffolded and **verified working**: `npx tsc --noEmit`, `npm run build`, and `npm run lint` all clean. Mobile-first shell (bottom nav, max-width phone-like column) matching the wireframe, since Academy's real users are on their phones, not a desk browser. Dashboard page queries Supabase for real: active enrollment, up to 3 open tasks sorted by deadline, and an attendance rate computed from real attendance_records rows.

**Not yet built:** Tasks, Attendance, Requests, Report Issue, Testimony, and Profile are nav links with no page behind them yet. Auth isn't wired up.

## A genuinely tricky bug worth knowing about

Every Supabase query on this project's dashboard was silently typed as `never`, even though the code looked correct and the `Database` type appeared structurally sound. Root cause, confirmed by direct empirical testing (not guessing): `@supabase/postgrest-js` requires the schema type to satisfy `Record<string, GenericTable>`, and a plain `interface`-declared Row type — despite having an identical shape to a `type` alias — does **not** satisfy `Record<string, unknown>` in this specific conditional-type context, while a `type` alias with the exact same fields does. All Row types in `src/types/database.ts` are `type` aliases, not `interface`s, for exactly this reason. If you regenerate this file with `supabase gen types`, it already outputs `type`, so this won't resurface — but hand-editing back to `interface` would silently reintroduce it.

## Setup

Same as Admin-web: `npm install`, copy `.env.example` → `.env.local` with real Supabase values, `npm run dev`.

## Next steps

1. Auth, including the profile switcher for users holding more than one active role
2. Build out Tasks, Attendance (with the offline-tolerant check-in queue), Requests, Report Issue, Testimony, Profile against `bauhaven-academy-web-wireframes.html` and `Bauhaven-Academy-Feature-Spec.md`
3. Generate real types once a Supabase project exists, same command as Admin-web
