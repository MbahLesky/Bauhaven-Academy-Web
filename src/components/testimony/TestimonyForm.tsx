"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { submitTestimony } from "@/lib/testimony-actions";
import { EMPTY_TESTIMONY, testimonySchema, type TestimonyInput } from "@/lib/schemas/testimony";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function TestimonyForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TestimonyInput>({
    resolver: zodResolver(testimonySchema),
    defaultValues: EMPTY_TESTIMONY,
  });

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
          {/*
            One field, exactly as the wireframe draws it. `testimonies` has separate
            content_en and content_fr columns, but which one this belongs in is answered by
            `users.preferred_language` server-side — asking a student to fill two boxes
            would be asking them to translate their own testimonial.
          */}
          <label htmlFor="content" className="mb-1.5 block text-sm font-medium">
            Your experience
          </label>
          {/* A textarea rather than the wireframe's single-line input: this is destined for
              a pull-quote on the public Site, and a one-line box invites one line. */}
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
          <p className="mt-1.5 text-[11px] text-neutral-500">
            Write in whichever language you prefer — it&apos;s saved in the language set on
            your profile.
          </p>
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
        {isPending ? "Sending…" : "Submit"}
      </Button>

      {/*
        States what happens without inventing a consent mechanism. Portfolio/testimony
        consent is explicitly deferred in the Project Brief's "Known open items" — not
        decided — so no opt-in checkbox is built here, exactly as Content Editor left
        `portfolio_entries` alone. What the screen *can* honestly say is that featuring is
        someone else's decision and hasn't happened yet: `testimonies` has no UPDATE policy,
        so nothing can reach 'published' today by any route.
      */}
      <p className="mt-3 text-xs text-neutral-500">
        Bauhaven may feature this on the website. Nothing is published automatically —
        someone chooses, and you&apos;ll see it here if it goes up.
      </p>
    </form>
  );
}
