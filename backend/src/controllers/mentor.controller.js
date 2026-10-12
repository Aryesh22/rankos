import { HTTP_STATUS } from "../constants/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as mentorService from "../services/mentor.service.js";

/**
 * Mentor controller — the AI Mentor dock (API_SPEC.md → `AiChatDock`). RAW bodies.
 */

// GET /mentor/messages?conversationId=
export const getMessages = asyncHandler(async (req, res) => {
  const data = await mentorService.getMessages(req.user.id, req.query.conversationId);
  res.status(HTTP_STATUS.OK).json(data);
});

// POST /mentor/chat
export const chat = asyncHandler(async (req, res) => {
  const data = await mentorService.chat(req.user.id, req.body);
  res.status(HTTP_STATUS.OK).json(data);
});

export default { getMessages, chat };
