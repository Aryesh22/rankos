import { Profile, StudyTask, WeeklyGoal, TestAttempt, Mistake, Test, ExamDNA, Topic } from "../models/index.js";

/**
 * Dashboard service — assembles the single aggregate read backing the `/app`
 * dashboard page (API_SPEC.md → Page `/app`). Returns the RAW shape the frontend
 * consumes directly (no envelope). All reads are scoped to the current user.
 */

const todayStr = () => new Date().toISOString().slice(0, 10);

/** First sentence (up to and including the first period) of a narrative string. */
function firstSentence(s) {
  if (!s) return "";
  const m = String(s).match(/^[^.]*\./);
  return m ? m[0] : String(s);
}

/** Aggregate every widget the dashboard needs in one round-trip. */
export async function getDashboard(userId) {
  const [profile, tasks, goals, attempts, mistakes, upcoming, dna, topics] = await Promise.all([
    Profile.findOne({ user: userId }),
    StudyTask.find({ user: userId, date: todayStr() }).sort({ time: 1 }),
    WeeklyGoal.find({ user: userId }),
    TestAttempt.find({ user: userId, status: "submitted" })
      .populate("test", "code maxScore")
      .sort({ createdAt: 1 }),
    Mistake.find({ user: userId, status: "Pending" }).sort({ createdAt: -1 }).limit(4),
    Test.find({ scheduledFor: { $ne: null } }),
    ExamDNA.findOne({ user: userId }),
    Topic.find({ user: userId }),
  ]);

  const student = {
    streak: profile?.streak ?? 0,
    currentPredictedRank: profile?.currentPredictedRank ?? null,
    targetRank: profile?.targetRank ?? null,
    accuracy: profile?.accuracy ?? 0,
    hoursThisWeek: profile?.hoursThisWeek ?? 0,
    xp: profile?.xp ?? 0,
    level: profile?.level ?? 1,
  };

  const weakTopics = topics
    .filter((t) => t.mastery < 50)
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, 3)
    .map((t) => t.name);

  return {
    student,
    todayPlan: tasks.map((t) => ({
      id: String(t._id),
      title: t.title,
      subject: t.subject,
      minutes: t.minutes,
      type: t.type,
      time: t.time,
      done: t.done,
    })),
    weeklyGoals: goals.map((g) => ({
      label: g.label,
      current: g.current,
      target: g.target,
      unit: g.unit,
    })),
    scoreTrend: attempts.map((a) => ({
      test: a.test?.code ?? "",
      score: a.score,
      percentile: a.percentile,
      topper: Math.round((a.maxScore || 0) * 0.81),
    })),
    revisionQueue: mistakes.map((m) => ({
      id: String(m._id),
      question: m.question,
      subject: m.subject,
      priority: m.priority,
      status: m.status,
    })),
    upcomingTests: upcoming.map((t) => ({
      id: t.code,
      code: t.code,
      title: t.title,
      difficulty: t.difficulty,
      questions: t.questionCount,
      durationMin: t.durationMin,
      maxScore: t.maxScore,
      scheduledFor: t.scheduledFor,
    })),
    aiInsight: {
      headline: firstSentence(dna?.narrative),
      topics: weakTopics,
    },
  };
}

export default { getDashboard };
