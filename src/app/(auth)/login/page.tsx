"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
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

  // Catch emailed links that land on / or /login with URL hash tokens (type=recovery, invite, signup)
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      const hash = window.location.hash;
      if (hash.includes("access_token") || hash.includes("type=")) {
        router.replace(`/auth/confirm${window.location.search}${hash}`);
      }
    }
  }, [router]);

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
    // Mobile: full-width, padded to the screen edge. sm+: centered fixed-width
    // card. Matches the login shell in Admin-web deliberately: one sign-in experience
    // across both apps.
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6">
      <div className="w-full sm:max-w-sm">
        <div className="mb-8 text-center">
          <span className="font-display text-lg font-bold">Bauhaven Hub</span>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="rounded-xl border border-neutral-200 bg-white p-6 sm:p-8"
          noValidate
        >
          <h1 className="font-display mb-1 text-xl font-bold">Sign in</h1>
          <p className="mb-6 text-sm text-neutral-500">Your tasks, attendance, and progress.</p>

          <div className="mb-4">
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              error={!!errors.email}
              {...register("email")}
            />
            {errors.email && (
              <p className="mt-1.5 text-xs text-danger">{errors.email.message}</p>
            )}
          </div>

          <div className="mb-6">
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <label htmlFor="password" className="block text-sm font-medium">
                Password
              </label>
              <Link href="/forgot-password" className="text-xs font-semibold text-accent">
                Forgotten?
              </Link>
            </div>
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

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Signing in…" : "Sign in"}
          </Button>

          <p className="mt-6 text-center text-xs text-neutral-500">
            Have an activation code?{" "}
            <Link href="/activate" className="font-semibold text-accent hover:underline">
              Activate your account
            </Link>
          </p>

          <div className="mt-8 border-t border-neutral-100 pt-5 text-center">
            <a
              href="/downloads/bauhaven-hub.apk"
              download="bauhaven-hub.apk"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 hover:text-accent transition"
            >
              <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Bauhaven Hub for Android (.apk)
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
