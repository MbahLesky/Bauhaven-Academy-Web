import { Suspense } from "react";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

/**
 * A server shell around the form, purely so the `useSearchParams` inside it has a Suspense
 * boundary. Without one this route fails the production build outright: a statically
 * prerendered page that reads search params has nothing to render until the request
 * arrives, and Next requires the boundary that says what to show meanwhile.
 *
 * The `error=link` param it reads is set by `/auth/confirm` when a reset link was expired,
 * already used, or tampered with.
 */
export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<ForgotPasswordFallback />}>
      <ForgotPasswordForm />
    </Suspense>
  );
}

// Matches the form's own frame, so the boundary resolving doesn't shift the layout.
function ForgotPasswordFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6">
      <div className="w-full sm:max-w-sm">
        <div className="mb-8 text-center">
          <span className="font-display text-lg font-bold">Bauhaven Academy</span>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-6 sm:p-8">
          <h1 className="font-display mb-1 text-xl font-bold">Forgotten your password?</h1>
          <p className="text-sm text-neutral-500">We&apos;ll email you a link to set a new one.</p>
        </div>
      </div>
    </div>
  );
}
