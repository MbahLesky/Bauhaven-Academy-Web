"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { acceptInvitation, completeInvitation } from "@/lib/accept-actions";
import {
  EMPTY_ACCEPT,
  acceptInvitationSchema,
  type AcceptInvitationInput,
} from "@/lib/schemas/accept";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/**
 * Setting up an account from an invitation.
 *
 * Two entry states, because there are genuinely two:
 *
 * - **Not signed in** — the ordinary case. Name and password, then `signUp` + redeem.
 * - **Already signed in** — one button. This happens after confirming an email (sign-up
 *   succeeded but left no session), and when an existing account is given a second role
 *   by invitation. Multi-role is the design, so this isn't an edge case.
 *
 * There is no email field in either state. The address comes from the invitation and the
 * RPC checks it against the signed-in account — a form field there would let whoever finds
 * a forwarded link redeem it under their own address.
 */
export function AcceptForm({
  token,
  email,
  signedIn,
  destination,
}: {
  token: string;
  email: string;
  signedIn: boolean;
  destination: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AcceptInvitationInput>({
    resolver: zodResolver(acceptInvitationSchema),
    defaultValues: { ...EMPTY_ACCEPT, token },
  });

  function finish(outcome: string, message: string) {
    if (outcome === "accepted") {
      router.replace(destination);
      router.refresh();
      return;
    }
    // "Needs email confirmation" isn't a failure — the account exists and the invitation
    // is untouched — so it's a status, not an alert.
    if (outcome === "needs-email-confirmation") {
      setNotice(message);
      return;
    }
    setServerError(message);
  }

  function onSubmit(values: AcceptInvitationInput) {
    setServerError(null);
    setNotice(null);

    startTransition(async () => {
      const result = await acceptInvitation({ ...values, token });
      finish(result.outcome, result.message);
    });
  }

  function complete() {
    setServerError(null);
    startTransition(async () => {
      const result = await completeInvitation(token);
      finish(result.outcome, result.message);
    });
  }

  if (signedIn) {
    return (
      <div>
        <Card><CardContent>
          <p className="text-sm">
            You&apos;re signed in as <span className="font-semibold">{email}</span>. Accept
            the invitation to finish setting up.
          </p>
          </CardContent>
        </Card>
        {serverError && (
          <p role="alert" className="mt-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {serverError}
          </p>
        )}
        <Button
          type="button"
          onClick={complete}
          disabled={isPending}
          className="mt-4 min-h-12 w-full"
        >
          {isPending ? "Setting up…" : "Accept invitation"}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Card><CardContent className="flex flex-col gap-4">
        <div>
          <span className="mb-1.5 block text-sm font-medium">Email</span>
          {/* Shown, never editable — see the doc comment. */}
          <p className="break-all rounded-md bg-neutral-100 px-3 py-2.5 text-sm text-neutral-600">
            {email}
          </p>
        </div>

        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
            Your name
          </label>
          <Input id="name" autoComplete="name" error={!!errors.name} {...register("name")} />
          {errors.name && <p className="mt-1.5 text-xs text-danger">{errors.name.message}</p>}
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
          {/* There is no password-reset flow in this app yet, so a typo here is a locked
              account until an admin intervenes. Worth the second field and this line. */}
          <p className="mt-1.5 text-[11px] text-neutral-500">
            Nobody else sees this — not even the person who invited you.
          </p>
        </div>
        </CardContent>
      </Card>

      {serverError && (
        <p role="alert" className="mt-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {serverError}
        </p>
      )}

      {notice && (
        <p role="status" className="mt-3 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
          {notice}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="mt-4 min-h-12 w-full">
        {isPending ? "Setting up…" : "Create my account"}
      </Button>
    </form>
  );
}
