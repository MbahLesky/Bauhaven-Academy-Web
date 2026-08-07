import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Ported from Admin-web unchanged. `h-11` is 44px, the minimum touch target in
 * `Bauhaven-Coding-Standards.md` — which matters more here than it does in Admin,
 * since Academy's users are on phones rather than at a desk.
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-11 w-full rounded-md border bg-white px-3 text-sm outline-none transition-colors",
          "focus:ring-2 focus:ring-accent focus:border-transparent",
          error ? "border-danger" : "border-neutral-200",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
