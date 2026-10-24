"use client";

import { Suspense, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { verifyActivationCode, activateWithCode } from "@/lib/activation-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function ActivateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCode = searchParams.get("code") || "";

  const [code, setCode] = useState(initialCode.toUpperCase());
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isVerified = !!email;

  function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      setError("Please enter the activation code from your email.");
      return;
    }

    startTransition(async () => {
      const res = await verifyActivationCode(cleanCode);
      if (!res.ok) {
        setError(res.error || "That code is invalid or has expired.");
        return;
      }
      setEmail(res.email || null);
    });
  }

  function handleCompleteActivation(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      const res = await activateWithCode(code.trim().toUpperCase(), password);
      if (!res.ok) {
        setError(res.error || "Failed to activate account. Try again.");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h1 className="font-display mb-1 text-xl font-bold">Activate your account</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Enter the activation code from your Bauhaven approval email to set up your learner access.
      </p>

      {!isVerified ? (
        <form onSubmit={handleVerifyCode} noValidate>
          <div className="mb-5">
            <label htmlFor="code" className="mb-1.5 block text-sm font-medium">
              Activation code
            </label>
            <Input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. BAUHAVEN-LUHAT9"
              className="font-mono uppercase tracking-wider text-base"
              autoCapitalize="characters"
              autoComplete="off"
              disabled={isPending}
              required
            />
            <p className="mt-1.5 text-xs text-neutral-500">
              You can copy and paste the code exactly as shown in your email.
            </p>
          </div>

          {error && (
            <p role="alert" className="mb-4 rounded-md bg-danger/10 px-3 py-2 text-xs text-danger font-medium">
              {error}
            </p>
          )}

          <Button type="submit" disabled={isPending || !code.trim()} className="min-h-12 w-full">
            {isPending ? "Checking code..." : "Continue"}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleCompleteActivation} noValidate>
          <div className="mb-5 rounded-lg border border-success/30 bg-success/5 p-3.5">
            <span className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Code verified for
            </span>
            <span className="font-medium text-neutral-900 text-sm">
              {email}
            </span>
            <button
              type="button"
              onClick={() => {
                setEmail(null);
                setError(null);
              }}
              className="mt-1 block text-xs text-accent underline"
            >
              Use a different code
            </button>
          </div>

          <div className="mb-4">
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
              Create password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              disabled={isPending}
              required
            />
          </div>

          <div className="mb-5">
            <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium">
              Confirm password
            </label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Type your password again"
              disabled={isPending}
              required
            />
          </div>

          {error && (
            <p role="alert" className="mb-4 rounded-md bg-danger/10 px-3 py-2 text-xs text-danger font-medium">
              {error}
            </p>
          )}

          <Button type="submit" disabled={isPending} className="min-h-12 w-full">
            {isPending ? "Activating account..." : "Activate & Enter Hub"}
          </Button>
        </form>
      )}

      <div className="mt-6 border-t border-neutral-100 pt-4 text-center">
        <Link href="/login" className="text-xs font-semibold text-neutral-600 hover:text-neutral-900">
          Already activated? <span className="text-accent underline">Sign in</span>
        </Link>
      </div>
    </div>
  );
}

export default function ActivatePage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-background px-5 py-12">
      <div className="mb-8 text-center">
        <span className="font-display text-lg font-bold">Bauhaven Hub</span>
      </div>
      <Suspense fallback={<div className="text-center text-sm text-neutral-400">Loading activation...</div>}>
        <ActivateForm />
      </Suspense>
    </div>
  );
}

