import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatTestimonyStatus, TESTIMONY_STATUS_VARIANTS } from "@/lib/testimony-format";
import type { MyTestimony } from "@/lib/testimony-queries";

/**
 * One row in "Your testimonies" — the words, when they were shared, and whether they've
 * been featured.
 *
 * Read-only. `testimonies` has SELECT and INSERT policies and nothing else, so a student
 * can neither edit nor withdraw a testimony once shared — a control that always failed
 * would be worse than its absence. Worth knowing that's a sharper limitation here than
 * elsewhere: this text may end up on a public website, and the person who wrote it cannot
 * take it back through the app.
 */
export function TestimonyCard({ testimony }: { testimony: MyTestimony }) {
  return (
    <Card className="mb-2.5">
      <CardContent className="py-3.5">
        <div className="flex items-start justify-between gap-3">
          {testimony.sharedOn && (
            <div className="text-xs text-neutral-400">Shared {testimony.sharedOn}</div>
          )}
          <Badge
            variant={TESTIMONY_STATUS_VARIANTS[testimony.status]}
            className="ml-auto flex-shrink-0"
          >
            {formatTestimonyStatus(testimony.status)}
          </Badge>
        </div>
        {/* Wrapped, not truncated: re-reading what you said about yourself — especially
            once it's public — is the main reason this list exists. */}
        <p className="mt-1.5 whitespace-pre-wrap break-words text-sm">{testimony.content}</p>
      </CardContent>
    </Card>
  );
}
