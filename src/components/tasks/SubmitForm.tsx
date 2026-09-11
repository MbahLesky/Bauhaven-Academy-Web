"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { submitWork } from "@/lib/task-actions";
import { EMPTY_SUBMISSION, requiredParts, submissionSchema, type SubmissionInput } from "@/lib/schemas/task";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface SubmitFormProps {
  assignmentId: string;
  taskTitle: string;
  submissionType: string;
  onCancel: () => void;
}

// Null-safe: `setValueAs` runs on the default value too.
const optionalText = (value: unknown) => (typeof value === "string" && value.trim() !== "" ? value : null);

/**
 * Hand in your work: an answer, a link, or both, as the task asks. Files can't be uploaded
 * yet, so a file task takes a link to the file.
 */
export function SubmitForm({ assignmentId, taskTitle, submissionType, onCancel }: SubmitFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  // One key per form: a retry after a lost response reuses it, so it can't hand in twice.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const needs = requiredParts(submissionType);
  const showText = needs.text || needs.either;
  const showLink = needs.link || needs.either;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SubmissionInput>({ resolver: zodResolver(submissionSchema), defaultValues: EMPTY_SUBMISSION });

  function onSubmit(values: SubmissionInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await submitWork(assignmentId, values, idempotencyKey);
      if (result.error) {
        setServerError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-3 border-t border-neutral-200 pt-3">
      {showText && (
        <div className="mb-3">
          <label htmlFor={`text-${assignmentId}`} className="mb-1.5 block text-xs font-medium">
            Your answer{needs.either && " (or add a link below)"}
          </label>
          <textarea
            id={`text-${assignmentId}`}
            rows={5}
            aria-invalid={!!errors.text_content}
            className={`w-full rounded-md border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-transparent focus:ring-2 focus:ring-accent ${
              errors.text_content ? "border-danger" : "border-neutral-200"
            }`}
            {...register("text_content", { setValueAs: optionalText })}
          />
          {errors.text_content && <p className="mt-1.5 text-xs text-danger">{errors.text_content.message}</p>}
        </div>
      )}

      {showLink && (
        <div className="mb-1">
          <label htmlFor={`link-${assignmentId}`} className="mb-1.5 block text-xs font-medium">
            {submissionType === "file" ? "Link to your file" : "Link to your work"}
          </label>
          <Input
            id={`link-${assignmentId}`}
            type="url"
            inputMode="url"
            // A phone keyboard capitalises the first letter by default, which breaks a URL.
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="https://…"
            aria-label={`Link to your work for ${taskTitle}`}
            error={!!errors.link_url}
            {...register("link_url", { setValueAs: optionalText })}
          />
          {errors.link_url && <p className="mt-1.5 text-xs text-danger">{errors.link_url.message}</p>}
          <p className="mt-1.5 text-[11px] text-neutral-500">
            {submissionType === "file"
              ? "Upload the file to a drive and share the link — uploading here isn't available yet."
              : "A repository, a live page, or a shared file. Make sure someone who isn't you can open it."}
          </p>
        </div>
      )}

      {serverError && (
        <p role="alert" className="mt-2 rounded-md bg-danger/10 px-2.5 py-2 text-xs text-danger">
          {serverError}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending} className="min-h-11 flex-1">
          Cancel
        </Button>
        <Button type="button" onClick={handleSubmit(onSubmit)} disabled={isPending} className="min-h-11 flex-1">
          {isPending ? "Handing in…" : "Hand in"}
        </Button>
      </div>
    </div>
  );
}
