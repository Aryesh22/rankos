import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import * as settingsController from "../controllers/settings.controller.js";

/** Account routes — account deletion (API_SPEC.md → Settings → DELETE /account). */
const router = Router();

router.use(authenticate);
router.delete("/", settingsController.deleteAccount);

export default router;
