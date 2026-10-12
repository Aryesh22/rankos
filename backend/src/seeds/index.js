/**
 * Database seed runner — populates a fresh RankOS database with realistic demo
 * data mirroring the frontend mock dataset, so every page loads real records.
 *
 * Usage:  npm run seed         (uses MONGODB_URI from .env)
 *         node src/seeds/index.js
 *
 * Idempotent: it CLEARS the demo collections first, then re-inserts. Safe to run
 * repeatedly in development. Demo credentials are printed at the end.
 */
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { logger } from "../config/logger.js";
import { hashPassword } from "../utils/password.util.js";
import { ROLES } from "../constants/roles.js";
import {
  User,
  Profile,
  Subject,
  Topic,
  Question,
  Test,
  TestAttempt,
  Mistake,
  ExamDNA,
  StudyTask,
  StudyPlan,
  Revision,
  StudyLog,
  WeeklyGoal,
  AIChat,
  Notification,
  Achievement,
  LeaderboardEntry,
} from "../models/index.js";
import * as D from "./data.js";

const today = () => new Date().toISOString().slice(0, 10);

/** Convert a human "lastRevised" label to an approximate Date. */
function labelToDate(label) {
  if (!label) return null;
  if (/today/i.test(label)) return new Date();
  const m = label.match(/(\d+)\s*day/i);
  if (m) return new Date(Date.now() - Number(m[1]) * 86400000);
  return new Date(Date.now() - 7 * 86400000);
}

async function clearAll() {
  const models = [
    User, Profile, Subject, Topic, Question, Test, TestAttempt, Mistake, ExamDNA,
    StudyTask, StudyPlan, Revision, StudyLog, WeeklyGoal, AIChat, Notification,
    Achievement, LeaderboardEntry,
  ];
  await Promise.all(models.map((M) => M.deleteMany({})));
  logger.info("[seed] cleared existing collections");
}

async function run() {
  await connectDatabase();
  await clearAll();

  const passwordHash = await hashPassword(D.DEMO_PASSWORD);

  // ── Users (student + teacher + parent demo accounts) ─────────
  const student = await User.create({
    fullName: D.demoStudent.fullName,
    email: D.demoStudent.email,
    mobile: D.demoStudent.mobile,
    passwordHash,
    role: ROLES.STUDENT,
    exam: D.demoStudent.exam,
    institute: D.demoStudent.institute,
    state: D.demoStudent.state,
    isEmailVerified: true,
    isMobileVerified: true,
  });
  const teacher = await User.create({
    fullName: "Priya Sharma", email: "teacher@example.com", mobile: "+919800000002",
    passwordHash, role: ROLES.TEACHER, isEmailVerified: true, isMobileVerified: true,
  });
  const parent = await User.create({
    fullName: "Rajesh Mehta", email: "parent@example.com", mobile: "+919800000003",
    passwordHash, role: ROLES.PARENT, isEmailVerified: true, isMobileVerified: true,
  });

  // ── Profile + ExamDNA ────────────────────────────────────────
  await Profile.create({
    user: student._id,
    exam: D.demoStudent.exam,
    examLabel: D.demoStudent.examLabel,
    targetYear: D.demoStudent.targetYear,
    dreamCollege: D.demoStudent.dreamCollege,
    institute: D.demoStudent.institute,
    state: D.demoStudent.state,
    targetRank: D.demoStudent.targetRank,
    currentPredictedRank: D.demoStudent.currentPredictedRank,
    xp: D.demoStudent.xp,
    level: D.demoStudent.level,
    streak: D.demoStudent.streak,
    longestStreak: D.demoStudent.longestStreak,
    lastActiveOn: new Date(),
    hoursThisWeek: D.demoStudent.hoursThisWeek,
    accuracy: D.demoStudent.accuracy,
    syllabusCovered: D.demoStudent.syllabusCovered,
  });

  await ExamDNA.create({
    user: student._id,
    radar: D.examDnaRadar,
    behaviours: D.examDnaBehaviours,
    errorProfile: D.errorMix.map((e) => ({ key: e.key, label: e.name, value: e.value })),
    burnoutRisk: "Moderate",
    enduranceDropPct: 27,
    learningVelocity: 1.8,
    narrative:
      "Your discipline and retention are elite, but endurance drops ~27% in the final 40 minutes of full mocks — the last-section accuracy fall traces to 3D Geometry and Probability being scheduled late. Move them into your first pass.",
  });

  // ── Subjects, Topics, Questions ──────────────────────────────
  await Subject.insertMany(D.subjects);

  await Topic.insertMany(
    D.topicGraph.map((t) => ({
      user: student._id,
      key: t.key,
      name: t.name,
      subject: t.subject,
      mastery: t.mastery,
      lastRevisedAt: labelToDate(t.lastRevised),
      weakQuestions: t.weakQuestions,
      x: t.x,
      y: t.y,
      links: t.links,
    })),
  );

  const questionDocs = await Question.insertMany(D.buildQuestions());

  // ── Tests (upcoming + previous) ──────────────────────────────
  const linkQ = (n) => questionDocs.slice(0, Math.min(n, questionDocs.length)).map((q) => q._id);

  const upcomingDocs = await Test.insertMany(
    D.upcomingTests.map((t) => ({
      code: t.code, title: t.title, exam: t.exam, subjects: t.subjects,
      questions: linkQ(t.questionCount), questionCount: t.questionCount,
      durationMin: t.durationMin, maxScore: t.maxScore, difficulty: t.difficulty,
      scheduledFor: t.scheduledFor, isCustom: false,
    })),
  );

  const previousDocs = await Test.insertMany(
    D.previousTests.map((t) => ({
      code: t.code, title: t.title, exam: t.exam, subjects: t.subjects,
      questions: linkQ(t.questionCount), questionCount: t.questionCount,
      durationMin: t.durationMin, maxScore: t.maxScore, difficulty: t.difficulty,
      isCustom: false,
    })),
  );

  // ── Test attempts for the previous tests (submitted) ─────────
  const attemptDate = { "12 Jul": 12, "05 Jul": 5, "28 Jun": 28, "21 Jun": 21 };
  await TestAttempt.insertMany(
    D.previousTests.map((t, i) => {
      const test = previousDocs[i];
      return {
        user: student._id,
        test: test._id,
        status: "submitted",
        responses: [],
        score: t.score,
        maxScore: t.maxScore,
        percentile: t.percentile,
        accuracy: t.accuracy,
        predictedAIR: 1240 + i * 60,
        durationUsedSec: (t.durationMin - 3) * 60,
        subjectBreakdown: t.code === "mock-14" ? D.subjectBreakdown : [],
        submittedAt: new Date(),
      };
    }),
  );

  // ── Mistakes ─────────────────────────────────────────────────
  await Mistake.insertMany(D.mistakes.map((m) => ({ user: student._id, ...m })));

  // ── Study tasks (today) + a week plan ────────────────────────
  await StudyTask.insertMany(D.todayPlan.map((task) => ({ user: student._id, date: today(), ...task })));

  await StudyPlan.create({
    user: student._id,
    scope: "week",
    periodStart: today(),
    days: Array.from({ length: 7 }, (_, d) => ({
      date: new Date(Date.now() + d * 86400000).toISOString().slice(0, 10),
      load: (d % 3) + 2,
      items: D.todayPlan.slice(0, (d % 3) + 2).map((t) => ({
        title: t.title, subject: t.subject, minutes: t.minutes, type: t.type,
      })),
    })),
  });

  // ── Revisions (recent events) ────────────────────────────────
  await Revision.insertMany([
    { user: student._id, topicKey: "rot", masteryBefore: 55, masteryAfter: 61, questionsPractised: 12, revisedAt: new Date() },
    { user: student._id, topicKey: "calc", masteryBefore: 49, masteryAfter: 55, questionsPractised: 15, revisedAt: new Date() },
    { user: student._id, topicKey: "ioneq", masteryBefore: 68, masteryAfter: 74, questionsPractised: 9, revisedAt: new Date(Date.now() - 3 * 86400000) },
  ]);

  // ── Study logs (heatmap) ─────────────────────────────────────
  await StudyLog.insertMany(D.buildHeatmap().map((h) => ({ user: student._id, ...h })));

  // ── Weekly goals ─────────────────────────────────────────────
  await WeeklyGoal.insertMany(D.weeklyGoals.map((g) => ({ user: student._id, weekStart: today(), ...g })));

  // ── AI chat conversation ─────────────────────────────────────
  await AIChat.create({
    user: student._id,
    title: "Percentile drop analysis",
    messages: [
      { role: "user", text: "Why did my percentile drop in Mock 13?" },
      { role: "ai", text: "Across your last 6 attempts, the dip traces to Mathematics — accuracy fell to 58% while Physics and Chemistry held. The biggest leak is 3D Geometry (34% mastery), attempted late under time pressure.", groundingRefs: ["attempt:mock-13", "topic:geo3d"] },
    ],
  });

  // ── Notifications ────────────────────────────────────────────
  await Notification.insertMany([
    { user: student._id, type: "reminder", title: "Part Test 07 starts at 20:00", body: "Mechanics + Organic. 60 questions, 120 minutes.", link: "/app/tests" },
    { user: student._id, type: "insight", title: "3 mistakes due for revision", body: "Your spaced-repetition queue has 3 items scheduled for today.", link: "/app/mistakes" },
    { user: student._id, type: "achievement", title: "Iron Streak unlocked", body: "45 days without a break. Keep it going!", read: true, link: "/app/profile" },
  ]);

  // ── Achievements ─────────────────────────────────────────────
  await Achievement.insertMany(
    D.achievements.map((a) => ({ user: student._id, ...a, earnedAt: a.earned ? new Date() : null })),
  );

  // ── Leaderboard entries (link Aarav's row to the student user) ─
  await LeaderboardEntry.insertMany(
    ["weekly", "monthly", "overall"].flatMap((range) =>
      D.leaderboard.map((e) => ({
        user: e.isYou ? student._id : null,
        name: e.name, institute: e.institute, state: e.state,
        xp: e.xp, accuracy: e.accuracy, streak: e.streak,
        scope: "india", range,
      })),
    ),
  );

  logger.info("[seed] done ✔");
  logger.info(`[seed] demo login → email: ${D.demoStudent.email}  mobile: ${D.demoStudent.mobile}  password: ${D.DEMO_PASSWORD}`);
  logger.info("[seed] teacher@example.com / parent@example.com share the same password");
}

// Auto-run only when executed directly (`node src/seeds/index.js` / `npm run seed`),
// not when imported by a test/harness.
const invokedDirectly =
  process.argv[1] && import.meta.url === `file://${process.argv[1]}`;

if (invokedDirectly) {
  run()
    .then(async () => {
      await disconnectDatabase();
      process.exit(0);
    })
    .catch(async (err) => {
      logger.error(`[seed] failed: ${err.stack || err.message}`);
      await disconnectDatabase().catch(() => {});
      process.exit(1);
    });
}

export default run;
export { run };
