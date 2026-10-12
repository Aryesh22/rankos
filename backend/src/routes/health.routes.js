import { Router } from "express";
import { health, liveness, readiness } from "../controllers/health.controller.js";

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Detailed health & service info
 *     description: Uptime, environment, dependency states and memory usage.
 *     responses:
 *       200:
 *         description: Service healthy
 */
router.get("/health", health);

/**
 * @openapi
 * /health/live:
 *   get:
 *     tags: [Health]
 *     summary: Liveness probe
 *     description: Returns 200 if the process is running. Used by orchestrators.
 *     responses:
 *       200:
 *         description: Alive
 */
router.get("/health/live", liveness);

/**
 * @openapi
 * /health/ready:
 *   get:
 *     tags: [Health]
 *     summary: Readiness probe
 *     description: Returns 200 only when required dependencies (MongoDB) are ready.
 *     responses:
 *       200:
 *         description: Ready
 *       503:
 *         description: Not ready
 */
router.get("/health/ready", readiness);

export default router;
