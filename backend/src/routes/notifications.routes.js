import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import * as notificationsController from "../controllers/notifications.controller.js";

/** Notifications routes — the in-app notification feed. */
const router = Router();

router.use(authenticate);
router.get("/", notificationsController.listNotifications);
router.patch("/read-all", notificationsController.markAllRead);
router.patch("/:id/read", notificationsController.markRead);

export default router;
