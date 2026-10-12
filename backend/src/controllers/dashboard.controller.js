import { HTTP_STATUS } from "../constants/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as dashboardService from "../services/dashboard.service.js";

/**
 * Dashboard controller. Thin: calls the service and emits the RAW aggregate body
 * the frontend reads directly (API_SPEC.md → Page `/app`).
 */

// GET /dashboard
export const getDashboard = asyncHandler(async (req, res) => {
  const data = await dashboardService.getDashboard(req.user.id);
  res.status(HTTP_STATUS.OK).json(data);
});

export default { getDashboard };
