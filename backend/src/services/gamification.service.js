import { Achievement, Notification, Profile, TestAttempt } from "../models/index.js";
import { logger } from "../config/logger.js";

/**
 * Gamification service — event-driven notifications + achievement awards. Called
 * after a test attempt is submitted. Best-effort: failures here NEVER break the
 * submit flow (they're logged, not thrown).
 */

/** Award an achievement by name if the user has it and hasn't earned it yet. */
async function award(userId, name) {
  const ach = await Achievement.findOne({ user: userId, name });
  if (!ach || ach.earned) return false;
  ach.earned = true;
  ach.earnedAt = new Date();
  await ach.save();
  await Notification.create({
    user: userId,
    type: "achievement",
    title: `${name} unlocked`,
    body: ach.detail,
    link: "/app/profile",
  });
  return true;
}

/**
 * Evaluate notifications + achievements after a submitted attempt.
 * @param {string} userId
 * @param {import("mongoose").Document} attempt
 */
export async function evaluateAfterSubmit(userId, attempt) {
  try {
    const [profile, attemptsCount] = await Promise.all([
      Profile.findOne({ user: userId }),
      TestAttempt.countDocuments({ user: userId, status: "submitted" }),
    ]);

    await Notification.create({
      user: userId,
      type: "result",
      title: `Mock scored ${attempt.score}/${attempt.maxScore}`,
      body: `Percentile ${attempt.percentile} · ${attempt.accuracy}% accuracy`,
      link: `/app/results?attempt=${attempt._id}`,
    });

    if ((profile?.streak ?? 0) >= 45) await award(userId, "Iron Streak");
    if (attemptsCount >= 100) await award(userId, "Century");
    if ((attempt.percentile ?? 0) >= 99) await award(userId, "Top 1%");
    const physics = attempt.subjectBreakdown?.find((s) => /physics/i.test(s.subject || ""));
    if (physics && physics.accuracy === 100) await award(userId, "Perfect Physics");
  } catch (err) {
    logger.warn(`[gamification] evaluate failed: ${err.message}`);
  }
}

export default { evaluateAfterSubmit };
