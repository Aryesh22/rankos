import { ApiError } from "../utils/ApiError.js";
import { Notification } from "../models/index.js";

/**
 * Notifications service — the in-app notification feed (API_SPEC.md → global
 * notification bell). Scoped to the current user.
 */

/** GET /notifications → the user's notifications + unread count. */
export async function listNotifications(userId) {
  const data = await Notification.find({ user: userId }).sort({ createdAt: -1 });
  const unread = await Notification.countDocuments({ user: userId, read: false });
  return { data, unread };
}

/** PATCH /notifications/:id/read → mark one notification read. */
export async function markRead(userId, id) {
  const note = await Notification.findOneAndUpdate(
    { _id: id, user: userId },
    { read: true },
    { new: true },
  );
  if (!note) throw ApiError.notFound("Notification not found");
  return { id: String(note._id), read: true };
}

/** PATCH /notifications/read-all → mark every notification read. */
export async function markAllRead(userId) {
  const res = await Notification.updateMany({ user: userId, read: false }, { read: true });
  return { updated: res.modifiedCount ?? 0, unread: 0 };
}

export default { listNotifications, markRead, markAllRead };
