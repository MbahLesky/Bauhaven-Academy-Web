import { z } from "zod";

// Deliberately not in auth-actions.ts: a "use server" file can only export
// async functions — a Zod schema exported from one silently isn't the real
// schema by the time a client component imports it. This exact mistake broke
// Admin-web's build once (`zodResolver` failing with "Invalid input: not a Zod
// schema" during prerendering), and it compiles fine either way, so the split
// is the only thing preventing it. Same rule applies to every schema in here.
export const signInSchema = z.object({
  // `z.email()` rather than Admin-web's `z.string().email()`: the chained form is
  // deprecated in Zod 4, which this repo's AGENTS.md says to heed. Same validation,
  // same message — the only intentional difference from the ported original.
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export type SignInInput = z.infer<typeof signInSchema>;
