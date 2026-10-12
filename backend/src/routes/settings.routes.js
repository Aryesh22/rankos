import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import * as settingsController from "../controllers/settings.controller.js";

/** Settings routes — settings groups + account + 2FA (API_SPEC.md → Settings). */
const router = Router();

router.use(authenticate);
router.get("/", settingsController.getSettings);
router.patch("/", settingsController.updateSettings);
router.post("/security/2fa", settingsController.setTwoFactor);

export default router;
