import { SignOutButton } from "@/components/profile/SignOutButton";

/**
 * Shown instead of the app to someone signed in with no open enrolment.
 *
 * The usual reasons are ordinary: they applied and haven't been accepted yet, their
 * programme has finished, or they're Bauhaven staff who belong in Bauhaven Admin. The
 * notice names all three rather than guessing, and offers the one action that always
 * helps — signing out, in case this is the wrong account.
 */
export function NotEnrolledNotice() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-background px-5 py-12">
      <div className="mb-8 text-center">
        <span className="font-display text-lg font-bold">Bauhaven Academy</span>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <h1 className="font-display mb-2 text-xl font-bold">You&apos;re not on a programme yet</h1>
        <p className="mb-4 text-sm text-neutral-500">
          Academy opens once you&apos;re enrolled on a Bauhaven programme.
        </p>
        <ul className="mb-6 list-disc space-y-1.5 pl-5 text-sm text-neutral-600">
          <li>If you&apos;ve applied, you&apos;ll get an email when you&apos;re accepted.</li>
          <li>If your programme has finished, your place here has closed with it.</li>
          <li>If you work at Bauhaven, sign in to Bauhaven Admin instead.</li>
        </ul>
        <SignOutButton />
      </div>
    </div>
  );
}
