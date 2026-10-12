import { HTTP_STATUS } from "../constants/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as mistakesService from "../services/mistakes.service.js";

/**
 * Mistakes controller — Mistake Bank list + status transitions (API_SPEC.md →
 * Page `/app/mistakes`). RAW bodies.
 */

// GET /mistakes?status=&category=&q=&page=
export const listMistakes = asyncHandler(async (req, res) => {
  const { status, category, q, page } = req.query;
  const data = await mistakesService.listMistakes(req.user.id, { status, category, q, page });
  res.status(HTTP_STATUS.OK).json(data);
});

// PATCH /mistakes/:id
export const patchMistake = asyncHandler(async (req, res) => {
  const result = await mistakesService.setMistakeStatus(req.user.id, req.params.id, req.body.status);
  res.status(HTTP_STATUS.OK).json(result);
});

// POST /mistakes/:id/practice  ("Practice N similar")
export const practice = asyncHandler(async (req, res) => {
  const data = await mistakesService.practiceSimilar(req.user.id, req.params.id, req.body?.count);
  res.status(HTTP_STATUS.CREATED).json(data);
});

export default { listMistakes, patchMistake, practice };
