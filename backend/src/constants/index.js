export { HTTP_STATUS } from "./httpStatus.js";
export { ROLES, ROLE_VALUES, SELF_ASSIGNABLE_ROLES } from "./roles.js";
export { TOKEN_TYPES, COOKIE_NAMES } from "./tokens.js";

/** Machine-readable error codes returned in error responses. */
export const ERROR_CODES = Object.freeze({
  INTERNAL: "INTERNAL_ERROR",
  VALIDATION: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  BAD_REQUEST: "BAD_REQUEST",
  RATE_LIMITED: "RATE_LIMITED",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  CONFLICT: "CONFLICT",
});

/** Service-wide constants. */
export const APP = Object.freeze({
  JSON_BODY_LIMIT: "1mb",
  REQUEST_ID_HEADER: "x-request-id",
});
