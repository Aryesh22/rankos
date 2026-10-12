import { HTTP_STATUS } from "../constants/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { clearAuthCookies } from "../utils/cookie.util.js";
import * as settingsService from "../services/settings.service.js";

/**
 * Settings controller — settings groups + account + 2FA + account deletion
 * (API_SPEC.md → Page `/app/settings`). RAW bodies.
 */

// GET /settings
export const getSettings = asyncHandler(async (req, res) => {
  const data = await settingsService.getSettings(req.user.id);
  res.status(HTTP_STATUS.OK).json(data);
});

// PATCH /settings
export const updateSettings = asyncHandler(async (req, res) => {
  const data = await settingsService.updateSettings(req.user.id, req.body);
  res.status(HTTP_STATUS.OK).json(data);
});

// POST /settings/security/2fa
export const setTwoFactor = asyncHandler(async (req, res) => {
  const data = await settingsService.setTwoFactor(req.user.id, req.body.enable);
  res.status(HTTP_STATUS.OK).json(data);
});

// DELETE /account
export const deleteAccount = asyncHandler(async (req, res) => {
  const data = await settingsService.deleteAccount(req.user.id, req.body);
  clearAuthCookies(res);
  res.status(HTTP_STATUS.ACCEPTED).json(data);
});

export default { getSettings, updateSettings, setTwoFactor, deleteAccount };
