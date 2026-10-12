import { HTTP_STATUS } from "../constants/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as tasksService from "../services/tasks.service.js";

/**
 * Tasks controller — StudyTask CRUD (API_SPEC.md → Planner / Dashboard). RAW
 * bodies; the current user comes from the session, never the client.
 */

// GET /tasks?date=YYYY-MM-DD
export const listTasks = asyncHandler(async (req, res) => {
  const data = await tasksService.listTasks(req.user.id, req.query.date);
  res.status(HTTP_STATUS.OK).json(data);
});

// PATCH /tasks/:id
export const patchTask = asyncHandler(async (req, res) => {
  const result = await tasksService.setTaskDone(req.user.id, req.params.id, req.body.done);
  res.status(HTTP_STATUS.OK).json(result);
});

// POST /tasks
export const createTask = asyncHandler(async (req, res) => {
  const task = await tasksService.createTask(req.user.id, req.body);
  res.status(HTTP_STATUS.CREATED).json(task);
});

// DELETE /tasks/:id
export const deleteTask = asyncHandler(async (req, res) => {
  await tasksService.deleteTask(req.user.id, req.params.id);
  res.status(HTTP_STATUS.NO_CONTENT).send();
});

export default { listTasks, patchTask, createTask, deleteTask };
