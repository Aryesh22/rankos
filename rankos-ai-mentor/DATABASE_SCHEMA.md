# RankOS — Database Schema (MongoDB)

> **Analysis date:** 2026-07-29
> Derived from `src/types/index.ts`, `src/services/mockData.ts`, and every route's data usage. No files were modified.
> Notation: Mongoose-style. `ObjectId` = reference. Enums shown inline. Timestamps (`createdAt`/`updatedAt`) assumed on every collection unless noted.

The frontend today stores everything as flat mock arrays for a single hard-coded student (`Aarav Mehta`). The schema below normalizes that into per-user collections.

---

## Collections at a glance

| # | Collection | Backs frontend | Owner |
|---|-----------|----------------|-------|
| 1 | `users` | profile, auth, gamification, targets | — |
| 2 | `sessions` / (or JWT) | auth | user |
| 3 | `otps` | signup verification, resets | user |
| 4 | `studyTasks` | dashboard + planner daily plan | user |
| 5 | `weeklyGoals` | dashboard + planner goals | user |
| 6 | `plans` | planner week/month | user |
| 7 | `pomodoroSessions` | planner Pomodoro (optional) | user |
| 8 | `tests` | test catalogue (templates/scheduled) | shared/user |
| 9 | `questions` | test interface | test |
| 10 | `testAttempts` | test taking + results | user |
| 11 | `mistakes` | Mistake Bank | user |
| 12 | `topicNodes` | revision graph + exam DNA | user (or per-exam template) |
| 13 | `revisionEvents` | revision-graph history | user/topic |
| 14 | `examDna` | Exam DNA analytics | user |
| 15 | `studyLogs` | heatmap / consistency | user |
| 16 | `leaderboardEntries` (or derived) | leaderboard | user |
| 17 | `achievements` + `userAchievements` | profile badges | user |
| 18 | `parentLinks` / `parentReports` | parent view | parent↔student |
| 19 | `batches` | teacher view | teacher |
| 20 | `assignments` | teacher view | teacher/batch |
| 21 | `userSettings` | settings | user |
| 22 | `chatMessages` | AI mentor dock | user |

---

## 1. `users`

Central document. Combines auth, `student` mock profile, gamification, and targets.

```js
User {
  _id: ObjectId,
  role: enum["student","parent","teacher","admin"],   // default "student"
  // --- identity / auth ---
  name: String,                      // student.name  "Aarav Mehta"
  initials: String,                  // student.initials "AM" (derivable)
  email: String, unique, indexed,
  mobile: String, unique, sparse,    // signup collects mobile
  passwordHash: String,              // bcrypt/argon2
  authProviders: [{ provider: enum["google","apple"], providerId: String }],
  emailVerified: Boolean,
  mobileVerified: Boolean,           // gated by OTP
  // --- exam context ---
  exam: enum["JEE","NEET","UPSC","GATE","CAT","SSC","Banking"],  // signup picker
  examLabel: String,                 // student.exam "JEE Advanced 2027"
  institute: String,                 // "Allen, Kota"
  state: String,                     // "Rajasthan"
  // --- targets / prediction ---
  targetRank: Number,                // 480
  currentPredictedRank: Number,      // 1240  (computed by analytics)
  dreamCollege: String,              // "IIT Bombay — Computer Science"
  syllabusCovered: Number,           // 68 (percent)
  // --- gamification (denormalized for fast reads) ---
  xp: Number,                        // 48250
  level: Number,                     // 27
  streak: Number,                    // 46 (current)
  longestStreak: Number,             // 61
  // --- rolling stats (recomputed nightly) ---
  hoursThisWeek: Number,             // 38.5
  accuracy: Number,                  // 72.4 (percent)
  createdAt, updatedAt
}
```
> `initials`, `hoursThisWeek`, `accuracy`, `currentPredictedRank`, `xp/level/streak` are **derived** and can be recomputed; store denormalized for dashboard speed.

---

## 2. `sessions` (if not using stateless JWT)

```js
Session { _id, userId: ObjectId->users, token: String indexed, userAgent, ip,
          expiresAt: Date (TTL index), createdAt }
```

## 3. `otps`

```js
Otp { _id, userId: ObjectId->users, purpose: enum["signup","reset","login"],
      channel: enum["sms","email"], codeHash: String, attempts: Number,
      expiresAt: Date (TTL, ~5 min), consumedAt: Date|null, createdAt }
```

---

## 4. `studyTasks`  (from `StudyTask` / `todayPlan`)

```js
StudyTask {
  _id: ObjectId,
  userId: ObjectId->users, indexed,
  date: Date,                         // the day this task belongs to (index {userId, date})
  title: String,                      // "Rotational Motion — Angular Momentum conservation"
  subject: String,                    // "Physics" | "Mixed" | ...
  minutes: Number,                    // 55
  type: enum["Concept","Practice","Revision","Mock","Analysis"],
  time: String,                       // "06:30" (scheduled slot, HH:mm)
  done: Boolean,                      // toggled on dashboard
  relatedTestId: ObjectId->tests|null,      // "Part Test 07" links to a test
  relatedTopicId: ObjectId->topicNodes|null,
  source: enum["ai","manual"],        // AI planner vs user-added
  createdAt, updatedAt
}
```

## 5. `weeklyGoals`  (from `weeklyGoals`)

```js
WeeklyGoal { _id, userId->users, weekOf: Date,
  label: String,        // "Study hours" | "Questions solved" | "Mistakes cleared" | "Mock tests"
  current: Number,      // 38.5
  target: Number,       // 45
  unit: String,         // "h" | ""
  metricKey: enum["study_hours","questions_solved","mistakes_cleared","mock_tests"],
  createdAt, updatedAt }
```

## 6. `plans`  (planner Week/Month — currently synthetic on the client)

```js
Plan { _id, userId->users, scope: enum["week","month"],
  periodStart: Date,
  days: [ { date: Date, load: Number,           // intensity 0..3 for calendar
            items: [ { title, subject, minutes, type } ] } ],
  generatedBy: enum["ai","manual"], createdAt, updatedAt }
```

## 7. `pomodoroSessions`  (optional, from Planner Pomodoro)

```js
PomodoroSession { _id, userId->users, startedAt, endedAt, focusMinutes: Number,
  taskId: ObjectId->studyTasks|null, completed: Boolean }
```

---

## 8. `tests`  (from `TestSummary`: `upcomingTests` + `previousTests`)

A test **template/schedule**. Attempt-specific results live in `testAttempts`.

```js
Test {
  _id: ObjectId,
  code: String,                       // "pt-07", "mock-14" (used as $testId route param) — indexed unique
  title: String,                      // "Part Test 07 — Mechanics + Organic"
  exam: enum["JEE","NEET","UPSC","GATE","CAT","SSC","Banking"],
  subjects: [String],                 // ["Physics","Chemistry"]
  questionCount: Number,              // 60
  durationMin: Number,                // 120
  difficulty: enum["Easy","Medium","Hard"],
  maxScore: Number,                   // 240
  scheduledFor: Date|null,            // upcoming tests
  type: enum["part","full","sprint","custom"],
  visibility: enum["global","batch","custom"],  // custom = generated for one user
  createdBy: ObjectId->users|null,    // teacher or student (custom generator)
  batchId: ObjectId->batches|null,
  questionIds: [ObjectId->questions],
  createdAt, updatedAt
}
```

## 9. `questions`  (from `questions` mock)

```js
Question {
  _id: ObjectId,
  externalId: Number|String,          // "id" 1..30 in mock
  subject: enum["Physics","Chemistry","Mathematics", ...],
  chapter: String,
  difficulty: enum["Easy","Medium","Hard"],
  text: String,                       // stem (may contain LaTeX)
  options: [String],                  // 4 options
  correctIndex: Number,               // "correct" (0-based)
  marks: Number,                      // + marks
  negativeMarks: Number,              // e.g. -1
  topicId: ObjectId->topicNodes|null,
  createdAt, updatedAt
}
```
> **Security:** `correctIndex` must NOT be sent to the client during an active attempt — only on the result endpoint.

## 10. `testAttempts`  (drives Test interface + Results page; also `scoreTrend`)

The richest model. One document per (user, test) attempt.

```js
TestAttempt {
  _id: ObjectId,
  userId: ObjectId->users, indexed,
  testId: ObjectId->tests, indexed,
  status: enum["in_progress","submitted","evaluated"],
  startedAt: Date,
  submittedAt: Date|null,
  durationUsedSec: Number,
  // per-question responses
  responses: [ {
     questionId: ObjectId->questions,
     selectedIndex: Number|null,
     status: enum["unseen","answered","review","skipped"],   // matches test UI palette
     marked: Boolean,                  // mark-for-review
     timeSpentSec: Number,
     isCorrect: Boolean|null           // filled on evaluation
  } ],
  // --- evaluated result fields (Results page) ---
  score: Number,                       // 214
  maxScore: Number,                    // 360
  percentile: Number,                  // 97.8
  accuracy: Number,                    // 71
  predictedAIR: Number,                // 1240
  attemptedOn: String,                 // display "12 Jul"
  // analytics breakdowns (mirror the mock arrays)
  subjectBreakdown: [ { subject, score, max, accuracy, time } ],   // subjectBreakdown
  errorMix:         [ { name, key, value } ],                       // errorMix (pie)
  timePerQuestion:  [ { bucket, correct, wrong } ],                 // timePerQuestion
  difficultyStats:  [ { level, correct, total } ],
  radarTraits:      [ { trait, value } ],                           // examDnaRadar
  weakAreas: [String], strongAreas: [String],
  aiFeedback: String,                  // computed prose
  createdAt, updatedAt
}
```
> `scoreTrend` (Dashboard learning graph) is an **aggregation** over a user's `testAttempts` (`{test, score, percentile, topper}`), not a stored collection.

---

## 11. `mistakes`  (from `Mistake` / `mistakes`)

```js
Mistake {
  _id: ObjectId,
  userId: ObjectId->users, indexed,
  question: String,                    // stem text
  questionId: ObjectId->questions|null,
  subject: String,                     // "Physics"
  chapter: String,                     // "Friction & Newton's Laws"
  category: enum["Concept Error","Formula Error","Calculation Error",
                 "Guess","Memory Error","Time Pressure","Careless Mistake"],
  priority: enum["High","Medium","Low"],
  status: enum["Pending","Revised","Mastered"],
  occurredOn: Date,                    // "12 Jul"
  timesRepeated: Number,               // 3
  aiNote: String,                      // AI-classified explanation
  sourceAttemptId: ObjectId->testAttempts|null,   // created from a wrong answer
  nextRevisionAt: Date|null,           // spaced-repetition scheduling
  createdAt, updatedAt
}
```
Indexes: `{userId, status}`, `{userId, category}`, text index on `question/chapter/subject` (Mistake Bank search is currently client-side).

---

## 12. `topicNodes`  (from `TopicNode` / `topicGraph`)

Per-user knowledge-graph node (mastery is personal). Positions `x/y` may be layout metadata on a shared template.

```js
TopicNode {
  _id: ObjectId,
  userId: ObjectId->users, indexed,        // (or template + per-user mastery join)
  key: String,                             // "rot", "emag" (graph id)
  name: String,                            // "Rotational Motion"
  subject: enum["Physics","Chemistry","Mathematics", ...],
  mastery: Number,                         // 0..100
  lastRevised: Date,                       // "Today" / "2 days ago"
  weakQuestions: Number,                   // 14
  x: Number, y: Number,                    // graph layout %
  links: [String],                         // adjacency by `key` -> other nodes
  createdAt, updatedAt
}
```

## 13. `revisionEvents`  (Revision-graph "history" — currently hard-coded)

```js
RevisionEvent { _id, userId->users, topicId->topicNodes, revisedAt: Date,
  masteryBefore: Number, masteryAfter: Number, questionsPractised: Number, source }
```

## 14. `examDna`  (Exam DNA + Results radar/behaviour — currently hard-coded)

Computed analytics snapshot per user (recomputed after each attempt).

```js
ExamDna {
  _id, userId->users, indexed,
  computedAt: Date,
  radar: [ { trait: enum["Speed","Accuracy","Confidence","Retention","Discipline","Endurance"],
             value: Number } ],           // examDnaRadar
  behaviours: [ { key, label, value } ],  // learning-behaviour rings
  errorProfile: [ { key, label, value } ],
  burnoutRisk: enum["Low","Moderate","High"] | Number,   // 38%
  discipline: Number, endurance: Number, learningVelocity: Number,
  narrative: String                        // DNA prose
}
```

## 15. `studyLogs`  (heatmap / `StudyHeatmap`)

```js
StudyLog { _id, userId->users, date: Date,      // index {userId, date} unique
  minutes: Number, value: Number,               // 0..5 intensity (heatmap bucket)
  questionsSolved: Number, focusScore: Number }
```

---

## 16. `leaderboardEntries`  (from `LeaderboardEntry` / `leaderboard`)

Can be a **materialized view** rebuilt periodically, or computed on read from `users`.

```js
LeaderboardEntry {
  _id, userId->users,
  scope: enum["friends","institute","state","india"],   // page filter (currently non-functional)
  timeRange: enum["weekly","monthly","overall"],
  rank: Number,                        // 7
  name: String, institute: String, state: String,
  xp: Number, accuracy: Number, streak: Number,
  // `isYou` is resolved at request time by comparing userId to the caller
  computedAt: Date
}
```

## 17. `achievements` + `userAchievements`  (Profile badges)

```js
Achievement { _id, key, name: String,          // "Iron Streak"
  detail: String,                               // "45 days without a break"
  icon: String,                                 // "flame"
  criteria: Object }                            // rule definition

UserAchievement { _id, userId->users, achievementId->achievements,
  earned: Boolean, earnedAt: Date|null, progress: Number }
```

---

## 18. Parent workspace

```js
ParentLink { _id, parentUserId->users, studentUserId->users,
  permissions: { studyTime: Bool, trends: Bool },   // never questions/chat (privacy)
  status: enum["pending","active"], createdAt }

ParentReport {                                       // from `parentReport` (computed weekly)
  _id, studentUserId->users, weekOf: Date,
  studyTimeWeek: [ { day: String, hours: Number, target: Number } ],
  attendance: Number,                                // 94
  focusScore: Number,                                // 81
  burnoutRisk: enum["Low","Moderate","High"],
  subjectBreakdown: [ { subject, accuracy } ]        // reused from attempts
}
```

## 19. Teacher workspace

```js
Batch {                                              // from `classPerformance`
  _id, teacherUserId->users, name: String,           // "Batch A — JEE Adv"
  exam: String, studentIds: [ObjectId->users],
  studentCount: Number,                              // 42
  avgScore: Number,                                  // 63
  weakTopic: String,                                 // "3D Geometry"
  trend: Number }                                    // 6 / -3

Assignment {                                         // local const in app.teacher.tsx
  _id, teacherUserId->users, batchId->batches,
  title: String,                                     // "Rotational Dynamics — 25 Q set"
  dueAt: Date,                                       // "due" text
  submittedCount: Number,                            // submitted
  totalCount: Number,                                // total
  testId: ObjectId->tests|null, createdAt, updatedAt }
```

---

## 20. `userSettings`  (from Settings page toggle groups)

```js
UserSettings {
  _id, userId->users, unique,
  notifications: {
     dailyPlanReminder: Boolean,
     testReminders: Boolean,
     mistakeBankDigest: Boolean,
     leaderboardMovement: Boolean
  },
  privacy: {
     shareProgressWithParents: Boolean,
     appearOnPublicLeaderboards: Boolean,
     allowAnonymisedBenchmarking: Boolean
  },
  security: {
     twoFactorAuth: Boolean,
     examLockdownMode: Boolean,
     sessionAlerts: Boolean
  },
  account: { fullName: String, email: String, language: String },   // "English (India)"
  updatedAt
}
```

## 21. `chatMessages`  (AI mentor dock)

```js
ChatMessage { _id, userId->users, conversationId: ObjectId,
  role: enum["user","ai"], text: String,
  groundingRefs: [ObjectId],           // attempts/mistakes the AI cited
  createdAt }
```

---

## Relationship summary

```
users 1───* studyTasks, weeklyGoals, plans, pomodoroSessions
users 1───* testAttempts *───1 tests 1───* questions
users 1───* mistakes  (mistakes *───1 testAttempts, *───1 questions)
users 1───* topicNodes 1───* revisionEvents
users 1───1 examDna, userSettings
users 1───* studyLogs, chatMessages, userAchievements
users 1───* leaderboardEntries          (materialized)
parentLinks: users(parent) *───* users(student) ; parentReports 1 per student/week
teachers: users 1───* batches 1───* assignments ; batches *───* users(students)
```

## Key indexes

- `users`: `{email} unique`, `{mobile} unique sparse`, `{role}`, `{exam, xp:-1}` (leaderboard).
- `studyTasks`: `{userId, date}`.
- `testAttempts`: `{userId, submittedAt:-1}`, `{userId, testId}`.
- `mistakes`: `{userId, status}`, `{userId, category}`, text index.
- `studyLogs`: `{userId, date} unique`.
- `topicNodes`: `{userId, subject}`.
- TTL: `sessions.expiresAt`, `otps.expiresAt`.
</content>
