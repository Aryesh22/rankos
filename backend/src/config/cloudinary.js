import { v2 as cloudinary } from "cloudinary";
import { env } from "./env.js";
import { logger } from "./logger.js";

/**
 * Cloudinary is OPTIONAL in the foundation build. We only configure the SDK
 * when credentials are present; no upload/business logic lives here yet.
 */
let configured = false;

export function configureCloudinary() {
  if (!env.cloudinary.isConfigured) {
    logger.warn("[cloudinary] not configured — media uploads disabled");
    return null;
  }
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
    secure: true,
  });
  configured = true;
  logger.info(`[cloudinary] configured → cloud: ${env.cloudinary.cloudName}`);
  return cloudinary;
}

export function getCloudinary() {
  return configured ? cloudinary : null;
}

export { cloudinary };
export default configureCloudinary;
