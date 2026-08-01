import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind classes, resolving conflicts (e.g. "p-2 p-4" -> "p-4").
 * Standard shadcn/ui helper — used by every component that accepts a `className` prop.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
