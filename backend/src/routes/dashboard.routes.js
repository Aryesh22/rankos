import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import * as dashboardController from "../controllers/dashboard.controller.js";

/** Dashboard routes — API_SPEC.md → Page `/app`. */
const router = Router();

router.use(authenticate);
router.get("/", dashboardController.getDashboard);

export default router;
