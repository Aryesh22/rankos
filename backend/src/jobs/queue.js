import { Queue } from "bullmq";
import { createRedisConnection } from "../config/redis.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

/**
 * BullMQ queue factory (INFRASTRUCTURE only). No concrete queues/workers are
 * defined in the foundation — features register their own via `createQueue`.
 * Every queue reuses a dedicated Redis connection (BullMQ requirement).
 */

const registry = new Map();

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 24 * 3600 },
};

/**
 * Create (or return the cached) queue by name.
 * @param {string} name
 * @returns {import("bullmq").Queue | null}  null when Redis isn't configured.
 */
export function createQueue(name) {
  if (!env.redis.isConfigured) {
    logger.warn(`[jobs] Redis not configured — queue "${name}" unavailable`);
    return null;
  }
  if (registry.has(name)) return registry.get(name);

  const connection = createRedisConnection();
  const queue = new Queue(name, { connection, defaultJobOptions });
  queue.on("error", (err) => logger.warn(`[jobs] queue "${name}" error: ${err.message}`));

  registry.set(name, queue);
  logger.info(`[jobs] queue registered: ${name}`);
  return queue;
}

export function getQueue(name) {
  return registry.get(name) || null;
}

/** Gracefully close all queues (called on shutdown). */
export async function closeQueues() {
  await Promise.all(
    [...registry.values()].map((q) => q.close().catch(() => undefined)),
  );
  registry.clear();
}

export default createQueue;
