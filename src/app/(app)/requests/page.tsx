import Link from "next/link";
import { getMyRequests } from "@/lib/request-queries";
import { AbsenceRequestForm } from "@/components/requests/AbsenceRequestForm";
import { RequestCard } from "@/components/requests/RequestCard";
import { Card, CardContent } from "@/components/ui/card";

// Per-user, never statically cached across users — same reason the other app routes are.
export const dynamic = "force-dynamic";

export default async function RequestsPage() {
  const { requests, error } = await getMyRequests();

  // Throwing hands off to error.tsx rather than rendering an empty list, which would read
  // as "you've never requested anything" — a different and possibly false statement, and
  // one that could prompt a student to submit a duplicate.
  if (error) {
    console.error("Academy requests fetch failed:", error);
    throw new Error("Couldn't load your requests.");
  }

  return (
    <div className="pt-2">
      <Link href="/dashboard" className="text-sm text-neutral-500">
        ← Home
      </Link>
      <h1 className="font-display mt-2 text-xl font-bold">Request absence</h1>
      {/*
        The wireframe said "Goes to your Programme Manager for approval". Corrected to
        match the quorum rule in Bauhaven-Core-Feature-Spec.md §8, which routes a student's
        request to *one Staff approval* — "Programme Manager" isn't a role this schema has,
        and no routing to a named person exists.
      */}
      <p className="mb-5 text-sm text-neutral-500">Goes to staff for approval.</p>

      <AbsenceRequestForm />

      <div className="mb-2 mt-8 text-xs font-bold uppercase tracking-wide text-neutral-400">
        Your requests
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="text-sm text-neutral-500">
            You haven&apos;t sent any requests yet.
          </CardContent>
        </Card>
      ) : (
        requests.map((request) => <RequestCard key={request.id} request={request} />)
      )}
    </div>
  );
}
