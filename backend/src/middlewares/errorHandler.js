import mongoose from "mongoose";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { ApiError } from "../utils/ApiError.js";
import { HTTP_STATUS, ERROR_CODES } from "../constants/index.js";

/**
 * Normalize known third-party errors (Mongoose, JSON parse, etc.) into ApiError
 * so the response shape stays consistent.
 */
function normalizeError(err) {
  if (err instanceof ApiError) return err;

  // Mongoose validation
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return new ApiError(HTTP_STATUS.UNPROCESSABLE_ENTITY, "Validation failed", {
      code: ERROR_CODES.VALIDATION,
      details,
      cause: err,
    });
  }

  // Mongoose bad ObjectId / cast
  if (err instanceof mongoose.Error.CastError) {
    return new ApiError(HTTP_STATUS.BAD_REQUEST, `Invalid value for '${err.path}'`, {
      code: ERROR_CODES.BAD_REQUEST,
      cause: err,
    });
  }

  // Mongo duplicate key
  if (err && err.code === 11000) {
    const fields = Object.keys(err.keyValue || {});
    return new ApiError(HTTP_STATUS.CONFLICT, `Duplicate value for: ${fields.join(", ")}`, {
      code: ERROR_CODES.CONFLICT,
      details: err.keyValue,
      cause: err,
    });
  }

  // Malformed JSON body (from express.json)
  if (err && err.type === "entity.parse.failed") {
    return new ApiError(HTTP_STATUS.BAD_REQUEST, "Malformed JSON in request body", {
      code: ERROR_CODES.BAD_REQUEST,
      cause: err,
    });
  }

  // Fallback: unexpected/programmer error → masked 500
  return new ApiError(err?.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR, err?.message, {
    isOperational: false,
    cause: err,
  });
}

/**
 * Centralized error-handling middleware. MUST be registered last, and MUST keep
 * the 4-arg signature so Express recognizes it as an error handler.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const apiError = normalizeError(err);

  // Log: operational errors at warn, everything else at error with stack.
  const logMeta = {
    method: req.method,
    path: req.originalUrl,
    status: apiError.statusCode,
    requestId: req.id,
  };
  if (apiError.isOperational && apiError.statusCode < 500) {
    logger.warn(`${apiError.statusCode} ${apiError.message}`, logMeta);
  } else {
    logger.error(apiError.stack || apiError.message, logMeta);
  }

  const body = {
    success: false,
    error: {
      code: apiError.code,
      message:
        apiError.statusCode >= 500 && env.isProduction
          ? "Internal server error"
          : apiError.message,
      ...(apiError.details ? { details: apiError.details } : {}),
      ...(apiError.fields ? { fields: apiError.fields } : {}),
    },
  };

  // Expose stack traces only outside production.
  if (!env.isProduction && apiError.stack) {
    body.error.stack = apiError.stack;
  }
  if (req.id) body.requestId = req.id;

  res.status(apiError.statusCode).json(body);
}

export default errorHandler;
