import { HTTP_STATUS } from "../constants/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as leaderboardService from "../services/leaderboard.service.js";

/**
 * Leaderboard controller (API_SPEC.md → Page `/app/leaderboard`). RAW bodies.
 */

// GET /leaderboard?scope=&range=&page=
export const getLeaderboard = asyncHandler(async (req, res) => {
  const { scope, range, page } = req.query;
  const data = await leaderboardService.getLeaderboard(req.user.id, { scope, range, page });
  res.status(HTTP_STATUS.OK).json(data);
});

export default { getLeaderboard };
