"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateLanguage } from "@/lib/profile-actions";
import { LANGUAGE_OPTIONS } from "@/lib/schemas/profile";
import type { ContentLanguage } from "@/lib/schemas/testimony";

/**
 * The wireframe's EN/FR toggle, wired to `users.preferred_language`.
 *
 * A radio group rather than two buttons: this is one setting with two states, and a
 * screen reader should hear "Language, English selected" instead of two unrelated
 * controls. `useOptimistic` so the tap lands immediately — a preference toggle that waits
 * on a round trip before moving reads as broken on a slow connection.
 */
export function LanguageToggle({ current }: { current: ContentLanguage }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useOptimistic(current);

  function handleChange(language: ContentLanguage) {
    if (language === optimistic) return;

    setError(null);

    startTransition(async () => {
      setOptimistic(language);
      const result = await updateLanguage(language);

      if (result.error) {
        // The optimistic value reverts when the transition ends, so the toggle snaps back
        // to what the database actually says rather than lying about a saved preference.
        setError(result.error);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Language"
        className="flex gap-1 rounded-md bg-neutral-100 p-1"
      >
        {LANGUAGE_OPTIONS.map((option) => {
          const selected = optimistic === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              // The two-letter label is what the wireframe shows and what fits; the full
              // language name is what a screen reader should say.
              aria-label={option.name}
              disabled={isPending}
              onClick={() => handleChange(option.value)}
              className={`min-h-9 min-w-11 rounded px-3 text-xs font-semibold transition-colors disabled:opacity-60 ${
                selected ? "bg-white text-foreground shadow-sm" : "text-neutral-500"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="mt-1.5 text-right text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
