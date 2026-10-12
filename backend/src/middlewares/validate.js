import { ZodError } from "zod";
import { ApiError } from "../utils/ApiError.js";
import { ERROR_CODES } from "../constants/index.js";

/**
 * Request validation middleware factory (Zod).
 *
 * Pass a map of the request segments to validate:
 *   validate({ body: signupSchema, query: pageSchema, params: idSchema })
 *
 * On success the PARSED (and coerced) values replace `req.body/query/params`
 * so downstream handlers get clean, typed data. On failure a 422 ApiError is
 * thrown carrying `fields` ({ fieldName: message }) — consumed directly by the
 * frontend forms (`ApiError.fields`) — plus a `details` array.
 *
 * @param {{ body?: import("zod").ZodTypeAny, query?: import("zod").ZodTypeAny, params?: import("zod").ZodTypeAny }} schemas
 */
export function validate(schemas = {}) {
  return (req, _res, next) => {
    try {
      for (const segment of ["params", "query", "body"]) {
        const schema = schemas[segment];
        if (!schema) continue;
        const parsed = schema.parse(req[segment] ?? {});
        // req.query/params getters can be read-only on some setups — assign the
        // fields rather than replacing the object when needed.
        if (segment === "body") {
          req.body = parsed;
        } else {
          req[segment] = parsed;
        }
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const fields = {};
        const details = [];
        for (const issue of err.issues) {
          const field = issue.path.join(".") || "_";
          // Keep the FIRST message per field (react-hook-form shows one).
          if (!(field in fields)) fields[field] = issue.message;
          details.push({ field, message: issue.message });
        }
        return next(
          new ApiError(422, "Validation failed", {
            code: ERROR_CODES.VALIDATION,
            fields,
            details,
            cause: err,
          }),
        );
      }
      return next(err);
    }
  };
}

export default validate;
