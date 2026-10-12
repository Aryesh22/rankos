import { env } from "../config/env.js";
import { COOKIE_NAMES } from "../constants/tokens.js";

/**
 * Cookie utility for auth tokens. Tokens are delivered as httpOnly cookies so
 * they are never readable by JavaScript (mitigates XSS token theft). `secure`
 * is on in production (HTTPS only) and `sameSite` defaults to `lax` to blunt CSRF.
 *
 * The refresh cookie is scoped to the refresh/logout paths so it isn't sent on
 * every request — only where it's actually needed.
 */

// Scope the refresh cookie to the auth mount point (`/api/auth`) so it is sent
// only to the refresh/logout endpoints — never on every API request. This must
// match where the auth router is actually mounted (see routes/index.js).
const REFRESH_COOKIE_PATH = `${env.app.apiPrefix}/auth`;

function baseOptions(maxAgeMs, path = "/") {
  return {
    httpOnly: true,
    secure: env.cookie.secure,
    sameSite: env.cookie.sameSite,
    domain: env.cookie.domain,
    path,
    maxAge: maxAgeMs,
  };
}

/**
 * Set both auth cookies on the response.
 * @param {import("express").Response} res
 * @param {{ accessToken: string, refreshToken: string, refreshMaxAgeMs?: number }} tokens
 *   `refreshMaxAgeMs` overrides the refresh-cookie lifetime (e.g. "remember me").
 */
export function setAuthCookies(res, { accessToken, refreshToken, refreshMaxAgeMs }) {
  res.cookie(COOKIE_NAMES.ACCESS, accessToken, baseOptions(env.auth.accessTtlMs, "/"));
  res.cookie(
    COOKIE_NAMES.REFRESH,
    refreshToken,
    baseOptions(refreshMaxAgeMs ?? env.auth.refreshTtlMs, REFRESH_COOKIE_PATH),
  );
}

/**
 * Clear both auth cookies (logout / account deletion). Options (except maxAge)
 * must match those used when setting, or the browser won't remove them.
 * @param {import("express").Response} res
 */
export function clearAuthCookies(res) {
  const common = { httpOnly: true, secure: env.cookie.secure, sameSite: env.cookie.sameSite, domain: env.cookie.domain };
  res.clearCookie(COOKIE_NAMES.ACCESS, { ...common, path: "/" });
  res.clearCookie(COOKIE_NAMES.REFRESH, { ...common, path: REFRESH_COOKIE_PATH });
}

/** Read the refresh token from the request cookie (if present). */
export function readRefreshCookie(req) {
  return req.cookies?.[COOKIE_NAMES.REFRESH] || null;
}

/** Read the access token from the cookie (fallback when no Authorization header). */
export function readAccessCookie(req) {
  return req.cookies?.[COOKIE_NAMES.ACCESS] || null;
}

export default { setAuthCookies, clearAuthCookies, readRefreshCookie, readAccessCookie };
