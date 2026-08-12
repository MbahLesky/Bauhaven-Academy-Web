"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { submitIssueReport } from "@/lib/issue-report-actions";
import {
  EMPTY_ISSUE_REPORT,
  ISSUE_CATEGORIES,
  issueReportSchema,
  type IssueReportInput,
} from "@/lib/schemas/issue-report";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function IssueReportForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<IssueReportInput>({
    resolver: zodResolver(issueReportSchema),
    defaultValues: EMPTY_ISSUE_REPORT,
  });

  function onSubmit(values: IssueReportInput) {
    setServerError(null);
    setSent(false);

    startTransition(async () => {
      const result = await submitIssueReport(values);

      if (result.error) {
        setServerError(result.error);
        return;
      }

      // Stays on the page rather than navigating: the report just filed appears in the
      // list directly below, which confirms it better than a redirect would.
      setSent(true);
      reset(EMPTY_ISSUE_REPORT);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div>
            <label htmlFor="category" className="mb-1.5 block text-sm font-medium">
              Category
            </label>
            {/* A select, not the wireframe's free-text box. `issue_reports.category` has
                no check constraint, so free text would mean every report arriving in its
                own category of one — unsortable for whoever eventually triages them. */}
            <select
              id="category"
              aria-invalid={!!errors.category}
              defaultValue=""
              className={`h-11 w-full rounded-md border bg-white px-3 text-sm outline-none transition-colors focus:border-transparent focus:ring-2 focus:ring-accent ${
                errors.category ? "border-danger" : "border-neutral-200"
              }`}
              {...register("category")}
            >
              <option value="" disabled>
                Choose one
              </option>
              {ISSUE_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
            {errors.category && (
              <p className="mt-1.5 text-xs text-danger">{errors.category.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="description" className="mb-1.5 block text-sm font-medium">
              What&apos;s wrong?
            </label>
            {/* A textarea rather than the wireframe's single-line input: `description` is
                `text`, and there's no comment thread on `issue_reports` for staff to ask
                a follow-up question — so the first description is all they get. */}
            <textarea
              id="description"
              rows={4}
              aria-invalid={!!errors.description}
              placeholder="Where it is, what happens, and when it started."
              className={`w-full rounded-md border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-transparent focus:ring-2 focus:ring-accent ${
                errors.description ? "border-danger" : "border-neutral-200"
              }`}
              {...register("description")}
            />
            {errors.description && (
              <p className="mt-1.5 text-xs text-danger">{errors.description.message}</p>
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
          Report sent. It&apos;s in your list below.
        </p>
      )}

      <Button type="submit" disabled={isPending} className="mt-4 min-h-12 w-full">
        {isPending ? "Sending…" : "Submit report"}
      </Button>

      {/*
        Honest about the queue, and specific about the one case where waiting is the wrong
        thing to do.

        Staff and Admin can read every report — `issue_reports_select` covers them — so
        filing one is genuinely useful. What doesn't exist yet is a screen where anyone
        works through them, and nothing in the schema routes a report to a particular
        person: the category is a label, not a destination. For an urgent or unsafe
        problem, "it's in a queue" is not good enough, so the screen says so rather than
        letting the category do work it can't do.
      */}
      <p className="mt-3 text-xs text-neutral-500">
        Staff can see your reports. If something is urgent or unsafe, tell a mentor
        directly as well — don&apos;t wait on this.
      </p>
    </form>
  );
}
