import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { validate } from "../middlewares/validate.js";
import { authenticate } from "../middlewares/authenticate.js";
import { createRateLimiter } from "../middlewares/rateLimiter.js";
import {
  signupSchema,
  verifyOtpSchema,
  resendOtpSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  oauthProviderSchema,
} from "../validators/auth.validator.js";

/**
 * Auth routes — backs API_SPEC.md → PART A. Sensitive credential/OTP endpoints
 * get a stricter rate limiter than the global one to blunt brute-force + SMS
 * flooding.
 */
const router = Router();

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30, // per IP / 15 min across auth mutations
});

router.post("/signup", authLimiter, validate({ body: signupSchema }), authController.signup);
router.post("/verify-otp", authLimiter, validate({ body: verifyOtpSchema }), authController.verifyOtp);
router.post("/resend-otp", authLimiter, validate({ body: resendOtpSchema }), authController.resendOtp);
router.post("/login", authLimiter, validate({ body: loginSchema }), authController.login);
router.post(
  "/forgot-password",
  authLimiter,
  validate({ body: forgotPasswordSchema }),
  authController.forgotPassword,
);
router.post(
  "/reset-password",
  authLimiter,
  validate({ body: resetPasswordSchema }),
  authController.resetPassword,
);

router.get("/me", authenticate, authController.me);
router.post("/logout", authController.logout);

// OAuth (Google/Apple) — redirect start + callback.
router.get("/oauth/:provider", validate({ params: oauthProviderSchema }), authController.oauthStart);
router.get(
  "/oauth/:provider/callback",
  validate({ params: oauthProviderSchema }),
  authController.oauthCallback,
);

export default router;
