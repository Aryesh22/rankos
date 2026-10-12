import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { verifyAccessToken } from "../utils/jwt.util.js";
import {
  readAccessCookie,
  readRefreshCookie,
  setAuthCookies,
} from "../utils/cookie.util.js";
import { rotateSession } from "../services/session.service.js";

/** Extract a Bearer token from the Authorization header, if present. */
function bearerToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) return header.slice(7).trim();
  return null;
}

/**
 * Require a valid session. Resolution order:
 *   1. Verify the access token (Authorization header → access cookie).
 *   2. If it's missing/expired, attempt a SILENT REFRESH using the refresh
 *      cookie — rotate the session and set fresh cookies transparently. This is
 *      what gives the SSR frontend seamless session persistence: it only ever
 *      calls GET /auth/me, and expiry is healed here without any client change.
 *
 * On success `req.user = { id, role }`. Otherwise a 401 is thrown.
 */
export const authenticate = asyncHandler(async (req, res, next) => {
  const token = bearerToken(req) || readAccessCookie(req);
  if (token) {
    try {
      const decoded = verifyAccessToken(token);
      req.user = { id: decoded.sub, role: decoded.role };
      return next();
    } catch {
      // Access token invalid/expired — fall through to refresh.
    }
  }

  const refresh = readRefreshCookie(req);
  if (refresh) {
    const { user, accessToken, refreshToken, refreshMaxAgeMs } = await rotateSession(refresh, req);
    setAuthCookies(res, { accessToken, refreshToken, refreshMaxAgeMs });
    req.user = { id: String(user._id), role: user.role };
    return next();
  }

  throw ApiError.unauthorized("Authentication required");
});

/**
 * Best-effort authentication: attach `req.user` when a valid access token is
 * present, but never reject. Useful for endpoints with public + personalized
 * variants. Does not attempt a refresh.
 */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = bearerToken(req) || readAccessCookie(req);
  if (token) {
    try {
      const decoded = verifyAccessToken(token);
      req.user = { id: decoded.sub, role: decoded.role };
    } catch {
      /* ignore */
    }
  }
  next();
});

/**
 * Role-based authorization. Use AFTER `authenticate`.
 *   router.get("/admin", authenticate, authorize("admin"), handler)
 */
export function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized("Authentication required"));
    if (roles.length && !roles.includes(req.user.role)) {
      return next(ApiError.forbidden("You don't have access to this resource."));
    }
    next();
  };
}

export default authenticate;
