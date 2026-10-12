import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { TOKEN_TYPES } from "../constants/tokens.js";
import { ApiError } from "./ApiError.js";

/**
 * JWT utility. Two independently-signed token families:
 *   - ACCESS  : short-lived, sent on every request (Authorization header / cookie)
 *   - REFRESH : long-lived, single-use, rotated; carries a `jti` so the server
 *               can track and revoke individual refresh tokens.
 * Each token embeds a `type` claim to prevent an access token being replayed as
 * a refresh token (and vice-versa).
 */

const baseVerifyOptions = {
  issuer: env.auth.issuer,
  audience: env.auth.audience,
};

/**
 * Sign an access token.
 * @param {{ sub: string, role: string, email?: string }} payload
 * @returns {string}
 */
export function signAccessToken(payload) {
  return jwt.sign({ ...payload, type: TOKEN_TYPES.ACCESS }, env.auth.accessSecret, {
    expiresIn: env.auth.accessExpires,
    issuer: env.auth.issuer,
    audience: env.auth.audience,
  });
}

/**
 * Sign a refresh token. `jti` uniquely identifies this token server-side.
 * @param {{ sub: string, jti: string }} payload
 * @returns {string}
 */
export function signRefreshToken(payload) {
  return jwt.sign({ ...payload, type: TOKEN_TYPES.REFRESH }, env.auth.refreshSecret, {
    expiresIn: env.auth.refreshExpires,
    issuer: env.auth.issuer,
    audience: env.auth.audience,
  });
}

/**
 * Verify an access token. Throws ApiError(401) on any failure.
 * @param {string} token
 * @returns {{ sub: string, role: string, type: string, iat: number, exp: number }}
 */
export function verifyAccessToken(token) {
  return verify(token, env.auth.accessSecret, TOKEN_TYPES.ACCESS);
}

/**
 * Verify a refresh token. Throws ApiError(401) on any failure.
 * @param {string} token
 * @returns {{ sub: string, jti: string, type: string, iat: number, exp: number }}
 */
export function verifyRefreshToken(token) {
  return verify(token, env.auth.refreshSecret, TOKEN_TYPES.REFRESH);
}

/** Internal: verify signature/expiry and assert the expected token type. */
function verify(token, secret, expectedType) {
  let decoded;
  try {
    decoded = jwt.verify(token, secret, baseVerifyOptions);
  } catch (err) {
    // Map jsonwebtoken errors to a uniform, non-leaky 401.
    const message =
      err.name === "TokenExpiredError" ? "Token has expired" : "Invalid or malformed token";
    throw ApiError.unauthorized(message, { cause: err });
  }
  if (decoded.type !== expectedType) {
    throw ApiError.unauthorized("Invalid token type");
  }
  return decoded;
}

export default {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
