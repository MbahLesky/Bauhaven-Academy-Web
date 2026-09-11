# Bauhaven Academy (Web)

The learner app for Bauhaven's interns, students and holiday-makers, in Next.js (App Router). It shares one database
and one sign-in with the rest of Bauhaven: the website, Bauhaven Admin (web and mobile) and the Bauhaven Academy mobile
app. The database's schema and documentation live in the Bauhaven-Platform repository.

Phone-first: a bottom nav and a phone-width column, because learners use it on their phones.

## Screens

| Screen | What it does |
|---|---|
| Home | Your programme, what's due soon, your attendance rate |
| Tasks | Work your mentors set: read the instructions, hand in an answer or a link, see released feedback, hand in again when changes are requested |
| Attendance | Today's sessions, your rate and your history. Taken by your mentor or coordinator |
| Share feedback | Tell Bauhaven how it's going, with an optional rating. It's featured on the website only if you tick the box |
| Profile | Your details and your programmes; sign out |
| Request absence, Report a problem | Built, and switched off until their database tables exist (`src/lib/database-readiness.ts`). They say so plainly instead of failing |

**Who gets in.** Signing in proves who someone is; an enrolment is what gives them anything here. Someone signed in with
no open enrolment (starting soon, in progress, or paused) sees a notice explaining where they stand, not an empty app.

**How accounts start.** People apply on the website. When staff accept an application, Bauhaven emails an invitation;
its link lands on `/auth/confirm` and then `/set-password`, and they're in. Forgotten passwords go through
`/forgot-password` → the emailed link → `/reset-password`.

## Checks

- `npx tsc --noEmit` — clean
- `npm run lint` — clean
- `npm test` (Vitest) — 127 tests. Database access is tested against a stub client (`src/test/fake-supabase.ts`) that
  records every read and write.
- `npm run build` — clean

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the Bauhaven Supabase project's URL and anon key
3. `npm run dev`

## Things worth knowing

1. **A `"use server"` file can only export async functions.** Schemas live in `src/lib/schemas/`.
2. **Personal screens filter by the signed-in person explicitly.** A mentor or staff member can legitimately see other
   people's rows, and one account can hold both kinds of role; Academy's screens are only ever about the person holding
   the session.
3. **Times are Bauhaven's (Africa/Douala),** wherever the learner is — a deadline an hour out is the difference between
   on time and late.
