/**
 * Auth API surface — thin, typed wrappers over the `/api/auth/*` endpoints
 * documented in API_SPEC.md → "PART A". Every function returns the parsed
 * response body or throws {@link ApiError}.
 */
import { apiFetch } from "@/lib/api";
import type { AuthSession, SignupResult, User } from "@/types";
import type { ForgotPasswordValues, LoginValues, SignupValues } from "@/lib/auth-schemas";

export const authApi = {
  /** Create an unverified account and dispatch an OTP. */
  signup(values: SignupValues): Promise<SignupResult> {
    return apiFetch<SignupResult>("/auth/signup", { method: "POST", body: values });
  },

  /** Verify the 6-digit OTP for a signup and open a session. */
  verifyOtp(input: { userId: string; code: string; purpose?: string }): Promise<AuthSession> {
    return apiFetch<AuthSession>("/auth/verify-otp", {
      method: "POST",
      body: { purpose: "signup", ...input },
    });
  },

  /** Re-send the OTP; returns the new expiry window. */
  resendOtp(input: { userId: string; purpose?: string }): Promise<{ otpExpiresInSec: number }> {
    return apiFetch<{ otpExpiresInSec: number }>("/auth/resend-otp", {
      method: "POST",
      body: { purpose: "signup", ...input },
    });
  },

  /** Password login by email or mobile. */
  login(values: LoginValues): Promise<AuthSession> {
    return apiFetch<AuthSession>("/auth/login", { method: "POST", body: values });
  },

  /** Always resolves (200) to avoid user enumeration. */
  forgotPassword(values: ForgotPasswordValues): Promise<{ sent: boolean }> {
    return apiFetch<{ sent: boolean }>("/auth/forgot-password", {
      method: "POST",
      body: values,
    });
  },

  /** Consume a reset token and set a new password. */
  resetPassword(input: { token: string; newPassword: string }): Promise<{ reset: boolean }> {
    return apiFetch<{ reset: boolean }>("/auth/reset-password", {
      method: "POST",
      body: input,
    });
  },

  /** Resolve the current session user. Throws 401 when unauthenticated. */
  me(signal?: AbortSignal): Promise<User> {
    return apiFetch<User>("/auth/me", { signal });
  },

  /** Revoke the session (idempotent, 204). */
  logout(): Promise<void> {
    return apiFetch<void>("/auth/logout", { method: "POST" });
  },
};

/** Full URL that begins the OAuth redirect flow for a social provider. */
export function oauthUrl(provider: "google" | "apple"): string {
  const base = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/+$/, "");
  return `${base}/auth/oauth/${provider}`;
}
