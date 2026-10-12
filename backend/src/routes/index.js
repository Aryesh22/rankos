import { Router } from "express";
import { env } from "../config/env.js";
import healthRoutes from "./health.routes.js";
import authRoutes from "./auth.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import tasksRoutes from "./tasks.routes.js";
import testsRoutes from "./tests.routes.js";
import attemptsRoutes from "./attempts.routes.js";
import mistakesRoutes from "./mistakes.routes.js";
import leaderboardRoutes from "./leaderboard.routes.js";
import profileRoutes from "./profile.routes.js";
import analyticsRoutes from "./analytics.routes.js";
import topicsRoutes from "./topics.routes.js";
import settingsRoutes from "./settings.routes.js";
import accountRoutes from "./account.routes.js";
import notificationsRoutes from "./notifications.routes.js";
import mentorRoutes from "./mentor.routes.js";
import parentRoutes from "./parent.routes.js";
import teacherRoutes from "./teacher.routes.js";
import uploadRoutes from "./upload.routes.js";
import plansRoutes from "./plans.routes.js";
import pomodoroRoutes from "./pomodoro.routes.js";
import aiRoutes from "./ai.routes.js";

/**
 * Root API router.
 *
 * API versioning: all feature routers live on a single `featureRouter`, mounted
 * BOTH at the un-versioned root (`/api/...`, the contract the frontend consumes
 * per API_SPEC.md) AND under `/api/v1/...`. New breaking versions can later be
 * mounted at `/api/v2` without disturbing existing clients.
 */
function buildFeatureRouter() {
  const router = Router();
  router.use("/", healthRoutes);
  router.use("/auth", authRoutes);
  // ── Feature routers ────────────────────────────────────────
  router.use("/dashboard", dashboardRoutes);
  router.use("/tasks", tasksRoutes);
  router.use("/tests", testsRoutes);
  router.use("/attempts", attemptsRoutes);
  router.use("/mistakes", mistakesRoutes);
  router.use("/leaderboard", leaderboardRoutes);
  router.use("/profile", profileRoutes);
  router.use("/analytics", analyticsRoutes);
  router.use("/topics", topicsRoutes);
  router.use("/settings", settingsRoutes);
  router.use("/account", accountRoutes);
  router.use("/notifications", notificationsRoutes);
  router.use("/mentor", mentorRoutes);
  router.use("/parent", parentRoutes);
  router.use("/teacher", teacherRoutes);
  router.use("/uploads", uploadRoutes);
  router.use("/plans", plansRoutes);
  router.use("/pomodoro", pomodoroRoutes);
  router.use("/ai", aiRoutes);
  return router;
}

const router = Router();

// Service metadata at the API root.
router.get("/", (_req, res) => {
  res.json({
    success: true,
    message: `${env.app.name} is running`,
    data: {
      name: env.app.name,
      environment: env.nodeEnv,
      versions: ["v1"],
      docs: env.swagger.enabled ? `${env.app.apiPrefix}/docs` : null,
    },
  });
});

const featureRouter = buildFeatureRouter();

// Un-versioned (frontend contract) + explicit v1 alias.
router.use("/", featureRouter);
router.use("/v1", featureRouter);

export default router;
