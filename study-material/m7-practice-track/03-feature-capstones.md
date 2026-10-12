# Module 7.3 — Feature Capstones

> **Goal:** Build four substantial features on your own. Each capstone gives you a user story, acceptance criteria, the files to study first, a suggested order of attack, and hints that point at existing code to imitate — but **no finished code**. The struggle between "I know what to build" and "it works" is where you actually become a developer.

**How to work these:**

- Do them in order — each is harder than the last (a: pure imitation of existing patterns; b: reading + reconciling two codebases; c: new infrastructure; d: a technology the app has wired but never used).
- Budget days, not hours. A realistic pace: A ≈ 3–5 evenings, B ≈ 4–6, C ≈ 3–5, D ≈ 4–6. Getting stuck is the exercise. When stuck for 30+ minutes, escalate one rung at a time: (1) re-read the error, first line and top stack frame; (2) shrink the problem — curl instead of clicking, test the service from a throwaway script; (3) re-read the capstone's "files to study first"; (4) add `logger.debug(...)` / `console.log(...)` at the boundary you distrust and look at what's *actually* there; (5) grep for someone who solved the same shape of problem (`grep -rn "populate(" backend/src`); (6) ask Claude for a hint, not a fix; (7) sleep on it, then rung 1 again.
- Use git before you start each one (Module 7.4 shows the branch-per-feature workflow). **Note:** as of today, `~/Desktop/myapp` is *not* a git repository — initializing it is literally step zero of capstone (a).
- [SOLUTIONS.md](SOLUTIONS.md) contains architecture-level sketches only — deliberately. Check them *after* you've shipped, to compare decisions.
- After each capstone, re-run `npm test` in `backend/` — you must not break the 17 existing tests (19 with your Module 7.2 additions).

---

## Capstone A — Bookmarks / Saved Questions (end-to-end feature)

The classic first feature: a new model, new endpoints, new UI — built entirely by imitating patterns that already exist in this codebase. Nothing here requires anything you haven't seen.

### User story

> As a student, while reviewing tests and mistakes I want to **save questions to a personal bookmarks list** with an optional note, and see them all on one page, so I can rebuild my weak-spot revision set without hunting through old attempts.

### Acceptance criteria

1. `POST /api/bookmarks` with `{ "questionId": "<id>", "note": "optional text" }` creates a bookmark **for the logged-in user** and returns 201 with the created bookmark (with `id`, not `_id` — match the existing `toJSON` transform convention).
2. Bookmarking the same question twice does **not** create a duplicate (either return the existing one or a 409 — your call, but document it in the route's `@openapi` block).
3. `GET /api/bookmarks` returns the user's bookmarks, newest first, with the question's text/subject populated (hint: Mongoose `.populate()` — see how `dashboard.service.js` populates `"test", "code maxScore"` on attempts).
4. `DELETE /api/bookmarks/:id` returns 204; deleting someone else's bookmark or a nonexistent id returns 404 (imitate `deleteTask` in `tasks.service.js` — note how it scopes the delete to `{ _id, user }` in one query).
5. All three endpoints return 401 without a session.
6. A `/app/bookmarks` page in the frontend lists them, shows the note, and has a working remove button.
7. A test file `backend/src/tests/bookmarks.test.js` (integration-test pattern) covers criteria 1, 3, 4, and 5.

### Files to study first (your templates)

| To build | Imitate |
|---|---|
| `backend/src/models/bookmark.model.js` | `backend/src/models/note.model.js` — a user-owned document with a compound index and the standard `toJSON` transform. Your schema: `user` (ref User, required, indexed), `question` (ref `Question`), `note` (string, optional). For criterion 2, look at how `user.model.js` builds a **unique** index |
| Model registration | `backend/src/models/index.js` — new models must be exported here or `import { Bookmark } from "../models/index.js"` won't resolve |
| `backend/src/routes/bookmarks.routes.js` | `backend/src/routes/tasks.routes.js` — `router.use(authenticate)` then the CRUD lines |
| Route registration | `backend/src/routes/index.js` — add an import + one `router.use("/bookmarks", ...)` line inside `buildFeatureRouter()` |
| `backend/src/controllers/bookmarks.controller.js` | `backend/src/controllers/tasks.controller.js` — thin `asyncHandler` wrappers, `req.user.id` for scoping |
| `backend/src/services/bookmarks.service.js` | `backend/src/services/tasks.service.js` — including `ApiError.notFound(...)` for missing docs |
| `rankos-ai-mentor/src/services/bookmarks.ts` | `rankos-ai-mentor/src/services/tasks.ts` — typed `apiFetch` wrappers + `queryOptions` |
| `rankos-ai-mentor/src/routes/app.bookmarks.tsx` | `rankos-ai-mentor/src/routes/app.planner.tsx` — `createFileRoute`, `useQuery`, `useMutation` + `invalidateQueries` on delete. TanStack Router picks up the new file automatically (the route tree regenerates while `npm run dev` runs) |
| A type for the bookmark | `rankos-ai-mentor/src/types/index.ts` |

Where do question ids come from for testing? The seed inserts questions (`Question.insertMany(D.buildQuestions())` in `backend/src/seeds/index.js`). Grab one id with mongosh:

```bash
mongosh rankos --eval 'db.questions.findOne({}, {_id: 1})'
```

### Suggested step order

1. `git init` + first commit of the whole project, then a `feature/bookmarks` branch (see Module 7.4).
2. Model + registration in `models/index.js`. Restart, confirm no boot errors.
3. Service → controller → routes → registration in `routes/index.js`. **Verify with curl at every step** — create, duplicate-create, list, delete, delete-again (expect 404).
4. The test file. Run `npm test`.
5. Frontend service + type, then the page. Add a sidebar/nav link if you find where navigation lives (search `AppLayout.tsx` for an existing label like "Planner" and follow the pattern).
6. `@openapi` doc blocks (Module 7.2, exercise 10 pattern).

### Stretch goals

- A bookmark button on the test-results review UI (`rankos-ai-mentor/src/routes/app.results.tsx` or `test.$testId.tsx`) — optimistic toggle with React Query.
- A `bookmarkCount` on the dashboard payload (`backend/src/services/dashboard.service.js` — add one query to its `Promise.all`).
- A Zod validator + `validate({ body })` middleware for `POST /bookmarks` — the pattern tasks never got (see `routes/auth.routes.js` for how validators are attached).

---

## Capstone B — Reconcile an auth flow (read first, build second)

This one is less about typing code and more about **establishing the truth of a system** — the highest-leverage skill you'll practice in this course.

### Context — and a warning about stale documentation

Earlier course notes (and the memory file `rankos-auth-contract.md` in your Claude project folder) recorded that the frontend was built against an auth spec while "the backend's auth layer is unbuilt — mismatch unresolved." **That is no longer true.** The backend has since grown a full auth implementation. Your first task is to verify the *current* truth against code, because documentation — including your own notes — rots.

What my reading of today's code says (verify every line of this yourself — that's the exercise):

**Exists and is wired end-to-end:**
- `POST /auth/login` (email *or* mobile + password) — `rankos-ai-mentor/src/routes/login.tsx` → `src/services/auth.ts` (`authApi.login`) → `backend/src/routes/auth.routes.js` → `auth.controller.js` → `auth.service.js` (`login()`), issuing httpOnly cookie sessions with silent refresh in `middlewares/authenticate.js`.
- Signup (mobile + OTP), `verify-otp`, `resend-otp`, `me`, `logout`, `forgot-password`, `reset-password`, and dev-stubbed OAuth.
- OTP "delivery" is a **dev stub**: `backend/src/services/sms.service.js` logs the code to the server terminal instead of sending SMS (look for `[sms:stub]` lines).

**Exists in name only / genuinely missing — this is the gap you'll close:**
- `signupSchema` (both `rankos-ai-mentor/src/lib/auth-schemas.ts` and `backend/src/validators/auth.validator.js`) collects `name, mobile, password, exam` — **no email**.
- `forgotPassword` (`backend/src/services/auth.service.js`) looks users up **by email only** and emails a reset link.
- Therefore: **a user who signs up normally can never reset their password.** The seeded demo users have emails (the seed sets them directly), which masks the hole.
- `backend/src/models/emailVerificationToken.model.js` exists and is registered in `models/index.js`, but **nothing imports it** — email verification was scaffolded and never built. (Prove this to yourself: `grep -rn "EmailVerificationToken" backend/src`.)

### User story

> As a student who signed up with my mobile number, I want to **add my email address and verify it**, so that "Forgot password" can actually rescue my account.

### Acceptance criteria

1. A written half-page "state of auth" summary in your own words: every `/auth/*` endpoint, what calls it from the frontend, and its status (works / stubbed / missing). Do this **before** writing code. Update the stale memory note when done.
2. `POST /api/account/email` (or a route of your choosing under an authenticated router) accepts `{ email }`, validates it (Zod), stores it un-verified on the user, creates an `EmailVerificationToken`, and sends a verification link via `services/email.service.js`. With SMTP unconfigured, the link must appear in the server log (imitate how `forgotPassword` logs the reset link in non-production).
3. `POST /api/auth/verify-email` consumes `{ token }`, flips `isEmailVerified`, and invalidates the token (single-use + expiry — imitate `passwordResetToken` handling in `auth.service.js` `resetPassword()`: hashed token lookup, `consume`, expiry check).
4. Duplicate email → 409 with a field error (the user model already enforces a partial unique index on `email` — find it near the bottom of `user.model.js`; your job is returning a *clean* error, which `errorHandler.js`'s duplicate-key branch already half-does for you).
5. The full loop demonstrably works: signup fresh user (grab OTP from the `[sms:stub]` log) → add email → click the logged link (or curl the token) → `forgot-password` with that email → reset link appears in log → `reset-password` → login with the new password.
6. Settings page (`rankos-ai-mentor/src/routes/app.settings.tsx`) gets an "Email & recovery" card: shows current email + verified state (`GET /auth/me` already returns the user — check what `presentAuthUser` in `backend/src/presenters/user.presenter.js` exposes and extend if needed), with an add/change form.

### Files to study first

- `backend/src/services/auth.service.js` — `forgotPassword` + `resetPassword` are your blueprint for token issue/consume.
- `backend/src/utils/token.util.js` (`generateOpaqueToken`, `hashToken`) — why store a *hash* of the token, never the token?  Answer that in your notes.
- `backend/src/models/emailVerificationToken.model.js` and `backend/src/repositories/passwordResetToken.repository.js` — you'll likely write an `emailVerificationToken.repository.js` mirroring the latter.
- `backend/src/presenters/user.presenter.js` — the single place deciding what user fields the client sees.
- `rankos-ai-mentor/src/routes/forgot-password.tsx` and `reset-password.tsx` — already built; your work makes them *reachable* for real users.

### Suggested step order

1. The audit (criterion 1). Trace login in a debugger-free way: add one `logger.debug` in `auth.service.login`, log in from the UI, watch it fire.
2. Backend: validator → repository → service functions → routes. Curl the whole loop before touching UI.
3. Frontend settings card.
4. Test file covering criteria 2–4.

### Stretch goals

- Let login also accept a *verified* email set this way (it already does — `findByIdentifierWithPassword`; confirm and add a test).
- Implement `sendViaProvider` in `sms.service.js` against a real SMS provider's free tier — or leave the stub but make the OTP appear in a dev-only API response so signup is testable without server logs.
- Rate-limit your new endpoints like `auth.routes.js` does with `createRateLimiter`.

---

## Capstone C — Weekly email summary (jobs + email systems)

RankOS ships *infrastructure* for background jobs (BullMQ + Redis in `backend/src/jobs/`) and email (Nodemailer in `services/email.service.js`) — but **zero queues, workers, or feature emails exist**. The comments in those files literally say features will register them later. You are "later."

### User story

> As a student, every Monday morning I receive a **"Your week in RankOS"** email: hours studied, questions solved, tests taken with best percentile, mistakes cleared vs. added, and my current streak — so momentum (or its absence) is impossible to ignore.

### Acceptance criteria

1. Redis runs locally (`brew install redis && brew services start redis`, then set `REDIS_URL=redis://localhost:6379` in `backend/.env`) and the boot log changes from `[jobs] disabled — no Redis configured` to `[jobs] queue system ready`.
2. A `weekly-summary` queue is created via the existing `createQueue` factory (`backend/src/jobs/queue.js`), and a BullMQ `Worker` processes it. `initJobs()` in `backend/src/jobs/index.js` registers both — read its doc comment; this is exactly the extension point it describes.
3. The job is **repeatable on a cron schedule** (Monday 07:00 — BullMQ repeatable jobs docs) *and* manually triggerable for development: either a small script (`node src/jobs/trigger-weekly.js`) or a dev-only authenticated endpoint. You will not wait until Monday to test.
4. The summary content is computed in a new `services/summary.service.js` from real models — `StudyLog`, `TestAttempt`, `Mistake`, `Profile`, `WeeklyGoal` (see how `dashboard.service.js` aggregates several models in one `Promise.all`; your date-range filters can use `createdAt` / the `date` strings the seed writes).
5. Email goes through the existing `sendMail(...)` — **never** a new transporter. With SMTP unconfigured it logs `[email] skipped (no SMTP) → Your week in RankOS to aarav@example.com`, which counts as success for dev. For a real inbox, sign up for a free Mailtrap (or Ethereal) account and fill the `SMTP_*` vars.
6. Users without an email are skipped without crashing the job; a summary line is logged (`[jobs] weekly-summary: 1 sent, 2 skipped`).
7. Failure behavior: throw inside the worker on a fake error and confirm BullMQ retries (the queue factory already sets `attempts: 3` with exponential backoff — find that in `queue.js` and watch it happen in the logs).

### Files to study first

- `backend/src/jobs/queue.js` + `jobs/index.js` — the factory and the bootstrap hook (`initJobs` is called from `src/index.js`).
- `backend/src/config/redis.js` — how connections are created/reused; `createRedisConnection` exists for BullMQ's dedicated-connection requirement.
- `backend/src/services/email.service.js` — the `sendMail` contract (`{to, subject, html, text}`).
- `backend/src/services/dashboard.service.js` — your model-aggregation template.
- BullMQ docs for `Worker` and repeatable jobs (the package is already in `package.json`).

### Suggested step order

1. Redis up; confirm the log line flips (criterion 1) and `GET /api/health` reports `"redis":"connected"`.
2. `summary.service.js` first, tested via a throwaway script that prints the object for the seeded student — no queue involved yet. Logic before infrastructure.
3. HTML template as a simple function returning a string (keep it inline; no template engine).
4. Queue + worker + manual trigger. Then the cron repeat.
5. The failure-retry experiment (criterion 7).

### Stretch goals

- Per-user opt-out stored via the existing settings endpoints (`routes/settings.routes.js` — `PATCH /settings`).
- Graceful shutdown: close your Worker in the shutdown path (`src/index.js` already calls `closeQueues()` — workers need the same treatment).
- Include a "next week's focus" line reusing whatever the AI layer exposes (`services/ai/index.js` — note its local fallback works with zero API keys).

---

## Capstone D — Realtime "study buddy online" indicator (Socket.IO)

The backend already attaches a Socket.IO server (`backend/src/sockets/index.js`) — but it only logs connections; no events, no auth, no rooms. The frontend has **no socket client at all** (check `rankos-ai-mentor/package.json` — `socket.io-client` is absent; installing it is part of the work). This capstone crosses the realtime frontier the app has wired but never used.

### User story

> As a student, I see a live **"N studying now"** indicator (and a green dot on the leaderboard rows of people currently online), so studying feels like a shared room instead of a lonely grind.

### Acceptance criteria

1. Socket connections are **authenticated**: the handshake is rejected (socket disconnected with an error) unless it carries a valid session. Hint: the browser sends cookies with the handshake when `withCredentials: true`; on the server, `socket.handshake.headers.cookie` is raw — parse it (the `cookie` package ships as a dependency of cookie-parser, or parse manually) and verify with `verifyAccessToken` from `backend/src/utils/jwt.util.js`. Study how `middlewares/authenticate.js` reads the cookie names (they live in `utils/cookie.util.js`).
2. The server keeps an in-memory presence map of `userId → connection count` (a user with two tabs is *one* person; closing one tab must not mark them offline — this is why you count connections, not booleans).
3. On every join/leave, the server broadcasts a `presence:update` event with `{ online: <count>, userIds: [...] }`.
4. Frontend: `npm install socket.io-client` in `rankos-ai-mentor/`, a small `src/lib/socket.ts` module creating one shared client, and a hook (`useOnlineCount()` or similar) that components subscribe to.
5. The count renders somewhere always visible (`rankos-ai-mentor/src/layouts/AppLayout.tsx` — the app shell around every page) with a pulsing green dot.
6. Two-browser proof: normal window + private window logged in as `teacher@example.com` (seeded, same `password123`). Count reads 2; close one → 1 within a few seconds.
7. Server restart doesn't wedge the UI: the client reconnects (Socket.IO's default) and the indicator recovers.

### The networking trap (read before you start)

In dev, your page is served by Vite (e.g. `:8081`) but Socket.IO lives on the backend (`:8080`) at path `/socket.io`. The Vite proxy in `vite.config.ts` forwards `/api` only — **websockets won't flow through it as configured** (and the Lovable config actively warns that ws proxying can interfere with HMR). The straightforward dev setup is a **direct cross-origin connection**:

```
io("http://localhost:8080", { withCredentials: true })
```

…which makes CORS real for the first time in this project: the backend's Socket.IO server is constructed with `cors: { origin: env.cors.origin, credentials: env.cors.credentials }` (see `sockets/index.js`) — and browsers reject `origin: "*"` **combined with credentials**. So set `CORS_ORIGIN=http://localhost:8081` (your actual Vite port) in `backend/.env`. When this bites you with cryptic console errors, you were warned here first.

### Files to study first

- `backend/src/sockets/index.js` — your extension point; note `getIO()` exists so other modules (a controller, a job) can broadcast.
- `backend/src/utils/jwt.util.js` + `utils/cookie.util.js` — token verification and the cookie names.
- `backend/src/app.js` — how CORS options are applied to Express (Socket.IO mirrors them).
- `rankos-ai-mentor/src/layouts/AppLayout.tsx` — where the indicator lives.
- Socket.IO docs: server `io.use()` middleware (the idiomatic place for handshake auth), client reconnection options.

### Suggested step order

1. Anonymous echo first: server logs a custom event, a temporary `useEffect` in AppLayout emits it. Prove the transport works before adding auth (isolate variables — debugging methodology, Module 7.4).
2. Handshake auth via `io.use()`. Prove rejection: connect from a logged-out private window and watch it fail.
3. Presence map + broadcast. Test with two browsers.
4. Extract the frontend hook, render the indicator properly.
5. Kill the backend, restart, watch recovery (criterion 7).

### Stretch goals

- Per-user green dots on `/app/leaderboard` (the seeded leaderboard rows link `user` ids — see how `seeds/index.js` builds `LeaderboardEntry`; only "Aarav's" row has a real user id, which is itself an interesting data-modeling discovery).
- Broadcast a `task:completed` toast to everyone online when someone checks off a task (server-side hook point: `setTaskDone` in `tasks.service.js`, via `getIO()`).
- Presence that survives multiple backend instances (spoiler: the in-memory Map doesn't — write down *why*, and what Redis would fix; this is a system-design interview classic).

---

## After the capstones

You'll have: a shipped CRUD feature, an audited-and-extended auth system, a scheduled background job with real email, and a realtime layer — each verified with tests or a reproducible demo. That is, without exaggeration, a junior-developer portfolio. The final chapter turns it into a growth plan.

**Next:** [Module 7.4 — Mastery Roadmap](04-mastery-roadmap.md)
