import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import * as analyticsController from "../controllers/analytics.controller.js";

/** Analytics routes — Exam DNA, score trend, heatmap (API_SPEC.md). */
const router = Router();

router.use(authenticate);
router.get("/exam-dna", analyticsController.getExamDna);
router.get("/score-trend", analyticsController.getScoreTrend);
router.get("/heatmap", analyticsController.getHeatmap);
router.get("/recommendations", analyticsController.getRecommendations);

export default router;
