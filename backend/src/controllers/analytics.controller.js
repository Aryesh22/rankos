import { HTTP_STATUS } from "../constants/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as analyticsService from "../services/analytics.service.js";

/**
 * Analytics controller — derived analytics (API_SPEC.md → Exam DNA, score trend,
 * heatmap). RAW bodies.
 */

// GET /analytics/exam-dna
export const getExamDna = asyncHandler(async (req, res) => {
  const data = await analyticsService.getExamDna(req.user.id);
  res.status(HTTP_STATUS.OK).json(data);
});

// GET /analytics/score-trend
export const getScoreTrend = asyncHandler(async (req, res) => {
  const data = await analyticsService.getScoreTrend(req.user.id);
  res.status(HTTP_STATUS.OK).json(data);
});

// GET /analytics/heatmap?days=182
export const getHeatmap = asyncHandler(async (req, res) => {
  const data = await analyticsService.getHeatmap(req.user.id, req.query.days);
  res.status(HTTP_STATUS.OK).json(data);
});

// GET /analytics/recommendations
export const getRecommendations = asyncHandler(async (req, res) => {
  const data = await analyticsService.getRecommendations(req.user.id);
  res.status(HTTP_STATUS.OK).json(data);
});

export default { getExamDna, getScoreTrend, getHeatmap, getRecommendations };
