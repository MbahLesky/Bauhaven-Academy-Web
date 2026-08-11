import { Card } from "@/components/ui/card";

const SKELETON_COUNT = 3;

export default function RequestsLoading() {
  return (
    <div className="pt-2" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your requests…</span>

      <div className="mb-5">
        <div className="mb-2 h-7 w-40 animate-pulse rounded-md bg-neutral-200" />
        <div className="h-4 w-48 animate-pulse rounded-md bg-neutral-200" />
      </div>

      <Card className="h-64 animate-pulse bg-neutral-100" />

      <div className="mb-2 mt-8 h-3 w-24 animate-pulse rounded bg-neutral-200" />
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <Card key={index} className="mb-2.5 h-16 animate-pulse bg-neutral-100" />
      ))}
    </div>
  );
}
