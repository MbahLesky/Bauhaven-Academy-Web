"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { setInitialPassword } from "@/lib/set-password-actions";
import {
  EMPTY_NEW_PASSWORD,
  MIN_PASSWORD_LENGTH,
  newPasswordSchema,
  type NewPasswordInput,
} from "@/lib/schemas/password-reset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Welcome: setting up the account an accepted applicant was invited to.
 *
 * Reached only through `/auth/confirm`, which has already exchanged the emailed invitation
 * token for a session. There's no email field and no way to aim this at another account.
 */
export default function SetPasswordPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewPasswordInput>({ resolver: zodResolver(newPasswordSchema), defaultValues: EMPTY_NEW_PASSWORD });

  function onSubmit(values: NewPasswordInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await setInitialPassword(values);
      if (result.error) {
        setServerError(result.error);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-background px-5 py-12">
      <div className="mb-8 text-center">
        <span className="font-display text-lg font-bold">Bauhaven Academy</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="rounded-xl border border-neutral-200 bg-white p-6" noValidate>
        <h1 className="font-display mb-1 text-xl font-bold">Welcome to Bauhaven</h1>
        <p className="mb-6 text-sm text-neutral-500">
          Choose a password for your account — at least {MIN_PASSWORD_LENGTH} characters. You&apos;ll use it to sign
          in here and in the Bauhaven Academy app.
        </p>

        <div className="mb-4">
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
            Password
          </label>
          <Input id="password" type="password" autoComplete="new-password" error={!!errors.password} {...register("password")} />
          {errors.password && <p className="mt-1.5 text-xs text-danger">{errors.password.message}</p>}
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
          {errors.confirmPassword && <p className="mt-1.5 text-xs text-danger">{errors.confirmPassword.message}</p>}
        </div>

        {serverError && (
          <p role="alert" className="mb-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {serverError}{" "}
            <Link href="/forgot-password" className="font-semibold underline">
              Ask for a new link
            </Link>
          </p>
        )}

        <Button type="submit" disabled={isPending} className="min-h-12 w-full">
          {isPending ? "Saving…" : "Save and continue"}
        </Button>
      </form>
    </div>
  );
}
