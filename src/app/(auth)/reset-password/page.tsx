"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { setNewPassword } from "@/lib/password-reset-actions";
import {
  EMPTY_NEW_PASSWORD,
  newPasswordSchema,
  type NewPasswordInput,
} from "@/lib/schemas/password-reset";
import { MIN_PASSWORD_LENGTH } from "@/lib/schemas/signup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Setting the new password.
 *
 * Reached only through `/auth/confirm`, which has already exchanged the emailed token for a
 * recovery session. There is no email field here and no way to aim this at another account:
 * `updateUser` acts on `auth.uid()`, so the link is what proves who this is.
 *
 * On success the action signs them out and this sends them to the sign-in form. One
 * deliberate extra step, and it buys a real thing: a recovery session would otherwise carry
 * somebody into the app on the strength of an email link rather than a password they just
 * proved they know.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewPasswordInput>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: EMPTY_NEW_PASSWORD,
  });

  function onSubmit(values: NewPasswordInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await setNewPassword(values);
      if (result.error) {
        setServerError(result.error);
        return;
      }
      setDone(true);
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6">
      <div className="w-full sm:max-w-sm">
        <div className="mb-8 text-center">
          <span className="font-display text-lg font-bold">Bauhaven Academy</span>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-6 sm:p-8">
          {done ? (
            <>
              <h1 className="font-display mb-2 text-xl font-bold">Password changed</h1>
              <p className="mb-6 text-sm text-neutral-500">
                Sign in with your new password.
              </p>
              <Link
                href="/login"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-gradient-to-br from-accent to-accent-2 px-4 text-sm font-semibold text-white hover:opacity-90"
              >
                Sign in
              </Link>
            </>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <h1 className="font-display mb-1 text-xl font-bold">Choose a new password</h1>
              <p className="mb-6 text-sm text-neutral-500">
                At least {MIN_PASSWORD_LENGTH} characters. Only you will know it.
              </p>

              <div className="mb-4">
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
                  New password
                </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  error={!!errors.password}
                  {...register("password")}
                />
                {errors.password && (
                  <p className="mt-1.5 text-xs text-danger">{errors.password.message}</p>
                )}
              </div>

              <div className="mb-4">
                <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium">
                  Type it again
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  error={!!errors.confirmPassword}
                  {...register("confirmPassword")}
                />
                {errors.confirmPassword && (
                  <p className="mt-1.5 text-xs text-danger">{errors.confirmPassword.message}</p>
                )}
              </div>

              {serverError && (
                <p
                  role="alert"
                  className="mb-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger"
                >
                  {serverError}{" "}
                  <Link href="/forgot-password" className="font-semibold underline">
                    Ask for a new link
                  </Link>
                </p>
              )}

              <Button type="submit" disabled={isPending} className="min-h-11 w-full">
                {isPending ? "Saving…" : "Save new password"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
