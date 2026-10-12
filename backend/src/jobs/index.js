import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { createQueue, getQueue, closeQueues } from "./queue.js";

/**
 * Job system bootstrap. In the foundation build there are no queues/workers to
 * start — this simply reports availability. Feature modules will call
 * `createQueue(name)` and register BullMQ Workers here as they are built.
 */
export function initJobs() {
  if (!env.redis.isConfigured) {
    logger.warn("[jobs] disabled — no Redis configured");
    return;
  }
  logger.info("[jobs] queue system ready (no queues registered yet)");
}

export { createQueue, getQueue, closeQueues };
export default initJobs;
