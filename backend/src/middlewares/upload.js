import multer from "multer";
import { ApiError } from "../utils/ApiError.js";

/**
 * Multer upload middleware — in-memory storage so the buffer can be streamed
 * straight to Cloudinary/Vision without touching disk. Accepts the file types
 * RankOS ingests (OMR sheets, CBT screenshots, PDFs, images) and enforces a
 * size cap. Rejections surface as clean 400/413 ApiErrors via the error handler.
 */
const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/heic",
]);

function fileFilter(_req, file, cb) {
  if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
  cb(
    ApiError.badRequest(`Unsupported file type: ${file.mimetype}. Allowed: PDF, PNG, JPG, WEBP.`, {
      code: "UNSUPPORTED_FILE_TYPE",
      fields: { file: "Upload a PDF or image (PNG/JPG/WEBP)." },
    }),
  );
}

const multerInstance = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_BYTES, files: 1 },
  fileFilter,
});

/**
 * Single-file upload under the `file` field, with multer's own errors (e.g. size
 * limit) normalized to ApiError so responses stay consistent.
 */
export function uploadSingle(field = "file") {
  const handler = multerInstance.single(field);
  return (req, res, next) => {
    handler(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        const code = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        return next(
          new ApiError(code, err.code === "LIMIT_FILE_SIZE" ? "File is too large (max 15 MB)." : err.message, {
            code: err.code,
            fields: { file: err.code === "LIMIT_FILE_SIZE" ? "Max file size is 15 MB." : err.message },
          }),
        );
      }
      return next(err); // ApiError from fileFilter, or anything else
    });
  };
}

export default uploadSingle;
