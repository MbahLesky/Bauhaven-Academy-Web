import Link from "next/link";
import { getMyRequests } from "@/lib/request-queries";
import { isDatabaseReady } from "@/lib/database-readiness";
import { AbsenceRequestForm } from "@/components/requests/AbsenceRequestForm";
import { RequestCard } from "@/components/requests/RequestCard";
import { PendingFeatureNotice } from "@/components/app-shell/PendingFeatureNotice";
import { Card, CardContent } from "@/components/ui/card";

// Per-user, never statically cached across users — same reason the other app routes are.
export const dynamic = "force-dynamic";

export default async function RequestsPage() {
  if (!isDatabaseReady("absenceRequests")) {
    return (
      <PendingFeatureNotice
        title="Request absence"
        fallback="Asking for time off here isn't switched on yet. Tell your coordinator directly for now."
      />
    );
  }

  // A failed read throws to error.tsx rather than rendering an empty list.
  const requests = await getMyRequests();

  return (
    <div className="pt-2">
      <Link href="/dashboard" className="text-sm text-neutral-500">
        ← Home
      </Link>
      <h1 className="font-display mt-2 text-xl font-bold">Request absence</h1>
      <p className="mb-5 text-sm text-neutral-500">Goes to your programme&apos;s coordinators for approval.</p>

      <AbsenceRequestForm />

      <div className="mb-2 mt-8 text-xs font-bold uppercase tracking-wide text-neutral-400">Your requests</div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="text-sm text-neutral-500">You haven&apos;t sent any requests yet.</CardContent>
        </Card>
      ) : (
        requests.map((request) => <RequestCard key={request.id} request={request} />)
      )}
    </div>
  );
}
