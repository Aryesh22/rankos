import { StudyPlan, Topic, PomodoroSession, StudyLog } from "../models/index.js";
import * as ai from "./ai/index.js";

/**
 * Plans service — AI study-plan generation + retrieval and Pomodoro logging
 * (API_SPEC.md → Page `/app/planner`). Plans are synthesized from the student's
 * weakest topics so the week/month grids reflect real mastery gaps rather than
 * static filler. A generated plan is persisted (upsert by user+scope+start) so
 * subsequent reads are stable.
 */
const TYPES = ["Concept", "Practice", "Revision", "Analysis"];
const SUBJECTS = ["Physics", "Chemistry", "Mathematics"];

const todayStr = () => new Date().toISOString().slice(0, 10);

function addDays(dateStr, n) {
  return new Date(new Date(dateStr).getTime() + n * 86400000).toISOString().slice(0, 10);
}

function serialize(plan) {
  return {
    scope: plan.scope,
    periodStart: plan.periodStart,
    days: plan.days,
    narrative: plan.narrative ?? null,
  };
}

/**
 * Build (and persist) a plan for a scope/start from the user's weak topics.
 * @param {{ scope?:string, start?:string, constraints?:object }} args
 */
export async function generatePlan(userId, { scope = "week", start, constraints = {} } = {}) {
  const periodStart = start || todayStr();
  const dayCount = scope === "month" ? 30 : 7;
  const dailyHours = Number(constraints.dailyHours) || 6;

  const weakTopics = await Topic.find({ user: userId }).sort({ mastery: 1 }).limit(12);

  const days = Array.from({ length: dayCount }, (_, d) => {
    const load = 2 + (d % 3); // 2–4 items/day
    const items = Array.from({ length: load }, (_, i) => {
      const topic = weakTopics[(d * 3 + i) % (weakTopics.length || 1)];
      const type = TYPES[(d + i) % TYPES.length];
      const subject = topic?.subject || SUBJECTS[(d + i) % SUBJECTS.length];
      return {
        title: topic ? `${topic.name} — ${type}` : `${subject} — ${type}`,
        subject,
        minutes: Math.round((dailyHours * 60) / load),
        type,
      };
    });
    return { date: addDays(periodStart, d), load, items };
  });

  const { text: narrative } = await ai.roadmap({
    scope,
    weakTopics: weakTopics.slice(0, 5).map((t) => ({ name: t.name })),
  });

  const plan = await StudyPlan.findOneAndUpdate(
    { user: userId, scope, periodStart },
    { user: userId, scope, periodStart, days, narrative },
    { new: true, upsert: true },
  );
  return serialize(plan);
}

/** GET /plans?scope=&start= — stored plan, or generate one on the fly. */
export async function getPlans(userId, { scope = "week", start } = {}) {
  const query = { user: userId, scope };
  if (start) query.periodStart = start;
  const plan = await StudyPlan.findOne(query).sort({ periodStart: -1 });
  if (!plan) return generatePlan(userId, { scope, start });
  return serialize(plan);
}

/** POST /pomodoro — log a focus session and roll it into today's study log. */
export async function logPomodoro(userId, { focusMinutes = 25, taskId = null, completed = true } = {}) {
  const session = await PomodoroSession.create({
    user: userId,
    focusMinutes,
    taskId: taskId ? String(taskId) : null,
    completed,
  });
  await StudyLog.findOneAndUpdate(
    { user: userId, date: todayStr() },
    { $inc: { minutes: focusMinutes }, $max: { value: 1 } },
    { upsert: true },
  );
  return { id: String(session._id) };
}

export default { generatePlan, getPlans, logPomodoro };
