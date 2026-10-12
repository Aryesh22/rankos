# 🎤 Interview Prep — RankOS (one evening, everything you need)

> **Goal:** walk into the interview able to explain *what* RankOS is, *how* it is
> built, *why* each choice was made, and *what you would fix next* — using the
> real files in this folder, in plain language.
>
> Read this top to bottom once (about 90 minutes). Then do the Night-Before
> Checklist at the end. Every answer below points at a real file so you can open
> it and see for yourself. Nothing here is invented.

---

## Part 0 — One honest sentence first

If asked "did you build this alone?", say the truth and make it a strength:

> "I built it with AI pair-programming assistance, and I've gone through the
> codebase file by file to understand every layer. I can walk you through any
> request end to end, and I know the open bugs."

Interviewers care far more about **understanding** than about who typed. A
candidate who can name three real bugs in their own project is rare and
impressive. This guide gives you those bugs (Part 7).

---

## Part 1 — The 60-second pitch (memorise this)

> "RankOS is an AI study mentor for JEE/NEET exam aspirants. A student logs in,
> gets a daily study plan, takes timed mock tests, and the app automatically
> scores the attempt, files every wrong answer into a *mistake notebook*, awards
> achievements, and generates an AI summary of weak and strong areas. There's a
> leaderboard, a revision graph, a Pomodoro timer, and separate parent and
> teacher views.
>
> Technically it's two apps: a **Node.js + Express + MongoDB** REST API with
> cookie-based JWT sessions, and a **React 19 + TypeScript** frontend built on
> TanStack Router/Query with Tailwind. The backend has a layered architecture
> — routes, controllers, services, repositories, models — with Zod validation,
> centralised error handling, rate limiting, Swagger docs, integration tests
> against an in-memory MongoDB, and a multi-stage Docker image. The AI layer is
> provider-agnostic: Anthropic, Gemini or OpenAI via env config, with a
> data-grounded local fallback so the app works with zero API keys."

Say it out loud five times tonight.

---

## Part 2 — Tech stack cheat sheet ("why did you use X?")

| Layer | Tool | One-line *why* you can say |
|---|---|---|
| Runtime | **Node.js 20+** (ES modules) | Same language front and back; non-blocking I/O suits an API that mostly waits on the database. |
| Web framework | **Express 4** | Minimal, huge ecosystem, middleware model makes cross-cutting concerns (auth, logging, rate limits) one line each. |
| Database | **MongoDB + Mongoose** | Student data is document-shaped (a test attempt with nested responses, a profile with nested stats). Mongoose gives schemas, validation and indexes on top. |
| Validation | **Zod** | One schema validates *and* coerces input; errors map straight to per-field messages the forms show. |
| Auth | **JWT** (access + refresh) in **httpOnly cookies**, **bcrypt** for passwords | Cookies can't be read by JavaScript, so XSS can't steal tokens. Short access token + rotating refresh token limits damage if one leaks. |
| Security middleware | **helmet**, **cors**, custom **sanitize** | Secure headers; controlled cross-origin access; strips `$`-keys to block NoSQL injection. |
| Rate limiting | **express-rate-limit** (+ Redis store when available) | Blunts brute force and abuse; Redis lets limits be shared across multiple server instances. |
| Logging | **winston** + **morgan** | Structured, levelled logs with daily file rotation; every request carries a request ID. |
| Realtime / jobs | **Socket.IO**, **BullMQ** | Infrastructure is wired for live updates and background jobs (e.g. email). Both are optional at runtime. |
| Docs | **swagger-jsdoc + swagger-ui** | Live API docs at `/api/docs`. |
| Tests | Node's built-in test runner + **supertest** + **mongodb-memory-server** | Integration tests boot the real app against a throwaway in-memory Mongo. No external services needed in CI. |
| Frontend | **React 19 + TypeScript + Vite** | Type safety across the API contract; Vite for fast dev builds. |
| Routing | **TanStack Router** (file-based) + **TanStack Start** (SSR) | A file = a page; `beforeLoad` guards handle auth redirects before render. |
| Data fetching | **TanStack React Query** | Caching, de-duplication, background refetch, loading/error states for every API call. |
| Forms | **react-hook-form + Zod** | Same schema style as the backend; server field errors drop straight into the form. |
| UI | **Tailwind CSS 4 + Radix UI + shadcn-style components**, **Recharts**, **motion** | Accessible primitives, consistent design tokens, charts for analytics. |
| Deployment | **Docker** (multi-stage, non-root, healthcheck), **Render blueprint**, Cloudflare/Nitro for frontend, **GitHub Actions CI** | Repeatable builds; CI runs tests + type-check + Docker build on every push. |

---

## Part 3 — The architecture in one picture

```
Browser (React)                              Server (Express)                     MongoDB
──────────────                               ────────────────                     ───────
page (routes/app.planner.tsx)
  └─ useQuery(tasksQueryOptions)
       └─ services/tasks.ts
            └─ lib/api.ts  apiFetch("/tasks?date=…", credentials:"include")
                 │  cookie: access_token=<JWT>
                 ▼
            app.js middleware chain:
              requestId → helmet → cors → json → cookieParser → sanitize
              → compression → morgan → rateLimiter → routes
                 ▼
            routes/tasks.routes.js   router.use(authenticate)  ← verifies JWT, silent-refreshes if expired
                 ▼
            controllers/tasks.controller.js   reads req.user.id + req.query, calls service
                 ▼
            services/tasks.service.js   StudyTask.find({ user: userId, date })  ──────────▶  studytasks
                 ▼
            res.json({...})            (errors → middlewares/errorHandler.js → uniform JSON)
```

**The sentence to say:** "Every request passes through the same middleware
chain in `app.js`, then route → controller → service → model. Controllers are
thin, services hold the business logic, and *every query is scoped to the
logged-in user* — the client never sends its own ID."

### Folder map (know these cold)

| Folder (backend/src) | Job | Example |
|---|---|---|
| `routes/` | Which URLs exist, which middleware guards them | `tasks.routes.js` |
| `middlewares/` | Code that runs before handlers | `authenticate.js`, `validate.js`, `sanitize.js`, `rateLimiter.js`, `errorHandler.js` |
| `controllers/` | Read request → call service → send response | `auth.controller.js` |
| `services/` | Business rules | `attempts.service.js` (scoring), `session.service.js` (tokens) |
| `repositories/` | Reusable DB queries | `user.repository.js` |
| `models/` | Mongoose schemas (25 of them) | `user.model.js`, `testAttempt.model.js` |
| `validators/` | Zod schemas | `auth.validator.js` |
| `presenters/` | Shape DB docs into API JSON | `user.presenter.js` |
| `config/` | env, database, redis, logger, swagger | `env.js` |
| `services/ai/` | AI facade + provider registry | `index.js`, `providers/*.js` |
| `tests/` | Integration tests | `integration.test.js` |

Frontend (`rankos-ai-mentor/src`): `routes/` = pages, `services/` = API calls
per feature, `lib/api.ts` = the one HTTP client, `lib/auth.ts` = session +
guards, `components/ui/` = design system, `types/` = shared TypeScript types,
`API_SPEC.md` = the contract between the two apps.

---

## Part 4 — Five flows you must be able to explain deeply

Interviewers pick one feature and drill. Prepare these five; each one is a story
with real file names.

### Flow 1 — Login and sessions (`auth.service.js`, `session.service.js`, `authenticate.js`, `cookie.util.js`)

1. `POST /api/auth/login` with email-or-mobile + password.
2. `auth.service.login` loads the user **with** `passwordHash` (the field is
   `select: false` by default so it never leaks), checks it with bcrypt, and
   returns a *uniform* "incorrect credentials" error whether the account exists
   or not (no user enumeration).
3. `session.service.issueSession` signs two JWTs: a short-lived **access token**
   (15 min) and a long-lived **refresh token** (7 days, 30 with "remember me").
   The refresh token's hash and `jti` are stored in the `refreshtokens`
   collection so it can be revoked.
4. `cookie.util.setAuthCookies` sends both as **httpOnly, SameSite=lax** cookies.
   The refresh cookie is path-scoped to `/api/auth` so it's only sent where needed.
5. On every protected request, `authenticate` middleware verifies the access
   token. If it's expired, it **silently rotates** using the refresh cookie and
   sets fresh cookies — the frontend never has to handle expiry.
6. **Reuse detection:** if a revoked refresh token is presented again, the server
   assumes theft and revokes the user's whole token family.

*Why cookies not localStorage?* JavaScript can't read httpOnly cookies, so an
XSS bug can't exfiltrate the session. *Why two tokens?* A stolen access token
dies in 15 minutes; the refresh token is revocable server-side.

Signup is mobile + OTP: `signup` creates user + profile + OTP inside
`withTransaction`, the OTP is stored as a **SHA-256 hash**, is single-use,
5-minute TTL, max 5 attempts. SMS is a dev stub (code appears in server logs).

### Flow 2 — Taking a mock test (`attempts.service.js`, `gamification.service.js`)

1. `startAttempt` creates a `TestAttempt` with the questions **minus** the
   correct answers (the test asserts this: "hides answers").
2. `saveResponse` records each selected option as the student goes.
3. `submitAttempt` is the big one:
   - loads the test with questions populated, scores each response,
   - computes score, accuracy, a percentile and a predicted rank,
   - asks the AI layer for a one-time performance summary and stores it on the
     attempt (generated once, served many times — no repeated AI cost),
   - bulk-inserts every wrong question into the **Mistake** collection
     (`Mistake.insertMany`) so the mistake notebook fills itself,
   - calls `evaluateAfterSubmit` which creates a result notification and awards
     achievements ("Top 1%", "Century", "Iron Streak"). This is **best-effort**:
     wrapped in try/catch so a gamification bug can never break a submission.
4. Returns a `resultUrl`; the results page reads the stored attempt.

*Design point to mention:* side effects that aren't essential (notifications,
badges) are isolated and non-fatal. Essential writes (score) happen first.

### Flow 3 — The AI layer with zero keys (`services/ai/index.js`, `providers/`)

- One facade `run({ system, prompt, fallback })`.
- `providers/index.js` picks a provider: `AI_PROVIDER` env if set and
  configured → first configured of Anthropic / Gemini / OpenAI → **local**.
- Every feature (mentor reply, recommendations, test summary, topic notes)
  supplies a **grounded fallback composer** that builds the answer from the
  student's real data (weakest topic, pending mistakes, accuracy). So with no
  key, the user still gets a sensible, personalised answer — never "lorem ipsum".
- If the remote call throws or returns empty, it falls back and logs a warning.
- `GET /api/ai/status` tells you which provider is live.

*Say:* "Switching the model vendor is an env change, not a code change, and the
app degrades gracefully instead of failing."

### Flow 4 — Input safety and errors (`validate.js`, `sanitize.js`, `errorHandler.js`, `ApiError.js`)

- `validate({ body: schema })` runs Zod; on success the **parsed** value replaces
  `req.body` (so handlers get typed, coerced data). On failure → 422 with a
  `fields` map that react-hook-form displays directly.
- `sanitize` deletes any key starting with `$` or containing `.`, plus
  `__proto__`/`constructor`/`prototype` — that blocks NoSQL operator injection
  (e.g. `{ "password": { "$gt": "" } }`) and prototype pollution. It leaves
  string *values* alone because maths content has `<`, `>` symbols.
- `errorHandler` is the last middleware. It normalises Mongoose validation
  errors (422), bad ObjectIds (400), duplicate keys (409) and bad JSON (400) into
  one envelope `{ success:false, error:{ code, message, fields? } }`.
  Unexpected errors become a masked 500 so stack traces never reach the client.
- `asyncHandler` wraps every async controller so thrown promises reach the
  error handler (Express 4 doesn't catch async errors by itself).

### Flow 5 — Frontend data and route guards (`lib/api.ts`, `lib/auth.ts`, `routes/app.tsx`, `services/queries.ts`)

- `apiFetch` is the single HTTP client: base URL from `VITE_API_URL` or
  same-origin `/api`, always `credentials: "include"`, converts non-2xx into a
  typed `ApiError` with `status`, `code`, `fields`.
- The session is **one React Query entry** `["auth","session"]` that resolves to
  the user or `null`. A 401 means "logged out", not "crash".
- `routes/app.tsx` has `beforeLoad: requireAuth`. Every page under `/app/*`
  inherits the guard, and the guard's fetch is reused by the layout (no double
  request).
- Each feature has `xxxQueryOptions()` in `services/*.ts`, re-exported from
  `queries.ts`, so cache keys are consistent across pages.
- In dev, Vite proxies `/api` → `localhost:8080`, so cookies are same-origin
  and CORS never applies.

---

## Part 5 — Likely questions and answers you can own

### About the project

**Q: What problem does it solve?**
Exam aspirants practise a lot but rarely *analyse*. RankOS turns every mock
test into structured feedback: automatic mistake notebook, weak-topic
detection, a plan for tomorrow, and an AI mentor grounded in their own numbers.

**Q: Who are the users?**
Four roles: `student`, `parent`, `teacher`, `admin` (see `constants/roles.js`; admin can never be self-assigned at signup). Routes
use `authorize("teacher")` after `authenticate`; the test
"role-based access control blocks a student from teacher routes" proves it.

**Q: What was the hardest part?**
Honest answer: the auth contract. The frontend was built against `API_SPEC.md`
(mobile + OTP) while the backend originally did email + password. I rebuilt the
backend auth to the frontend's contract and kept password login as well. It
taught me that the API spec is the real source of truth between two teams.

**Q: How big is it?**
Roughly: 21 route groups, 25 Mongoose models, 23 services, about 20 frontend pages.
(Count them in `routes/index.js`, `models/`, `services/`, `src/routes/`.)

### Backend

**Q: Why the layered architecture? Isn't it overkill?**
Each layer has one reason to change. URL changes touch routes; rule changes
touch services; storage changes touch models. It also makes testing easy:
services can be tested without HTTP, controllers without a DB.

**Q: What does the middleware chain look like, in order?**
requestId → helmet → cors → json/urlencoded → cookieParser → sanitize →
compression → morgan → rate limiter (on `/api`) → swagger → routes → notFound →
errorHandler. Order matters: sanitize must run after body parsing, error handler
must be last.

**Q: How do you version the API?**
Feature routers are mounted both at `/api/...` (the frontend contract) and
`/api/v1/...`. A breaking change can go to `/api/v2` without touching clients.

**Q: How does the server start and stop?**
`index.js`: connect Mongo (fatal if it fails), then optional Redis, Cloudinary,
email, jobs, sockets, then listen. On SIGTERM/SIGINT it stops accepting
connections, closes sockets, queues, Redis, Mongo, with a 10-second force-exit
timer. Docker uses `dumb-init` so signals reach Node.

**Q: What's `trust proxy` for?**
Behind a load balancer the real client IP is in `X-Forwarded-For`; trusting one
hop makes rate limiting key on the real IP.

**Q: Transactions in MongoDB?**
`withTransaction` uses a real multi-document transaction on a replica set, and
detects (once, cached) if it's a standalone dev `mongod` and then runs without
one. Signup uses it so user + profile + OTP are created together.

### Database

**Q: Why MongoDB over SQL?**
Documents fit the data: an attempt holds its responses; a profile holds nested
stats. Schema evolves quickly during product iteration. Mongoose still gives me
schemas, enums, indexes. I'd consider Postgres if reporting across many
relations became the core workload.

**Q: How do you handle uniqueness when fields are optional?**
`user.model.js` uses **partial indexes**: unique on `email`/`mobile`/`username`
only for non-deleted docs that actually have the field. So many users can have
"no mobile" without colliding, and a soft-deleted user's email can be reused.

**Q: Why `select: false` on passwordHash?**
Queries never return it by accident. Only the login path does
`.select("+passwordHash")`.

**Q: Indexes you'd add?**
`{ user: 1, date: 1 }` on StudyTask (the planner's main query),
`{ scope: 1, range: 1, xp: -1 }` on LeaderboardEntry (currently sorts in
memory — see Part 7).

### Security

**Q: XSS, CSRF, injection — how are each handled?**
- XSS: tokens in httpOnly cookies; helmet sets CSP-ish headers; React escapes output.
- CSRF: `SameSite=lax` cookies; state-changing routes are JSON POST/PATCH which
  simple forms can't send with the right content type.
- NoSQL injection: `sanitize` strips `$`/dotted keys; Zod validates types.
- Brute force: rate limiter + OTP attempt cap + bcrypt cost 12.
- Secrets: `.env`, never committed; server refuses to boot in production with
  dev JWT secrets.

**Q: What's refresh-token rotation and why?**
Each refresh use revokes the old token and issues a new one. If an old token is
ever replayed, that's evidence of theft, so every session for that user is
revoked. Limits the window for a stolen token.

### Frontend

**Q: Why TanStack Router over React Router?**
Type-safe file-based routes, built-in `beforeLoad` guards with loaders, and it
pairs with TanStack Start for SSR. The `routeTree.gen.ts` is generated so links
are typed.

**Q: Why React Query? Isn't `useEffect + fetch` enough?**
React Query gives caching, de-duplication (two components asking for the same
data = one request), stale-while-revalidate, retries and loading/error state
for free. The session query is a good example: guard and layout share one fetch.

**Q: How do server validation errors reach the form?**
Backend returns 422 with `fields: { mobile: "already registered" }`.
`apiFetch` throws `ApiError` with `.fields`; `lib/form-errors.ts` maps them
into react-hook-form `setError`.

**Q: SSR — what does it mean here?**
TanStack Start renders the first HTML on the server (Nitro), then React hydrates
in the browser. The session guard works on both sides because it just calls
`GET /auth/me` with cookies.

### Testing and DevOps

**Q: How do you test?**
`npm test` runs Node's test runner. `integration.test.js` boots
`mongodb-memory-server`, seeds data, and uses supertest against the real
Express app (exported without listening — that's why `createApp()` is
separate from `index.js`). Tests cover: login cookie, 422 field errors, auth
required, dashboard data, mistakes filter + NoSQL injection rejection, AI
status/mentor/notes, attempt lifecycle hiding answers, upload + OCR, RBAC.

**Q: Describe the Dockerfile.**
Multi-stage: `deps` stage runs `npm ci --omit=dev`, `runtime` stage copies only
`node_modules` + `src`. Runs as the non-root `node` user, has a `HEALTHCHECK`
on `/api/health/live`, uses `dumb-init` as PID 1 for correct signal handling.

**Q: What's the #1 deployment gotcha?**
Cookie + CORS topology. Same-origin (API under `/api` of the app domain) is
simplest: `SameSite=lax`, no CORS. Cross-origin needs `SameSite=none`,
`Secure=true`, exact `CORS_ORIGIN` (never `*` with credentials), both HTTPS.

**Q: CI?**
GitHub Actions: backend `npm ci && npm test`, frontend `tsc --noEmit && npm run
build`, and a Docker build. Deploy only runs after these pass.

**Q: Health checks?**
`/api/health/live` = process is up (used by Docker/Render). `/api/health/ready` = ready to serve traffic. `/api/health` =
dependency status (Mongo, Redis).

---

## Part 6 — Demo script (if you can share your screen)

Start it (two terminals, order matters — see `HOW_TO_RUN.md`):

```bash
cd ~/Desktop/myapp/backend && npm start          # window 1 → "listening on :8080"
cd ~/Desktop/myapp/rankos-ai-mentor && npm run dev   # window 2 → http://localhost:8081
```

Login: `aarav@example.com` / `password123` (teacher@ and parent@ share it).

Show, in this order (about 4 minutes):
1. **Dashboard** — streak, predicted rank, today's plan. Say: "one aggregated
   endpoint, `GET /dashboard`, so the page needs one round-trip."
2. **Tests → take a test → submit → Results** — "this one submit scores,
   writes mistakes, awards badges and stores an AI summary."
3. **Mistakes** — "filled automatically by the submit above."
4. **AI mentor chat dock** — "no API key is set, so this is the grounded local
   fallback using my real data. Set `ANTHROPIC_API_KEY` and it becomes a real model."
5. **Swagger** at `http://localhost:8080/api/docs` — "every endpoint documented."
6. **DevTools → Application → Cookies** — point at the httpOnly flags.
7. **Terminal** — `npm test` in backend to show green integration tests.

Backup if the app won't run: open `app.js`, `authenticate.js`,
`attempts.service.js` and walk through Part 4 from the code.

---

## Part 7 — "What would you improve?" (your secret weapon)

These are **real, verified issues** in this codebase. Naming them shows mastery.
Pick three.

| Issue | Where | What you'd say |
|---|---|---|
| Planner "Today" is always empty | frontend sends `date=today` literally; `tasks.service.js` does `date \|\| todayStr()` so it queries the string "today" | "Resolve 'today' server-side to a real date, and add a Zod schema on the query so only `YYYY-MM-DD` passes." |
| OAuth stub trusts query params | `oauthCallback` takes `email`/`providerId` from the URL | "Replace with a real OAuth code exchange; never trust identity from the client." |
| CORS footgun | `origin: "*"` with `credentials: true` is allowed in dev | "Add a startup guard that refuses that combination like we already do for cookie flags." |
| Redis import-order bug | rate limiter builds its store at import time, before Redis connects, so it always falls back to memory | "Build the store lazily or after `connectRedis()` resolves." |
| Startup hang if Redis is down | `connectRedis` awaits a `ping()` that never rejects | "Add a connect timeout; optional dependencies must never block boot." |
| Leaderboard sorts in memory | `leaderboard.service.js` loads every entry then slices | "Index `{scope, range, xp}` and paginate with `.skip().limit()`; compute 'your rank' with a `countDocuments({ xp: { $gt: mine } })`." |
| Login ignores `isMobileVerified` | `auth.service.login` | "Block or soft-warn unverified accounts." |
| Dead code | `mockData.ts` (620 lines) no longer used | "Delete it; dead code misleads the next reader." |
| Socket.IO and BullMQ are wired but unused | `sockets/index.js`, `jobs/` | "Infrastructure-first was deliberate; next step is live leaderboard updates and queued emails." |
| Small ones | OTP attempt-count read-then-write race; resend cooldown only client-side; reset TTL 30 min in code vs 15 in spec | Any of these shows you read carefully. |

Bigger-picture improvements: unit tests for services (only integration tests
exist), observability (metrics + tracing on the request ID), caching the
dashboard aggregate, and a proper SMS provider.

---

## Part 8 — Flash cards (cover the right column)

| Prompt | Answer |
|---|---|
| Access token lifetime / refresh lifetime | 15 min / 7 days (30 with remember-me) |
| Where are tokens stored | httpOnly cookies, refresh scoped to `/api/auth` |
| Password hashing | bcrypt, 12 rounds |
| OTP | 6 digits, SHA-256 hashed, 5-min TTL, 5 attempts, single use |
| Validation library | Zod → 422 with `fields` |
| Error envelope | `{ success:false, error:{ code, message, fields? } }` |
| What blocks NoSQL injection | `sanitize` middleware strips `$` and dotted keys |
| Rate limit default | 300 requests / 15 min per IP |
| AI provider order | `AI_PROVIDER` env → Anthropic → Gemini → OpenAI → local |
| Test runner | Node built-in + supertest + mongodb-memory-server |
| Ports in dev | backend 8080, frontend 8081, Mongo 27017 |
| Why `createApp()` is separate from `index.js` | So tests import the app without starting a server |
| Front-end session cache key | `["auth","session"]` |
| Route guard | `beforeLoad: requireAuth` in `routes/app.tsx` |
| API versioning | same router at `/api` and `/api/v1` |
| Graceful shutdown | SIGTERM → close server → sockets → queues → Redis → Mongo, 10 s force timer |
| Docker user | non-root `node`, `dumb-init` PID 1 |
| Deployment gotcha | cookie SameSite + CORS origin topology |

---

## Part 9 — Night-before checklist (about 3 hours)

- [ ] Say the Part 1 pitch out loud until it flows (15 min).
- [ ] Run the app once and click through the demo order in Part 6 (20 min).
      Fix nothing; just make sure it runs.
- [ ] Open and *read* these six files slowly, in order (60 min):
      `backend/src/app.js` → `middlewares/authenticate.js` →
      `services/session.service.js` → `services/attempts.service.js` (the
      `submitAttempt` function) → `services/ai/index.js` (top 40 lines) →
      `rankos-ai-mentor/src/lib/auth.ts`.
- [ ] Explain Flow 1 and Flow 2 to a wall, or to a friend, without notes (20 min).
- [ ] Pick your three "improvements" from Part 7 and rehearse them (15 min).
- [ ] Run `npm test` in `backend/` and screenshot the green output (5 min).
- [ ] Re-read the flash cards (10 min). Sleep.

On the day: when a question is outside what you know, say "I haven't built that
part yet, but here is how I'd approach it" and reason from the layers in Part 3.
That answer scores higher than a bluff every time.

**Related lessons if a topic feels shaky:** [Life of a Request](04-backend-request-lifecycle.md) ·
[Authentication](06-authentication.md) · [The Frontend](07-frontend-react.md) ·
[Running & Deploying](09-running-and-deploying.md) · [m4 auth & security](m4-auth-security/) · [GLOSSARY](GLOSSARY.md)
