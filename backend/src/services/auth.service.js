import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { ROLES } from "../constants/roles.js";
import { ApiError } from "../utils/ApiError.js";
import { withTransaction } from "../utils/transaction.util.js";
import { hashPassword, verifyPassword } from "../utils/password.util.js";
import { generateOpaqueToken, hashToken } from "../utils/token.util.js";
import { examLabelFor, examYearFor } from "../utils/exam.util.js";
import { userRepository } from "../repositories/user.repository.js";
import { profileRepository } from "../repositories/profile.repository.js";
import { passwordResetTokenRepository } from "../repositories/passwordResetToken.repository.js";
import { issueOtp, verifyOtp as verifyOtpCode, OTP_EXPIRES_IN_SEC } from "./otp.service.js";
import { issueSession } from "./session.service.js";
import { sendMail } from "./email.service.js";
import { presentAuthUser } from "../presenters/user.presenter.js";

/**
 * Auth service — orchestrates the full authentication surface documented in
 * API_SPEC.md → PART A. Controllers stay thin: they validate input, call one of
 * these methods, and translate the result into the raw response bodies + cookies
 * the frontend expects.
 */

/** Create an unverified mobile account and dispatch a signup OTP. */
export async function signup({ name, mobile, password, exam }) {
  if (await userRepository.existsByMobile(mobile)) {
    throw ApiError.conflict("An account with this mobile number already exists.", {
      code: "MOBILE_TAKEN",
      fields: { mobile: "This mobile number is already registered." },
    });
  }

  const passwordHash = await hashPassword(password);

  const user = await withTransaction(async (session) => {
    const created = await userRepository.create(
      { fullName: name, mobile, passwordHash, exam, role: ROLES.STUDENT },
      session,
    );
    await profileRepository.create(
      {
        user: created._id,
        exam,
        examLabel: examLabelFor(exam),
        targetYear: examYearFor(exam),
      },
      session,
    );
    await issueOtp({ user: created, purpose: "signup", mobile }, session);
    return created;
  });

  return {
    userId: String(user._id),
    otpChannel: "sms",
    otpExpiresInSec: OTP_EXPIRES_IN_SEC,
    nextStep: "verify-otp",
  };
}

/** Verify a signup/login OTP and open a session. */
export async function verifyOtpAndLogin({ userId, code, purpose = "signup" }, req) {
  await verifyOtpCode({ userId, purpose, code });

  const user = await userRepository.findById(userId);
  if (!user || !user.isActive) throw ApiError.notFound("Account not found");

  if (!user.isMobileVerified) await userRepository.markMobileVerified(userId);
  await userRepository.touchLastLogin(userId);

  const tokens = await issueSession({ user, req, rememberMe: true });
  const profile = await profileRepository.findByUser(user._id);
  return { user: presentAuthUser(user, profile), ...tokens };
}

/** Re-issue a fresh OTP (resend button). */
export async function resendOtp({ userId, purpose = "signup" }) {
  const user = await userRepository.findById(userId);
  if (!user) throw ApiError.notFound("Account not found");
  const { expiresInSec } = await issueOtp({ user, purpose, mobile: user.mobile });
  return { otpExpiresInSec: expiresInSec };
}

/** Password login by email or mobile. */
export async function login({ identifier, password, rememberMe = false }, req) {
  const user = await userRepository.findByIdentifierWithPassword(identifier);
  // Uniform error to avoid revealing whether the account exists.
  const invalid = () =>
    ApiError.unauthorized("Incorrect email/mobile or password.", { code: "INVALID_CREDENTIALS" });

  if (!user || !user.passwordHash) throw invalid();
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw invalid();
  if (!user.isActive) throw ApiError.forbidden("This account has been disabled.");

  await userRepository.touchLastLogin(user._id);
  const tokens = await issueSession({ user, req, rememberMe });
  const profile = await profileRepository.findByUser(user._id);
  return { user: presentAuthUser(user, profile), ...tokens };
}

/** Resolve the current session user for GET /auth/me. */
export async function getMe(userId) {
  const user = await userRepository.findById(userId);
  if (!user || !user.isActive) throw ApiError.unauthorized("Session invalid");
  const profile = await profileRepository.findByUser(user._id);
  return presentAuthUser(user, profile);
}

/**
 * Begin a password reset. ALWAYS resolves (no user enumeration). When the email
 * matches an account we generate a single-use token and email the reset link.
 */
export async function forgotPassword({ email }) {
  const user = await userRepository.findByEmail(email);
  if (user) {
    await passwordResetTokenRepository.invalidateAllForUser(user._id);
    const { token, tokenHash } = generateOpaqueToken();
    await passwordResetTokenRepository.create({
      user: user._id,
      tokenHash,
      expiresAt: new Date(Date.now() + env.auth.passwordResetTtlMs),
    });
    const link = `${env.app.clientUrl}/reset-password?token=${token}`;
    await sendMail({
      to: email,
      subject: "Reset your RankOS password",
      text: `Reset your password using this link (valid 30 minutes): ${link}`,
      html: `<p>Reset your RankOS password using the link below (valid 30 minutes):</p>
             <p><a href="${link}">${link}</a></p>
             <p>If you didn't request this, you can safely ignore this email.</p>`,
    });
    if (!env.isProduction) logger.info(`[auth] password reset link for ${email}: ${link}`);
  }
  return { sent: true };
}

/** Consume a reset token and set a new password; revokes all existing sessions. */
export async function resetPassword({ token, newPassword }) {
  const record = await passwordResetTokenRepository.findActiveByHash(hashToken(token));
  if (!record) {
    throw ApiError.badRequest("This reset link is invalid or has expired.", {
      code: "RESET_TOKEN_INVALID",
    });
  }
  const passwordHash = await hashPassword(newPassword);
  await withTransaction(async (session) => {
    await userRepository.updatePassword(record.user, passwordHash, session);
    await passwordResetTokenRepository.consume(record._id, session);
  });
  // Force re-login everywhere for safety (done outside the txn — best effort).
  const { refreshTokenRepository } = await import("../repositories/refreshToken.repository.js");
  await refreshTokenRepository.revokeAllForUser(record.user);
  return { reset: true };
}

/**
 * Find-or-create a user from a verified OAuth identity, then open a session.
 * `profile` = { provider, providerId, email, name }.
 */
export async function loginWithProvider(profileData, req) {
  const { provider, providerId, email, name } = profileData;
  let user = await userRepository.findByProvider(provider, providerId);

  if (!user && email) {
    // Link the social identity to an existing email account if present.
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      user = await userRepository.addAuthProvider(existing._id, { provider, providerId, email });
    }
  }

  if (!user) {
    user = await withTransaction(async (session) => {
      const created = await userRepository.create(
        {
          fullName: name || "RankOS User",
          email: email || null,
          isEmailVerified: Boolean(email),
          role: ROLES.STUDENT,
          authProviders: [{ provider, providerId, email: email || null }],
        },
        session,
      );
      await profileRepository.create({ user: created._id }, session);
      return created;
    });
  }

  await userRepository.touchLastLogin(user._id);
  const tokens = await issueSession({ user, req, rememberMe: true });
  const profile = await profileRepository.findByUser(user._id);
  return { user: presentAuthUser(user, profile), ...tokens };
}

export default {
  signup,
  verifyOtpAndLogin,
  resendOtp,
  login,
  getMe,
  forgotPassword,
  resetPassword,
  loginWithProvider,
};
