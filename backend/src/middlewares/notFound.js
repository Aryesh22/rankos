import { ApiError } from "../utils/ApiError.js";

/**
 * Catch-all for unmatched routes. Forwards a 404 ApiError to the error handler.
 * Register AFTER all routes and BEFORE the error handler.
 */
export function notFound(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

export default notFound;
