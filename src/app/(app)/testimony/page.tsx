import Link from "next/link";
import { getMyTestimonies } from "@/lib/testimony-queries";
import { TestimonyForm } from "@/components/testimony/TestimonyForm";
import { TestimonyCard } from "@/components/testimony/TestimonyCard";
import { Card, CardContent } from "@/components/ui/card";

// Per-user, never statically cached across users — same reason the other app routes are.
export const dynamic = "force-dynamic";

export default async function TestimonyPage() {
  const { testimonies, error } = await getMyTestimonies();

  // Throwing hands off to error.tsx rather than rendering an empty list, which would read
  // as "you've never shared anything" — a different and possibly false statement, and one
  // that could prompt a student to write the same thing twice with no way to delete either.
  if (error) {
    console.error("Academy testimonies fetch failed:", error);
    throw new Error("Couldn't load your testimonies.");
  }

  return (
    <div className="pt-2">
      <Link href="/dashboard" className="text-sm text-neutral-500">
        ← Home
      </Link>
      <h1 className="font-display mt-2 text-xl font-bold">Share feedback</h1>
      {/* The wireframe's own subtitle, kept verbatim — it's the honest statement of what
          happens, and it's the closest thing to a consent notice this feature is allowed
          to have while consent stays deferred. */}
      <p className="mb-5 text-sm text-neutral-500">
        Your testimony may be featured on the Bauhaven website.
      </p>

      <TestimonyForm />

      <div className="mb-2 mt-8 text-xs font-bold uppercase tracking-wide text-neutral-400">
        Your testimonies
      </div>

      {testimonies.length === 0 ? (
        <Card>
          <CardContent className="text-sm text-neutral-500">
            You haven&apos;t shared anything yet.
          </CardContent>
        </Card>
      ) : (
        testimonies.map((testimony) => (
          <TestimonyCard key={testimony.id} testimony={testimony} />
        ))
      )}
    </div>
  );
}
