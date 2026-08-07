"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { submitTask } from "@/lib/task-actions";
import { EMPTY_SUBMISSION, submissionSchema, type SubmissionInput } from "@/lib/schemas/task";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface SubmitFormProps {
  taskId: string;
  taskTitle: string;
  onCancel: () => void;
}

/**
 * Hand in a link to your work.
 *
 * One field, because `submissions.content_url` is the only column carrying the work —
 * there's no file storage and no body text, so a submission is a pointer to something
 * hosted elsewhere.
 */
export function SubmitForm({ taskId, taskTitle, onCancel }: SubmitFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SubmissionInput>({
    resolver: zodResolver(submissionSchema),
    defaultValues: EMPTY_SUBMISSION,
  });

  function onSubmit(values: SubmissionInput) {
    setServerError(null);

    startTransition(async () => {
      const result = await submitTask(taskId, values);

      if (result.error) {
        setServerError(result.error);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="mt-3 border-t border-neutral-200 pt-3">
      <label htmlFor={`content_url-${taskId}`} className="mb-1.5 block text-xs font-medium">
        Link to your work
      </label>
      <Input
        id={`content_url-${taskId}`}
        type="url"
        inputMode="url"
        // A phone keyboard capitalises the first letter by default, which breaks a URL
        // before validation ever sees it — same reason the login email field does this.
        autoCapitalize="none"
        autoCorrect="off"
        placeholder="https://…"
        aria-label={`Link to your work for ${taskTitle}`}
        error={!!errors.content_url}
        {...register("content_url")}
      />
      {errors.content_url && (
        <p className="mt-1.5 text-xs text-danger">{errors.content_url.message}</p>
      )}

      <p className="mt-1.5 text-[11px] text-neutral-500">
        A repository, a live page, or a shared file. Make sure it&apos;s viewable by
        someone who isn&apos;t you.
      </p>

      {serverError && (
        <p role="alert" className="mt-2 rounded-md bg-danger/10 px-2.5 py-2 text-xs text-danger">
          {serverError}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isPending}
          className="min-h-11 flex-1"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSubmit(onSubmit)}
          disabled={isPending}
          className="min-h-11 flex-1"
        >
          {isPending ? "Submitting…" : "Submit"}
        </Button>
      </div>
    </div>
  );
}
