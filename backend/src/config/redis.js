import IORedis from "ioredis";
import { env } from "./env.js";
import { logger } from "./logger.js";

/**
 * Redis is OPTIONAL in the foundation build. If it isn't configured, the app
 * still boots — features that need it (BullMQ, distributed rate limiting,
 * caching) simply stay dormant. When configured, connections are lazy and
 * non-fatal so a Redis blip never crashes the API.
 */

let client = null;

/**
 * Connection options shared by the shared client and by BullMQ.
 * `maxRetriesPerRequest: null` is REQUIRED by BullMQ.
 */
export function getRedisOptions() {
  if (!env.redis.isConfigured) return null;

  if (env.redis.url) {
    return { url: env.redis.url, maxRetriesPerRequest: null, enableReadyCheck: false };
  }
  return {
    host: env.redis.host,
    port: env.redis.port,
    password: env.redis.password || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

/** Build a new ioredis instance (used by BullMQ workers/queues that need isolation). */
export function createRedisConnection() {
  const opts = getRedisOptions();
  if (!opts) return null;
  return opts.url ? new IORedis(opts.url, opts) : new IORedis(opts);
}

/** Lazily create and return the shared app-wide Redis client. */
export function getRedisClient() {
  if (!env.redis.isConfigured) return null;
  if (client) return client;

  client = createRedisConnection();

  client.on("connect", () => logger.info("[redis] connected"));
  client.on("ready", () => logger.debug("[redis] ready"));
  client.on("error", (err) => logger.warn(`[redis] error: ${err.message}`));
  client.on("close", () => logger.warn("[redis] connection closed"));

  return client;
}

export async function connectRedis() {
  if (!env.redis.isConfigured) {
    logger.warn("[redis] not configured — skipping (set REDIS_URL to enable)");
    return null;
  }
  const c = getRedisClient();
  try {
    await c.ping();
    logger.info("[redis] ping OK");
  } catch (err) {
    logger.warn(`[redis] initial ping failed: ${err.message}`);
  }
  return c;
}

export async function disconnectRedis() {
  if (client) {
    await client.quit().catch(() => client.disconnect());
    client = null;
    logger.info("[redis] connection closed");
  }
}

export function isRedisReady() {
  return Boolean(client && client.status === "ready");
}

export default getRedisClient;
