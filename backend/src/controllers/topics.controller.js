import { HTTP_STATUS } from "../constants/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as topicsService from "../services/topics.service.js";

/**
 * Topics controller — mastery graph + revision history (API_SPEC.md → Pages
 * `/app/revision-graph`, `/app/exam-dna`). RAW bodies.
 */

// GET /topics/graph
export const getGraph = asyncHandler(async (req, res) => {
  const data = await topicsService.getGraph(req.user.id);
  res.status(HTTP_STATUS.OK).json(data);
});

// GET /topics/:id/revisions
export const getRevisions = asyncHandler(async (req, res) => {
  const data = await topicsService.getRevisions(req.user.id, req.params.id);
  res.status(HTTP_STATUS.OK).json(data);
});

// POST /topics/:id/practice  ("Practise N weak questions")
export const practice = asyncHandler(async (req, res) => {
  const data = await topicsService.practiceWeakQuestions(req.user.id, req.params.id, req.body?.count);
  res.status(HTTP_STATUS.CREATED).json(data);
});

// GET /topics/:id/notes
export const getNotes = asyncHandler(async (req, res) => {
  const data = await topicsService.listNotes(req.user.id, req.params.id);
  res.status(HTTP_STATUS.OK).json(data);
});

// POST /topics/:id/notes  (generate AI revision notes)
export const generateNotes = asyncHandler(async (req, res) => {
  const note = await topicsService.generateNotes(req.user.id, req.params.id);
  res.status(HTTP_STATUS.CREATED).json(note);
});

export default { getGraph, getRevisions, practice, getNotes, generateNotes };
