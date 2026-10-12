import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import * as mistakesController from "../controllers/mistakes.controller.js";

/** Mistakes routes — Mistake Bank (API_SPEC.md → Page `/app/mistakes`). */
const router = Router();

router.use(authenticate);
router.get("/", mistakesController.listMistakes);
router.patch("/:id", mistakesController.patchMistake);
router.post("/:id/practice", mistakesController.practice);

export default router;
