import { randomInt } from "node:crypto";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { ApiError } from "../utils/ApiError.js";
import { hashToken } from "../utils/token.util.js";
import { otpRepository } from "../repositories/otp.repository.js";
import { sendSms } from "./sms.service.js";

/**
 * OTP service — issue and verify one-time codes.
 *
 * - Codes are 6 digits, valid for OTP_TTL_MS, and stored only as a SHA-256 hash.
 * - Re-issuing invalidates prior active codes for the (user, purpose).
 * - Verification is attempt-limited (MAX_ATTEMPTS) and single-use.
 */
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes (matches API_SPEC otpExpiresInSec: 300)
const MAX_ATTEMPTS = 5;

export const OTP_EXPIRES_IN_SEC = OTP_TTL_MS / 1000;

function generateCode() {
  // 000000–999999, zero-padded → always 6 digits.
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * Issue a fresh OTP for a user+purpose and dispatch it over the channel.
 * @param {{ user: any, purpose: string, mobile?: string|null, channel?: string }} args
 * @returns {Promise<{ expiresInSec: number, channel: string }>}
 */
export async function issueOtp({ user, purpose, mobile = null, channel = "sms" }, session = null) {
  // Invalidate any outstanding codes first so only the newest is valid.
  await otpRepository.consumeAllActive(user._id ?? user, purpose, session);

  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  await otpRepository.create(
    { user: user._id ?? user, purpose, channel, codeHash: hashToken(code), expiresAt },
    session,
  );

  const to = mobile ?? user.mobile;
  if (to) {
    await sendSms({
      to,
      body: `Your RankOS verification code is ${code}. It expires in 5 minutes.`,
    });
  }
  // In non-production, also surface the code in logs for easy manual testing.
  if (!env.isProduction) {
    logger.info(`[otp] ${purpose} code for user ${user._id ?? user}: ${code}`);
  }

  return { expiresInSec: OTP_EXPIRES_IN_SEC, channel };
}

/**
 * Verify a submitted code. Throws ApiError(400/429) on failure; consumes the
 * OTP on success.
 * @returns {Promise<true>}
 */
export async function verifyOtp({ userId, purpose, code }, session = null) {
  const otp = await otpRepository.findLatestActive(userId, purpose, session);
  if (!otp) {
    throw ApiError.badRequest("Code expired or not found. Request a new one.", {
      code: "OTP_INVALID",
    });
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    await otpRepository.consume(otp._id, session);
    throw new ApiError(429, "Too many attempts. Request a new code.", { code: "OTP_LOCKED" });
  }
  if (otp.codeHash !== hashToken(String(code))) {
    await otpRepository.incrementAttempts(otp._id, session);
    throw ApiError.badRequest("Incorrect code. Please try again.", { code: "OTP_INCORRECT" });
  }
  await otpRepository.consume(otp._id, session);
  return true;
}

export default { issueOtp, verifyOtp, OTP_EXPIRES_IN_SEC };
