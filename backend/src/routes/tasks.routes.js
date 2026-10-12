import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import * as tasksController from "../controllers/tasks.controller.js";

/** Tasks routes — StudyTask CRUD (API_SPEC.md → Planner / Dashboard). */
const router = Router();

router.use(authenticate);
router.get("/", tasksController.listTasks);
router.post("/", tasksController.createTask);
router.patch("/:id", tasksController.patchTask);
router.delete("/:id", tasksController.deleteTask);

export default router;
