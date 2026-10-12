/**
 * Reusable OpenAPI component schemas, scanned by swagger-jsdoc.
 * Kept in one place so feature routes can `$ref` them.
 *
 * @openapi
 * components:
 *   schemas:
 *     SuccessResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Success }
 *         data: { type: object, nullable: true }
 *         meta: { type: object, nullable: true }
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: false }
 *         error:
 *           type: object
 *           properties:
 *             code: { type: string, example: NOT_FOUND }
 *             message: { type: string, example: Resource not found }
 *             details: { type: object, nullable: true }
 *         requestId: { type: string, nullable: true }
 *     HealthStatus:
 *       type: object
 *       properties:
 *         service: { type: string, example: RankOS API }
 *         status: { type: string, example: ok }
 *         environment: { type: string, example: development }
 *         uptimeSeconds: { type: integer, example: 42 }
 *         dependencies:
 *           type: object
 *           properties:
 *             mongodb: { type: string, example: connected }
 *             redis: { type: string, example: not-configured }
 */
export default {};
