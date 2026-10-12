import { env } from "../config/env.js";
import { HTTP_STATUS } from "../constants/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { setAuthCookies, clearAuthCookies, readRefreshCookie } from "../utils/cookie.util.js";
import * as authService from "../services/auth.service.js";
import { revokeSession } from "../services/session.service.js";

/**
 * Auth controller. Handlers stay thin — validate (middleware), call the service,
 * set/clear cookies, and emit the RAW response bodies documented in
 * API_SPEC.md → PART A (the frontend client reads these directly, NOT wrapped in
 * the ApiResponse envelope).
 */

/** Attach the session cookies, then send the `{ token, user }` body. */
function sendSession(res, status, { user, accessToken, refreshToken, refreshMaxAgeMs }) {
  setAuthCookies(res, { accessToken, refreshToken, refreshMaxAgeMs });
  return res.status(status).json({ token: accessToken, user });
}

// POST /auth/signup
export const signup = asyncHandler(async (req, res) => {
  const result = await authService.signup(req.body);
  res.status(HTTP_STATUS.CREATED).json(result);
});

// POST /auth/verify-otp
export const verifyOtp = asyncHandler(async (req, res) => {
  const session = await authService.verifyOtpAndLogin(req.body, req);
  sendSession(res, HTTP_STATUS.OK, session);
});

// POST /auth/resend-otp
export const resendOtp = asyncHandler(async (req, res) => {
  const result = await authService.resendOtp(req.body);
  res.status(HTTP_STATUS.OK).json(result);
});

// POST /auth/login
export const login = asyncHandler(async (req, res) => {
  const session = await authService.login(req.body, req);
  sendSession(res, HTTP_STATUS.OK, session);
});

// GET /auth/me
export const me = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user.id);
  res.status(HTTP_STATUS.OK).json(user);
});

// POST /auth/forgot-password  (always 200 — no user enumeration)
export const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.body);
  res.status(HTTP_STATUS.OK).json(result);
});

// POST /auth/reset-password
export const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(req.body);
  res.status(HTTP_STATUS.OK).json(result);
});

// POST /auth/logout  → 204
export const logout = asyncHandler(async (req, res) => {
  await revokeSession(readRefreshCookie(req));
  clearAuthCookies(res);
  res.status(HTTP_STATUS.NO_CONTENT).send();
});

/**
 * GET /auth/oauth/:provider — begin the OAuth flow.
 *
 * DEV-STUB: with no OAuth credentials configured, we can't perform a real
 * provider redirect. Instead we short-circuit to the callback with a
 * deterministic demo identity so the "Continue with Google/Apple" buttons work
 * end-to-end locally. Swap `redirectToProvider` in when credentials are set.
 */
export const oauthStart = asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const configured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  if (configured && provider === "google") {
    // Real flow would build the provider consent URL and redirect here.
    return res.redirect(buildGoogleConsentUrl(req));
  }

  // Dev stub: mint a demo identity and jump straight to the callback.
  const demoId = `demo-${provider}-user`;
  const params = new URLSearchParams({ stub: "1", providerId: demoId });
  return res.redirect(`${env.app.apiPrefix}/auth/oauth/${provider}/callback?${params.toString()}`);
});

// GET /auth/oauth/:provider/callback — finish OAuth, open a session, redirect to app.
export const oauthCallback = asyncHandler(async (req, res) => {
  const { provider } = req.params;

  // In the dev stub the identity comes from the query; a real integration would
  // exchange `code` for tokens and fetch the verified profile here.
  const providerId = req.query.providerId || `demo-${provider}-user`;
  const email =
    req.query.email || (provider === "google" ? "demo.google@rankos.app" : "demo.apple@rankos.app");
  const name = req.query.name || "Demo Google User";

  const session = await authService.loginWithProvider(
    { provider, providerId: String(providerId), email: String(email), name: String(name) },
    req,
  );
  setAuthCookies(res, session);
  // Land the user inside the app; the SSR guard will pick up the cookie session.
  return res.redirect(`${env.app.clientUrl}/app`);
});

function buildGoogleConsentUrl(req) {
  const redirectUri = `${req.protocol}://${req.get("host")}${env.app.apiPrefix}/auth/oauth/google/callback`;
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export default {
  signup,
  verifyOtp,
  resendOtp,
  login,
  me,
  forgotPassword,
  resetPassword,
  logout,
  oauthStart,
  oauthCallback,
};
