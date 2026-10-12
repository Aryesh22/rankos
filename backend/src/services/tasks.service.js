import { ApiError } from "../utils/ApiError.js";
import { StudyTask } from "../models/index.js";

/**
 * Tasks service — CRUD over the student's StudyTask plan items (API_SPEC.md →
 * Planner / Dashboard). Every query is scoped to the owning user; a client never
 * sends its own id.
 */

const todayStr = () => new Date().toISOString().slice(0, 10);

/** GET /tasks?date=YYYY-MM-DD → the day's tasks for this user. */
export async function listTasks(userId, date) {
  const day = date || todayStr();
  const tasks = await StudyTask.find({ user: userId, date: day }).sort({ time: 1 });
  return { data: tasks };
}

/** PATCH /tasks/:id { done } → toggle completion. */
export async function setTaskDone(userId, taskId, done) {
  const task = await StudyTask.findOneAndUpdate(
    { _id: taskId, user: userId },
    { done: Boolean(done) },
    { new: true },
  );
  if (!task) throw ApiError.notFound("Task not found");
  return { id: String(task._id), done: task.done };
}

/** POST /tasks → create a new plan item for this user. */
export async function createTask(userId, body) {
  const task = await StudyTask.create({
    user: userId,
    date: body.date || todayStr(),
    title: body.title,
    subject: body.subject,
    minutes: body.minutes ?? 0,
    type: body.type || "Concept",
    time: body.time ?? null,
    done: false,
  });
  return task;
}

/** DELETE /tasks/:id → remove a plan item owned by this user. */
export async function deleteTask(userId, taskId) {
  const res = await StudyTask.deleteOne({ _id: taskId, user: userId });
  if (res.deletedCount === 0) throw ApiError.notFound("Task not found");
}

export default { listTasks, setTaskDone, createTask, deleteTask };
