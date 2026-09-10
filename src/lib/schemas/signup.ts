import { z } from "zod";

// Its own module, not the actions file — a "use server" file can only export async
// functions, and a schema exported from one silently isn't the real schema by the time a
// client component imports it. Same rule every schema here follows.

/**
 * Supabase Auth's own floor is 6. Eight, because the one thing a password on a shared,
 * low-end Android device has to survive is a guess from somebody standing nearby.
 */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Signing up for a programme.
 *
 * The account and the application are created together: signing up **is** applying. There
 * is no separate "apply" step afterwards, and no account that exists without one — which
 * is the whole simplification.
 *
 * `program_id` is a real `programs` row, not the marketing site's category slug. Academy
 * can offer the actual catalogue because `programs_select_all` is `using (true)`, so the
 * picker shows what Bauhaven genuinely runs — and an approved application already knows
 * which programme to enrol them on, with nobody having to map a slug to a cohort.
 */
export const signUpSchema = z
  .object({
    name: z.string().trim().min(1, "Tell us your name").max(120, "That name is too long"),
    email: z.email("Enter a valid email address"),
    phone: z
      .string()
      .trim()
      .max(30, "That phone number is too long")
      .nullable()
      .transform((value) => (value === null || value === "" ? null : value)),
    program_id: z.uuid("Choose the programme you're applying for"),
    /** Why they're applying. What a reviewer reads before deciding. */
    message: z
      .string()
      .trim()
      .max(2000, "Keep it under 2000 characters")
      .nullable()
      .transform((value) => (value === null || value === "" ? null : value)),
    password: z.string().min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    // There is no password-reset flow yet, so a typo here is a locked account.
    error: "Those don't match",
    path: ["confirmPassword"],
  });

export type SignUpInput = z.infer<typeof signUpSchema>;

export const EMPTY_SIGN_UP: SignUpInput = {
  name: "",
  email: "",
  phone: null,
  // Not preselected — a default programme is the one everybody applies to by accident.
  program_id: "" as string,
  message: null,
  password: "",
  confirmPassword: "",
};
