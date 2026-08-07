"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createSelfTask } from "@/lib/task-actions";
import { EMPTY_SELF_TASK, selfTaskSchema, type SelfTaskInput } from "@/lib/schemas/task";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

// An empty optional field is null, which the column stores as NULL. Null-safe because
// `setValueAs` also runs on the default value, which is null here.
const OPTIONAL_TEXT = {
  setValueAs: (value: unknown) =>
    typeof value === "string" && value.trim() !== "" ? value : null,
};

export function SelfTaskForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SelfTaskInput>({
    resolver: zodResolver(selfTaskSchema),
    defaultValues: EMPTY_SELF_TASK,
  });

  function onSubmit(values: SelfTaskInput) {
    setServerError(null);

    startTransition(async () => {
      const result = await createSelfTask(values);

      if (result.error) {
        setServerError(result.error);
        return;
      }

      router.push("/tasks");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div>
            <label htmlFor="title" className="mb-1.5 block text-sm font-medium">
              Title
            </label>
            <Input id="title" error={!!errors.title} {...register("title")} />
            {errors.title && <p className="mt-1.5 text-xs text-danger">{errors.title.message}</p>}
          </div>

          <div>
            <label htmlFor="description" className="mb-1.5 block text-sm font-medium">
              What you&apos;re doing{" "}
              <span className="text-xs font-normal text-neutral-400">Optional</span>
            </label>
            <Input
              id="description"
              error={!!errors.description}
              {...register("description", OPTIONAL_TEXT)}
            />
            {errors.description && (
              <p className="mt-1.5 text-xs text-danger">{errors.description.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="deadline" className="mb-1.5 block text-sm font-medium">
              Deadline <span className="text-xs font-normal text-neutral-400">Optional</span>
            </label>
            <Input
              id="deadline"
              type="datetime-local"
              error={!!errors.deadline}
              {...register("deadline", OPTIONAL_TEXT)}
            />
            {errors.deadline && (
              <p className="mt-1.5 text-xs text-danger">{errors.deadline.message}</p>
            )}
            <p className="mt-1.5 text-[11px] text-neutral-500">
              Read as Cameroon time, whatever timezone you&apos;re in.
            </p>
          </div>
        </CardContent>
      </Card>

      {serverError && (
        <p role="alert" className="mt-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {serverError}
        </p>
      )}

      <p className="mt-3 text-xs text-neutral-500">
        This is yours — it shows on your list marked as self-created, and your mentors can
        see it alongside the work they assigned.
      </p>

      <div className="mt-4 flex gap-2">
        <Link
          href="/tasks"
          className="flex min-h-12 flex-1 items-center justify-center rounded-md border border-neutral-200 bg-white text-sm font-semibold"
        >
          Cancel
        </Link>
        <Button type="submit" disabled={isPending} className="min-h-12 flex-1">
          {isPending ? "Creating…" : "Create task"}
        </Button>
      </div>
    </form>
  );
}
