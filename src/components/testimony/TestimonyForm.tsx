"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { submitTestimony } from "@/lib/testimony-actions";
import { EMPTY_TESTIMONY, testimonySchema, type TestimonyInput } from "@/lib/schemas/testimony";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const RATINGS = [1, 2, 3, 4, 5] as const;

export function TestimonyForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<TestimonyInput>({ resolver: zodResolver(testimonySchema), defaultValues: EMPTY_TESTIMONY });

  const rating = useWatch({ control, name: "rating" });

  function onSubmit(values: TestimonyInput) {
    setServerError(null);
    setSent(false);

    startTransition(async () => {
      const result = await submitTestimony(values);
      if (result.error) {
        setServerError(result.error);
        return;
      }
      setSent(true);
      reset(EMPTY_TESTIMONY);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Card>
        <CardContent>
          <label htmlFor="content" className="mb-1.5 block text-sm font-medium">
            Your experience
          </label>
          {/* A textarea: this may become a quote on the website, and a one-line box invites one line. */}
          <textarea
            id="content"
            rows={5}
            aria-invalid={!!errors.content}
            placeholder="What changed for you, and what you'd tell someone thinking about joining."
            className={`w-full rounded-md border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-transparent focus:ring-2 focus:ring-accent ${
              errors.content ? "border-danger" : "border-neutral-200"
            }`}
            {...register("content")}
          />
          {errors.content && <p className="mt-1.5 text-xs text-danger">{errors.content.message}</p>}

          <fieldset className="mt-4">
            <legend className="mb-1.5 text-sm font-medium">Your rating (optional)</legend>
            <div className="flex gap-2">
              {RATINGS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={rating === value}
                  aria-label={`${value} out of 5`}
                  onClick={() => setValue("rating", rating === value ? null : value)}
                  className={cn(
                    "min-h-11 flex-1 rounded-md border text-sm font-semibold transition-colors",
                    rating === value ? "border-accent bg-accent/10 text-accent" : "border-neutral-200 bg-white text-neutral-600"
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="mt-4 flex items-start gap-2.5 text-sm">
            <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-accent" {...register("allow_public_use")} />
            <span>Bauhaven may feature what I wrote, with my name, on its website.</span>
          </label>
        </CardContent>
      </Card>

      {serverError && (
        <p role="alert" className="mt-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {serverError}
        </p>
      )}

      {sent && (
        <p role="status" className="mt-3 rounded-md bg-success/10 px-3 py-2 text-sm text-success">
          Thank you — it&apos;s in your list below.
        </p>
      )}

      <Button type="submit" disabled={isPending} className="mt-4 min-h-12 w-full">
        {isPending ? "Sending…" : "Send"}
      </Button>

      <p className="mt-3 text-xs text-neutral-500">
        Bauhaven&apos;s team reads everything shared here. Nothing goes on the website unless you tick the box above.
      </p>
    </form>
  );
}
