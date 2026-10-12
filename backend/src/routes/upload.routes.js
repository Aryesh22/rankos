import { Router } from "express";
import * as uploadController from "../controllers/upload.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { uploadSingle } from "../middlewares/upload.js";
import { createRateLimiter } from "../middlewares/rateLimiter.js";

/**
 * Upload + OCR routes. Uploads are rate-limited more tightly than the global API
 * (they hit external storage/OCR). `GET /uploads/files/:name` serves dev-stub
 * local files and is intentionally unauthenticated so <img src> works.
 */
const router = Router();

const uploadLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 60 });

// Serve locally-stored dev files (must be declared before "/:id").
router.get("/files/:name", uploadController.serveLocal);

router.post("/", authenticate, uploadLimiter, uploadSingle("file"), uploadController.create);
router.get("/", authenticate, uploadController.list);
router.get("/:id", authenticate, uploadController.detail);
router.delete("/:id", authenticate, uploadController.remove);

export default router;
