import { ApiError } from "../utils/ApiError.js";
import { Mistake } from "../models/index.js";
import { createCustomTest } from "./tests.service.js";

/**
 * Mistakes service — server-side equivalent of the Mistake Bank's in-memory
 * filter (API_SPEC.md → Page `/app/mistakes`). Filters by user + optional
 * status/category + a text regex over question/chapter, paginated 20/page.
 */

const PAGE_SIZE = 20;

/** Escape user-supplied text before building a RegExp. */
function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** GET /mistakes?status=&category=&q=&page= */
export async function listMistakes(userId, { status, category, q, page = 1 } = {}) {
  // Only accept STRING filter values — a sanitized injection attempt may arrive
  // as an object/array; ignore it rather than passing it to the query layer.
  const str = (v) => (typeof v === "string" && v ? v : undefined);
  const filter = { user: userId };
  if (str(status)) filter.status = str(status);
  if (str(category)) filter.category = str(category);
  if (str(q)) {
    const rx = new RegExp(escapeRegex(str(q)), "i");
    filter.$or = [{ question: rx }, { chapter: rx }];
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const [total, docs] = await Promise.all([
    Mistake.countDocuments(filter),
    Mistake.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE),
  ]);

  const data = docs.map((m) => ({
    id: String(m._id),
    question: m.question,
    subject: m.subject,
    chapter: m.chapter,
    category: m.category,
    priority: m.priority,
    status: m.status,
    occurredOn: m.occurredOn,
    timesRepeated: m.timesRepeated,
    aiNote: m.aiNote,
  }));

  return { data, total };
}

/** PATCH /mistakes/:id { status } → transition Pending→Revised→Mastered. */
export async function setMistakeStatus(userId, id, status) {
  const mistake = await Mistake.findOneAndUpdate(
    { _id: id, user: userId },
    { status },
    { new: true },
  );
  if (!mistake) throw ApiError.notFound("Mistake not found");
  return { id: String(mistake._id), status: mistake.status };
}

/** POST /mistakes/:id/practice → custom test of similar questions for a mistake. */
export async function practiceSimilar(userId, id, count) {
  const mistake = await Mistake.findOne({ _id: id, user: userId });
  if (!mistake) throw ApiError.notFound("Mistake not found");
  const test = await createCustomTest({
    userId,
    subjects: [mistake.subject],
    count: count || 5,
    titlePrefix: `Practice: ${mistake.chapter || mistake.subject}`,
  });
  return { testId: test.code, code: test.code };
}

export default { listMistakes, setMistakeStatus, practiceSimilar };
