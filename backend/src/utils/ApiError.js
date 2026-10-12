import { HTTP_STATUS, ERROR_CODES } from "../constants/index.js";

/**
 * Operational (expected) API error. Anything thrown as an ApiError is treated
 * as a client-facing, safe-to-expose error by the centralized error handler.
 * Unexpected errors (not ApiError) are masked as 500s in production.
 */
export class ApiError extends Error {
  /**
   * @param {number} statusCode  HTTP status code
   * @param {string} message     Human-readable message
   * @param {object} [options]
   * @param {string} [options.code]      Machine-readable error code
   * @param {Array|object} [options.details]  Field-level validation details
   * @param {Record<string,string>} [options.fields]  Per-field messages keyed by
   *   form field name — consumed directly by the frontend (`ApiError.fields`).
   * @param {boolean} [options.isOperational]
   * @param {Error}  [options.cause]     Underlying error
   */
  constructor(statusCode, message, { code, details, fields, isOperational = true, cause } = {}) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
    this.code = code || ApiError.defaultCodeFor(this.statusCode);
    this.details = details;
    this.fields = fields;
    this.isOperational = isOperational;
    if (cause) this.cause = cause;
    Error.captureStackTrace(this, this.constructor);
  }

  static defaultCodeFor(statusCode) {
    const map = {
      [HTTP_STATUS.BAD_REQUEST]: ERROR_CODES.BAD_REQUEST,
      [HTTP_STATUS.UNAUTHORIZED]: ERROR_CODES.UNAUTHORIZED,
      [HTTP_STATUS.FORBIDDEN]: ERROR_CODES.FORBIDDEN,
      [HTTP_STATUS.NOT_FOUND]: ERROR_CODES.NOT_FOUND,
      [HTTP_STATUS.CONFLICT]: ERROR_CODES.CONFLICT,
      [HTTP_STATUS.UNPROCESSABLE_ENTITY]: ERROR_CODES.VALIDATION,
      [HTTP_STATUS.TOO_MANY_REQUESTS]: ERROR_CODES.RATE_LIMITED,
    };
    return map[statusCode] || ERROR_CODES.INTERNAL;
  }

  // ── Convenience factories ──────────────────────────────────
  static badRequest(message = "Bad request", opts) {
    return new ApiError(HTTP_STATUS.BAD_REQUEST, message, opts);
  }
  static unauthorized(message = "Unauthorized", opts) {
    return new ApiError(HTTP_STATUS.UNAUTHORIZED, message, opts);
  }
  static forbidden(message = "Forbidden", opts) {
    return new ApiError(HTTP_STATUS.FORBIDDEN, message, opts);
  }
  static notFound(message = "Resource not found", opts) {
    return new ApiError(HTTP_STATUS.NOT_FOUND, message, opts);
  }
  static conflict(message = "Conflict", opts) {
    return new ApiError(HTTP_STATUS.CONFLICT, message, opts);
  }
  static unprocessable(message = "Validation failed", opts) {
    return new ApiError(HTTP_STATUS.UNPROCESSABLE_ENTITY, message, opts);
  }
  static internal(message = "Internal server error", opts) {
    return new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, message, {
      ...opts,
      isOperational: false,
    });
  }

  /** Serialize for a JSON response body. */
  toJSON() {
    return {
      code: this.code,
      message: this.message,
      ...(this.details ? { details: this.details } : {}),
      ...(this.fields ? { fields: this.fields } : {}),
    };
  }
}

export default ApiError;
