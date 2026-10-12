export type ExamTrack = "JEE" | "NEET" | "UPSC" | "GATE" | "CAT" | "SSC" | "Banking";

export type Difficulty = "Easy" | "Medium" | "Hard";

export interface StudyTask {
  id: string;
  title: string;
  subject: string;
  minutes: number;
  type: "Concept" | "Practice" | "Revision" | "Mock" | "Analysis";
  done: boolean;
  time: string;
}

export interface TestSummary {
  id: string;
  title: string;
  exam: ExamTrack;
  subjects: string[];
  questions: number;
  durationMin: number;
  difficulty: Difficulty;
  scheduledFor?: string;
  attemptedOn?: string;
  score?: number;
  maxScore: number;
  percentile?: number;
  accuracy?: number;
}

export interface Mistake {
  id: string;
  question: string;
  subject: string;
  chapter: string;
  category:
    | "Concept Error"
    | "Formula Error"
    | "Calculation Error"
    | "Guess"
    | "Memory Error"
    | "Time Pressure"
    | "Careless Mistake";
  priority: "High" | "Medium" | "Low";
  status: "Pending" | "Revised" | "Mastered";
  occurredOn: string;
  timesRepeated: number;
  aiNote: string;
}

export interface TopicNode {
  id: string;
  name: string;
  subject: string;
  mastery: number;
  lastRevised: string;
  weakQuestions: number;
  x: number;
  y: number;
  links: string[];
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  institute: string;
  state: string;
  xp: number;
  accuracy: number;
  streak: number;
  isYou?: boolean;
}

/* ------------------------------------------------------------------ */
/* Authentication & session                                            */
/* ------------------------------------------------------------------ */

export type Role = "student" | "parent" | "teacher" | "admin";

/**
 * The authenticated user, mirroring `GET /api/auth/me` (see API_SPEC.md).
 * This is the canonical identity used by the route guards and app shell.
 */
export interface User {
  id: string;
  role: Role;
  name: string;
  /** Two-letter monogram used in the avatar chip, e.g. "AM". */
  initials: string;
  email: string;
  /** Exam track, e.g. "JEE". */
  exam: ExamTrack;
  /** Human label for the track, e.g. "JEE Advanced 2027". */
  examLabel: string;
  institute?: string;
  state?: string;
  streak: number;
}

/** `POST /api/auth/signup` response — an unverified user awaiting OTP. */
export interface SignupResult {
  userId: string;
  otpChannel: "sms" | "email";
  otpExpiresInSec: number;
  nextStep: "verify-otp";
}

/** Shared response for `login` and `verify-otp` — JWT + the resolved user. */
export interface AuthSession {
  token: string;
  user: User;
}

/** Normalised error envelope: `{ error: { code, message, fields? } }`. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}
