import { LeaderboardEntry } from "../models/index.js";

/**
 * Teacher service — the Teacher View (API_SPEC.md → Page `/app/teacher`).
 * Batches/assignments have no model in this build, so they are served as
 * reasonable computed constants; the live leaderboard reads real entries.
 */

const BATCHES = [
  { id: "batch-a", name: "Batch A — JEE Adv", students: 42, avgScore: 63, weakTopic: "3D Geometry", trend: 6 },
  { id: "batch-b", name: "Batch B — JEE Main", students: 58, avgScore: 71, weakTopic: "Thermodynamics", trend: -3 },
  { id: "batch-c", name: "Batch C — Foundation", students: 66, avgScore: 68, weakTopic: "Trigonometry", trend: 4 },
];

const ASSIGNMENTS = [
  { id: "as-1", title: "Rotational Dynamics — 25 Q set", batch: "Batch A — JEE Adv", due: "Fri", submitted: 31, total: 42 },
  { id: "as-2", title: "Organic Named Reactions — 30 Q", batch: "Batch B — JEE Main", due: "Mon", submitted: 12, total: 58 },
  { id: "as-3", title: "Calculus Mixed Bag — 20 Q", batch: "Batch C — Foundation", due: "Wed", submitted: 40, total: 66 },
];

/** GET /teacher/overview → headline class stats. */
export function getOverview() {
  const totalStudents = BATCHES.reduce((sum, b) => sum + b.students, 0);
  const avgClassAccuracy = 67.4;
  return {
    totalStudents,
    avgClassAccuracy,
    openAssignments: ASSIGNMENTS.length,
    batchCount: BATCHES.length,
  };
}

/** GET /teacher/batches → class performance per batch. */
export function getBatches() {
  return { data: BATCHES };
}

/** GET /teacher/assignments → current assignments. */
export function getAssignments() {
  return { data: ASSIGNMENTS };
}

/** POST /teacher/assignments → create (stub) and echo the new assignment row. */
export function createAssignment(body = {}) {
  const batch = BATCHES.find((b) => b.id === body.batchId) || BATCHES[0];
  return {
    id: `as-${Date.now()}`,
    title: body.title || "Untitled assignment",
    batch: batch.name,
    submitted: 0,
    total: batch.students,
  };
}

/** GET /teacher/leaderboard?limit=6 → top students this week. */
export async function getLeaderboard(limit = 6) {
  const n = Math.max(1, Number(limit) || 6);
  const entries = await LeaderboardEntry.find({ scope: "india", range: "weekly" })
    .sort({ xp: -1 })
    .limit(n);
  const data = entries.map((e, i) => ({
    rank: i + 1,
    name: e.name,
    institute: e.institute,
    accuracy: e.accuracy,
  }));
  return { data };
}

export default { getOverview, getBatches, getAssignments, createAssignment, getLeaderboard };
