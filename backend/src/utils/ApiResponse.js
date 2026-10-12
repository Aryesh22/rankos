import { HTTP_STATUS } from "../constants/index.js";

/**
 * Standardized success envelope for all API responses:
 *   { success, message, data, meta }
 * Use `.send(res)` to write it, or the static helpers.
 */
export class ApiResponse {
  /**
   * @param {number} statusCode
   * @param {*} data
   * @param {string} [message]
   * @param {object} [meta]  pagination / extra metadata
   */
  constructor(statusCode = HTTP_STATUS.OK, data = null, message = "Success", meta = undefined) {
    this.statusCode = statusCode;
    this.success = statusCode < 400;
    this.message = message;
    this.data = data;
    if (meta !== undefined) this.meta = meta;
  }

  /** Write this response to an Express `res`. */
  send(res) {
    const body = {
      success: this.success,
      message: this.message,
      data: this.data,
    };
    if (this.meta !== undefined) body.meta = this.meta;
    return res.status(this.statusCode).json(body);
  }

  // ── Convenience factories ──────────────────────────────────
  static ok(res, data = null, message = "Success", meta) {
    return new ApiResponse(HTTP_STATUS.OK, data, message, meta).send(res);
  }
  static created(res, data = null, message = "Created", meta) {
    return new ApiResponse(HTTP_STATUS.CREATED, data, message, meta).send(res);
  }
  static accepted(res, data = null, message = "Accepted", meta) {
    return new ApiResponse(HTTP_STATUS.ACCEPTED, data, message, meta).send(res);
  }
  static noContent(res) {
    return res.status(HTTP_STATUS.NO_CONTENT).send();
  }
}

export default ApiResponse;
