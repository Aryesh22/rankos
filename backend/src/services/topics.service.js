import { ApiError } from "../utils/ApiError.js";
import { Topic, Revision, Note } from "../models/index.js";
import { createCustomTest } from "./tests.service.js";
import * as ai from "./ai/index.js";

/**
 * Topics service — the mastery/knowledge graph (API_SPEC.md → Pages
 * `/app/revision-graph` and `/app/exam-dna`) plus per-topic revision history.
 */

/** Humanize a lastRevised date into "Today" / "N days ago". */
function humanizeSince(date) {
  if (!date) return "Never";
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

/** GET /topics/graph → all topic nodes for the current user. */
export async function getGraph(userId) {
  const topics = await Topic.find({ user: userId });
  const nodes = topics.map((t) => ({
    id: t.key,
    name: t.name,
    subject: t.subject,
    mastery: t.mastery,
    lastRevised: humanizeSince(t.lastRevisedAt),
    weakQuestions: t.weakQuestions,
    x: t.x,
    y: t.y,
    links: t.links,
  }));
  return { nodes };
}

/** GET /topics/:id/revisions → revision history for one topic (by key). */
export async function getRevisions(userId, topicKey) {
  const revisions = await Revision.find({ user: userId, topicKey }).sort({ revisedAt: -1 });
  const data = revisions.map((r) => ({
    revisedAt: r.revisedAt,
    masteryBefore: r.masteryBefore,
    masteryAfter: r.masteryAfter,
    questionsPractised: r.questionsPractised,
  }));
  return { data };
}

/** POST /topics/:id/practice → build a custom test of weak questions for a topic. */
export async function practiceWeakQuestions(userId, topicKey, count) {
  const topic = await Topic.findOne({ user: userId, key: topicKey });
  if (!topic) throw ApiError.notFound("Topic not found");
  const test = await createCustomTest({
    userId,
    subjects: [topic.subject],
    count: count || topic.weakQuestions || 10,
    titlePrefix: `${topic.name} — Weak Questions`,
  });
  return { testId: test.code, code: test.code };
}

/** GET /topics/:id/notes → stored AI notes for a topic (newest first). */
export async function listNotes(userId, topicKey) {
  const notes = await Note.find({ user: userId, topicKey }).sort({ createdAt: -1 }).limit(10);
  return { data: notes };
}

/** POST /topics/:id/notes → generate + persist AI revision notes for a topic. */
export async function generateNotes(userId, topicKey) {
  const topic = await Topic.findOne({ user: userId, key: topicKey });
  if (!topic) throw ApiError.notFound("Topic not found");
  const { text, provider } = await ai.notes({
    name: topic.name,
    subject: topic.subject,
    mastery: topic.mastery,
  });
  const note = await Note.create({
    user: userId,
    topicKey,
    subject: topic.subject,
    title: `${topic.name} — Revision Notes`,
    content: text,
    provider,
  });
  return note;
}

export default { getGraph, getRevisions, practiceWeakQuestions, listNotes, generateNotes };
