import { ExamDNA, Topic, TestAttempt, StudyLog, Mistake, Profile } from "../models/index.js";
import * as ai from "./ai/index.js";

/**
 * Analytics service — derived analytics endpoints (API_SPEC.md → Exam DNA,
 * Dashboard score trend, Profile heatmap). These are computed views over the
 * user's ExamDNA / Topic mastery / attempts / study logs, not CRUD.
 */

/** GET /analytics/exam-dna → the full Exam DNA fingerprint + weak/strong chapters. */
export async function getExamDna(userId) {
  const [dna, topics] = await Promise.all([
    ExamDNA.findOne({ user: userId }),
    Topic.find({ user: userId }),
  ]);

  const weakChapters = topics
    .filter((t) => t.mastery < 50)
    .sort((a, b) => a.mastery - b.mastery)
    .map((t) => ({ id: t.key, name: t.name, subject: t.subject, mastery: t.mastery }));
  const strongChapters = topics
    .filter((t) => t.mastery >= 80)
    .sort((a, b) => b.mastery - a.mastery)
    .map((t) => ({ id: t.key, name: t.name, subject: t.subject, mastery: t.mastery }));

  return {
    radar: (dna?.radar ?? []).map((r) => ({ trait: r.trait, value: r.value })),
    behaviours: (dna?.behaviours ?? []).map((b) => ({ key: b.key, label: b.label, value: b.value })),
    errorProfile: (dna?.errorProfile ?? []).map((e) => ({ key: e.key, label: e.label, value: e.value })),
    burnoutRisk: dna?.burnoutRisk ?? "Low",
    enduranceDropPct: dna?.enduranceDropPct ?? 0,
    learningVelocity: dna?.learningVelocity ?? 0,
    narrative: dna?.narrative ?? "",
    weakChapters,
    strongChapters,
  };
}

/** GET /analytics/score-trend → score progression across submitted attempts. */
export async function getScoreTrend(userId) {
  const attempts = await TestAttempt.find({ user: userId, status: "submitted" })
    .populate("test", "code")
    .sort({ createdAt: 1 });

  const data = attempts.map((a) => ({
    test: a.test?.code ?? "",
    score: a.score,
    percentile: a.percentile,
    topper: Math.round((a.maxScore || 0) * 0.81),
  }));
  return { data };
}

/** GET /analytics/heatmap?days=182 → study-activity heatmap for the last N days. */
export async function getHeatmap(userId, days = 182) {
  const n = Math.max(1, Number(days) || 182);
  const logs = await StudyLog.find({ user: userId }).sort({ date: 1 });
  const recent = logs.slice(-n);
  return { data: recent.map((l) => ({ date: l.date, value: l.value })) };
}

/** GET /analytics/recommendations → AI-personalized study recommendations. */
export async function getRecommendations(userId) {
  const [topics, pendingMistakes, profile] = await Promise.all([
    Topic.find({ user: userId }).sort({ mastery: 1 }).limit(5),
    Mistake.countDocuments({ user: userId, status: "Pending" }),
    Profile.findOne({ user: userId }),
  ]);
  const weakTopics = topics
    .filter((t) => t.mastery < 70)
    .map((t) => ({ name: t.name, mastery: t.mastery, subject: t.subject }));
  const { headline, items, topics: focusTopics, provider } = await ai.recommendations({
    weakTopics,
    pendingMistakes,
    accuracy: profile?.accuracy,
  });
  return { headline, items, topics: focusTopics, provider };
}

export default { getExamDna, getScoreTrend, getHeatmap, getRecommendations };
