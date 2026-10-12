import { HTTP_STATUS } from "../constants/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as attemptsService from "../services/attempts.service.js";

/**
 * Attempts controller — the test-attempt lifecycle (API_SPEC.md → `/test/$testId`
 * and `/app/results`). RAW bodies. Answers are only revealed by the result route.
 */

// POST /tests/:code/attempts  (mounted under /tests)
export const startAttempt = asyncHandler(async (req, res) => {
  const data = await attemptsService.startAttempt(req.user.id, req.params.code);
  res.status(HTTP_STATUS.CREATED).json(data);
});

// PATCH /attempts/:attemptId/response
export const saveResponse = asyncHandler(async (req, res) => {
  const data = await attemptsService.saveResponse(req.user.id, req.params.attemptId, req.body);
  res.status(HTTP_STATUS.OK).json(data);
});

// POST /attempts/:attemptId/submit
export const submitAttempt = asyncHandler(async (req, res) => {
  const data = await attemptsService.submitAttempt(req.user.id, req.params.attemptId, req.body);
  res.status(HTTP_STATUS.OK).json(data);
});

// GET /attempts/:attemptId/result
export const getResult = asyncHandler(async (req, res) => {
  const data = await attemptsService.getResult(req.user.id, req.params.attemptId);
  res.status(HTTP_STATUS.OK).json(data);
});

// POST /attempts/:attemptId/to-mistake-bank
export const toMistakeBank = asyncHandler(async (req, res) => {
  const data = await attemptsService.toMistakeBank(req.user.id, req.params.attemptId, req.body?.questionIds);
  res.status(HTTP_STATUS.CREATED).json(data);
});

// POST /attempts/:attemptId/schedule-revision
export const scheduleRevision = asyncHandler(async (req, res) => {
  const data = await attemptsService.scheduleRevision(req.user.id, req.params.attemptId, req.body?.topicIds);
  res.status(HTTP_STATUS.CREATED).json(data);
});

export default { startAttempt, saveResponse, submitAttempt, getResult, toMistakeBank, scheduleRevision };
