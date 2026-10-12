import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import * as testsController from "../controllers/tests.controller.js";
import * as attemptsController from "../controllers/attempts.controller.js";

/**
 * Tests routes — Test Centre reads + attempt CREATION (API_SPEC.md → Pages
 * `/app/tests`, `/test/$testId`). Static paths precede `/:code` so they aren't
 * captured as a test code.
 */
const router = Router();

router.use(authenticate);
router.get("/stats", testsController.getStats);
router.post("/custom", testsController.createCustom);
router.get("/", testsController.listTests);
router.get("/:code", testsController.getByCode);
router.post("/:code/attempts", attemptsController.startAttempt);

export default router;
