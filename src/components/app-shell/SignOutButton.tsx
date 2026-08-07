"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-actions";

/**
 * Minimal sign-out, in the header.
 *
 * **Deliberately a stopgap.** This belongs on the Profile screen — the wireframe
 * puts account controls there alongside "My requests", the language toggle and
 * testimonies — but Profile isn't built yet, and shipping auth with no way to
 * sign out would be worse than a temporary control in the wrong place. Move it
 * when Profile lands; there is nothing to preserve here but the two lines below.
 *
 * A text button rather than an icon: an unlabelled icon for a destructive-ish
 * action is a guessing game, and the header has room for four characters.
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
      // 44px minimum touch target, negative margin so it doesn't visually
      // inflate a 56px header just to satisfy that.
      className="-mr-2 min-h-11 rounded-md px-2 text-xs font-semibold text-neutral-500 transition-colors hover:text-foreground disabled:opacity-50"
    >
      {isPending ? "Signing out…" : "Sign out"}
    </button>
  );
}
