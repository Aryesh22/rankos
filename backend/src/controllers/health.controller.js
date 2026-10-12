import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { env } from "../config/env.js";
import { getDatabaseState } from "../config/database.js";
import { isRedisReady } from "../config/redis.js";

const startedAt = Date.now();

/**
 * Liveness probe — is the process up? Cheap, no dependency checks.
 */
export const liveness = asyncHandler(async (_req, res) => {
  ApiResponse.ok(res, { status: "ok" }, "Service is alive");
});

/**
 * Readiness probe — are downstream dependencies usable?
 * Returns 200 only when MongoDB is connected; Redis is optional.
 */
export const readiness = asyncHandler(async (_req, res) => {
  const dbState = getDatabaseState();
  const dependencies = {
    mongodb: dbState,
    redis: env.redis.isConfigured ? (isRedisReady() ? "connected" : "unavailable") : "not-configured",
  };

  const ready = dbState === "connected";
  const payload = {
    status: ready ? "ready" : "not-ready",
    dependencies,
  };

  if (ready) {
    ApiResponse.ok(res, payload, "Service is ready");
  } else {
    res.status(503).json({
      success: false,
      message: "Service is not ready",
      data: payload,
    });
  }
});

/**
 * Detailed health/info — uptime, environment, memory. Handy for dashboards.
 */
export const health = asyncHandler(async (_req, res) => {
  const mem = process.memoryUsage();
  ApiResponse.ok(
    res,
    {
      service: env.app.name,
      status: "ok",
      environment: env.nodeEnv,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
      dependencies: {
        mongodb: getDatabaseState(),
        redis: env.redis.isConfigured
          ? isRedisReady()
            ? "connected"
            : "unavailable"
          : "not-configured",
      },
      memory: {
        rssMb: +(mem.rss / 1024 / 1024).toFixed(1),
        heapUsedMb: +(mem.heapUsed / 1024 / 1024).toFixed(1),
      },
      node: process.version,
    },
    "Health OK",
  );
});
