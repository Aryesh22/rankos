import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { ApiError } from "../utils/ApiError.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt.util.js";
import { hashToken, generateJti } from "../utils/token.util.js";
import { refreshTokenRepository } from "../repositories/refreshToken.repository.js";
import { userRepository } from "../repositories/user.repository.js";

/**
 * Session service — issues, rotates and revokes JWT sessions.
 *
 * A session = one access token (short-lived, sent every request) + one refresh
 * token (long-lived, single-use, rotated). The refresh token is persisted
 * server-side by `jti` (hash only) so it can be revoked and reuse-detected:
 * presenting an already-revoked refresh token is treated as theft and revokes
 * the user's entire token family.
 */
const REMEMBER_ME_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function accessPayload(user) {
  return { sub: String(user._id), role: user.role, email: user.email ?? undefined };
}

/**
 * Issue a brand-new session for a user.
 * @param {{ user: any, req?: any, rememberMe?: boolean }} args
 * @returns {Promise<{ accessToken: string, refreshToken: string, refreshMaxAgeMs: number }>}
 */
export async function issueSession({ user, req, rememberMe = false }, session = null) {
  const jti = generateJti();
  const refreshMaxAgeMs = rememberMe ? REMEMBER_ME_TTL_MS : env.auth.refreshTtlMs;

  const accessToken = signAccessToken(accessPayload(user));
  const refreshToken = signRefreshToken({ sub: String(user._id), jti });

  await refreshTokenRepository.create(
    {
      user: user._id,
      jti,
      tokenHash: hashToken(refreshToken),
      userAgent: req?.headers?.["user-agent"] ?? null,
      ip: req?.ip ?? null,
      expiresAt: new Date(Date.now() + refreshMaxAgeMs),
    },
    session,
  );

  return { accessToken, refreshToken, refreshMaxAgeMs };
}

/**
 * Rotate a refresh token: validate it, revoke it, and issue a fresh pair.
 * Returns the resolved user too, so the caller can re-authenticate silently.
 * @param {string} rawRefreshToken
 * @returns {Promise<{ user: any, accessToken: string, refreshToken: string, refreshMaxAgeMs: number }>}
 */
export async function rotateSession(rawRefreshToken, req) {
  if (!rawRefreshToken) throw ApiError.unauthorized("Missing refresh token");

  const decoded = verifyRefreshToken(rawRefreshToken); // throws 401 on bad/expired
  const record = await refreshTokenRepository.findByJti(decoded.jti);

  if (!record || record.tokenHash !== hashToken(rawRefreshToken)) {
    throw ApiError.unauthorized("Invalid session");
  }

  // Reuse detection: a revoked token being presented again ⇒ likely theft.
  if (record.revokedAt) {
    logger.warn(`[auth] refresh token reuse detected for user ${record.user} — revoking all`);
    await refreshTokenRepository.revokeAllForUser(record.user);
    throw ApiError.unauthorized("Session revoked. Please sign in again.");
  }
  if (record.expiresAt.getTime() <= Date.now()) {
    throw ApiError.unauthorized("Session expired. Please sign in again.");
  }

  const user = await userRepository.findById(record.user);
  if (!user || !user.isActive) throw ApiError.unauthorized("Account unavailable");

  // Preserve the original lifetime window (approximate remember-me) on rotation.
  const remainingMs = record.expiresAt.getTime() - record.createdAt.getTime();
  const rememberMe = remainingMs > env.auth.refreshTtlMs + 1000;

  const next = await issueSession({ user, req, rememberMe });
  await refreshTokenRepository.revoke(decoded.jti, null);

  return { user, ...next };
}

/** Revoke a single session by its refresh token (logout). Idempotent. */
export async function revokeSession(rawRefreshToken) {
  if (!rawRefreshToken) return;
  try {
    const decoded = verifyRefreshToken(rawRefreshToken);
    await refreshTokenRepository.revoke(decoded.jti, null);
  } catch {
    // Already invalid/expired — logout is idempotent, nothing to do.
  }
}

export default { issueSession, rotateSession, revokeSession };
