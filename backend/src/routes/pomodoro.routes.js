import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import * as plansController from "../controllers/plans.controller.js";

/** Pomodoro route — log a focus session (API_SPEC.md → `POST /api/pomodoro`). */
const router = Router();

router.use(authenticate);
router.post("/", plansController.logPomodoro);

export default router;
