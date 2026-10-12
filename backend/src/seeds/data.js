/**
 * Static demo dataset — mirrors the frontend's `src/services/mockData.ts` so the
 * seeded backend reproduces exactly what the UI was designed around. Kept apart
 * from the seed runner so it can also feed tests/fixtures.
 */
export const DEMO_PASSWORD = "password123";

export const demoStudent = {
  fullName: "Aarav Mehta",
  email: "aarav@example.com",
  mobile: "+919800000001",
  exam: "JEE",
  examLabel: "JEE Advanced 2027",
  targetYear: 2027,
  institute: "Allen, Kota",
  state: "Rajasthan",
  dreamCollege: "IIT Bombay — Computer Science",
  targetRank: 480,
  currentPredictedRank: 1240,
  xp: 48250,
  level: 27,
  streak: 46,
  longestStreak: 61,
  hoursThisWeek: 38.5,
  accuracy: 72.4,
  syllabusCovered: 68,
};

export const subjects = [
  { name: "Physics", exam: "JEE", color: "#6366f1", order: 1 },
  { name: "Chemistry", exam: "JEE", color: "#10b981", order: 2 },
  { name: "Mathematics", exam: "JEE", color: "#f59e0b", order: 3 },
];

export const todayPlan = [
  { title: "Rotational Motion — Angular Momentum conservation", subject: "Physics", minutes: 55, type: "Concept", done: true, time: "06:30" },
  { title: "Aldehydes & Ketones — 40 PYQs (2015–2024)", subject: "Chemistry", minutes: 45, type: "Practice", done: true, time: "08:00" },
  { title: "Definite Integration — spaced revision set #4", subject: "Mathematics", minutes: 30, type: "Revision", done: false, time: "16:00" },
  { title: "Mistake Bank — 12 calculation errors from Mock 14", subject: "Mixed", minutes: 25, type: "Analysis", done: false, time: "18:30" },
  { title: "Part Test 07 — Mechanics + Organic", subject: "Mixed", minutes: 90, type: "Mock", done: false, time: "20:00" },
];

export const weeklyGoals = [
  { label: "Study hours", current: 38.5, target: 45, unit: "h" },
  { label: "Questions solved", current: 612, target: 750, unit: "" },
  { label: "Mistakes cleared", current: 41, target: 60, unit: "" },
  { label: "Mock tests", current: 2, target: 3, unit: "" },
];

export const upcomingTests = [
  { code: "pt-07", title: "Part Test 07 — Mechanics + Organic", exam: "JEE", subjects: ["Physics", "Chemistry"], questionCount: 60, durationMin: 120, difficulty: "Hard", scheduledFor: "Today, 20:00", maxScore: 240 },
  { code: "ft-12", title: "Full Syllabus Mock 12", exam: "JEE", subjects: ["Physics", "Chemistry", "Mathematics"], questionCount: 90, durationMin: 180, difficulty: "Hard", scheduledFor: "Sat, 09:00", maxScore: 360 },
  { code: "cs-04", title: "Calculus Sprint — Timed 30", exam: "JEE", subjects: ["Mathematics"], questionCount: 30, durationMin: 45, difficulty: "Medium", scheduledFor: "Sun, 17:00", maxScore: 120 },
];

export const previousTests = [
  { code: "mock-14", title: "Full Syllabus Mock 14", exam: "JEE", subjects: ["Physics", "Chemistry", "Mathematics"], questionCount: 90, durationMin: 180, difficulty: "Hard", maxScore: 360, attemptedOn: "12 Jul", score: 214, percentile: 97.8, accuracy: 71 },
  { code: "mock-13", title: "Full Syllabus Mock 13", exam: "JEE", subjects: ["Physics", "Chemistry", "Mathematics"], questionCount: 90, durationMin: 180, difficulty: "Hard", maxScore: 360, attemptedOn: "05 Jul", score: 198, percentile: 96.4, accuracy: 68 },
  { code: "pt-06", title: "Part Test 06 — Electrostatics + Inorganic", exam: "JEE", subjects: ["Physics", "Chemistry"], questionCount: 60, durationMin: 120, difficulty: "Medium", maxScore: 240, attemptedOn: "28 Jun", score: 168, percentile: 94.1, accuracy: 74 },
  { code: "mock-12", title: "Full Syllabus Mock 12", exam: "JEE", subjects: ["Physics", "Chemistry", "Mathematics"], questionCount: 90, durationMin: 180, difficulty: "Hard", maxScore: 360, attemptedOn: "21 Jun", score: 181, percentile: 94.9, accuracy: 65 },
];

export const scoreTrend = [
  { test: "M09", score: 142, percentile: 88.2, topper: 268 },
  { test: "M10", score: 156, percentile: 90.6, topper: 274 },
  { test: "M11", score: 171, percentile: 93.1, topper: 281 },
  { test: "M12", score: 181, percentile: 94.9, topper: 279 },
  { test: "M13", score: 198, percentile: 96.4, topper: 288 },
  { test: "M14", score: 214, percentile: 97.8, topper: 291 },
];

export const subjectBreakdown = [
  { subject: "Physics", score: 78, max: 120, accuracy: 74, time: 62 },
  { subject: "Chemistry", score: 82, max: 120, accuracy: 81, time: 44 },
  { subject: "Mathematics", score: 54, max: 120, accuracy: 58, time: 74 },
];

export const examDnaRadar = [
  { trait: "Speed", value: 74 },
  { trait: "Accuracy", value: 72 },
  { trait: "Confidence", value: 61 },
  { trait: "Retention", value: 83 },
  { trait: "Discipline", value: 91 },
  { trait: "Endurance", value: 66 },
];

export const examDnaBehaviours = [
  { key: "discipline", label: "Discipline", value: 91 },
  { key: "consistency", label: "Consistency", value: 78 },
  { key: "focus", label: "Focus", value: 81 },
  { key: "resilience", label: "Resilience", value: 64 },
];

export const errorMix = [
  { name: "Concept Error", value: 34, key: "concept" },
  { name: "Calculation Error", value: 26, key: "calculation" },
  { name: "Careless Mistake", value: 17, key: "careless" },
  { name: "Time Pressure", value: 13, key: "time" },
  { name: "Guess", value: 10, key: "guess" },
];

export const timePerQuestion = [
  { bucket: "0-30s", correct: 41, wrong: 6 },
  { bucket: "30-60s", correct: 29, wrong: 11 },
  { bucket: "1-2m", correct: 18, wrong: 14 },
  { bucket: "2-4m", correct: 9, wrong: 17 },
  { bucket: "4m+", correct: 3, wrong: 12 },
];

export const mistakes = [
  { question: "A block on a rough incline is given velocity up the plane. Find distance before stopping.", subject: "Physics", chapter: "Friction & Newton's Laws", category: "Concept Error", priority: "High", status: "Pending", occurredOn: "12 Jul", timesRepeated: 3, aiNote: "You keep applying kinetic friction in the direction of motion. Friction opposes relative sliding — draw it after fixing the velocity direction." },
  { question: "Evaluate ∫ x²·e^(−x) dx from 0 to ∞ using gamma function.", subject: "Mathematics", chapter: "Definite Integration", category: "Formula Error", priority: "High", status: "Pending", occurredOn: "12 Jul", timesRepeated: 2, aiNote: "Γ(n) = (n−1)!, not n!. This single off-by-one cost you 8 marks across the last 3 mocks." },
  { question: "Calculate pH of 0.01 M CH₃COOH given Ka = 1.8 × 10⁻⁵.", subject: "Chemistry", chapter: "Ionic Equilibrium", category: "Calculation Error", priority: "Medium", status: "Revised", occurredOn: "09 Jul", timesRepeated: 4, aiNote: "Concept is correct — you drop exponents while doing log by hand. Practise the log-table shortcut set." },
  { question: "Identify the major product of Cannizzaro reaction on 2-methylbenzaldehyde.", subject: "Chemistry", chapter: "Aldehydes & Ketones", category: "Memory Error", priority: "Medium", status: "Pending", occurredOn: "08 Jul", timesRepeated: 2, aiNote: "Named-reaction recall decays around day 9 for you. Scheduled a spaced repetition on 17 Jul." },
  { question: "Find the equation of the plane through 3 points and its distance from origin.", subject: "Mathematics", chapter: "3D Geometry", category: "Time Pressure", priority: "High", status: "Pending", occurredOn: "05 Jul", timesRepeated: 5, aiNote: "You attempted this at minute 168 of 180 with 40s spent. Move 3D Geometry into your first pass." },
  { question: "A capacitor network with a dielectric slab partially inserted — find equivalent C.", subject: "Physics", chapter: "Capacitance", category: "Careless Mistake", priority: "Low", status: "Mastered", occurredOn: "01 Jul", timesRepeated: 1, aiNote: "Right method, wrong series/parallel grouping while copying. Slow down on the redraw step." },
  { question: "Probability that a randomly chosen 4-digit number is divisible by 7 or 11.", subject: "Mathematics", chapter: "Probability", category: "Guess", priority: "High", status: "Pending", occurredOn: "12 Jul", timesRepeated: 2, aiNote: "Marked in 14s with no rough work — a guess. Inclusion–exclusion is the gap; 20 targeted questions queued." },
  { question: "Assertion–Reason on lanthanoid contraction affecting atomic radii of 5d elements.", subject: "Chemistry", chapter: "d & f Block", category: "Concept Error", priority: "Medium", status: "Revised", occurredOn: "28 Jun", timesRepeated: 3, aiNote: "You confuse the cause with the consequence. Read the one-page derivation card added to your queue." },
];

export const topicGraph = [
  { key: "mech", name: "Mechanics", subject: "Physics", mastery: 82, lastRevised: "2 days ago", weakQuestions: 6, x: 22, y: 30, links: ["rot", "grav"] },
  { key: "rot", name: "Rotational Motion", subject: "Physics", mastery: 61, lastRevised: "Today", weakQuestions: 14, x: 40, y: 18, links: ["mech"] },
  { key: "grav", name: "Gravitation", subject: "Physics", mastery: 88, lastRevised: "6 days ago", weakQuestions: 2, x: 12, y: 56, links: ["mech"] },
  { key: "emag", name: "Electromagnetism", subject: "Physics", mastery: 47, lastRevised: "11 days ago", weakQuestions: 22, x: 62, y: 38, links: ["cap"] },
  { key: "cap", name: "Capacitance", subject: "Physics", mastery: 70, lastRevised: "4 days ago", weakQuestions: 8, x: 78, y: 24, links: ["emag"] },
  { key: "orgc", name: "Organic Basics", subject: "Chemistry", mastery: 91, lastRevised: "1 day ago", weakQuestions: 1, x: 30, y: 72, links: ["alde", "amine"] },
  { key: "alde", name: "Aldehydes & Ketones", subject: "Chemistry", mastery: 66, lastRevised: "Today", weakQuestions: 11, x: 50, y: 84, links: ["orgc"] },
  { key: "amine", name: "Amines", subject: "Chemistry", mastery: 38, lastRevised: "18 days ago", weakQuestions: 26, x: 16, y: 88, links: ["orgc"] },
  { key: "ioneq", name: "Ionic Equilibrium", subject: "Chemistry", mastery: 74, lastRevised: "3 days ago", weakQuestions: 7, x: 68, y: 68, links: ["alde"] },
  { key: "calc", name: "Definite Integration", subject: "Mathematics", mastery: 55, lastRevised: "Today", weakQuestions: 19, x: 86, y: 56, links: ["prob"] },
  { key: "prob", name: "Probability", subject: "Mathematics", mastery: 42, lastRevised: "9 days ago", weakQuestions: 24, x: 90, y: 86, links: ["calc"] },
  { key: "geo3d", name: "3D Geometry", subject: "Mathematics", mastery: 34, lastRevised: "21 days ago", weakQuestions: 29, x: 48, y: 52, links: ["calc", "prob"] },
];

export const leaderboard = [
  { rank: 1, name: "Ishaan Rao", institute: "FIITJEE, Delhi", state: "Delhi", xp: 96400, accuracy: 89, streak: 128 },
  { rank: 2, name: "Diya Krishnan", institute: "Allen, Kota", state: "Rajasthan", xp: 91250, accuracy: 87, streak: 96 },
  { rank: 3, name: "Rehan Qureshi", institute: "Resonance, Kota", state: "Rajasthan", xp: 88700, accuracy: 85, streak: 74 },
  { rank: 4, name: "Sneha Patil", institute: "PACE, Mumbai", state: "Maharashtra", xp: 84110, accuracy: 84, streak: 63 },
  { rank: 5, name: "Kabir Sethi", institute: "Vidyamandir, Delhi", state: "Delhi", xp: 79980, accuracy: 82, streak: 51 },
  { rank: 6, name: "Ananya Iyer", institute: "Narayana, Hyderabad", state: "Telangana", xp: 71300, accuracy: 80, streak: 88 },
  { rank: 7, name: "Aarav Mehta", institute: "Allen, Kota", state: "Rajasthan", xp: 48250, accuracy: 72, streak: 46, isYou: true },
  { rank: 8, name: "Meera Nair", institute: "Aakash, Kochi", state: "Kerala", xp: 46900, accuracy: 71, streak: 33 },
  { rank: 9, name: "Vivaan Shah", institute: "Self study", state: "Gujarat", xp: 44210, accuracy: 69, streak: 22 },
  { rank: 10, name: "Tanvi Deshmukh", institute: "Allen, Kota", state: "Rajasthan", xp: 41870, accuracy: 68, streak: 41 },
];

export const achievements = [
  { name: "Iron Streak", detail: "45 days without a break", icon: "flame", earned: true },
  { name: "Mistake Slayer", detail: "500 mistakes cleared", icon: "target", earned: true },
  { name: "Night Owl", detail: "50 sessions after 11 PM", icon: "moon", earned: true },
  { name: "Century", detail: "100 mock tests attempted", icon: "trophy", earned: false },
  { name: "Perfect Physics", detail: "100% in a full Physics section", icon: "atom", earned: false },
  { name: "Top 1%", detail: "Percentile above 99 in a mock", icon: "crown", earned: false },
];

/** 30 demo questions (same generation rule as mockData.ts). */
export function buildQuestions() {
  const subjectNames = ["Physics", "Chemistry", "Mathematics"];
  return Array.from({ length: 30 }, (_, i) => ({
    subject: subjectNames[Math.floor(i / 10)],
    difficulty: ["Easy", "Medium", "Hard"][i % 3],
    text:
      i % 3 === 0
        ? "A uniform disc of mass M and radius R rolls without slipping down an incline of angle θ. Find the acceleration of its centre of mass."
        : i % 3 === 1
          ? "Which of the following reagents converts a primary alcohol to an aldehyde without over-oxidation?"
          : "If f(x) = ∫₀ˣ t·sin(t) dt, then the value of f′(π/2) is:",
    options:
      i % 3 === 1
        ? ["KMnO₄ / H⁺", "PCC in CH₂Cl₂", "K₂Cr₂O₇ / H₂SO₄", "Hot alkaline KMnO₄"]
        : i % 3 === 0
          ? ["g sinθ", "(2/3) g sinθ", "(1/2) g sinθ", "(3/5) g sinθ"]
          : ["π/2", "1", "π", "0"],
    correctIndex: i % 3 === 1 ? 1 : i % 3 === 0 ? 1 : 0,
  }));
}

/** 182-day study heatmap (same deterministic rule as mockData.ts). */
export function buildHeatmap() {
  return Array.from({ length: 182 }, (_, i) => {
    const seed = (i * 9301 + 49297) % 233280;
    const rnd = seed / 233280;
    const weekday = i % 7;
    const base = weekday === 0 ? rnd * 2.5 : rnd * 5;
    const value = Math.round(Math.min(5, base + (i > 140 ? 1.4 : 0)));
    return {
      date: new Date(Date.now() - (181 - i) * 86400000).toISOString().slice(0, 10),
      value,
      minutes: value * 45,
    };
  });
}
