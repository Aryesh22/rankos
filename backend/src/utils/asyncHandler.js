/**
 * Wraps an async Express route/middleware so rejected promises are forwarded
 * to `next()` (and thus the centralized error handler) instead of crashing
 * the process with an unhandled rejection.
 *
 * @param {(req, res, next) => Promise<any>} fn
 * @returns {(req, res, next) => void}
 *
 * @example
 *   router.get("/", asyncHandler(async (req, res) => {
 *     const data = await service.doThing();
 *     ApiResponse.ok(res, data);
 *   }));
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
