import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { HTTP_STATUS } from "../constants/index.js";
import { Upload } from "../models/upload.model.js";
import { storeFile, localFilePath, deleteFile } from "../services/upload.service.js";
import { processUpload } from "../services/ocr.service.js";

/** Infer the RankOS document kind from an explicit hint or the mime type. */
function resolveKind(hint, mimeType) {
  const allowed = ["pdf", "image", "omr", "cbt"];
  if (allowed.includes(hint)) return hint;
  if (mimeType === "application/pdf") return "pdf";
  return "image";
}

// POST /uploads  (multipart, field "file") — store + OCR-parse in one call.
export const create = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw ApiError.badRequest("No file uploaded.", { fields: { file: "Choose a file to upload." } });
  }
  const { buffer, originalname, mimetype, size } = req.file;
  const kind = resolveKind(req.body?.kind, mimetype);

  const stored = await storeFile({ buffer, originalName: originalname, mimeType: mimetype });

  const upload = await Upload.create({
    user: req.user.id,
    kind,
    originalName: originalname,
    mimeType: mimetype,
    size,
    provider: stored.provider,
    url: stored.url,
    publicId: stored.publicId,
    status: "uploaded",
  });

  // Run OCR extraction/parse. The raw buffer is passed transiently (not stored).
  upload.__buffer = buffer;
  try {
    await processUpload(upload);
  } catch {
    // status/error already persisted by processUpload; still return the record.
  }

  res.status(HTTP_STATUS.CREATED).json({
    id: String(upload._id),
    kind: upload.kind,
    url: upload.url,
    provider: upload.provider,
    status: upload.status,
    ocrProvider: upload.ocrProvider,
    parsedCount: upload.parsed.length,
    parsed: upload.parsed,
  });
});

// GET /uploads — list the current user's uploads (newest first, no raw text).
export const list = asyncHandler(async (req, res) => {
  const docs = await Upload.find({ user: req.user.id })
    .sort({ createdAt: -1 })
    .select("-rawText")
    .limit(50);
  res.json({ data: docs, total: docs.length });
});

// GET /uploads/:id — one upload with its parsed questions.
export const detail = asyncHandler(async (req, res) => {
  const doc = await Upload.findOne({ _id: req.params.id, user: req.user.id });
  if (!doc) throw ApiError.notFound("Upload not found");
  res.json(doc);
});

// DELETE /uploads/:id — remove file + record.
export const remove = asyncHandler(async (req, res) => {
  const doc = await Upload.findOne({ _id: req.params.id, user: req.user.id });
  if (!doc) throw ApiError.notFound("Upload not found");
  await deleteFile({ provider: doc.provider, publicId: doc.publicId, url: doc.url });
  await doc.deleteOne();
  res.status(HTTP_STATUS.NO_CONTENT).send();
});

// GET /uploads/files/:name — serve a locally-stored (dev-stub) file.
export const serveLocal = asyncHandler(async (req, res) => {
  const file = localFilePath(req.params.name);
  res.sendFile(file, (err) => {
    if (err && !res.headersSent) res.status(HTTP_STATUS.NOT_FOUND).json({ error: { code: "NOT_FOUND", message: "File not found" } });
  });
});

export default { create, list, detail, remove, serveLocal };
