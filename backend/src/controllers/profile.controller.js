import { HTTP_STATUS } from "../constants/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as profileService from "../services/profile.service.js";

/**
 * Profile controller (API_SPEC.md → Page `/app/profile`). RAW bodies.
 */

// GET /profile
export const getProfile = asyncHandler(async (req, res) => {
  const data = await profileService.getProfile(req.user.id);
  res.status(HTTP_STATUS.OK).json(data);
});

// GET /profile/achievements
export const getAchievements = asyncHandler(async (req, res) => {
  const data = await profileService.getAchievements(req.user.id);
  res.status(HTTP_STATUS.OK).json(data);
});

export default { getProfile, getAchievements };
