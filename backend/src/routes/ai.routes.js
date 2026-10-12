import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import * as aiController from "../controllers/ai.controller.js";

/** AI routes — provider status probe (Day 2 AI layer). */
const router = Router();

router.use(authenticate);
router.get("/status", aiController.status);

export default router;
