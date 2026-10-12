import { HTTP_STATUS } from "../constants/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as notificationsService from "../services/notifications.service.js";

/**
 * Notifications controller — the in-app notification feed. RAW bodies.
 */

// GET /notifications
export const listNotifications = asyncHandler(async (req, res) => {
  const data = await notificationsService.listNotifications(req.user.id);
  res.status(HTTP_STATUS.OK).json(data);
});

// PATCH /notifications/read-all
export const markAllRead = asyncHandler(async (req, res) => {
  const data = await notificationsService.markAllRead(req.user.id);
  res.status(HTTP_STATUS.OK).json(data);
});

// PATCH /notifications/:id/read
export const markRead = asyncHandler(async (req, res) => {
  const data = await notificationsService.markRead(req.user.id, req.params.id);
  res.status(HTTP_STATUS.OK).json(data);
});

export default { listNotifications, markRead, markAllRead };
