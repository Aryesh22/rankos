# RankOS — Project Architecture

> **Analysis date:** 2026-07-29
> **Scope:** Frontend codebase (`rankos-ai-mentor/`). No files were modified during this analysis.
> **Status of backend:** None. The app is a fully **mocked** frontend. Every page reads static data from `src/services/mockData.ts`. There is **no API layer, no `fetch`, no react-query network calls, no real authentication**. This document maps the frontend to the backend that needs to be built.

---

## 1. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | **TanStack Start** (SSR) + **TanStack Router** (file-based routing) |
| UI runtime | **React 19** |
| Data fetching | **TanStack React Query** (`QueryClientProvider` is mounted in `__root.tsx`, but **no queries are used yet**) |
| Styling | **Tailwind CSS v4** + custom design tokens (`styles.css`) |
| Component kit | **shadcn/ui** (Radix primitives) — `src/components/ui/*` |
| Forms | **react-hook-form** + **zod** + `@hookform/resolvers` (installed, **not yet wired** — current forms use raw `useState`/uncontrolled inputs) |
| Charts | **Recharts** |
| Animation | **motion** (Framer Motion successor) |
| Icons | **lucide-react** |
| Build / dev | **Vite 8**, bun, Nitro server preset |
| Toasts | **sonner** |
| Origin | Generated with **Lovable** (`AGENTS.md`, `.lovable/`) |

### Server entry points
- `src/server.ts` — Nitro/h3 fetch handler with hardened SSR error normalization.
- `src/start.ts` — `createStart` with **CSRF middleware** (`createCsrfMiddleware`, filtered to `serverFn` handlers) + an error middleware. This is the seam where server functions / API routes would be added.
- `src/router.tsx` — builds the router with a `QueryClient` in context.

> **Implication:** The intended backend pattern is TanStack **server functions** (protected by the existing CSRF middleware) and/or a separate REST API. This spec is written REST-first (framework-agnostic) so it maps cleanly onto either an Express/Fastify + MongoDB service or TanStack server functions backed by Mongo.

---

## 2. Route Map

All routes are defined file-based under `src/routes/` and compiled into `src/routeTree.gen.ts`.

### Public / marketing + auth (root-level, **no layout guard**)

| Path | File | Component | Purpose |
|------|------|-----------|---------|
| `/` | `routes/index.tsx` | `Landing` | Marketing landing page (hero, features, pricing, FAQ). Fully static. |
| `/login` | `routes/login.tsx` | `LoginPage` | Email/password + social login. |
| `/signup` | `routes/signup.tsx` | `SignupPage` | Name, mobile, password, target-exam picker. |
| `/verify-otp` | `routes/verify-otp.tsx` | `OtpPage` | 6-digit OTP entry with resend countdown. |
| `/forgot-password` | `routes/forgot-password.tsx` | `ForgotPage` | Request password-reset email. |
| `/test/$testId` | `routes/test.$testId.tsx` | `TestInterface` | **Fullscreen exam simulator** (own layout, outside `/app`). |

### Authenticated app (nested under `/app`, wrapped by `AppLayout`)

Parent route `routes/app.tsx` renders `AppLayout` (sidebar + header + `AiChatDock`) around an `<Outlet />`.

| Path | File | Purpose | Nav group |
|------|------|---------|-----------|
| `/app` (index) | `routes/app.index.tsx` | **Dashboard** — daily overview hub | Prepare |
| `/app/planner` | `routes/app.planner.tsx` | AI Study Planner (Today/Week/Month + Pomodoro) | Prepare |
| `/app/revision-graph` | `routes/app.revision-graph.tsx` | Knowledge graph of topic mastery | Prepare |
| `/app/tests` | `routes/app.tests.tsx` | Test centre + custom test generator | Perform |
| `/app/results` | `routes/app.results.tsx` | Result / analytics breakdown of one attempt | Perform |
| `/app/exam-dna` | `routes/app.exam-dna.tsx` | Behavioural fingerprint + weak/strong chapters | Perform |
| `/app/mistakes` | `routes/app.mistakes.tsx` | Mistake Bank (filterable) | Perform |
| `/app/leaderboard` | `routes/app.leaderboard.tsx` | XP leaderboard (scope + range) | Community |
| `/app/profile` | `routes/app.profile.tsx` | Student profile, XP, achievements | Community |
| `/app/parent` | `routes/app.parent.tsx` | Parent dashboard (privacy-limited trends) | Workspaces |
| `/app/teacher` | `routes/app.teacher.tsx` | Teacher dashboard (batches, assignments) | Workspaces |
| `/app/settings` | `routes/app.settings.tsx` | Preferences (notifications/privacy/security/account) | Workspaces |

> **Gap:** `/app/*` routes have **no `beforeLoad` auth guard** today. Adding authentication requires a guard on `routes/app.tsx` (and `routes/test.$testId.tsx`) that checks the session and redirects to `/login`.

---

## 3. Layouts & Shared Components

- **`layouts/AppLayout.tsx`** — Fixed sidebar (4 nav groups), sticky top header ("Start today's test" CTA), user chip (name/exam/streak from `student`), and the floating `AiChatDock`. Reads `student` mock directly.
- **`layouts/AuthLayout.tsx`** — Two-column auth shell + `SocialAuth` (Google/Apple buttons, currently no-op).
- **`components/app/AiChatDock.tsx`** — Floating AI mentor chat. Local `useState` message list; `send()` appends a **hard-coded canned AI reply**. No streaming, no backend.
- **`components/app/PageHeader.tsx`** — Presentational page title block.
- **`components/ui-kit/`** — `StatCard`, `RingProgress`, `StudyHeatmap` (pulls `heatmap` mock internally), `Motion` (Reveal/AnimatedNumber).
- **`components/brand/Logo.tsx`**, **`components/ui/*`** — shadcn primitives.

---

## 4. State Management

There is **no global client state store** (no Redux/Zustand/Context beyond React Query + Router).

| Mechanism | Where | Notes |
|-----------|-------|-------|
| `QueryClientProvider` | `__root.tsx` | Mounted but **unused** — ready for real data fetching. |
| Local `useState` | Every interactive page | All mutations are **local & ephemeral** — nothing persists. |
| `useMemo` | Mistake Bank | Client-side filtering over the full mock array. |
| Router state | `AppLayout` | `useRouterState` for active-nav highlighting. |

**Ephemeral-only interactions that need backend persistence once wired:**
- Dashboard: toggling a study task's `done`.
- Planner: Pomodoro timer (optional session logging).
- Test interface: answers, marked-for-review, per-question status, timer, submission.
- Mistakes: status transitions, "practice similar".
- Tests: custom-generator config → create a test.
- Settings: all switches/inputs (uncontrolled, "Save changes" is a stub).
- Teacher: "Create assignment" (stub).
- AiChatDock: chat messages (canned).

---

## 5. Authentication Flow (current vs. required)

### Current (mocked)
```
/signup  --(submit)-->  /verify-otp  --(6 digits + Verify)-->  /app
/login   --(submit, 700ms fake delay)-->  /app
/forgot-password --(submit)--> inline "email sent" state (no navigation)
```
- `login.tsx`: `onSubmit` sets a loading flag, `setTimeout(700)` → `navigate({ to: "/app" })`. Credentials are prefilled demo values and ignored.
- `signup.tsx`: `onSubmit` → `navigate({ to: "/verify-otp" })`. Collects name, mobile, password, target exam (local `useState`), sends nothing.
- `verify-otp.tsx`: local OTP state + resend countdown; on 6 digits → `navigate({ to: "/app" })`.
- `SocialAuth` (Google/Apple) buttons are decorative (no handlers).
- No token, no session, no cookie, no guard.

### Required (to build)
1. **Signup** → `POST /auth/signup` (creates unverified user, sends OTP).
2. **OTP verify** → `POST /auth/verify-otp` (marks verified, issues session/JWT).
3. **Login** → `POST /auth/login` (password check, issues session/JWT).
4. **Social** → `GET /auth/oauth/:provider` (Google/Apple OAuth).
5. **Forgot / reset** → `POST /auth/forgot-password`, `POST /auth/reset-password`.
6. **Session** → `GET /auth/me`, `POST /auth/logout`.
7. **Route guard** on `/app/*` and `/test/*` (redirect unauthenticated users to `/login`).
8. **Roles** — the presence of `/app/parent` and `/app/teacher` implies a `role` field (`student | parent | teacher | admin`) gating those workspaces.

See `API_SPEC.md` for full request/response contracts.

---

## 6. Domain Model Overview

Derived from `src/types/index.ts` and `src/services/mockData.ts`. Full field lists in `DATABASE_SCHEMA.md`.

| Domain entity | Frontend source | Consumed by pages |
|---------------|-----------------|-------------------|
| **User / Student profile** | `student` | Dashboard, Profile, Settings, AppLayout, Parent (as child) |
| **StudyTask** (daily plan) | `todayPlan` (`StudyTask[]`) | Dashboard, Planner |
| **WeeklyGoal** | `weeklyGoals` | Dashboard, Planner |
| **Test** (scheduled + attempted) | `upcomingTests`, `previousTests` (`TestSummary[]`) | Tests, Dashboard |
| **Question** | `questions` | Test interface |
| **TestAttempt / Result** | hard-coded + `subjectBreakdown`, `errorMix`, `timePerQuestion`, `scoreTrend` | Results, Dashboard |
| **Mistake** | `mistakes` (`Mistake[]`) | Mistake Bank, Dashboard, Results |
| **TopicNode** (revision graph) | `topicGraph` (`TopicNode[]`) | Revision Graph, Exam DNA |
| **ExamDNA / analytics** | `examDnaRadar` + hard-coded behaviour scores | Exam DNA, Results |
| **StudyLog / Heatmap** | `heatmap` | Dashboard, Profile (`StudyHeatmap`) |
| **LeaderboardEntry** | `leaderboard` (`LeaderboardEntry[]`) | Leaderboard, Tests, Teacher |
| **Achievement** | `achievements` | Profile |
| **ParentReport** | `parentReport` | Parent |
| **ClassPerformance / Batch** | `classPerformance` | Teacher |
| **Assignment** | local const in `app.teacher.tsx` | Teacher |
| **UserSettings** | local const in `app.settings.tsx` | Settings |
| **ChatMessage (AI mentor)** | canned in `AiChatDock` | Global dock |

---

## 7. Notable "AI/computed" surfaces (not simple DB reads)

Several sections render **hard-coded prose/arrays** rather than mock data — these represent **computed or AI-generated** outputs the backend must produce, not straight CRUD reads:

- Dashboard "AI mentor" insight card.
- Results page: AI feedback prose, per-question timeline (synthetic formula), difficulty analysis, weak/strong lists, StatCard numbers.
- Exam DNA: behaviour scores, error profile, burnout/discipline/endurance/velocity, DNA narrative.
- Planner: "Recommendations", week/month plans (synthetic).
- Revision Graph: "Revision history" (hard-coded).
- AiChatDock: canned replies (→ real LLM mentor endpoint).

These map to endpoints like `GET /analytics/exam-dna`, `GET /tests/:id/result`, `POST /mentor/chat`, `POST /planner/generate` in `API_SPEC.md`.

---

## 8. Suggested Backend Shape

```
MongoDB (Mongoose)  ──  REST API (Express/Fastify)  or  TanStack server functions
        │
        ├── auth service (JWT/session cookie, OTP via SMS, OAuth)
        ├── study service (tasks, goals, planner, pomodoro, heatmap)
        ├── test service (tests, questions, attempts, results, custom generator)
        ├── mistake service (bank, classification, spaced repetition)
        ├── analytics service (Exam DNA, subject/error/time breakdowns, predicted AIR)
        ├── graph service (topic mastery nodes + links, revision history)
        ├── social service (leaderboard, achievements, XP)
        ├── workspace service (parent reports, teacher batches, assignments)
        ├── settings service (preferences, account)
        └── mentor service (LLM chat grounded in the student's attempt data)
```

Recommended collections and their fields are in **`DATABASE_SCHEMA.md`**; every endpoint with request/response bodies, auth requirements, and the models it touches is in **`API_SPEC.md`**.
</content>
</invoke>
