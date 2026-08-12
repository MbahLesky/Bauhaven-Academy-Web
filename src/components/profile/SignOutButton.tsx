"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-actions";

/**
 * Sign-out, at the bottom of the Profile screen where the wireframe puts it.
 *
 * This lived in the app-shell header through the Auth pass, documented there as a stopgap
 * until Profile existed to hold it properly. Profile exists now, so the header control is
 * gone and this is the app's only sign-out — one place to end a session rather than two
 * that could drift.
 *
 * A text button rather than an icon: an unlabelled icon for a destructive-ish action is a
 * guessing game.
 */
export function SignOutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      await signOut();
      // Middleware would bounce the next request to /login anyway; navigating
      // explicitly means the user doesn't sit on a stale authenticated screen
      // until they happen to click something.
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isPending}
      // Full width at the foot of the screen, matching the wireframe's secondary
      // button. 48px tall, comfortably over the 44px minimum touch target.
      className="min-h-12 w-full rounded-md border border-neutral-200 bg-white text-sm font-semibold text-neutral-600 transition-colors hover:text-foreground disabled:opacity-50"
    >
      {isPending ? "Signing out…" : "Sign out"}
    </button>
  );
}
