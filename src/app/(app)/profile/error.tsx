"use client"; // Error boundaries must be Client Components.

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SignOutButton } from "@/components/profile/SignOutButton";

export default function ProfileError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Academy profile route error:", error.digest, error.message);
  }, [error]);

  return (
    <div className="pt-2">
      <Card>
        <CardContent className="py-8 text-center">
          <p className="font-display mb-1.5 text-sm font-bold">Couldn&apos;t load your profile</p>
          <p className="mx-auto mb-5 max-w-xs text-sm text-neutral-500">
            Something went wrong reaching the server. Nothing about your account has
            changed — try again in a moment.
          </p>
          <Button onClick={() => unstable_retry()} className="min-h-11">
            Try again
          </Button>
        </CardContent>
      </Card>

      {/*
        Sign-out is rendered here too, and this is the reason the control has to be usable
        without the profile query succeeding: this page is now the app's only way out of a
        session. Someone signed into the wrong account, or stuck behind a failing profile
        read, would otherwise have no way to leave.
      */}
      <div className="mt-6">
        <SignOutButton />
      </div>
    </div>
  );
}
