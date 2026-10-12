import { HTTP_STATUS } from "../constants/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as teacherService from "../services/teacher.service.js";

/**
 * Teacher controller — the Teacher View (API_SPEC.md → Page `/app/teacher`).
 * RAW bodies.
 */

// GET /teacher/overview
export const getOverview = asyncHandler(async (_req, res) => {
  res.status(HTTP_STATUS.OK).json(teacherService.getOverview());
});

// GET /teacher/batches
export const getBatches = asyncHandler(async (_req, res) => {
  res.status(HTTP_STATUS.OK).json(teacherService.getBatches());
});

// GET /teacher/assignments
export const getAssignments = asyncHandler(async (_req, res) => {
  res.status(HTTP_STATUS.OK).json(teacherService.getAssignments());
});

// POST /teacher/assignments
export const createAssignment = asyncHandler(async (req, res) => {
  res.status(HTTP_STATUS.CREATED).json(teacherService.createAssignment(req.body));
});

// GET /teacher/leaderboard?limit=6
export const getLeaderboard = asyncHandler(async (req, res) => {
  const data = await teacherService.getLeaderboard(req.query.limit);
  res.status(HTTP_STATUS.OK).json(data);
});

export default { getOverview, getBatches, getAssignments, createAssignment, getLeaderboard };
