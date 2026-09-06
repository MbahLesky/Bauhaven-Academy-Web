import { z } from "zod";
import { MIN_PASSWORD_LENGTH } from "./signup";

// Its own module for the reason every schema here is: a "use server" file can only export
// async functions, and a schema exported from one silently isn't the real schema by the
// time a client component imports it.

export const requestResetSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
});

export type RequestResetInput = z.infer<typeof requestResetSchema>;

export const EMPTY_REQUEST_RESET: RequestResetInput = { email: "" };

export const newPasswordSchema = z
  .object({
    // The same floor sign-up applies, imported rather than repeated — two copies of a
    // number like this drift, and the pair that disagrees is the one nobody notices.
    password: z.string().min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    error: "Those two don't match",
    path: ["confirmPassword"],
  });

export type NewPasswordInput = z.infer<typeof newPasswordSchema>;

export const EMPTY_NEW_PASSWORD: NewPasswordInput = { password: "", confirmPassword: "" };
