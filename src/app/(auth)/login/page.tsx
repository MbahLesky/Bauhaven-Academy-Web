"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "@/lib/auth-actions";
import { signInSchema, type SignInInput } from "@/lib/schemas/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInInput>({ resolver: zodResolver(signInSchema) });

  function onSubmit(data: SignInInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await signIn(data);
      if (result.error) {
        setServerError(result.error);
        return;
      }
      // Middleware redirects authenticated requests away from /login, but a
      // fresh session cookie needs a navigation to actually take effect here.
      router.replace("/dashboard");
      router.refresh();
    });
  }

  return (
    // Academy is phone-first, so this is the mirror image of Admin's login: the
    // full-width padded layout is the *design*, not the small-screen fallback,
    // and the `max-w-md` column matches the app shell it hands off to rather
    // than Admin's narrower desk-sized card.
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-background px-5 py-12">
      <div className="mb-8 text-center">
        {/* Wordmark only — real logo asset not yet provided, see Bauhaven-Brand-Guidelines.md */}
        <span className="font-display text-lg font-bold">Bauhaven Academy</span>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-xl border border-neutral-200 bg-white p-6"
        noValidate
      >
        <h1 className="font-display mb-1 text-xl font-bold">Sign in</h1>
        <p className="mb-6 text-sm text-neutral-500">
          Your tasks, attendance, and progress.
        </p>

        <div className="mb-4">
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
            Email
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            // Phones default to autocapitalising the first letter, which quietly
            // breaks an email address before it ever reaches validation.
            autoCapitalize="none"
            autoCorrect="off"
            inputMode="email"
            error={!!errors.email}
            {...register("email")}
          />
          {errors.email && <p className="mt-1.5 text-xs text-danger">{errors.email.message}</p>}
        </div>

        <div className="mb-6">
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
            Password
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            error={!!errors.password}
            {...register("password")}
          />
          {errors.password && (
            <p className="mt-1.5 text-xs text-danger">{errors.password.message}</p>
          )}
        </div>

        {serverError && (
          <div
            role="alert"
            className="mb-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger"
          >
            {serverError}
          </div>
        )}

        {/* min-h-12 is 48px — comfortably past the 44px touch-target floor for the
            one control on this screen that has to be easy to hit on a phone. */}
        <Button type="submit" className="min-h-12 w-full" disabled={isPending}>
          {isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-neutral-500">
        One Bauhaven account works here and across the rest of the platform. Ask an Admin
        if you don&apos;t have one yet.
      </p>
    </div>
  );
}
