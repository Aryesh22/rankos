import { ApiError } from "../utils/ApiError.js";
import { userRepository } from "../repositories/user.repository.js";
import { Profile, Achievement } from "../models/index.js";

/**
 * Profile service — the read-only Profile page (API_SPEC.md → Page
 * `/app/profile`). Level progression is derived: nextLevelXp = (level+1)*2000.
 */

/** GET /profile → gamified profile summary for the current user. */
export async function getProfile(userId) {
  const [user, profile] = await Promise.all([
    userRepository.findById(userId),
    Profile.findOne({ user: userId }),
  ]);
  if (!user) throw ApiError.notFound("User not found");

  const level = profile?.level ?? 1;
  const xp = profile?.xp ?? 0;
  const nextLevelXp = (level + 1) * 2000;
  const xpToNextLevel = Math.max(0, nextLevelXp - xp);

  return {
    name: user.fullName,
    initials: user.initials,
    exam: profile?.examLabel ?? "",
    institute: profile?.institute ?? user.institute ?? "",
    state: profile?.state ?? user.state ?? "",
    level,
    xp,
    xpToNextLevel,
    nextLevelXp,
    targetRank: profile?.targetRank ?? null,
    currentPredictedRank: profile?.currentPredictedRank ?? null,
    syllabusCovered: profile?.syllabusCovered ?? 0,
    dreamCollege: profile?.dreamCollege ?? "",
    longestStreak: profile?.longestStreak ?? 0,
    streak: profile?.streak ?? 0,
  };
}

/** GET /profile/achievements → badges + earned/total counts. */
export async function getAchievements(userId) {
  const list = await Achievement.find({ user: userId }).sort({ createdAt: 1 });
  const data = list.map((a) => ({
    name: a.name,
    detail: a.detail,
    icon: a.icon,
    earned: a.earned,
  }));
  return { data, earnedCount: data.filter((a) => a.earned).length, total: data.length };
}

export default { getProfile, getAchievements };
