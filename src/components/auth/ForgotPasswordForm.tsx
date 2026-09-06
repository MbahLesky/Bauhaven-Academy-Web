"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { requestPasswordReset } from "@/lib/password-reset-actions";
import {
  EMPTY_REQUEST_RESET,
  requestResetSchema,
  type RequestResetInput,
} from "@/lib/schemas/password-reset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Asking for a reset link.
 *
 * Before this existed, a forgotten password meant finding an Admin — and it lands hardest
 * here, on accounts an Admin created with a password they chose and read out. Those are
 * exactly the passwords nobody remembers a fortnight later.
 *
 * It needs no mail provider: Supabase Auth's own mailer sends this, the same one already
 * confirming new sign-ups. That is why it could be built while invitations still can't be
 * emailed.
 */
export function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Set by /auth/confirm when a link was expired, already used, or tampered with.
  const linkFailed = searchParams.get("error") === "link";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RequestResetInput>({
    resolver: zodResolver(requestResetSchema),
    defaultValues: EMPTY_REQUEST_RESET,
  });

  function onSubmit(values: RequestResetInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await requestPasswordReset(values);
      if (result.error) {
        setServerError(result.error);
        return;
      }
      setSent(true);
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6">
      <div className="w-full sm:max-w-sm">
        <div className="mb-8 text-center">
          <span className="font-display text-lg font-bold">Bauhaven Academy</span>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-6 sm:p-8">
          {sent ? (
            <>
              <h1 className="font-display mb-2 text-xl font-bold">Check your email</h1>
              {/*
               * Deliberately the same message whether or not that address has an account.
               * Anything else turns this form into a way to ask who works at Bauhaven —
               * the enumeration problem the sign-in form already avoids.
               */}
              <p className="mb-6 text-sm text-neutral-500">
                If that address has an account, a reset link is on its way. It&apos;s good
                for one hour. Check spam if it hasn&apos;t arrived in a few minutes.
              </p>
              <Link
                href="/login"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-neutral-200 px-4 text-sm font-semibold hover:bg-neutral-50"
              >
                Back to sign in
              </Link>
            </>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <h1 className="font-display mb-1 text-xl font-bold">Forgotten your password?</h1>
              <p className="mb-6 text-sm text-neutral-500">
                We&apos;ll email you a link to set a new one.
              </p>

              {linkFailed && (
                <p
                  role="alert"
                  className="mb-4 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning"
                >
                  That link has expired or was already used. Ask for a new one below.
                </p>
              )}

              <div className="mb-4">
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  inputMode="email"
                  error={!!errors.email}
                  {...register("email")}
                />
                {errors.email && (
                  <p className="mt-1.5 text-xs text-danger">{errors.email.message}</p>
                )}
              </div>

              {serverError && (
                <p
                  role="alert"
                  className="mb-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger"
                >
                  {serverError}
                </p>
              )}

              <Button type="submit" disabled={isPending} className="min-h-11 w-full">
                {isPending ? "Sending…" : "Email me a link"}
              </Button>

              <p className="mt-4 text-center text-sm text-neutral-500">
                <Link href="/login" className="font-semibold text-accent">
                  Back to sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
