import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import * as leaderboardController from "../controllers/leaderboard.controller.js";

/** Leaderboard routes — API_SPEC.md → Page `/app/leaderboard`. */
const router = Router();

router.use(authenticate);
router.get("/", leaderboardController.getLeaderboard);

export default router;
