import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import * as plansController from "../controllers/plans.controller.js";

/** Plans routes — AI planner read + generate (API_SPEC.md → Page `/app/planner`). */
const router = Router();

router.use(authenticate);
router.get("/", plansController.getPlans);
router.post("/generate", plansController.generatePlan);

export default router;
