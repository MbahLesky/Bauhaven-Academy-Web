import { Card } from "@/components/ui/card";

const SKELETON_COUNT = 4;

export default function TasksLoading() {
  return (
    <div className="pt-2" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your tasks…</span>

      <div className="mb-5">
        <div className="mb-2 h-7 w-32 animate-pulse rounded-md bg-neutral-200" />
        <div className="h-4 w-48 animate-pulse rounded-md bg-neutral-200" />
      </div>

      <div className="mb-2 mt-5 h-3 w-16 animate-pulse rounded bg-neutral-200" />
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <Card key={index} className="mb-2.5 h-20 animate-pulse bg-neutral-100" />
      ))}
    </div>
  );
}
