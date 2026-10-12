import { Router } from "express";
import { authenticate, authorize } from "../middlewares/authenticate.js";
import * as teacherController from "../controllers/teacher.controller.js";

/** Teacher routes — the Teacher View (API_SPEC.md → Page `/app/teacher`). */
const router = Router();

router.use(authenticate, authorize("teacher", "admin"));
router.get("/overview", teacherController.getOverview);
router.get("/batches", teacherController.getBatches);
router.get("/assignments", teacherController.getAssignments);
router.post("/assignments", teacherController.createAssignment);
router.get("/leaderboard", teacherController.getLeaderboard);

export default router;
