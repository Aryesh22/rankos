/**
 * Exam-track helpers. Maps a short track code (as sent by the signup form) to a
 * human label + a sensible default target year, matching the frontend's
 * `examLabel` (e.g. "JEE" → "JEE Advanced 2027").
 */
const EXAM_META = {
  JEE: { label: "JEE Advanced", year: 2027 },
  NEET: { label: "NEET UG", year: 2027 },
  UPSC: { label: "UPSC CSE", year: 2027 },
  GATE: { label: "GATE", year: 2027 },
  CAT: { label: "CAT", year: 2026 },
  SSC: { label: "SSC CGL", year: 2026 },
  Banking: { label: "Banking", year: 2026 },
};

/** Full human label for a track, e.g. "JEE" → "JEE Advanced 2027". */
export function examLabelFor(track, year) {
  const meta = EXAM_META[track];
  if (!meta) return track || null;
  return `${meta.label} ${year ?? meta.year}`;
}

/** Default target year for a track. */
export function examYearFor(track) {
  return EXAM_META[track]?.year ?? null;
}

export default { examLabelFor, examYearFor };
