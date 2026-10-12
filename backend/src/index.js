import http from "node:http";

import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { connectRedis, disconnectRedis } from "./config/redis.js";
import { configureCloudinary } from "./config/cloudinary.js";
import { verifyEmailTransport } from "./services/email.service.js";
import { initJobs, closeQueues } from "./jobs/index.js";
import { initSockets, closeSockets } from "./sockets/index.js";

const server = http.createServer(app);
let shuttingDown = false;

async function bootstrap() {
  // 1) Required dependency — MongoDB (fails fast if unreachable).
  await connectDatabase();

  // 2) Optional dependencies — never fatal in the foundation build.
  await connectRedis();
  configureCloudinary();
  await verifyEmailTransport();
  initJobs();

  // 3) Realtime layer.
  initSockets(server);

  // 4) Start listening.
  server.listen(env.app.port, () => {
    logger.info(
      `[server] ${env.app.name} listening on :${env.app.port} ` +
        `(${env.nodeEnv}) — API at ${env.app.apiPrefix}`,
    );
    if (env.swagger.enabled) {
      logger.info(`[server] docs → http://localhost:${env.app.port}${env.app.apiPrefix}/docs`);
    }
  });
}

/**
 * Graceful shutdown: stop accepting connections, then close resources.
 */
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`[server] ${signal} received — shutting down gracefully`);

  // Force-exit if cleanup hangs.
  const forceTimer = setTimeout(() => {
    logger.error("[server] forced shutdown (cleanup timed out)");
    process.exit(1);
  }, 10000);
  forceTimer.unref();

  server.close(async () => {
    try {
      await closeSockets();
      await closeQueues();
      await disconnectRedis();
      await disconnectDatabase();
      logger.info("[server] shutdown complete");
      clearTimeout(forceTimer);
      process.exit(0);
    } catch (err) {
      logger.error(`[server] error during shutdown: ${err.message}`);
      process.exit(1);
    }
  });
}

// ── Process-level safety nets ────────────────────────────────
process.on("unhandledRejection", (reason) => {
  logger.error(`[process] unhandledRejection: ${reason?.stack || reason}`);
});
process.on("uncaughtException", (err) => {
  logger.error(`[process] uncaughtException: ${err.stack || err.message}`);
  shutdown("uncaughtException");
});
["SIGTERM", "SIGINT"].forEach((sig) => process.on(sig, () => shutdown(sig)));

bootstrap().catch((err) => {
  logger.error(`[server] failed to start: ${err.stack || err.message}`);
  process.exit(1);
});

export { server };
