import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import * as profileController from "../controllers/profile.controller.js";

/** Profile routes — API_SPEC.md → Page `/app/profile`. */
const router = Router();

router.use(authenticate);
router.get("/", profileController.getProfile);
router.get("/achievements", profileController.getAchievements);

export default router;
