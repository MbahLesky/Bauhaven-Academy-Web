import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Status colors are intentionally separate from the accent gradient — see
// Bauhaven-Brand-Guidelines.md's semantic-color table. Don't reuse `accent`/`accent-2`
// here even if a color looks close; that's the exact collision this project already
// caught and fixed once.
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold before:h-1.5 before:w-1.5 before:rounded-full before:bg-current",
  {
    variants: {
      variant: {
        success: "bg-success/10 text-success",
        warning: "bg-warning/10 text-warning",
        danger: "bg-danger/10 text-danger",
        neutral: "bg-neutral-100 text-neutral-600",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
