import { Card } from "@/components/ui/card";

const HISTORY_SKELETON_COUNT = 5;

export default function AttendanceLoading() {
  return (
    <div className="pt-2" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your attendance…</span>

      <div className="mb-5">
        <div className="mb-2 h-7 w-32 animate-pulse rounded-md bg-neutral-200" />
        <div className="h-4 w-36 animate-pulse rounded-md bg-neutral-200" />
      </div>

      <Card className="mb-5 h-40 animate-pulse bg-neutral-100" />

      <div className="mb-5 grid grid-cols-2 gap-3">
        <Card className="h-20 animate-pulse bg-neutral-100" />
        <Card className="h-20 animate-pulse bg-neutral-100" />
      </div>

      <div className="mb-2 h-3 w-16 animate-pulse rounded bg-neutral-200" />
      <Card className="overflow-hidden p-0">
        {Array.from({ length: HISTORY_SKELETON_COUNT }, (_, index) => (
          <div key={index} className="border-b border-neutral-200 px-4 py-3.5 last:border-b-0">
            <div className="h-4 w-full animate-pulse rounded bg-neutral-100" />
          </div>
        ))}
      </Card>
    </div>
  );
}
