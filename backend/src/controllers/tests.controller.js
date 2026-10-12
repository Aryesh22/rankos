import { HTTP_STATUS } from "../constants/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as testsService from "../services/tests.service.js";

/**
 * Tests controller — Test Centre reads (API_SPEC.md → Pages `/app/tests`,
 * `/test/$testId`). RAW bodies. Attempt lifecycle lives in attempts.controller.js.
 */

// GET /tests?status=upcoming|history  (+ default list = upcoming)
export const listTests = asyncHandler(async (req, res) => {
  const status = req.query.status;
  const data =
    status === "history"
      ? await testsService.listHistory(req.user.id)
      : await testsService.listUpcoming();
  res.status(HTTP_STATUS.OK).json(data);
});

// GET /tests/stats
export const getStats = asyncHandler(async (req, res) => {
  const data = await testsService.getStats(req.user.id);
  res.status(HTTP_STATUS.OK).json(data);
});

// GET /tests/:code
export const getByCode = asyncHandler(async (req, res) => {
  const data = await testsService.getByCode(req.params.code);
  res.status(HTTP_STATUS.OK).json(data);
});

// POST /tests/custom  (custom generator: subjects, difficulty, count)
export const createCustom = asyncHandler(async (req, res) => {
  const data = await testsService.generateCustom(req.user.id, req.body || {});
  res.status(HTTP_STATUS.CREATED).json(data);
});

export default { listTests, getStats, getByCode, createCustom };
