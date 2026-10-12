import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { env } from "./env.js";
import { logger } from "./logger.js";

/**
 * OpenAPI 3 definition. Route handlers document themselves via JSDoc
 * `@openapi` comments (see src/routes/*.js), which swagger-jsdoc scans.
 * Reusable schemas live in src/docs/components.js.
 */
const definition = {
  openapi: "3.0.3",
  info: {
    title: `${env.app.name} — API`,
    version: "0.1.0",
    description:
      "RankOS backend API. This is the foundation build — only infrastructure " +
      "and health endpoints are documented so far.",
    contact: { name: "RankOS", url: "https://rankos.app" },
    license: { name: "UNLICENSED" },
  },
  servers: [{ url: env.app.apiPrefix, description: "Current server (relative)" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      cookieAuth: { type: "apiKey", in: "cookie", name: "session" },
    },
  },
  tags: [{ name: "Health", description: "Service liveness & readiness probes" }],
};

const options = {
  definition,
  // Scan route + docs files for @openapi JSDoc blocks.
  apis: ["./src/routes/*.js", "./src/docs/*.js"],
};

export const swaggerSpec = swaggerJSDoc(options);

/**
 * Mount Swagger UI at `${apiPrefix}/docs` and the raw JSON at
 * `${apiPrefix}/docs.json`. No-op when SWAGGER_ENABLED=false.
 */
export function mountSwagger(app) {
  if (!env.swagger.enabled) {
    logger.warn("[swagger] disabled (SWAGGER_ENABLED=false)");
    return;
  }
  const base = env.app.apiPrefix;

  app.get(`${base}/docs.json`, (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  app.use(
    `${base}/docs`,
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      explorer: true,
      customSiteTitle: `${env.app.name} Docs`,
    }),
  );

  logger.info(`[swagger] docs mounted at ${base}/docs`);
}

export default mountSwagger;
