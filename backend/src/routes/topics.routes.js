import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import * as topicsController from "../controllers/topics.controller.js";

/** Topics routes — mastery graph + revision history (API_SPEC.md). */
const router = Router();

router.use(authenticate);
router.get("/graph", topicsController.getGraph);
router.get("/:id/revisions", topicsController.getRevisions);
router.post("/:id/practice", topicsController.practice);
router.get("/:id/notes", topicsController.getNotes);
router.post("/:id/notes", topicsController.generateNotes);

export default router;
