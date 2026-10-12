import { HTTP_STATUS } from "../constants/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as plansService from "../services/plans.service.js";

/**
 * Plans controller — AI planner read/generate + Pomodoro logging (API_SPEC.md →
 * Page `/app/planner`). RAW bodies.
 */

// GET /plans?scope=week|month&start=YYYY-MM-DD
export const getPlans = asyncHandler(async (req, res) => {
  const data = await plansService.getPlans(req.user.id, {
    scope: req.query.scope,
    start: req.query.start,
  });
  res.status(HTTP_STATUS.OK).json(data);
});

// POST /plans/generate
export const generatePlan = asyncHandler(async (req, res) => {
  const plan = await plansService.generatePlan(req.user.id, req.body || {});
  res.status(HTTP_STATUS.CREATED).json({ plan });
});

// POST /pomodoro
export const logPomodoro = asyncHandler(async (req, res) => {
  const data = await plansService.logPomodoro(req.user.id, req.body || {});
  res.status(HTTP_STATUS.CREATED).json(data);
});

export default { getPlans, generatePlan, logPomodoro };
