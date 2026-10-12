import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { configureCloudinary, getCloudinary } from "../config/cloudinary.js";

/**
 * File storage service. Production path uploads to Cloudinary; when Cloudinary
 * isn't configured (the default in this build) it falls back to a DEV STUB that
 * writes the file to a local `uploads/` directory and returns a served path, so
 * the whole upload → OCR pipeline runs end-to-end without any credentials.
 */
const LOCAL_DIR = path.resolve(process.cwd(), "uploads");

/** Ensure Cloudinary is configured once, lazily. */
let cloudinaryReady = null;
function ensureCloudinary() {
  if (cloudinaryReady === null) {
    cloudinaryReady = Boolean(configureCloudinary());
  }
  return cloudinaryReady;
}

/**
 * Store a file buffer and return its storage descriptor.
 * @param {{ buffer: Buffer, originalName: string, mimeType: string, folder?: string }} file
 * @returns {Promise<{ provider: string, url: string, publicId: string|null }>}
 */
export async function storeFile({ buffer, originalName, mimeType, folder = "rankos/uploads" }) {
  if (ensureCloudinary()) {
    return storeOnCloudinary({ buffer, mimeType, folder });
  }
  return storeLocally({ buffer, originalName });
}

function storeOnCloudinary({ buffer, mimeType, folder }) {
  const cloudinary = getCloudinary();
  const isPdf = mimeType === "application/pdf";
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: isPdf ? "raw" : "image" },
      (err, result) => {
        if (err) return reject(err);
        logger.info(`[upload] cloudinary → ${result.secure_url}`);
        resolve({ provider: "cloudinary", url: result.secure_url, publicId: result.public_id });
      },
    );
    stream.end(buffer);
  });
}

async function storeLocally({ buffer, originalName }) {
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  const safe = String(originalName || "file").replace(/[^\w.\-]+/g, "_");
  const name = `${randomUUID()}-${safe}`;
  await fs.writeFile(path.join(LOCAL_DIR, name), buffer);
  const url = `${env.app.apiPrefix}/uploads/files/${name}`;
  logger.warn(`[upload:stub] stored locally → ${url} (set CLOUDINARY_* to use cloud storage)`);
  return { provider: "local", url, publicId: null };
}

/** Absolute path of a locally-stored file (for the static serve route). */
export function localFilePath(name) {
  return path.join(LOCAL_DIR, path.basename(name));
}

/** Remove a stored file (best-effort). */
export async function deleteFile({ provider, publicId, url }) {
  try {
    if (provider === "cloudinary" && publicId && ensureCloudinary()) {
      await getCloudinary().uploader.destroy(publicId);
    } else if (provider === "local" && url) {
      await fs.unlink(localFilePath(url.split("/").pop())).catch(() => {});
    }
  } catch (err) {
    logger.warn(`[upload] delete failed: ${err.message}`);
  }
}

export default { storeFile, localFilePath, deleteFile };
