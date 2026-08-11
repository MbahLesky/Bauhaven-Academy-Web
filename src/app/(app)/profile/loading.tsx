import { Card } from "@/components/ui/card";

export default function ProfileLoading() {
  return (
    <div className="pt-2" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your profile…</span>

      <div className="mb-6 flex items-center gap-4">
        <div className="h-16 w-16 flex-shrink-0 animate-pulse rounded-full bg-neutral-200" />
        <div className="min-w-0 flex-1">
          <div className="mb-2 h-5 w-32 animate-pulse rounded-md bg-neutral-200" />
          <div className="h-4 w-44 animate-pulse rounded-md bg-neutral-200" />
        </div>
      </div>

      <Card className="mb-5 h-56 animate-pulse bg-neutral-100" />

      <div className="mb-2 h-3 w-32 animate-pulse rounded bg-neutral-200" />
      <Card className="mb-5 h-40 animate-pulse bg-neutral-100" />

      <div className="mb-2 h-3 w-12 animate-pulse rounded bg-neutral-200" />
      <Card className="h-14 animate-pulse bg-neutral-100" />
    </div>
  );
}
