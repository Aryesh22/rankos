/**
 * Zod schemas shared by the auth forms (react-hook-form resolvers) and,
 * once the backend lands, reusable server-side. Field names mirror the
 * request bodies in API_SPEC.md → "PART A — Authentication & Session".
 */
import { z } from "zod";

export const EXAM_OPTIONS = ["JEE", "NEET", "UPSC", "GATE", "CAT", "SSC", "Banking"] as const;

/** Accepts Indian mobile numbers with an optional +country prefix. */
const mobileSchema = z
  .string()
  .trim()
  .min(1, "Mobile number is required")
  .regex(/^\+?[0-9\s-]{10,15}$/, "Enter a valid mobile number");

const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Password is too long");

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email or mobile"),
  password: z.string().min(1, "Enter your password"),
  // Default is supplied by the form's `defaultValues` — keeping the schema field
  // required avoids react-hook-form input/output resolver type friction.
  rememberMe: z.boolean(),
});

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  mobile: mobileSchema,
  password: passwordSchema,
  exam: z.enum(EXAM_OPTIONS),
});

export const otpSchema = z.object({
  code: z
    .string()
    .length(6, "Enter the 6-digit code")
    .regex(/^[0-9]{6}$/, "Code must be 6 digits"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, "Enter your email").email("Enter a valid email"),
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type SignupValues = z.infer<typeof signupSchema>;
export type OtpValues = z.infer<typeof otpSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
