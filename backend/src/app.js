import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import morgan from "morgan";

import { env } from "./config/env.js";
import { morganStream } from "./config/logger.js";
import { mountSwagger } from "./config/swagger.js";
import { APP } from "./constants/index.js";
import { requestId } from "./middlewares/requestId.js";
import { sanitize } from "./middlewares/sanitize.js";
import { globalRateLimiter } from "./middlewares/rateLimiter.js";
import { notFound } from "./middlewares/notFound.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import apiRouter from "./routes/index.js";

/**
 * Build and configure the Express application.
 * Exported WITHOUT starting a server so it can be imported by tests.
 */
export function createApp() {
  const app = express();

  // Trust the first proxy (needed for correct client IPs behind LB/nginx,
  // and for express-rate-limit to key on the real IP).
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  // ── Security & correlation ─────────────────────────────────
  app.use(requestId);
  app.use(helmet());
  app.use(
    cors({
      origin: env.cors.origin,
      credentials: env.cors.credentials,
    }),
  );

  // ── Body parsing & cookies ─────────────────────────────────
  app.use(express.json({ limit: APP.JSON_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: APP.JSON_BODY_LIMIT }));
  app.use(cookieParser());

  // ── Input sanitization (NoSQL injection / prototype pollution) ─
  app.use(sanitize);

  // ── Performance ────────────────────────────────────────────
  app.use(compression());

  // ── HTTP request logging (through Winston) ─────────────────
  app.use(
    morgan(env.isProduction ? "combined" : "dev", {
      stream: morganStream,
      skip: (req) => req.path === `${env.app.apiPrefix}/health/live`,
    }),
  );

  // ── Rate limiting (applied to the API surface) ─────────────
  app.use(env.app.apiPrefix, globalRateLimiter);

  // ── API docs (Swagger) ─────────────────────────────────────
  mountSwagger(app);

  // ── Routes ─────────────────────────────────────────────────
  app.use(env.app.apiPrefix, apiRouter);

  // Bare root → friendly redirect to the API root.
  app.get("/", (_req, res) => res.redirect(env.app.apiPrefix));

  // ── 404 + centralized error handling (must be last) ────────
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
export default app;
