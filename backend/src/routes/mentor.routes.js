import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import * as mentorController from "../controllers/mentor.controller.js";

/** Mentor routes — the AI Mentor dock (API_SPEC.md → `AiChatDock`). */
const router = Router();

router.use(authenticate);
router.get("/messages", mentorController.getMessages);
router.post("/chat", mentorController.chat);

export default router;
