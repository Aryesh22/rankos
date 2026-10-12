import dotenv from "dotenv";

// Load .env into process.env (no-op if the file is absent, e.g. in Docker
// where vars are injected by the runtime).
dotenv.config();

/**
 * Small, dependency-free environment loader + validator.
 * - Fails fast (process.exit) when a REQUIRED variable is missing.
 * - Coerces types (number/boolean/list) so the rest of the app reads clean values.
 */

const REQUIRED = ["MONGODB_URI"];

function ensureRequired() {
  const missing = REQUIRED.filter((key) => !process.env[key] || process.env[key].trim() === "");
  if (missing.length > 0) {
    // Logger may not be initialised yet — use console here intentionally.
    console.error(
      `\n[env] Missing required environment variable(s): ${missing.join(", ")}\n` +
        `[env] Copy .env.example to .env and fill them in.\n`,
    );
    process.exit(1);
  }
}

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function list(value, fallback = []) {
  if (!value) return fallback;
  return String(value)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Convert a duration like "15m" / "7d" / "30s" / "3600" (ms) to milliseconds. */
function durationMs(value, fallbackMs) {
  if (value === undefined || value === null || value === "") return fallbackMs;
  const match = String(value)
    .trim()
    .match(/^(\d+)\s*(ms|s|m|h|d)?$/i);
  if (!match) return fallbackMs;
  const amount = Number(match[1]);
  const unit = (match[2] || "ms").toLowerCase();
  const multipliers = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return amount * multipliers[unit];
}

ensureRequired();

const NODE_ENV = process.env.NODE_ENV || "development";

// In production, JWT secrets MUST be explicitly set — never ship the dev defaults.
if (NODE_ENV === "production") {
  const missingSecrets = ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"].filter(
    (key) => !process.env[key],
  );
  if (missingSecrets.length > 0) {
    console.error(
      `\n[env] Missing required production secret(s): ${missingSecrets.join(", ")}\n`,
    );
    process.exit(1);
  }

  // Never ship the dev placeholder secrets to production.
  const weakSecrets = ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"].filter((key) =>
    /change-me|dev-/.test(process.env[key] || ""),
  );
  if (weakSecrets.length > 0) {
    console.error(
      `\n[env] Insecure default secret(s) in production: ${weakSecrets.join(", ")}. ` +
        `Generate strong values (openssl rand -base64 48).\n`,
    );
    process.exit(1);
  }

  // SameSite=None cookies REQUIRE Secure, or browsers drop them.
  if (
    (process.env.COOKIE_SAME_SITE || "lax").toLowerCase() === "none" &&
    !bool(process.env.COOKIE_SECURE, true)
  ) {
    console.error("\n[env] COOKIE_SAME_SITE=none requires COOKIE_SECURE=true.\n");
    process.exit(1);
  }
}

export const env = Object.freeze({
  nodeEnv: NODE_ENV,
  isProduction: NODE_ENV === "production",
  isDevelopment: NODE_ENV === "development",
  isTest: NODE_ENV === "test",

  app: {
    name: process.env.APP_NAME || "RankOS API",
    port: num(process.env.PORT, 8080),
    apiPrefix: process.env.API_PREFIX || "/api",
    clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  },

  mongo: {
    uri: process.env.MONGODB_URI,
  },

  cors: {
    origin: process.env.CORS_ORIGIN === "*" ? "*" : list(process.env.CORS_ORIGIN, ["*"]),
    credentials: bool(process.env.CORS_CREDENTIALS, true),
  },

  rateLimit: {
    windowMs: num(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: num(process.env.RATE_LIMIT_MAX, 300),
  },

  log: {
    level: process.env.LOG_LEVEL || (NODE_ENV === "production" ? "info" : "debug"),
    dir: process.env.LOG_DIR || "logs",
  },

  redis: {
    url: process.env.REDIS_URL || null,
    host: process.env.REDIS_HOST || null,
    port: num(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD || null,
    get isConfigured() {
      return Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);
    },
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || null,
    apiKey: process.env.CLOUDINARY_API_KEY || null,
    apiSecret: process.env.CLOUDINARY_API_SECRET || null,
    get isConfigured() {
      return Boolean(
        process.env.CLOUDINARY_CLOUD_NAME &&
          process.env.CLOUDINARY_API_KEY &&
          process.env.CLOUDINARY_API_SECRET,
      );
    },
  },

  smtp: {
    host: process.env.SMTP_HOST || null,
    port: num(process.env.SMTP_PORT, 587),
    secure: bool(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER || null,
    password: process.env.SMTP_PASSWORD || null,
    from: process.env.EMAIL_FROM || "RankOS <no-reply@rankos.app>",
    get isConfigured() {
      return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
    },
  },

  swagger: {
    enabled: bool(process.env.SWAGGER_ENABLED, true),
  },

  auth: {
    bcryptRounds: num(process.env.BCRYPT_SALT_ROUNDS, 12),
    accessSecret: process.env.JWT_ACCESS_SECRET || "dev-access-secret-change-me",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "dev-refresh-secret-change-me",
    accessExpires: process.env.JWT_ACCESS_EXPIRES || "15m",
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || "7d",
    accessTtlMs: durationMs(process.env.JWT_ACCESS_EXPIRES, 15 * 60 * 1000),
    refreshTtlMs: durationMs(process.env.JWT_REFRESH_EXPIRES, 7 * 86400000),
    issuer: process.env.JWT_ISSUER || "rankos.api",
    audience: process.env.JWT_AUDIENCE || "rankos.client",
    emailVerifyTtlMs: durationMs(process.env.EMAIL_VERIFY_EXPIRES, 24 * 3600000),
    passwordResetTtlMs: durationMs(process.env.PASSWORD_RESET_EXPIRES, 30 * 60000),
  },

  cookie: {
    domain: process.env.COOKIE_DOMAIN || undefined,
    secure: bool(process.env.COOKIE_SECURE, NODE_ENV === "production"),
    sameSite: process.env.COOKIE_SAME_SITE || "lax",
  },
});

export default env;
