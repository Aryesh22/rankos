import { rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { getRedisClient, isRedisReady } from "../config/redis.js";
import { HTTP_STATUS, ERROR_CODES } from "../constants/index.js";

/**
 * Global rate limiter. Uses a Redis-backed store when Redis is available (so
 * limits are shared across instances); otherwise falls back to the default
 * in-memory store — fine for a single-node foundation build.
 */
function buildStore() {
  if (!env.redis.isConfigured || !isRedisReady()) return undefined;
  const client = getRedisClient();
  if (!client) return undefined;
  logger.info("[rate-limit] using Redis store");
  return new RedisStore({
    sendCommand: (...args) => client.call(...args),
    prefix: "rl:",
  });
}

export function createRateLimiter(overrides = {}) {
  return rateLimit({
    windowMs: env.rateLimit.windowMs,
    max: env.rateLimit.max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    store: buildStore(),
    message: {
      success: false,
      error: {
        code: ERROR_CODES.RATE_LIMITED,
        message: "Too many requests, please try again later.",
      },
    },
    statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
    ...overrides,
  });
}

/** Default global limiter instance. */
export const globalRateLimiter = createRateLimiter();

export default globalRateLimiter;
