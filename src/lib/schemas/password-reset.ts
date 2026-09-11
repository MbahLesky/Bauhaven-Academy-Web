import { z } from "zod";

/**
 * The shortest password accepted anywhere in Academy. One constant, so the reset form and
 * any other password form can't drift apart.
 */
export const MIN_PASSWORD_LENGTH = 8;

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
    password: z.string().min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    error: "Those two don't match",
    path: ["confirmPassword"],
  });

export type NewPasswordInput = z.infer<typeof newPasswordSchema>;

export const EMPTY_NEW_PASSWORD: NewPasswordInput = { password: "", confirmPassword: "" };
