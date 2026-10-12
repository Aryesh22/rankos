import { randomBytes } from "node:crypto";
import { ApiError } from "../utils/ApiError.js";
import { Test, TestAttempt, Question } from "../models/index.js";

/**
 * Tests service — Test Centre reads (API_SPEC.md → Pages `/app/tests` and
 * `/test/$testId`): upcoming catalog, attempt history, aggregate stat cards and
 * single-test metadata. Attempt LIFECYCLE lives in attempts.service.js.
 */

/** Format a Date as a short "DD Mon" label (e.g. "12 Jul"). */
function shortDate(date) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function toSummary(t) {
  return {
    id: t.code,
    code: t.code,
    title: t.title,
    exam: t.exam,
    subjects: t.subjects,
    questions: t.questionCount,
    durationMin: t.durationMin,
    maxScore: t.maxScore,
    difficulty: t.difficulty,
    scheduledFor: t.scheduledFor,
  };
}

/** GET /tests?status=upcoming → scheduled tests. */
export async function listUpcoming() {
  const tests = await Test.find({ scheduledFor: { $ne: null } });
  return { data: tests.map(toSummary) };
}

/** GET /tests?status=history → the current user's submitted attempts as rows. */
export async function listHistory(userId) {
  const attempts = await TestAttempt.find({ user: userId, status: "submitted" })
    .populate("test", "code title")
    .sort({ submittedAt: -1, createdAt: -1 });

  const data = attempts.map((a) => ({
    id: a.test?.code ?? String(a.test),
    title: a.test?.title ?? "",
    attemptedOn: shortDate(a.submittedAt || a.createdAt),
    score: a.score,
    maxScore: a.maxScore,
    accuracy: a.accuracy,
    percentile: a.percentile,
  }));
  return { data };
}

/** GET /tests/stats → aggregate stat cards from the user's submitted attempts. */
export async function getStats(userId) {
  const attempts = await TestAttempt.find({ user: userId, status: "submitted" }).populate(
    "test",
    "questionCount",
  );

  const attempted = attempts.length;
  if (attempted === 0) {
    return { attempted: 0, avgAccuracy: 0, avgTimePerQuestionSec: 0, bestPercentile: 0 };
  }

  const avgAccuracy =
    attempts.reduce((sum, a) => sum + (a.accuracy || 0), 0) / attempted;
  const perQTimes = attempts.map((a) => {
    const qCount = a.test?.questionCount || 0;
    return qCount ? (a.durationUsedSec || 0) / qCount : 0;
  });
  const avgTimePerQuestionSec =
    perQTimes.reduce((sum, v) => sum + v, 0) / perQTimes.length;
  const bestPercentile = Math.max(...attempts.map((a) => a.percentile || 0));

  return {
    attempted,
    avgAccuracy: Math.round(avgAccuracy * 10) / 10,
    avgTimePerQuestionSec: Math.round(avgTimePerQuestionSec),
    bestPercentile: Math.round(bestPercentile * 10) / 10,
  };
}

/** GET /tests/:code → single-test metadata for the exam interface. */
export async function getByCode(code) {
  const test = await Test.findOne({ code });
  if (!test) throw ApiError.notFound("Test not found");
  return {
    id: test.code,
    code: test.code,
    title: test.title,
    durationMin: test.durationMin,
    questionCount: test.questionCount,
    subjects: test.subjects,
    maxScore: test.maxScore,
  };
}

/** Normalize a UI difficulty label (e.g. "Exam-level") to the Test enum. */
function normalizeDifficulty(d) {
  if (!d) return "Medium";
  const k = String(d).toLowerCase();
  if (k.startsWith("exam")) return "Hard";
  if (["easy", "medium", "hard"].includes(k)) return k[0].toUpperCase() + k.slice(1);
  return "Medium";
}

/**
 * Create a custom practice Test by randomly sampling `count` questions (optionally
 * scoped to `subjects`) and return the persisted Test. Shared by the custom
 * generator and the topic/mistake "practice" actions. JEE marking (+4/q).
 * @param {{ userId:string, subjects?:string[], count?:number, difficulty?:string, titlePrefix?:string, exam?:string }} args
 */
export async function createCustomTest({
  userId,
  subjects = [],
  count = 20,
  difficulty,
  titlePrefix = "Custom Practice",
  exam = "JEE",
}) {
  const n = Math.min(Math.max(1, Number(count) || 20), 100);
  const scoped = Array.isArray(subjects) && subjects.length ? { subject: { $in: subjects } } : {};

  let sampled = await Question.aggregate([
    { $match: scoped },
    { $sample: { size: n } },
    { $project: { _id: 1 } },
  ]);
  // Fall back to the whole bank if the subject filter matched nothing.
  if (sampled.length === 0 && subjects.length) {
    sampled = await Question.aggregate([{ $sample: { size: n } }, { $project: { _id: 1 } }]);
  }
  const ids = sampled.map((s) => s._id);
  if (ids.length === 0) throw ApiError.badRequest("No questions available to build a test.");

  const test = await Test.create({
    code: `custom-${randomBytes(5).toString("hex")}`,
    title: `${titlePrefix} — ${ids.length} Q`,
    exam,
    subjects: subjects?.length ? subjects : [],
    questions: ids,
    questionCount: ids.length,
    durationMin: Math.max(15, Math.round(ids.length * 1.5)),
    maxScore: ids.length * 4,
    difficulty: normalizeDifficulty(difficulty),
    isCustom: true,
    owner: userId,
  });
  return test;
}

/** POST /tests/custom → generate a custom test from subjects/difficulty/count. */
export async function generateCustom(userId, { subjects, difficulty, count } = {}) {
  const test = await createCustomTest({
    userId,
    subjects,
    difficulty,
    count,
    titlePrefix: "Custom Test",
  });
  return { testId: test.code, code: test.code, questionCount: test.questionCount };
}

export default { listUpcoming, listHistory, getStats, getByCode, createCustomTest, generateCustom };
