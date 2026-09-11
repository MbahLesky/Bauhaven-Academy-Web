import Link from "next/link";
import { getMyTestimonies } from "@/lib/testimony-queries";
import { TestimonyForm } from "@/components/testimony/TestimonyForm";
import { TestimonyCard } from "@/components/testimony/TestimonyCard";
import { Card, CardContent } from "@/components/ui/card";

// Per-user, never statically cached across users — same reason the other app routes are.
export const dynamic = "force-dynamic";

export default async function TestimonyPage() {
  // A failed read throws to error.tsx rather than rendering "you've never shared anything".
  const testimonies = await getMyTestimonies();

  return (
    <div className="pt-2">
      <Link href="/dashboard" className="text-sm text-neutral-500">
        ← Home
      </Link>
      <h1 className="font-display mt-2 text-xl font-bold">Share feedback</h1>
      <p className="mb-5 text-sm text-neutral-500">Tell us how your programme is going.</p>

      <TestimonyForm />

      <div className="mb-2 mt-8 text-xs font-bold uppercase tracking-wide text-neutral-400">Your feedback</div>

      {testimonies.length === 0 ? (
        <Card>
          <CardContent className="text-sm text-neutral-500">You haven&apos;t shared anything yet.</CardContent>
        </Card>
      ) : (
        testimonies.map((testimony) => <TestimonyCard key={testimony.id} testimony={testimony} />)
      )}
    </div>
  );
}
