import { randomUUID } from "node:crypto";
import { APP } from "../constants/index.js";

/**
 * Attaches a correlation id to every request (reuses an inbound
 * `x-request-id` header if present) and echoes it back on the response.
 * Used by the logger and error handler for traceability.
 */
export function requestId(req, res, next) {
  const incoming = req.headers[APP.REQUEST_ID_HEADER];
  req.id = incoming || randomUUID();
  res.setHeader(APP.REQUEST_ID_HEADER, req.id);
  next();
}

export default requestId;
