import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import * as attemptsController from "../controllers/attempts.controller.js";

/**
 * Attempts routes — test-attempt lifecycle (API_SPEC.md → `/test/$testId`,
 * `/app/results`). Attempt CREATION is under `/tests/:code/attempts`.
 */
const router = Router();

router.use(authenticate);
router.patch("/:attemptId/response", attemptsController.saveResponse);
router.post("/:attemptId/submit", attemptsController.submitAttempt);
router.get("/:attemptId/result", attemptsController.getResult);
router.post("/:attemptId/to-mistake-bank", attemptsController.toMistakeBank);
router.post("/:attemptId/schedule-revision", attemptsController.scheduleRevision);

export default router;
