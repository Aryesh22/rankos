import { z } from "zod";
import { OTP_PURPOSES } from "../models/otp.model.js";

/**
 * Server-side auth validators. Field names + rules deliberately MIRROR the
 * frontend zod schemas (`rankos-ai-mentor/src/lib/auth-schemas.ts`) so the
 * same payloads validate on both ends and error `fields` map onto the forms.
 */

export const EXAM_OPTIONS = ["JEE", "NEET", "UPSC", "GATE", "CAT", "SSC", "Banking"];

const mobile = z
  .string()
  .trim()
  .min(1, "Mobile number is required")
  .regex(/^\+?[0-9\s-]{10,15}$/, "Enter a valid mobile number");

const password = z.string().min(8, "Use at least 8 characters").max(72, "Password is too long");

const objectId = z.string().trim().regex(/^[a-fA-F0-9]{24}$/, "Invalid id");

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  mobile,
  password,
  exam: z.enum(EXAM_OPTIONS),
});

export const verifyOtpSchema = z.object({
  userId: objectId,
  code: z
    .string()
    .trim()
    .length(6, "Enter the 6-digit code")
    .regex(/^[0-9]{6}$/, "Code must be 6 digits"),
  purpose: z.enum(OTP_PURPOSES).default("signup"),
});

export const resendOtpSchema = z.object({
  userId: objectId,
  purpose: z.enum(OTP_PURPOSES).default("signup"),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email or mobile"),
  password: z.string().min(1, "Enter your password"),
  rememberMe: z.boolean().optional().default(false),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, "Enter your email").email("Enter a valid email"),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, "Reset token is required"),
  newPassword: password,
});

export const oauthProviderSchema = z.object({
  provider: z.enum(["google", "apple"]),
});

export default {
  signupSchema,
  verifyOtpSchema,
  resendOtpSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  oauthProviderSchema,
};
