import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

/**
 * What a screen that isn't switched on yet shows, instead of an error or an empty form that
 * would fail on submit. Plain words for a learner; the technical detail lives in the code.
 */
export function PendingFeatureNotice({ title, fallback }: { title: string; fallback: string }) {
  return (
    <div className="pt-2">
      <Link href="/dashboard" className="text-sm text-neutral-500">
        ← Home
      </Link>
      <h1 className="font-display mt-2 text-xl font-bold">{title}</h1>
      <Card className="mt-5">
        <CardContent className="py-6 text-center">
          <p className="font-display mb-1 text-sm font-bold">Coming soon</p>
          <p className="mx-auto max-w-xs text-sm text-neutral-500">{fallback}</p>
        </CardContent>
      </Card>
    </div>
  );
}
