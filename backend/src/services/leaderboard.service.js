import { LeaderboardEntry } from "../models/index.js";

/**
 * Leaderboard service — ranked entries for a scope/range window (API_SPEC.md →
 * Page `/app/leaderboard`). `isYou` is resolved server-side by comparing each
 * entry's `user` to the current user; the client never sends its own id.
 */

const PAGE_SIZE = 20;

/** GET /leaderboard?scope=india&range=weekly&page= */
export async function getLeaderboard(userId, { scope = "india", range = "weekly", page = 1 } = {}) {
  const entries = await LeaderboardEntry.find({ scope, range }).sort({ xp: -1 });

  const ranked = entries.map((e, i) => ({
    rank: i + 1,
    name: e.name,
    institute: e.institute,
    state: e.state,
    xp: e.xp,
    accuracy: e.accuracy,
    streak: e.streak,
    isYou: Boolean(e.user) && String(e.user) === String(userId),
  }));

  const pageNum = Math.max(1, Number(page) || 1);
  const data = ranked.slice((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE);
  const youRow = ranked.find((r) => r.isYou);

  return {
    scope,
    range,
    podium: ranked.slice(0, 3),
    data,
    you: youRow ? { rank: youRow.rank } : null,
    total: ranked.length,
  };
}

export default { getLeaderboard };
