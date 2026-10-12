import { logger } from "../../config/logger.js";
import { getProvider, providerInfo } from "./providers/index.js";

/**
 * AI service facade. Every feature helper builds a system+user prompt for a real
 * LLM AND supplies a deterministic, data-grounded composer used when no remote
 * provider is configured (or a remote call fails). Callers never see a dummy
 * response — the fallback is synthesized from the student's actual RankOS data.
 *
 * Adding a provider or switching models is an env change only (see providers/).
 */

/** Run a prompt through the active provider, falling back to the grounded composer. */
async function run({ system, prompt, fallback, maxTokens = 700, temperature = 0.6 }) {
  const provider = getProvider();
  if (provider.isRemote) {
    try {
      const text = await provider.generate({ system, prompt, maxTokens, temperature });
      if (text && text.trim()) return { text: text.trim(), provider: provider.name };
      logger.warn(`[ai] ${provider.name} returned empty — using grounded fallback`);
    } catch (err) {
      logger.warn(`[ai] ${provider.name} failed (${err.message}) — using grounded fallback`);
    }
  }
  return { text: fallback(), provider: "local" };
}

export { providerInfo };

const MENTOR_SYSTEM =
  "You are RankOS, an elite JEE/NEET exam mentor. Be concise (2–4 sentences), specific, " +
  "encouraging, and strictly grounded in the student's data. Give one clear next action.";

/** AI Mentor reply. ctx: { question, weakest, pendingMistakes, accuracy } */
export function mentorReply(ctx) {
  const { question, weakest, pendingMistakes = 0, accuracy } = ctx;
  const prompt =
    `Student asks: "${question}".\n` +
    `Data — weakest topic: ${weakest ? `${weakest.name} (${weakest.mastery}% mastery)` : "n/a"}; ` +
    `pending mistakes: ${pendingMistakes}; overall accuracy: ${accuracy ?? "?"}%.\n` +
    `Answer their question and end with the single highest-leverage next step.`;
  const fallback = () => {
    const topicPart = weakest
      ? `your weakest area is ${weakest.name} (${weakest.mastery}% mastery)`
      : "your mastery looks steady across chapters";
    return (
      `Looking at your recent data, ${topicPart}, and you have ${pendingMistakes} pending ` +
      `mistake${pendingMistakes === 1 ? "" : "s"} to clear. Block a focused session on ` +
      `${weakest ? weakest.name : "your weak chapters"} and close those mistakes before your next mock — ` +
      `that's the fastest way to lift your percentile.`
    );
  };
  return run({ system: MENTOR_SYSTEM, prompt, fallback, maxTokens: 400 });
}

/** Personalized recommendations. ctx: { weakTopics[], pendingMistakes, accuracy }. Returns {headline, items[], provider}. */
export async function recommendations(ctx) {
  const { weakTopics = [], pendingMistakes = 0, accuracy } = ctx;
  const topicList = weakTopics.map((t) => `${t.name} (${t.mastery}%)`).join(", ") || "none flagged";
  const prompt =
    `Produce 3–5 short, actionable study recommendations as a plain bullet list (no preamble).\n` +
    `Weak topics: ${topicList}. Pending mistakes: ${pendingMistakes}. Accuracy: ${accuracy ?? "?"}%.`;
  const fallback = () =>
    [
      weakTopics[0] && `Prioritise ${weakTopics[0].name} — it's your lowest mastery at ${weakTopics[0].mastery}%.`,
      pendingMistakes > 0 && `Clear your ${pendingMistakes} pending mistakes before the next mock.`,
      weakTopics[1] && `Schedule a spaced-revision set for ${weakTopics[1].name}.`,
      accuracy != null && accuracy < 70 && "Slow down on the first pass — your accuracy has room to climb.",
      "Attempt one timed section daily to build endurance.",
    ]
      .filter(Boolean)
      .join("\n");

  const { text, provider } = await run({
    system: MENTOR_SYSTEM,
    prompt,
    fallback,
    maxTokens: 400,
  });
  const items = text
    .split("\n")
    .map((l) => l.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter(Boolean);
  const headline = weakTopics[0]
    ? `Focus on ${weakTopics[0].name} to lift your predicted rank`
    : "You're on track — keep the streak alive";
  return { headline, items, topics: weakTopics.slice(0, 3).map((t) => t.name), provider };
}

/** AI revision notes for a topic. ctx: { name, subject, mastery } */
export function notes(ctx) {
  const { name, subject, mastery } = ctx;
  const prompt =
    `Write concise revision notes for the ${subject} topic "${name}" aimed at a JEE/NEET aspirant ` +
    `(current mastery ${mastery}%). Use short markdown sections: Key ideas, Common traps, Must-know formulas, Quick drill.`;
  const fallback = () =>
    `## ${name} — Revision Notes\n\n` +
    `**Key ideas.** Nail the core definitions and the one governing principle of ${name}; most ${subject} questions here test a single concept applied under time pressure.\n\n` +
    `**Common traps.** Sign/direction errors and mis-grouping terms — the mistakes that cost you marks at ${mastery}% mastery. Re-draw the setup before solving.\n\n` +
    `**Must-know formulas.** Keep the standard results for ${name} on a flashcard and recall them cold.\n\n` +
    `**Quick drill.** Do 10 mixed PYQs on ${name} timed at 90s each, then review every wrong one in your Mistake Bank.`;
  return run({ system: MENTOR_SYSTEM, prompt, fallback, maxTokens: 700 });
}

/** AI performance summary of an attempt. ctx: { score, maxScore, percentile, accuracy, weakAreas[], strongAreas[] } */
export function summary(ctx) {
  const { score, maxScore, percentile, accuracy, weakAreas = [], strongAreas = [] } = ctx;
  const prompt =
    `Summarise this mock result for the student in 3–4 sentences: score ${score}/${maxScore}, ` +
    `percentile ${percentile}, accuracy ${accuracy}%. Strong: ${strongAreas.join(", ") || "n/a"}. ` +
    `Weak: ${weakAreas.join(", ") || "n/a"}. Be encouraging and give one focus for next time.`;
  const fallback = () =>
    `You scored ${score}/${maxScore} (${percentile} percentile) at ${accuracy}% accuracy. ` +
    `${strongAreas.length ? `Your strengths — ${strongAreas.slice(0, 2).join(" and ")} — are holding up well. ` : ""}` +
    `${weakAreas.length ? `The fastest gains are in ${weakAreas.slice(0, 2).join(" and ")}: move them into your first pass and clear the related mistakes. ` : ""}` +
    `Keep converting careless errors and your percentile will climb next mock.`;
  return run({ system: MENTOR_SYSTEM, prompt, fallback, maxTokens: 400 });
}

/** AI roadmap narrative for a study plan. ctx: { scope, weakTopics[] } */
export function roadmap(ctx) {
  const { scope = "week", weakTopics = [] } = ctx;
  const list = weakTopics.map((t) => t.name).slice(0, 5).join(", ") || "your weak chapters";
  const prompt =
    `In 2–3 sentences, explain the strategy behind a ${scope} study roadmap that front-loads ${list} ` +
    `for a JEE/NEET aspirant. Motivating and specific.`;
  const fallback = () =>
    `This ${scope} roadmap front-loads your lowest-mastery chapters (${list}) while they're most fixable, ` +
    `interleaving concept, practice and spaced revision so nothing decays. Protect the daily revision block — ` +
    `consistency here is what moves your predicted rank.`;
  return run({ system: MENTOR_SYSTEM, prompt, fallback, maxTokens: 300 });
}

export default { mentorReply, recommendations, notes, summary, roadmap, providerInfo };
