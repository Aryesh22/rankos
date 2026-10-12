import { HTTP_STATUS } from "../constants/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as parentService from "../services/parent.service.js";

/**
 * Parent controller — the Parent View (API_SPEC.md → Page `/app/parent`).
 * RAW bodies. Report reads honour student self-preview.
 */

// GET /parent/children
export const getChildren = asyncHandler(async (_req, res) => {
  const data = await parentService.getChildren();
  res.status(HTTP_STATUS.OK).json(data);
});

// GET /parent/report?studentId=&week=current
export const getReport = asyncHandler(async (req, res) => {
  const data = await parentService.getReport(req.user, { studentId: req.query.studentId });
  res.status(HTTP_STATUS.OK).json(data);
});

export default { getChildren, getReport };
