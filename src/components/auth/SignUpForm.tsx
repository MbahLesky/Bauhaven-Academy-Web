"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signUpAndApply } from "@/lib/signup-actions";
import { EMPTY_SIGN_UP, signUpSchema, type SignUpInput } from "@/lib/schemas/signup";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function SignUpForm({ programs }: { programs: { id: string; title: string }[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: EMPTY_SIGN_UP,
  });

  function onSubmit(values: SignUpInput) {
    setServerError(null);
    setNotice(null);

    startTransition(async () => {
      const result = await signUpAndApply(values);

      if (result.outcome === "applied") {
        // Straight to the app, which will show the pending screen — the gate reads their
        // enrolment, and they don't have one yet. Same destination either way, so there's
        // no separate "thanks" route to maintain.
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      /*
       * Email confirmation is on. Not a failure and not shown as one: the account exists
       * and the application is already filed, so the only thing outstanding is them
       * clicking a link Supabase has already sent.
       */
      if (result.outcome === "check-your-email") {
        setNotice(result.message);
        return;
      }

      setServerError(result.message);
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
              Your name
            </label>
            <Input id="name" autoComplete="name" error={!!errors.name} {...register("name")} />
            {errors.name && <p className="mt-1.5 text-xs text-danger">{errors.name.message}</p>}
          </div>

          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
              Email
            </label>
            {/* A phone keyboard capitalising the first letter silently breaks an address
                before validation ever sees it — same reasoning as the login screen. */}
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
            {errors.email && <p className="mt-1.5 text-xs text-danger">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="phone" className="mb-1.5 block text-sm font-medium">
              Phone <span className="text-xs font-normal text-neutral-400">Optional</span>
            </label>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              {...register("phone", {
                setValueAs: (value: unknown) =>
                  typeof value === "string" && value.trim() !== "" ? value : null,
              })}
            />
          </div>

          <div>
            <label htmlFor="program_id" className="mb-1.5 block text-sm font-medium">
              What are you applying for?
            </label>
            {/* Real `programs` rows, not the marketing site's category slugs. Academy can
                offer the actual catalogue (`programs_select_all` is `using (true)`), which
                means an approved application already knows which cohort to enrol them on. */}
            <select
              id="program_id"
              defaultValue=""
              aria-invalid={!!errors.program_id}
              className={`h-11 w-full rounded-md border bg-white px-3 text-sm outline-none transition-colors focus:border-transparent focus:ring-2 focus:ring-accent ${
                errors.program_id ? "border-danger" : "border-neutral-200"
              }`}
              {...register("program_id")}
            >
              <option value="" disabled>
                Choose a programme
              </option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.title}
                </option>
              ))}
            </select>
            {errors.program_id && (
              <p className="mt-1.5 text-xs text-danger">{errors.program_id.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="message" className="mb-1.5 block text-sm font-medium">
              Why you&apos;re applying{" "}
              <span className="text-xs font-normal text-neutral-400">Optional</span>
            </label>
            <textarea
              id="message"
              rows={3}
              className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-transparent focus:ring-2 focus:ring-accent"
              {...register("message", {
                setValueAs: (value: unknown) =>
                  typeof value === "string" && value.trim() !== "" ? value : null,
              })}
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
              Choose a password
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

          <div>
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
        </CardContent>
      </Card>

      {serverError && (
        <p role="alert" className="mt-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {serverError}
        </p>
      )}

      {notice && (
        <p role="status" className="mt-3 rounded-md bg-success/10 px-3 py-2 text-sm text-success">
          {notice}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="mt-4 min-h-12 w-full">
        {isPending ? "Sending…" : "Apply"}
      </Button>

      {/* Honest about what happens next. Creating an account here does not get you into
          the app — it puts an application in front of a person. */}
      <p className="mt-3 text-xs text-neutral-500">
        Applying creates your account. Someone at Bauhaven reviews it, and everything opens
        up once you&apos;re approved.
      </p>

      <p className="mt-4 text-center text-sm text-neutral-500">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-accent">
          Sign in
        </Link>
      </p>
    </form>
  );
}
