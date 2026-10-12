import { Router } from "express";
import { authenticate, authorize } from "../middlewares/authenticate.js";
import * as parentController from "../controllers/parent.controller.js";

/**
 * Parent routes — the Parent View (API_SPEC.md → Page `/app/parent`). A student
 * may self-preview their own report, so `student` is allowed alongside parent/admin.
 */
const router = Router();

router.use(authenticate, authorize("parent", "admin", "student"));
router.get("/children", parentController.getChildren);
router.get("/report", parentController.getReport);

export default router;
