import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError.js";
import { Test, TestAttempt, Mistake, ExamDNA, Topic, StudyTask } from "../models/index.js";
import * as ai from "./ai/index.js";
import { evaluateAfterSubmit } from "./gamification.service.js";

/**
 * Attempts service — the full test-attempt lifecycle (API_SPEC.md → Page
 * `/test/$testId` and `/app/results`): start → autosave responses → submit &
 * score → rich result analysis. Answers (`correctIndex`) are NEVER exposed until
 * the result endpoint. Every mutation verifies the attempt belongs to the user.
 */

/** Format a Date as a short "DD Mon" label (e.g. "12 Jul"). */
function shortDate(date) {
  return new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/** Load an attempt, asserting ownership (404 otherwise). */
async function ownedAttempt(userId, attemptId) {
  if (!mongoose.isValidObjectId(attemptId)) throw ApiError.notFound("Attempt not found");
  const attempt = await TestAttempt.findOne({ _id: attemptId, user: userId });
  if (!attempt) throw ApiError.notFound("Attempt not found");
  return attempt;
}

/** POST /tests/:code/attempts → create an in-progress attempt + return questions WITHOUT answers. */
export async function startAttempt(userId, code) {
  const test = await Test.findOne({ code }).populate("questions");
  if (!test) throw ApiError.notFound("Test not found");

  const attempt = await TestAttempt.create({
    user: userId,
    test: test._id,
    status: "in_progress",
    maxScore: test.maxScore,
    responses: [],
  });

  const questions = test.questions.map((q, i) => ({
    id: i + 1,
    subject: q.subject,
    difficulty: q.difficulty,
    text: q.text,
    options: q.options,
  }));

  return {
    attemptId: String(attempt._id),
    durationSec: (test.durationMin || 0) * 60,
    questions,
  };
}

/** PATCH /attempts/:attemptId/response → upsert one response by questionId. */
export async function saveResponse(userId, attemptId, body) {
  const attempt = await ownedAttempt(userId, attemptId);
  const { questionId, selectedIndex = null, status = "answered", marked = false, timeSpentSec = 0 } =
    body;

  const idx = attempt.responses.findIndex((r) => r.questionId === questionId);
  const next = { questionId, selectedIndex, status, marked, timeSpentSec };
  if (idx >= 0) attempt.responses.set(idx, next);
  else attempt.responses.push(next);
  await attempt.save();
  return { saved: true };
}

/** POST /attempts/:attemptId/submit → score, persist, and auto-file mistakes. */
export async function submitAttempt(userId, attemptId, { durationUsedSec } = {}) {
  const attempt = await ownedAttempt(userId, attemptId);
  const test = await Test.findById(attempt.test).populate("questions");
  if (!test) throw ApiError.notFound("Test not found");

  const totalQuestions = test.questionCount || test.questions.length || 1;
  const perQ = (test.maxScore || 0) / totalQuestions;

  let correct = 0;
  let answered = 0;
  const wrong = [];
  for (const r of attempt.responses) {
    if (r.selectedIndex === null || r.selectedIndex === undefined) continue;
    answered += 1;
    const q = test.questions[r.questionId - 1];
    if (!q) continue;
    if (q.correctIndex === r.selectedIndex) correct += 1;
    else wrong.push(q);
  }

  const score = Math.round(correct * perQ);
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;
  const ratio = test.maxScore ? score / test.maxScore : 0;
  const percentile = Math.min(99.9, Math.round((50 + 50 * ratio) * 10) / 10);
  const predictedAIR = Math.max(1, Math.round((100 - percentile) * 900));

  attempt.status = "submitted";
  attempt.score = score;
  attempt.maxScore = test.maxScore;
  attempt.accuracy = accuracy;
  attempt.percentile = percentile;
  attempt.predictedAIR = predictedAIR;
  attempt.durationUsedSec = durationUsedSec ?? attempt.durationUsedSec;
  attempt.submittedAt = new Date();

  // AI performance summary — generated ONCE here, then served by the result view.
  const topics = await Topic.find({ user: userId });
  const weakAreas = topics.filter((t) => t.mastery < 50).sort((a, b) => a.mastery - b.mastery).slice(0, 4).map((t) => t.name);
  const strongAreas = topics.filter((t) => t.mastery >= 80).sort((a, b) => b.mastery - a.mastery).slice(0, 4).map((t) => t.name);
  const { text: aiSummary } = await ai.summary({ score, maxScore: test.maxScore, percentile, accuracy, weakAreas, strongAreas });
  attempt.aiSummary = aiSummary;

  await attempt.save();

  if (wrong.length) {
    const occurredOn = shortDate(new Date());
    await Mistake.insertMany(
      wrong.map((q) => ({
        user: userId,
        question: q.text,
        subject: q.subject,
        chapter: q.topic || q.subject,
        category: "Concept Error",
        priority: "Medium",
        status: "Pending",
        occurredOn,
        timesRepeated: 1,
        aiNote: "",
      })),
    );
  }

  // Event-driven notifications + achievement awards (best-effort).
  await evaluateAfterSubmit(userId, attempt);

  return {
    attemptId: String(attempt._id),
    score,
    maxScore: test.maxScore,
    percentile,
    accuracy,
    resultUrl: `/app/results?attempt=${attempt._id}`,
  };
}

const DEFAULT_RADAR = [
  { trait: "Speed", value: 74 },
  { trait: "Accuracy", value: 72 },
  { trait: "Confidence", value: 61 },
  { trait: "Retention", value: 83 },
  { trait: "Discipline", value: 91 },
  { trait: "Endurance", value: 66 },
];

const DEFAULT_ERROR_MIX = [
  { name: "Concept Error", key: "concept", value: 34 },
  { name: "Calculation Error", key: "calculation", value: 26 },
  { name: "Careless Mistake", key: "careless", value: 17 },
  { name: "Time Pressure", key: "time", value: 13 },
  { name: "Guess", key: "guess", value: 10 },
];

/** Bucket a per-question timeline into the Results time/accuracy histogram. */
function buildTimeBuckets(timeline) {
  const defs = [
    { bucket: "0-30s", lo: 0, hi: 30 },
    { bucket: "30-60s", lo: 30, hi: 60 },
    { bucket: "1-2m", lo: 60, hi: 120 },
    { bucket: "2-4m", lo: 120, hi: 240 },
    { bucket: "4m+", lo: 240, hi: Infinity },
  ];
  return defs.map((d) => {
    const cells = timeline.filter((c) => c.seconds >= d.lo && c.seconds < d.hi);
    return {
      bucket: d.bucket,
      correct: cells.filter((c) => c.state === "correct").length,
      wrong: cells.filter((c) => c.state === "wrong").length,
    };
  });
}

/** GET /attempts/:attemptId/result → full result analysis for one attempt. */
export async function getResult(userId, attemptId) {
  const attempt = await ownedAttempt(userId, attemptId);
  const [test, dna, topics] = await Promise.all([
    Test.findById(attempt.test).populate("questions"),
    ExamDNA.findOne({ user: userId }),
    Topic.find({ user: userId }),
  ]);

  const questions = test?.questions ?? [];
  const N = questions.length || test?.questionCount || 90;
  const maxScore = attempt.maxScore || test?.maxScore || 0;
  const perQ = maxScore / (N || 1);
  const hasResponses = attempt.responses.length > 0;

  // Per-question timeline — real responses where present, deterministic buckets otherwise.
  const timeline = Array.from({ length: N }, (_, i) => {
    const r = attempt.responses.find((x) => x.questionId === i + 1);
    const q = questions[i];
    let state = "skipped";
    let seconds = r?.timeSpentSec || 0;
    if (r && r.selectedIndex !== null && r.selectedIndex !== undefined && q) {
      state = q.correctIndex === r.selectedIndex ? "correct" : "wrong";
    } else if (!hasResponses) {
      const seed = (i * 9301 + 49297) % 233280;
      const rnd = seed / 233280;
      state = rnd < 0.62 ? "correct" : rnd < 0.85 ? "wrong" : "skipped";
      seconds = 30 + Math.round(rnd * 150);
    }
    if (!seconds) seconds = 60;
    return { index: i + 1, state, seconds };
  });

  // Subject breakdown — prefer stored, else derive from questions + timeline.
  let subjectBreakdown = attempt.subjectBreakdown?.length
    ? attempt.subjectBreakdown.map((s) => ({
        subject: s.subject,
        score: s.score,
        max: s.max,
        accuracy: s.accuracy,
        time: s.time,
      }))
    : null;
  if (!subjectBreakdown) {
    const bySub = {};
    questions.forEach((q, i) => {
      const s = q.subject || "General";
      bySub[s] ??= { score: 0, max: 0, correct: 0, total: 0, time: 0 };
      const cell = timeline[i];
      bySub[s].total += 1;
      bySub[s].max += perQ;
      bySub[s].time += cell.seconds;
      if (cell.state === "correct") {
        bySub[s].correct += 1;
        bySub[s].score += perQ;
      }
    });
    subjectBreakdown = Object.entries(bySub).map(([subject, v]) => ({
      subject,
      score: Math.round(v.score),
      max: Math.round(v.max),
      accuracy: v.total ? Math.round((v.correct / v.total) * 100) : 0,
      time: v.total ? Math.round(v.time / v.total) : 0,
    }));
  }

  // Difficulty stats from questions + timeline.
  const byDiff = { Easy: { correct: 0, total: 0 }, Medium: { correct: 0, total: 0 }, Hard: { correct: 0, total: 0 } };
  questions.forEach((q, i) => {
    const level = q.difficulty || "Medium";
    byDiff[level] ??= { correct: 0, total: 0 };
    byDiff[level].total += 1;
    if (timeline[i].state === "correct") byDiff[level].correct += 1;
  });
  const difficultyStats = ["Easy", "Medium", "Hard"].map((level) => ({
    level,
    correct: byDiff[level]?.correct ?? 0,
    total: byDiff[level]?.total ?? 0,
  }));

  const weakAreas = topics
    .filter((t) => t.mastery < 50)
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, 4)
    .map((t) => t.name);
  const strongAreas = topics
    .filter((t) => t.mastery >= 80)
    .sort((a, b) => b.mastery - a.mastery)
    .slice(0, 4)
    .map((t) => t.name);

  const errorMix = dna?.errorProfile?.length
    ? dna.errorProfile.map((e) => ({ name: e.label, key: e.key, value: e.value }))
    : DEFAULT_ERROR_MIX;

  return {
    score: attempt.score,
    maxScore,
    percentile: attempt.percentile,
    predictedAIR: attempt.predictedAIR ?? 1240,
    accuracy: attempt.accuracy,
    aiFeedback:
      attempt.aiSummary ||
      dna?.narrative ||
      "Solid attempt. Tighten your weakest chapters and convert your careless errors — the fastest points on the board.",
    timeline,
    timePerQuestion: buildTimeBuckets(timeline),
    errorMix,
    subjectBreakdown,
    difficultyStats,
    radar: dna?.radar?.length ? dna.radar.map((r) => ({ trait: r.trait, value: r.value })) : DEFAULT_RADAR,
    weakAreas,
    strongAreas,
  };
}

/**
 * POST /attempts/:attemptId/to-mistake-bank → file wrong answers as Mistakes.
 * With `questionIds`, only those are filed; otherwise every wrong response is.
 * Skips questions already present in the user's bank (idempotent-ish).
 */
export async function toMistakeBank(userId, attemptId, questionIds = []) {
  const attempt = await ownedAttempt(userId, attemptId);
  const test = await Test.findById(attempt.test).populate("questions");
  if (!test) throw ApiError.notFound("Test not found");

  const wrong = [];
  for (const r of attempt.responses) {
    if (r.selectedIndex === null || r.selectedIndex === undefined) continue;
    const q = test.questions[r.questionId - 1];
    if (q && q.correctIndex !== r.selectedIndex) wrong.push(r.questionId);
  }
  let targets = wrong;
  if (Array.isArray(questionIds) && questionIds.length) {
    targets = wrong.length ? wrong.filter((id) => questionIds.includes(id)) : questionIds;
  }

  const occurredOn = shortDate(new Date());
  const docs = [];
  for (const qid of targets) {
    const q = test.questions[qid - 1];
    if (!q) continue;
    if (await Mistake.exists({ user: userId, question: q.text })) continue;
    docs.push({
      user: userId,
      question: q.text,
      subject: q.subject,
      chapter: q.topic || q.subject,
      category: "Concept Error",
      priority: "Medium",
      status: "Pending",
      occurredOn,
      timesRepeated: 1,
      aiNote: "",
    });
  }
  if (docs.length) await Mistake.insertMany(docs);
  return { created: docs.length };
}

/**
 * POST /attempts/:attemptId/schedule-revision → create Revision study tasks for
 * the given topic keys (today's plan).
 */
export async function scheduleRevision(userId, attemptId, topicIds = []) {
  await ownedAttempt(userId, attemptId);
  const today = new Date().toISOString().slice(0, 10);
  const topics = await Topic.find({ user: userId, key: { $in: topicIds } });
  const tasks = topics.map((t) => ({
    user: userId,
    date: today,
    title: `Revise ${t.name}`,
    subject: t.subject,
    minutes: 30,
    type: "Revision",
    time: null,
    done: false,
  }));
  if (tasks.length) await StudyTask.insertMany(tasks);
  return { tasksCreated: tasks.length };
}

export default {
  startAttempt,
  saveResponse,
  submitAttempt,
  getResult,
  toMistakeBank,
  scheduleRevision,
};
