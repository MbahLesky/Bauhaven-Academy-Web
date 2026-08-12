"use client"; // Error boundaries must be Client Components.

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function RequestsError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Academy requests route error:", error.digest, error.message);
  }, [error]);

  return (
    <div className="pt-2">
      <Card>
        <CardContent className="py-8 text-center">
          <p className="font-display mb-1.5 text-sm font-bold">Couldn&apos;t load your requests</p>
          <p className="mx-auto mb-5 max-w-xs text-sm text-neutral-500">
            Something went wrong reaching the server. Any request you&apos;ve already sent is
            still there — try again in a moment.
          </p>
          <Button onClick={() => unstable_retry()} className="min-h-11">
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
