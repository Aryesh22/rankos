# RankOS — API Specification

> **Analysis date:** 2026-07-29 · No files modified · No backend code written (by request).
> This spec is **REST-first** and framework-agnostic — it maps onto either a standalone Node/Mongo API or TanStack Start **server functions** (the app already ships CSRF middleware in `src/start.ts` for `serverFn` handlers).

## Conventions

- **Base URL:** `/api`
- **Auth:** `Authorization: Bearer <JWT>` **or** httpOnly session cookie. Marked per endpoint as **Auth: none / student / parent / teacher / admin**.
- **Content type:** `application/json` unless noted.
- **Standard error body:** `{ "error": { "code": "STRING", "message": "STRING", "fields"?: {} } }`
- **List envelope:** `{ "data": [...], "page": n, "pageSize": n, "total": n }`
- `«current user»` = resolved from the token; the frontend never sends its own id.
- Field names mirror `src/types/index.ts` so the client can drop in with minimal mapping.

---

# PART A — Authentication & Session

Backs: `/login`, `/signup`, `/verify-otp`, `/forgot-password`, `SocialAuth`, and the `/app` route guard.

### `POST /api/auth/signup`  — **Auth: none**
Backs `signup.tsx` (name, mobile, password, target exam).
```jsonc
// Request
{ "name": "Aarav Mehta", "mobile": "+919800000000",
  "password": "at least 8 chars", "exam": "JEE" }
// Response 201
{ "userId": "…", "otpChannel": "sms", "otpExpiresInSec": 300, "nextStep": "verify-otp" }
```
**Models:** `users` (create, `mobileVerified:false`), `otps` (create + send SMS).

### `POST /api/auth/verify-otp`  — **Auth: none**
Backs `verify-otp.tsx` (6-digit code → `/app`).
```jsonc
// Request
{ "userId": "…", "code": "123456", "purpose": "signup" }
// Response 200
{ "token": "JWT", "user": { /* see GET /auth/me */ } }   // + Set-Cookie session
```
**Models:** `otps` (validate+consume), `users` (`mobileVerified:true`), `sessions`.

### `POST /api/auth/resend-otp`  — **Auth: none**
Backs the "Resend code" button (28s countdown).
```jsonc
{ "userId": "…", "purpose": "signup" }   // → 200 { "otpExpiresInSec": 300 }
```
**Models:** `otps`.

### `POST /api/auth/login`  — **Auth: none**
Backs `login.tsx` (email/mobile + password, "keep me signed in 30 days").
```jsonc
// Request
{ "identifier": "aarav@example.com", "password": "…", "rememberMe": true }
// Response 200
{ "token": "JWT", "user": { /* see GET /auth/me */ } }   // + Set-Cookie
```
**Models:** `users` (verify hash), `sessions`.

### `GET /api/auth/oauth/:provider`  → callback `GET /api/auth/oauth/:provider/callback` — **Auth: none**
Backs `SocialAuth` (Google, Apple). Standard OAuth redirect flow → issues session.
**Models:** `users` (upsert by `authProviders`), `sessions`.

### `POST /api/auth/forgot-password`  — **Auth: none**
Backs `forgot-password.tsx` ("send reset link", 15-min expiry).
```jsonc
{ "email": "aarav@example.com" }   // → 200 { "sent": true }  (always 200 to avoid user enumeration)
```
**Models:** `users` (lookup), `otps`/reset-token (email).

### `POST /api/auth/reset-password`  — **Auth: none**
```jsonc
{ "token": "…", "newPassword": "…" }   // → 200 { "reset": true }
```
**Models:** `users`, `otps`/reset-token.

### `GET /api/auth/me`  — **Auth: student/parent/teacher**
Used by the route guard on `/app/*` and `AppLayout` user chip.
```jsonc
// Response 200
{ "id": "…", "role": "student", "name": "Aarav Mehta", "initials": "AM",
  "email": "aarav@example.com", "exam": "JEE", "examLabel": "JEE Advanced 2027",
  "institute": "Allen, Kota", "state": "Rajasthan", "streak": 46 }
```
**Models:** `users`.

### `POST /api/auth/logout`  — **Auth: any**  → `204`. **Models:** `sessions`.

> **Route guard note:** `/app/*` and `/test/*` need `beforeLoad` → call `GET /auth/me`; on 401 redirect to `/login`. `/app/parent` requires `role in [parent, admin]` (or a student previewing); `/app/teacher` requires `role in [teacher, admin]`.

---

# PART B — Per-Page Endpoints

Each page lists: **endpoints required · request body · response body · auth · models**.

---

## Page: `/` — Landing (`index.tsx`)
Fully static marketing content (hero, features, pricing, FAQ, testimonials). **No backend required.**
- *Optional* `POST /api/leads` (waitlist/"talk to sales") — `{ email, plan, message }` → `201`. Auth: none. Models: `leads`.

---

## Page: `/app` — Dashboard (`app.index.tsx`)
Reads: `student`, `todayPlan`, `weeklyGoals`, `upcomingTests`, `mistakes(pending)`, `scoreTrend`. Writes: toggle task `done`.

**One aggregate read is recommended** to avoid a waterfall:

### `GET /api/dashboard`  — **Auth: student**
```jsonc
// Response 200
{
  "student": { "streak": 46, "currentPredictedRank": 1240, "targetRank": 480,
               "accuracy": 72.4, "hoursThisWeek": 38.5, "xp": 48250, "level": 27 },
  "todayPlan": [ { "id":"t1", "title":"Rotational Motion…", "subject":"Physics",
                   "minutes":55, "type":"Concept", "time":"06:30", "done":true } ],
  "weeklyGoals": [ { "label":"Study hours", "current":38.5, "target":45, "unit":"h" } ],
  "scoreTrend": [ { "test":"M14", "score":214, "percentile":97.8, "topper":291 } ],
  "revisionQueue": [ { "id":"m5", "question":"…", "subject":"Mathematics",
                       "priority":"High", "status":"Pending" } ],   // pending mistakes, top 4
  "upcomingTests": [ { "id":"pt-07", "code":"pt-07", "title":"Part Test 07…",
                       "difficulty":"Hard", "questions":60, "durationMin":120,
                       "maxScore":240, "scheduledFor":"Today, 20:00" } ],
  "aiInsight": { "headline":"…", "topics":["Definite Integration","3D Geometry","Probability"] }
}
```
**Models:** `users`, `studyTasks`, `weeklyGoals`, `testAttempts` (scoreTrend agg), `mistakes`, `tests`, `examDna`/mentor (aiInsight).

### `PATCH /api/tasks/:taskId`  — **Auth: student**  (checkbox toggle)
```jsonc
{ "done": true }   // → 200 { "id":"t3", "done":true }
```
**Models:** `studyTasks`.

*(Granular alternatives if you prefer not to aggregate: `GET /api/profile/summary`, `GET /api/tasks?date=today`, `GET /api/goals?week=current`, `GET /api/tests?status=upcoming`, `GET /api/mistakes?status=Pending&limit=4`, `GET /api/analytics/score-trend`.)*

---

## Page: `/app/planner` — AI Planner (`app.planner.tsx`)
Reads: `todayPlan`, `weeklyGoals`; Week/Month plans are synthetic → need real generation. Pomodoro is local.

### `GET /api/tasks?date=YYYY-MM-DD`  — **Auth: student**
→ `{ "data": [StudyTask…] }`. **Models:** `studyTasks`.

### `GET /api/plans?scope=week|month&start=YYYY-MM-DD`  — **Auth: student**
```jsonc
// Response 200
{ "scope":"week", "periodStart":"2026-07-27",
  "days":[ { "date":"2026-07-27", "load":2,
             "items":[ { "title":"…","subject":"Physics","minutes":55,"type":"Concept" } ] } ] }
```
**Models:** `plans`.

### `POST /api/plans/generate`  — **Auth: student**  (AI "rebuild my plan")
```jsonc
{ "scope":"week", "start":"2026-07-27",
  "constraints": { "keepPhysicsRevision": true, "dailyHours": 6 } }
// → 201 { plan: { …same shape as GET /plans } }
```
**Models:** `plans`, `studyTasks`, `mistakes`, `topicNodes`, `examDna` (inputs to the planner), mentor service.

### `POST /api/pomodoro`  — **Auth: student**  (optional session logging)
```jsonc
{ "focusMinutes":25, "taskId":"t3", "completed":true }   // → 201 { id }
```
**Models:** `pomodoroSessions`, `studyLogs`.

### `POST /api/tasks`  / `DELETE /api/tasks/:id`  — **Auth: student**  (manual add/remove plan items)
```jsonc
// POST body
{ "date":"2026-07-29", "title":"…", "subject":"Physics", "minutes":45, "type":"Practice", "time":"18:00" }
```
**Models:** `studyTasks`.

---

## Page: `/app/revision-graph` — Revision Graph (`app.revision-graph.tsx`)
Reads: `topicGraph` (nodes + links + mastery). "Revision history" hard-coded. "Practise N weak questions" inert.

### `GET /api/topics/graph`  — **Auth: student**
```jsonc
// Response 200
{ "nodes":[ { "id":"rot", "name":"Rotational Motion", "subject":"Physics",
              "mastery":61, "lastRevised":"Today", "weakQuestions":14,
              "x":40, "y":18, "links":["mech"] } ] }
```
**Models:** `topicNodes`.

### `GET /api/topics/:id/revisions`  — **Auth: student**  (revision history panel)
→ `{ "data":[ { "revisedAt":"…","masteryBefore":55,"masteryAfter":61,"questionsPractised":12 } ] }`.
**Models:** `revisionEvents`.

### `POST /api/topics/:id/practice`  — **Auth: student**  ("Practise N weak questions")
```jsonc
{ "count": 14 }
// → 201 { "testId":"custom-abc", "code":"custom-abc" }  // client routes to /test/$testId
```
**Models:** `topicNodes`, `questions`, `tests` (create custom practice set).

---

## Page: `/app/tests` — Test Centre (`app.tests.tsx`)
Reads: `upcomingTests`, `previousTests`, `leaderboard(0..8)`, aggregate stat cards. Writes: custom test generator.

### `GET /api/tests?status=upcoming`  — **Auth: student**
→ `{ "data":[ TestSummary (scheduledFor set) ] }`. **Models:** `tests`.

### `GET /api/tests?status=history`  — **Auth: student**  (attempt history table)
```jsonc
// Response 200 — each row is an attempt
{ "data":[ { "id":"mock-14","title":"Full Syllabus Mock 14","attemptedOn":"12 Jul",
             "score":214,"maxScore":360,"accuracy":71,"percentile":97.8 } ] }
```
**Models:** `testAttempts` joined `tests`.

### `GET /api/tests/stats`  — **Auth: student**  (top StatCards: attempted, avg accuracy, avg time/q, best percentile)
→ `{ "attempted":47, "avgAccuracy":71.6, "avgTimePerQuestionSec":98, "bestPercentile":97.8 }`.
**Models:** `testAttempts` (aggregation).

### `POST /api/tests/custom`  — **Auth: student**  (custom generator: subjects, difficulty, count)
```jsonc
// Request  (from chips + slider)
{ "subjects":["Physics","Mathematics"], "difficulty":"Exam-level", "count":45 }
// Response 201
{ "testId":"custom-…", "code":"custom-…", "questionCount":45 }   // client → /test/$testId
```
**Models:** `tests` (create), `questions` (select).

### `GET /api/leaderboard?scope=india&range=weekly&limit=8`  — **Auth: student**  (inline leaderboard tab)
→ see Leaderboard page. **Models:** `leaderboardEntries`/`users`.

---

## Page: `/test/$testId` — Test Interface (`test.$testId.tsx`)
The exam simulator. Local state today (answers, marks, status, timer). Needs full attempt lifecycle.

### `GET /api/tests/:code`  — **Auth: student**  (load test meta)
→ `{ "id","code","title","durationMin","questionCount","subjects","maxScore" }`. **Models:** `tests`.

### `POST /api/tests/:code/attempts`  — **Auth: student**  (start attempt → returns questions WITHOUT answers)
```jsonc
// Response 201
{ "attemptId":"…", "durationSec":7200,
  "questions":[ { "id":1, "subject":"Physics", "difficulty":"Medium",
                  "text":"A uniform disc…", "options":["g sinθ","(2/3) g sinθ","…","…"] } ] }
//  NOTE: correctIndex is intentionally omitted here.
```
**Models:** `tests`, `questions`, `testAttempts` (create `in_progress`).

### `PATCH /api/attempts/:attemptId/response`  — **Auth: student**  (autosave each answer / mark / status)
```jsonc
{ "questionId":1, "selectedIndex":1, "status":"answered", "marked":false, "timeSpentSec":42 }
// → 200 { "saved":true }
```
**Models:** `testAttempts.responses`.

### `POST /api/attempts/:attemptId/submit`  — **Auth: student**  (Submit button → `/app/results`)
```jsonc
// Request
{ "durationUsedSec": 5820 }
// Response 200
{ "attemptId":"…", "score":214, "maxScore":360, "percentile":97.8, "accuracy":71,
  "resultUrl":"/app/results?attempt=…" }
```
**Models:** `testAttempts` (evaluate: score, breakdowns), `mistakes` (auto-create from wrong answers), `examDna` (recompute), `studyLogs`, `users` (xp/streak update).

---

## Page: `/app/results` — Result Analysis (`app.results.tsx`)
Reads: `subjectBreakdown`, `errorMix`, `timePerQuestion`, `examDnaRadar` + much hard-coded (score, percentile, timeline, difficulty, weak/strong, AI feedback). All belong to one attempt.

### `GET /api/attempts/:attemptId/result`  — **Auth: student**
```jsonc
// Response 200
{ "score":214, "maxScore":360, "percentile":97.8, "predictedAIR":1240, "accuracy":71,
  "aiFeedback":"…prose…",
  "timeline":[ { "index":1, "state":"correct", "seconds":74 } ],           // 90 cells
  "timePerQuestion":[ { "bucket":"0-30s","correct":41,"wrong":6 } ],
  "errorMix":[ { "name":"Concept Error","key":"concept","value":34 } ],
  "subjectBreakdown":[ { "subject":"Physics","score":78,"max":120,"accuracy":74,"time":62 } ],
  "difficultyStats":[ { "level":"Easy","correct":18,"total":20 } ],
  "radar":[ { "trait":"Speed","value":74 } ],                               // examDnaRadar (you vs top 100)
  "weakAreas":["3D Geometry","Probability"], "strongAreas":["Gravitation","Organic Basics"] }
```
**Models:** `testAttempts` (all fields), `topicNodes` (weak/strong), `examDna` (radar), mentor (aiFeedback).

### `POST /api/attempts/:attemptId/to-mistake-bank`  — **Auth: student**  ("Send errors to Mistake Bank")
```jsonc
{ "questionIds": [12, 27, 41] }   // or empty → all wrong answers
// → 201 { "created": 8 }
```
**Models:** `mistakes` (create), `testAttempts`.

### `POST /api/attempts/:attemptId/schedule-revision`  — **Auth: student**  ("Schedule suggested revision")
```jsonc
{ "topicIds":["geo3d","prob"] }   // → 201 { "tasksCreated":3 }
```
**Models:** `studyTasks`, `mistakes` (nextRevisionAt), `plans`.

---

## Page: `/app/exam-dna` — Exam DNA (`app.exam-dna.tsx`)
Reads: `examDnaRadar`, `topicGraph` (weak/strong by mastery). Behaviour/burnout/velocity hard-coded → computed.

### `GET /api/analytics/exam-dna`  — **Auth: student**
```jsonc
// Response 200
{ "radar":[ { "trait":"Retention","value":83 } ],
  "behaviours":[ { "key":"discipline","label":"Discipline","value":91 } ],
  "errorProfile":[ { "key":"concept","label":"Concept","value":34 } ],
  "burnoutRisk":"Moderate", "enduranceDropPct":27, "learningVelocity":1.8,
  "narrative":"…",
  "weakChapters":[ { "id":"geo3d","name":"3D Geometry","subject":"Mathematics","mastery":34 } ],
  "strongChapters":[ { "id":"orgc","name":"Organic Basics","subject":"Chemistry","mastery":91 } ] }
```
**Models:** `examDna`, `topicNodes`, `testAttempts` (source for computation).

---

## Page: `/app/mistakes` — Mistake Bank (`app.mistakes.tsx`)
Reads: `mistakes` with client-side filter (search + category + status). Writes: status transitions, "practice 5 similar" (inert today).

### `GET /api/mistakes?status=&category=&q=&page=`  — **Auth: student**
Server-side equivalent of the current in-memory `useMemo` filter.
```jsonc
// Query: status=Pending  category=Concept Error  q=friction
// Response 200
{ "data":[ { "id":"m1", "question":"A block on a rough incline…", "subject":"Physics",
             "chapter":"Friction & Newton's Laws", "category":"Concept Error",
             "priority":"High", "status":"Pending", "occurredOn":"12 Jul",
             "timesRepeated":3, "aiNote":"You keep applying kinetic friction…" } ],
  "total":8 }
```
**Models:** `mistakes` (indexes on status/category + text).

### `PATCH /api/mistakes/:id`  — **Auth: student**  (status Pending→Revised→Mastered)
```jsonc
{ "status": "Revised" }   // → 200 { "id":"m3", "status":"Revised" }
```
**Models:** `mistakes`.

### `POST /api/mistakes/:id/practice`  — **Auth: student**  ("Practice 5 similar")
```jsonc
{ "count": 5 }
// → 201 { "testId":"custom-…", "code":"custom-…" }   // client → /test/$testId
```
**Models:** `mistakes`, `questions`, `tests`.

---

## Page: `/app/leaderboard` — Leaderboard (`app.leaderboard.tsx`)
Reads: `leaderboard` (podium top-3 + full list). Filters `scope` (friends/institute/state/india) and `range` (weekly/monthly/overall) — currently non-functional stubs → make real.

### `GET /api/leaderboard?scope=india&range=weekly&page=1`  — **Auth: student**
```jsonc
// Response 200
{ "scope":"india", "range":"weekly",
  "podium":[ { "rank":1,"name":"Ishaan Rao","institute":"FIITJEE, Delhi","state":"Delhi",
               "xp":96400,"accuracy":89,"streak":128,"isYou":false } ],
  "data":[ { "rank":7,"name":"Aarav Mehta","institute":"Allen, Kota","state":"Rajasthan",
             "xp":48250,"accuracy":72,"streak":46,"isYou":true } ],
  "you": { "rank":7 }, "total":10 }
```
`isYou` resolved by comparing each entry's `userId` to «current user». `scope=friends/institute/state` filter the pool; `range` picks the XP window.
**Models:** `leaderboardEntries` (materialized) or `users` aggregation; `parentLinks`/friends for `scope=friends`.

---

## Page: `/app/profile` — Profile (`app.profile.tsx`)
Reads: `student`, `achievements`, `StudyHeatmap`. Read-only page (no writes on this page today).

### `GET /api/profile`  — **Auth: student**
```jsonc
// Response 200
{ "name":"Aarav Mehta","initials":"AM","exam":"JEE Advanced 2027","institute":"Allen, Kota",
  "state":"Rajasthan","level":27,"xp":48250,"xpToNextLevel":6750,"nextLevelXp":55000,
  "targetRank":480,"currentPredictedRank":1240,"syllabusCovered":68,
  "dreamCollege":"IIT Bombay — Computer Science","longestStreak":61,"streak":46 }
```
**Models:** `users`.

### `GET /api/profile/achievements`  — **Auth: student**
→ `{ "data":[ { "name":"Iron Streak","detail":"45 days without a break","icon":"flame","earned":true } ], "earnedCount":3, "total":6 }`.
**Models:** `achievements`, `userAchievements`.

### `GET /api/analytics/heatmap?days=182`  — **Auth: student**  (StudyHeatmap)
→ `{ "data":[ { "date":"2026-01-28","value":3 } ] }`.
**Models:** `studyLogs`.

---

## Page: `/app/parent` — Parent View (`app.parent.tsx`)
Reads: `parentReport` (weekly study time vs target, attendance, focus, burnout), `subjectBreakdown`. Privacy-limited: trends only, never questions/chat.

### `GET /api/parent/children`  — **Auth: parent**
→ `{ "data":[ { "studentId":"…","name":"Aarav Mehta","exam":"JEE" } ] }`.
**Models:** `parentLinks`, `users`.

### `GET /api/parent/report?studentId=…&week=current`  — **Auth: parent** (or student self-preview)
```jsonc
// Response 200
{ "student": { "name":"Aarav Mehta" },
  "studyTimeWeek":[ { "day":"Mon","hours":6.2,"target":6 } ],
  "attendance":94, "focusScore":81, "burnoutRisk":"Moderate",
  "subjectBreakdown":[ { "subject":"Physics","accuracy":74 } ],
  "recommendation":"…" }
```
**Authorization:** the parent must have an active `parentLink` to `studentId`; report honours the student's `privacy.shareProgressWithParents` setting.
**Models:** `parentReports`, `parentLinks`, `userSettings`, `testAttempts` (subjectBreakdown).

---

## Page: `/app/teacher` — Teacher View (`app.teacher.tsx`)
Reads: `classPerformance` (batches), `leaderboard(0..6)` (top students), local `assignments`. Writes: "Create assignment" (stub).

### `GET /api/teacher/overview`  — **Auth: teacher**
→ `{ "totalStudents":166, "avgClassAccuracy":67.4, "openAssignments":3, "batchCount":3 }`.
**Models:** `batches`, `assignments`, `testAttempts`.

### `GET /api/teacher/batches`  — **Auth: teacher**
```jsonc
// Response 200
{ "data":[ { "id":"…","name":"Batch A — JEE Adv","students":42,"avgScore":63,
             "weakTopic":"3D Geometry","trend":6 } ] }
```
**Models:** `batches`.

### `GET /api/teacher/assignments`  — **Auth: teacher**
```jsonc
{ "data":[ { "id":"…","title":"Rotational Dynamics — 25 Q set","batch":"Batch A — JEE Adv",
             "due":"Fri","submitted":31,"total":42 } ] }
```
**Models:** `assignments`.

### `POST /api/teacher/assignments`  — **Auth: teacher**  ("Create assignment")
```jsonc
// Request
{ "title":"Rotational Dynamics — 25 Q set", "batchId":"…", "dueAt":"2026-08-01",
  "testId":"…"|null }
// Response 201
{ "id":"…", "title":"…", "batch":"Batch A — JEE Adv", "submitted":0, "total":42 }
```
**Models:** `assignments`, `batches`, `tests`.

### `GET /api/teacher/leaderboard?limit=6`  — **Auth: teacher**  (top students this week)
→ `{ "data":[ { "rank":1,"name":"…","institute":"…","accuracy":89 } ] }`.
**Models:** `leaderboardEntries`/`users` scoped to teacher's batches.

---

## Page: `/app/settings` — Settings (`app.settings.tsx`)
Reads/writes: notifications, privacy, security groups + account (name/email/language). All uncontrolled today; "Save changes" and "Delete account" are stubs.

### `GET /api/settings`  — **Auth: student/teacher/parent**
```jsonc
// Response 200
{ "notifications": { "dailyPlanReminder":true,"testReminders":true,
                     "mistakeBankDigest":true,"leaderboardMovement":false },
  "privacy": { "shareProgressWithParents":true,"appearOnPublicLeaderboards":true,
               "allowAnonymisedBenchmarking":true },
  "security": { "twoFactorAuth":false,"examLockdownMode":true,"sessionAlerts":true },
  "account": { "fullName":"Aarav Mehta","email":"aarav@example.com","language":"English (India)" } }
```
**Models:** `userSettings`, `users`.

### `PATCH /api/settings`  — **Auth: owner**  ("Save changes" — partial update, any subset of groups)
```jsonc
// Request (example)
{ "notifications": { "leaderboardMovement": true },
  "account": { "language": "हिन्दी" } }
// Response 200 → the full updated settings object
```
**Models:** `userSettings`, `users` (email/name mirror).

### `POST /api/settings/security/2fa`  — **Auth: owner**  (enable/disable 2FA)
```jsonc
{ "enable": true }   // → 200 { "otpauthUrl":"…","qr":"…" }  when enabling
```
**Models:** `users`, `userSettings`.

### `DELETE /api/account`  — **Auth: owner**  ("Delete my account")
```jsonc
{ "confirm": "DELETE", "password": "…" }   // → 202 { "scheduledDeletionAt":"…" }
```
**Models:** cascade across all user-owned collections; `sessions` (revoke).

---

## Global widget: AI Mentor Dock (`AiChatDock.tsx`)
Present on all `/app` pages. Canned replies today → real grounded LLM mentor.

### `GET /api/mentor/messages?conversationId=`  — **Auth: student**
→ `{ "conversationId":"…","data":[ { "role":"ai","text":"…" } ] }`.
**Models:** `chatMessages`.

### `POST /api/mentor/chat`  — **Auth: student**  (send message; supports quick-prompts)
```jsonc
// Request
{ "conversationId":"…"|null, "text":"Why did my percentile drop?" }
// Response 200  (or SSE stream for token-by-token)
{ "conversationId":"…",
  "reply": { "role":"ai", "text":"Analysing your last 6 attempts…",
             "groundingRefs":["attempt:mock-14","mistake:m2"] } }
```
**Models:** `chatMessages`, and read access to `testAttempts`, `mistakes`, `examDna`, `topicNodes` for grounding.

---

# PART C — Endpoint ↔ Page ↔ Model Matrix

| Endpoint | Method | Page(s) | Auth | Primary models |
|----------|--------|---------|------|----------------|
| `/auth/signup` | POST | signup | none | users, otps |
| `/auth/verify-otp` | POST | verify-otp | none | otps, users, sessions |
| `/auth/resend-otp` | POST | verify-otp | none | otps |
| `/auth/login` | POST | login | none | users, sessions |
| `/auth/oauth/:provider` | GET | login, signup | none | users, sessions |
| `/auth/forgot-password` | POST | forgot-password | none | users, otps |
| `/auth/reset-password` | POST | (reset link) | none | users, otps |
| `/auth/me` | GET | guard, AppLayout | any | users |
| `/auth/logout` | POST | AppLayout | any | sessions |
| `/dashboard` | GET | Dashboard | student | users, studyTasks, weeklyGoals, testAttempts, mistakes, tests, examDna |
| `/tasks/:id` | PATCH | Dashboard, Planner | student | studyTasks |
| `/tasks` | GET/POST | Planner | student | studyTasks |
| `/plans` | GET | Planner | student | plans |
| `/plans/generate` | POST | Planner | student | plans, mistakes, topicNodes, examDna |
| `/pomodoro` | POST | Planner | student | pomodoroSessions, studyLogs |
| `/topics/graph` | GET | Revision Graph, Exam DNA | student | topicNodes |
| `/topics/:id/revisions` | GET | Revision Graph | student | revisionEvents |
| `/topics/:id/practice` | POST | Revision Graph | student | tests, questions |
| `/tests?status=upcoming` | GET | Tests, Dashboard | student | tests |
| `/tests?status=history` | GET | Tests | student | testAttempts, tests |
| `/tests/stats` | GET | Tests | student | testAttempts |
| `/tests/custom` | POST | Tests | student | tests, questions |
| `/tests/:code` | GET | Test interface | student | tests |
| `/tests/:code/attempts` | POST | Test interface | student | tests, questions, testAttempts |
| `/attempts/:id/response` | PATCH | Test interface | student | testAttempts |
| `/attempts/:id/submit` | POST | Test interface | student | testAttempts, mistakes, examDna, users |
| `/attempts/:id/result` | GET | Results | student | testAttempts, topicNodes, examDna |
| `/attempts/:id/to-mistake-bank` | POST | Results | student | mistakes |
| `/attempts/:id/schedule-revision` | POST | Results | student | studyTasks, plans, mistakes |
| `/analytics/exam-dna` | GET | Exam DNA | student | examDna, topicNodes, testAttempts |
| `/analytics/score-trend` | GET | Dashboard | student | testAttempts |
| `/analytics/heatmap` | GET | Profile, Dashboard | student | studyLogs |
| `/mistakes` | GET | Mistake Bank | student | mistakes |
| `/mistakes/:id` | PATCH | Mistake Bank | student | mistakes |
| `/mistakes/:id/practice` | POST | Mistake Bank | student | mistakes, questions, tests |
| `/leaderboard` | GET | Leaderboard, Tests | student | leaderboardEntries, users |
| `/profile` | GET | Profile | student | users |
| `/profile/achievements` | GET | Profile | student | achievements, userAchievements |
| `/parent/children` | GET | Parent | parent | parentLinks, users |
| `/parent/report` | GET | Parent | parent | parentReports, parentLinks, userSettings |
| `/teacher/overview` | GET | Teacher | teacher | batches, assignments, testAttempts |
| `/teacher/batches` | GET | Teacher | teacher | batches |
| `/teacher/assignments` | GET/POST | Teacher | teacher | assignments, batches, tests |
| `/teacher/leaderboard` | GET | Teacher | teacher | leaderboardEntries, users |
| `/settings` | GET/PATCH | Settings | owner | userSettings, users |
| `/settings/security/2fa` | POST | Settings | owner | users, userSettings |
| `/account` | DELETE | Settings | owner | (cascade) sessions |
| `/mentor/messages` | GET | AiChatDock | student | chatMessages |
| `/mentor/chat` | POST | AiChatDock | student | chatMessages (+ grounding reads) |

---

## Implementation notes / gotchas

1. **Never leak answers:** `questions.correctIndex` must be stripped from `POST /tests/:code/attempts`; only reveal in `/attempts/:id/result`.
2. **Auth guard is missing entirely** — add `beforeLoad` on `routes/app.tsx` and `routes/test.$testId.tsx`.
3. **Forms need real validation:** the codebase already has `react-hook-form` + `zod`; the current auth/settings forms are uncontrolled/`useState`. Reuse the same zod schemas server-side.
4. **Computed vs stored:** `scoreTrend`, `examDna` behaviour scores, Results timeline, difficulty stats, AI feedback/insights, planner recommendations, and mentor replies are **derived** — build them as analytics/AI endpoints, not CRUD.
5. **Roles gate workspaces:** `/app/parent` and `/app/teacher` need `role`-based authorization; a student should not reach teacher data.
6. **Idempotent autosave:** `PATCH /attempts/:id/response` will be called frequently — make it upsert-by-`questionId` within the attempt.
7. **CSRF** is already configured for `serverFn` in `src/start.ts`; if you implement the API as TanStack server functions, that protection applies automatically.
</content>
