"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { submitAbsenceRequest } from "@/lib/request-actions";
import {
  EMPTY_ABSENCE_REQUEST,
  absenceRequestSchema,
  type AbsenceRequestInput,
} from "@/lib/schemas/request";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function AbsenceRequestForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AbsenceRequestInput>({
    resolver: zodResolver(absenceRequestSchema),
    defaultValues: EMPTY_ABSENCE_REQUEST,
  });

  function onSubmit(values: AbsenceRequestInput) {
    setServerError(null);
    setSent(false);

    startTransition(async () => {
      const result = await submitAbsenceRequest(values);

      if (result.error) {
        setServerError(result.error);
        return;
      }

      // Stays on the page rather than navigating: the request the student just made
      // appears in the list directly below, which is a clearer confirmation than a
      // redirect to somewhere they'd have to scan for it.
      setSent(true);
      reset(EMPTY_ABSENCE_REQUEST);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Card>
        <CardContent className="flex flex-col gap-4">
          {/* Two date inputs, not the wireframe's single "6 Aug – 7 Aug 2026" text field.
              `start_date` and `end_date` are separate columns, and a free-text range is
              the kind of field that submits "next week" and stores nothing usable. */}
          <div>
            <label htmlFor="start_date" className="mb-1.5 block text-sm font-medium">
              First day away
            </label>
            <Input
              id="start_date"
              type="date"
              error={!!errors.start_date}
              {...register("start_date")}
            />
            {errors.start_date && (
              <p className="mt-1.5 text-xs text-danger">{errors.start_date.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="end_date" className="mb-1.5 block text-sm font-medium">
              Last day away
            </label>
            <Input id="end_date" type="date" error={!!errors.end_date} {...register("end_date")} />
            {errors.end_date && (
              <p className="mt-1.5 text-xs text-danger">{errors.end_date.message}</p>
            )}
            <p className="mt-1.5 text-[11px] text-neutral-500">
              For a single day, use the same date twice.
            </p>
          </div>

          <div>
            <label htmlFor="reason" className="mb-1.5 block text-sm font-medium">
              Reason
            </label>
            {/* A textarea rather than the wireframe's single-line input: `reason` is
                `text`, and a one-line box invites a three-word answer that gives the
                person deciding nothing to go on. */}
            <textarea
              id="reason"
              rows={3}
              aria-invalid={!!errors.reason}
              className={`w-full rounded-md border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-transparent focus:ring-2 focus:ring-accent ${
                errors.reason ? "border-danger" : "border-neutral-200"
              }`}
              {...register("reason")}
            />
            {errors.reason && (
              <p className="mt-1.5 text-xs text-danger">{errors.reason.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {serverError && (
        <p role="alert" className="mt-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {serverError}
        </p>
      )}

      {sent && (
        <p role="status" className="mt-3 rounded-md bg-success/10 px-3 py-2 text-sm text-success">
          Request sent. It&apos;s in your list below.
        </p>
      )}

      <Button type="submit" disabled={isPending} className="mt-4 min-h-12 w-full">
        {isPending ? "Sending…" : "Submit request"}
      </Button>

      {/*
        Deliberately honest about where this goes.

        Staff and Admin can already read these rows — `requests_select` covers them — so
        submitting is genuinely useful today. What doesn't exist yet is anywhere to record
        a decision: no approval screen has been built, and `requests` has no UPDATE policy
        for anyone, so a request cannot currently move off 'pending' at all. Saying "we'll
        get back to you" would be the same class of lie as Attendance's since-removed
        "works offline — syncs when you're back online".
      */}
      <p className="mt-3 text-xs text-neutral-500">
        Your mentors can see your requests. Approving them isn&apos;t handled in the app
        yet, so a mentor will confirm with you directly.
      </p>
    </form>
  );
}
