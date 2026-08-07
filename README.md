# Bauhaven Academy (Web)

Next.js App Router app for Interns/Students/Holiday-makers — dashboard, tasks, attendance, requests, testimonies, profile.

## Status

Scaffolded and **verified working**: `npx tsc --noEmit`, `npm run build`, `npm run lint`, and `npm test` (Vitest, 75/75) all clean. Mobile-first shell (bottom nav, max-width phone-like column) matching the wireframe, since Academy's real users are on their phones, not a desk browser. Dashboard page queries Supabase for real: active enrollment, up to 3 open tasks sorted by deadline, and an attendance rate computed from real attendance_records rows.

**Not yet built:** Requests, Report Issue, Testimony, and Profile are nav links with no page behind them yet.

**Auth is implemented, not stubbed:** middleware-based session refresh and route gating, a `/login` page in its own `(auth)` route group with client-side validation (react-hook-form + zod) backed by server-side validation in the Server Action, a deliberately generic "Invalid email or password" on failure, and sign-out wired into the app shell. `/` now checks for a session instead of redirecting everyone to `/dashboard` unconditionally.

**It's a port of Admin-web's, not a re-derivation.** Same product, same Supabase Auth instance, one login that works across both — so the same middleware, the same Server Action, and the same account-enumeration reasoning. Three things genuinely differ, and only because Academy differs:

- The login screen is phone-first. Admin's full-width layout is its small-screen fallback; here it's the design, in the same `max-w-md` column the app shell uses. The email field sets `autocapitalize="none"` / `autocorrect="off"` / `inputmode="email"`, because a phone keyboard capitalising the first letter silently breaks an address before validation ever sees it. There's a test for that.
- The Zod schema uses `z.email()` rather than Admin's `z.string().email()` — the chained form is deprecated in Zod 4, and this repo's `AGENTS.md` says to heed deprecations. Same validation, same message.
- **Sign-out lives in the header, temporarily.** It belongs on Profile, alongside "My requests", the language toggle and testimonies — but Profile isn't built, and shipping auth with no way to sign out would be worse than a control in the wrong place. Move it when Profile lands.

**Tasks is built end-to-end:** Open and Submitted-and-graded sections, submitting a link against an open task, self-created tasks for students who hold the individual `tasks:create` override, and the grade plus every feedback comment once a mentor has looked.

**Submitting moves the task to `submitted` via a database trigger, not via this app — and that trigger didn't exist.** Admin-web's Submitted queue filters on `tasks.status`, and its grading guards on `.eq('status','submitted')`, but Admin never *writes* that state; Academy inserts the `submissions` row; and `tasks_update` is `created_by = auth.uid()`, so a student **assigned** a task cannot update it. Nothing advanced the status, so a submission would have sat at `open` forever — invisible to staff and ungradeable, with no error on either side. Fixed in `006_submission_marks_task_submitted.sql`. There's a test that asserts the state Admin-web actually queries, not just that the action returned OK, and another that covers the database *without* `006` applied: the work still saves, and the student is told it hasn't reached anyone rather than assuming it has.

**Two wireframe corrections.** Badge colours were the inverse of Admin-web's (Open as warning, Grading as neutral) — the same task changed colour depending on which app you opened it in, so both now follow Admin's semantically-correct reading. And "Draft" wasn't a real status: `tasks.status` has no such value, so a self-created task is simply `open`, distinguished by a "Self-created ·" prefix the way Admin-web does it.

**The Home preview and the Tasks screen share one query module.** They were already diverging: Home formatted deadlines with `toLocaleDateString`, which renders in the browser's zone and told a travelling student the wrong day, while Admin-web pins `Africa/Douala`. Both now read through `src/lib/task-queries.ts`. Neither filters by `assigned_to` — `tasks_select` already scopes to the current user, and an explicit filter would both duplicate the policy and hide self-created tasks, which match on `created_by`.

**Attendance is built end-to-end:** today's session for the student's enrolled program, a large check-in button, attendance rate and sessions-attended, and history with Present/Excused/Absent badges matching Admin-web's roster exactly.

**No offline queue, and the wireframe's promise of one was removed.** The card read "Works offline — syncs when you're back online"; this app can't honour that. `Bauhaven-Architecture-Plan.md` §3 gives web clients best-effort caching and reserves queued writes for the native clients' Drift storage — and a web page genuinely can't guarantee a queued write ever syncs, since the tab closes, the browser evicts storage, and there's no durable background sync in this stack. For attendance specifically a false "saved, will sync" is the worst available failure: the student believes they're present and the register disagrees. The card now says a connection is needed, a failure is a plain error with a retry, and there's a test asserting the old wording never comes back. That fix also surfaced a contradiction *inside* §3 — one line gave web best-effort caching, the next said attendance queues "regardless of client". Corrected there too.

**Check-in is three outcomes, not ok/error.** Success, already-recorded, and refused by RLS mean genuinely different things to someone standing in a doorway. "Already recorded" is announced as a `status` rather than an `alert` — nothing failed and nothing was lost. A refusal from `attendance_records_insert` (not actively enrolled in the session's program) is an expected, handled case, not a bug to route around: the page scopes sessions to the student's program, but the policy is the authority and the two can disagree — an enrolment withdrawn between load and tap, or a stale tab.

**The duplicate check is the app's job, because the schema has no unique constraint on `(session_id, user_id)`.** A second insert would succeed and leave two standing rows for one session — the double-count the append-only chain exists to prevent, inflating the student's own rate. The action resolves the existing record first and writes nothing if one stands.

**The Home preview's attendance rate was wrong twice over.** It computed `present ÷ all rows`, which counted a Staff correction *and* the row it corrected as two sessions, and counted an excused absence against the student. `src/lib/append-only.ts` is ported from Admin-web to collapse corrections, excused sessions are excluded from the denominator (an approved absence is the system saying it doesn't count against you), and both screens now share one function. **This changes the number Home used to show.**

**The profile switcher is deliberately not here.** The wireframe shows its entry point ("Viewing as Intern ▾" on Home) and it's a Must in both the Core and Academy feature specs — but it needs a real notion of which role a session is *acting as*, somewhere to persist that, and screens whose content actually varies by it. Built inside an auth pass it would have been a dropdown that changes nothing. It stays in M3's gate; see `Bauhaven-Architecture-Plan.md` §6, "Auth as built". Relatedly, Academy does **not** yet read `user_roles` the way Admin does — nothing here is role-gated yet, so a lookup with no consumer would be speculative. Both arrive together with the switcher.

## A genuinely tricky bug worth knowing about

Every Supabase query on this project's dashboard was silently typed as `never`, even though the code looked correct and the `Database` type appeared structurally sound. Root cause, confirmed by direct empirical testing (not guessing): `@supabase/postgrest-js` requires the schema type to satisfy `Record<string, GenericTable>`, and a plain `interface`-declared Row type — despite having an identical shape to a `type` alias — does **not** satisfy `Record<string, unknown>` in this specific conditional-type context, while a `type` alias with the exact same fields does. All Row types in `src/types/database.ts` are `type` aliases, not `interface`s, for exactly this reason. If you regenerate this file with `supabase gen types`, it already outputs `type`, so this won't resurface — but hand-editing back to `interface` would silently reintroduce it.

## Setup

Same as Admin-web: `npm install`, copy `.env.example` → `.env.local` with real Supabase values, `npm run dev`. (`.env.example` didn't actually exist until the auth pass, and `.gitignore`'s `.env*` would have swallowed it anyway — both fixed.)

## Next steps

1. The **profile switcher** for users holding more than one active role — deliberately excluded from the auth pass, see below
2. Build out Requests, Report Issue, Testimony, Profile against `bauhaven-academy-web-wireframes.html` and `Bauhaven-Academy-Feature-Spec.md`
3. Generate real types once a Supabase project exists, same command as Admin-web
