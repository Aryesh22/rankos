import { HTTP_STATUS } from "../constants/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { providerInfo } from "../services/ai/index.js";

/**
 * AI controller — exposes which AI provider is active so the frontend/ops can
 * confirm whether responses are LLM-backed or the grounded local fallback.
 */

// GET /ai/status
export const status = asyncHandler(async (_req, res) => {
  res.status(HTTP_STATUS.OK).json(providerInfo());
});

export default { status };
