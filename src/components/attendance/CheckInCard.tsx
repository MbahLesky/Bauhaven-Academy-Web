"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkIn } from "@/lib/attendance-actions";
import type { CheckInOutcome } from "@/lib/attendance-actions";
import { formatAttendanceStatus, STATUS_VARIANTS } from "@/lib/attendance-format";
import type { AttendanceStatus } from "@/lib/schemas/attendance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export interface CheckInCardProps {
  sessionId: string;
  sessionLabel: string;
  /** The record already standing for today, if any — null means not yet marked. */
  currentStatus: AttendanceStatus | null;
}

/**
 * The wireframe's check-in card: where you stand, one large button, one line beneath.
 *
 * **No offline queue.** The wireframe's original line read "Works offline — syncs when
 * you're back online", which this app cannot honour: `Bauhaven-Architecture-Plan.md` §3
 * gives web clients best-effort caching and reserves genuine queued writes for the
 * native clients' Drift-backed storage. A web page can't guarantee a queued write ever
 * syncs, and for attendance a false "saved, will sync" is the worst kind of lie — the
 * student believes they're present and the register disagrees. So a failure here is a
 * plain error with a retry, and the note says what's actually true.
 */
export function CheckInCard({ sessionId, sessionLabel, currentStatus }: CheckInCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ outcome: CheckInOutcome; message: string } | null>(null);

  // Either the record that was already there on load, or the one just written.
  const settled = currentStatus !== null || result?.outcome === "checked-in";

  function handleCheckIn() {
    setResult(null);

    startTransition(async () => {
      const outcome = await checkIn({ session_id: sessionId });
      setResult(outcome);

      // Both of these mean the database now says something this screen should re-read.
      if (outcome.outcome === "checked-in" || outcome.outcome === "already-recorded") {
        router.refresh();
      }
    });
  }

  return (
    <Card className="mb-5 p-5 text-center">
      <p className="text-sm text-neutral-500">{sessionLabel}</p>

      <div className="mt-2 mb-4">
        {currentStatus ? (
          <div className="flex flex-col items-center gap-2">
            <Badge variant={STATUS_VARIANTS[currentStatus]}>
              {formatAttendanceStatus(currentStatus)}
            </Badge>
            <p className="font-display text-base font-bold">
              {currentStatus === "present"
                ? "You're checked in"
                : `Your mentor marked you ${formatAttendanceStatus(currentStatus).toLowerCase()}`}
            </p>
          </div>
        ) : (
          <p className="font-display text-base font-bold">You haven&apos;t checked in yet</p>
        )}
      </div>

      {!settled && (
        <Button
          onClick={handleCheckIn}
          disabled={isPending}
          size="lg"
          // Comfortably past the 44px touch-target floor: this is the one control the
          // whole screen exists for, tapped in a doorway, often in a hurry.
          className="min-h-14 w-full text-base"
        >
          {isPending ? "Checking in…" : "Check in now"}
        </Button>
      )}

      {result && result.outcome !== "checked-in" && (
        <p
          // "Already recorded" is not an error — nothing failed and nothing was lost —
          // so it's announced as status rather than as an alert.
          role={result.outcome === "already-recorded" ? "status" : "alert"}
          className={
            result.outcome === "already-recorded"
              ? "mt-3 rounded-md bg-neutral-100 px-3 py-2 text-xs text-neutral-600"
              : "mt-3 rounded-md bg-danger/10 px-3 py-2 text-xs text-danger"
          }
        >
          {result.message}
        </p>
      )}

      {result?.outcome === "failed" && (
        <Button
          variant="secondary"
          onClick={handleCheckIn}
          disabled={isPending}
          className="mt-2 min-h-11 w-full"
        >
          Try again
        </Button>
      )}

      <p className="mt-3 text-[11px] text-neutral-500">
        {/* The honest version of the wireframe's offline note. */}
        Needs a connection. If it fails, try again — nothing is saved until it succeeds.
      </p>
    </Card>
  );
}
