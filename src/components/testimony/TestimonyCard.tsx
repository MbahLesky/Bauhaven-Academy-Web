import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { MyTestimony } from "@/lib/testimony-queries";

/**
 * One piece of feedback the learner shared: the words, when, their rating, and whether they
 * allowed Bauhaven to feature it. Read-only — once shared it can't be edited from here, so
 * the consent it was given with is shown plainly.
 */
export function TestimonyCard({ testimony }: { testimony: MyTestimony }) {
  return (
    <Card className="mb-2.5">
      <CardContent className="py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="text-xs text-neutral-400">
            {testimony.sharedOn && `Shared ${testimony.sharedOn}`}
            {testimony.rating !== null && ` · ${testimony.rating}/5`}
          </div>
          <Badge variant={testimony.publicUse ? "success" : "neutral"} className="ml-auto shrink-0">
            {testimony.publicUse ? "May be featured" : "Private"}
          </Badge>
        </div>
        {/* Wrapped, not truncated: re-reading what you said is the main reason this list exists. */}
        <p className="mt-1.5 whitespace-pre-wrap break-words text-sm">{testimony.content}</p>
      </CardContent>
    </Card>
  );
}
