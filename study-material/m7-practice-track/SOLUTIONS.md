# Module 7 — Solutions

> **Goal:** Complete solutions for every [Module 7.2](02-guided-changes.md) exercise, and **architecture-level sketches only** for the [Module 7.3](03-feature-capstones.md) capstones. The capstones deliberately have no full code here: the struggle is the point, and a solution you copy is a solution you don't own. Compare your finished capstone against the sketch — different choices are fine if you can defend them.

---

## Part 1 — Full solutions for Module 7.2

### Exercise 1 — Log message

`backend/src/index.js`, inside `server.listen`:

```js
server.listen(env.app.port, () => {
  logger.info(
    `[server] ${env.app.name} listening on :${env.app.port} ` +
      `(${env.nodeEnv}) — API at ${env.app.apiPrefix} — Aryesh was here`,
  );
```

Verification: nodemon prints `restarting due to changes...` on save and the new message appears. Revert afterward.

### Exercise 2 — Health response field

`backend/src/controllers/health.controller.js`, in the `health` handler's data object:

```js
      memory: {
        rssMb: +(mem.rss / 1024 / 1024).toFixed(1),
        heapUsedMb: +(mem.heapUsed / 1024 / 1024).toFixed(1),
      },
      node: process.version,
      pid: process.pid,
      startedAtIso: new Date(startedAt).toISOString(),
    },
    "Health OK",
```

### Exercise 3 — `GET /tasks/stats`

**`backend/src/services/tasks.service.js`** — imports and new function:

```js
import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError.js";
import { StudyTask } from "../models/index.js";
```

```js
/** GET /tasks/stats?date=YYYY-MM-DD → counts for the day's plan. */
export async function getTaskStats(userId, date) {
  const day = !date || date === "today" ? todayStr() : date; // "today" handling = exercise 9 fix
  const match = { user: new mongoose.Types.ObjectId(userId), date: day };

  const [total, done, byTypeRaw] = await Promise.all([
    StudyTask.countDocuments(match),
    StudyTask.countDocuments({ ...match, done: true }),
    StudyTask.aggregate([
      { $match: match },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]),
  ]);

  const byType = Object.fromEntries(byTypeRaw.map((row) => [row._id, row.count]));
  return { date: day, total, done, pending: total - done, byType };
}

export default { listTasks, setTaskDone, createTask, deleteTask, getTaskStats };
```

**`backend/src/controllers/tasks.controller.js`**:

```js
// GET /tasks/stats?date=YYYY-MM-DD
export const getStats = asyncHandler(async (req, res) => {
  const data = await tasksService.getTaskStats(req.user.id, req.query.date);
  res.status(HTTP_STATUS.OK).json(data);
});

export default { listTasks, patchTask, createTask, deleteTask, getStats };
```

**`backend/src/routes/tasks.routes.js`**:

```js
router.use(authenticate);
router.get("/", tasksController.listTasks);
router.get("/stats", tasksController.getStats);
router.post("/", tasksController.createTask);
router.patch("/:id", tasksController.patchTask);
router.delete("/:id", tasksController.deleteTask);
```

Verification: authenticated curl returns `{ date, total: 5, done: 2, pending: 3, byType: {...} }` on fresh seed data; unauthenticated returns 401.

### Exercise 4 — `priority` field

**`backend/src/models/studyTask.model.js`**:

```js
    done: { type: Boolean, default: false },
    priority: {
      type: String,
      enum: ["low", "normal", "high"],
      default: "normal",
    },
    time: { type: String, default: null },
```

**`backend/src/services/tasks.service.js`**, in `createTask`:

```js
  const task = await StudyTask.create({
    user: userId,
    date: body.date || todayStr(),
    title: body.title,
    subject: body.subject,
    minutes: body.minutes ?? 0,
    type: body.type || "Concept",
    priority: body.priority || "normal",
    time: body.time ?? null,
    done: false,
  });
```

Verification: `POST /api/tasks` with `"priority":"high"` → 201 with the field; `"priority":"URGENT!!"` → 422 `Validation failed` with a `priority` detail (schema enum → Mongoose ValidationError → `errorHandler.js`). There is no Zod validator for tasks — `backend/src/validators/` contains only `auth.validator.js`; the schema enum is the sole guard, which is exactly the honest observation the exercise asks for.

### Exercise 5 — Frontend tweaks

`rankos-ai-mentor/src/routes/app.planner.tsx`:

```tsx
<PageHeader
  eyebrow="AI planner"
  title="Your plan, rebuilt while you sleep"
  ...
```

```tsx
<span
  className={cn(
    "mt-1.5 h-2.5 w-2.5 rounded-full",
    t.done ? "bg-success" : "bg-warning",
  )}
/>
```

Verification: hot-reload updates without a page refresh; pending-task dots turn amber (`--warning` is a semantic token defined in `src/styles.css`).

### Exercise 6 — Priority in the UI

**`rankos-ai-mentor/src/types/index.ts`**:

```ts
export interface StudyTask {
  id: string;
  title: string;
  subject: string;
  minutes: number;
  type: "Concept" | "Practice" | "Revision" | "Mock" | "Analysis";
  priority?: "low" | "normal" | "high";
  done: boolean;
  time: string;
}
```

(`priority` is optional because seeded documents predate the field — MongoDB doesn't backfill.)

**`rankos-ai-mentor/src/routes/app.planner.tsx`**, in the Today timeline:

```tsx
<div className="pb-6">
  <p className="text-[12px] tabular-nums text-muted-foreground">{t.time}</p>
  <p className="mt-0.5 text-[13.5px] font-medium">{t.title}</p>
  <p className="mt-1 text-[12px] text-muted-foreground">
    {t.subject} · {t.minutes} min · {t.type}
  </p>
  {t.priority === "high" && (
    <Badge variant="secondary" className="mt-1.5 rounded-full text-[10px]">
      High priority
    </Badge>
  )}
</div>
```

`Badge` is already imported in this file. Verification requires a high-priority task for today (exercise 4's curl) *and* the exercise 9 fix so the Today tab lists tasks at all.

### Exercise 7 — Test for the stats endpoint

**New file `backend/src/tests/tasks.stats.test.js`** — exactly as printed in the chapter (it is itself the solution):

```js
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongod;
let mongoose;
let api;
let cookies;

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.NODE_ENV = "test";
  process.env.SWAGGER_ENABLED = "false";

  const seeds = await import("../seeds/index.js");
  await seeds.run();

  const { app } = await import("../app.js");
  mongoose = (await import("mongoose")).default;
  const supertest = (await import("supertest")).default;
  api = supertest(app);

  const login = await api
    .post("/api/auth/login")
    .send({ identifier: "aarav@example.com", password: "password123" });
  cookies = login.headers["set-cookie"];
});

after(async () => {
  if (mongoose) await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

test("GET /tasks/stats requires authentication", async () => {
  assert.equal((await api.get("/api/tasks/stats")).status, 401);
});

test("GET /tasks/stats counts today's seeded plan", async () => {
  const res = await api.get("/api/tasks/stats").set("Cookie", cookies);
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 5);
  assert.equal(res.body.done, 2);
  assert.equal(res.body.pending, 3);
  assert.equal(res.body.byType.Mock, 1);
});
```

The seeded expectations come from `backend/src/seeds/data.js` → `todayPlan`: 5 tasks, 2 with `done: true`, one of type `Mock`. Key subtlety worth remembering: `MONGODB_URI` is set **before** any dynamic `import("../app.js")`, because `config/env.js` validates the environment at import time.

### Exercise 8 — Deliberate breakage

No lasting code changes — the "solution" is the reading:

- **Boot-time error** (`StudyTaskk` import): first line names the missing export; nodemon enters `app crashed - waiting for file changes`. Fix → auto-restart.
- **Request-time error** (`countDocument`): server boots; the failing request returns a 500 envelope *with a stack trace* (development only — `errorHandler.js` masks message and stack when `env.isProduction`), and the terminal logs it at `error` level with `method`, `path`, `requestId`.
- **Client errors:** malformed JSON → 400 `Malformed JSON in request body` (normalized from Express's `entity.parse.failed`); `PATCH /api/tasks/not-a-real-id` → 400 `Invalid value for '_id'` (normalized Mongoose CastError). The server never crashes for client mistakes.

### Exercise 9 — The `date=today` bug

**Root cause:** `rankos-ai-mentor/src/services/tasks.ts` sends the literal keyword `today` (`getTasks(date = "today")` → `/tasks?date=today`), but `backend/src/services/tasks.service.js` only had a *falsy* fallback:

```js
const day = date || todayStr();   // "today" is truthy → queries { date: "today" } → always []
```

**Fix** in `listTasks` (and mirrored in `getTaskStats`):

```js
export async function listTasks(userId, date) {
  const day = !date || date === "today" ? todayStr() : date;
  const tasks = await StudyTask.find({ user: userId, date: day }).sort({ time: 1 });
  return { data: tasks };
}
```

An equally valid alternative is fixing the *frontend* to send a real ISO date — but the frontend's documented contract ("`date=today` or an ISO date") and the dashboard's server-side `todayStr()` precedent make the backend the better home for the fix; the server should also never trust the client's clock less than its own. Verification: `curl ... "/api/tasks?date=today"` returns the seeded tasks; the Planner Today tab renders the timeline.

### Exercise 10 — Swagger documentation

`backend/src/routes/tasks.routes.js`, above the stats route:

```js
/**
 * @openapi
 * /tasks/stats:
 *   get:
 *     tags: [Tasks]
 *     summary: Task counts for a day
 *     description: Totals, done/pending split, and per-type counts for the user's study plan.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema: { type: string, example: "2026-08-11" }
 *         description: ISO day (YYYY-MM-DD), or "today". Defaults to today.
 *     responses:
 *       200:
 *         description: Stats for the day
 *       401:
 *         description: Not authenticated
 */
router.get("/stats", tasksController.getStats);
```

Verification: a **Tasks** section appears at `http://localhost:8080/api/docs`. `swagger.js` scans `./src/routes/*.js` for `@openapi` blocks; the YAML inside the comment is indentation-sensitive.

---

## Part 2 — Capstone sketches (architecture only, on purpose)

**Why no code here:** each capstone is a rehearsal for real work, where nobody hands you the diff. If your version works, passes tests, and you can defend its decisions, it *is* a correct solution — even where it differs from these sketches. Use them as a post-completion code-review checklist, not a map.

### Capstone A — Bookmarks: reference architecture

- **Model** (`bookmark.model.js`): `{ user: ObjectId ref User (required, indexed), question: ObjectId ref Question (required), note: String (default null) }`, timestamps, the standard `toJSON` id-transform copied from `note.model.js`. Duplicate prevention belongs in the database, not in application code: a **unique compound index** `{ user: 1, question: 1 }` — then a double-create surfaces as Mongo error 11000, which `errorHandler.js` already converts to a 409. (If you instead checked `findOne` before create: that works but has a race window; the index doesn't. Good interview answer.)
- **Service:** `create` (catch/report duplicates cleanly), `list` (`find({ user }).sort({ createdAt: -1 }).populate("question", "text subject")` — populate only the fields the UI needs), `remove` (`deleteOne({ _id, user })`, 404 on `deletedCount === 0` — owner-scoping in the query itself, same as tasks).
- **Wiring:** export from `models/index.js`; routes file with `router.use(authenticate)`; one line in `routes/index.js`'s `buildFeatureRouter()`.
- **Frontend:** `services/bookmarks.ts` mirrors `services/tasks.ts` (typed wrappers + `queryOptions`); the page mirrors `app.planner.tsx`'s query/mutation/skeleton/empty-state shape; delete uses `useMutation` + `invalidateQueries({ queryKey: ["bookmarks"] })`.
- **Tests:** integration-pattern file; the subtle case worth having: user B (log in as `teacher@example.com`) cannot delete user A's bookmark (expect 404, *not* 403 — think about why not leaking existence matters).

### Capstone B — Auth reconciliation: reference architecture

- **The audit (the real deliverable):** login, signup+OTP, me, logout, forgot/reset-password all exist and are wired; OTP transport and OAuth are dev stubs; `EmailVerificationToken` is dead scaffolding; signup collects no email, so forgot-password is unreachable for organic accounts. Your writeup should end by *updating the stale note* — closing the loop between docs and code.
- **Backend shape:** a new `emailVerificationToken.repository.js` cloned from `passwordResetToken.repository.js` (create / findActiveByHash / consume / invalidateAllForUser). Service functions in `auth.service.js` (or a small `email-verification.service.js`): `requestEmailVerification(userId, email)` — normalize + store unverified email, issue opaque token via `generateOpaqueToken()` (store the **hash**; the raw token exists only in the emailed link, so a database leak doesn't leak live links), `sendMail(...)`, and log the link in non-production exactly like `forgotPassword` does; `verifyEmail(token)` — hash, look up active, expire-check, mark `isEmailVerified`, consume.
- **Routes:** the add-email route lives behind `authenticate` (it acts on the current user); `verify-email` is public (clicked from an email, possibly logged out) but rate-limited with `createRateLimiter` like the other credential endpoints.
- **Duplicate email:** rely on the existing partial unique index in `user.model.js`; translate 11000 into a 409 with `fields: { email: ... }` so the form highlights the field.
- **Frontend:** a settings card driven by `GET /auth/me` (extend `presentAuthUser` if `email`/`isEmailVerified` aren't exposed — check first), plus a tiny route to catch the verification link and call the API.
- **Proof:** the five-step loop from the acceptance criteria, executed end-to-end with the `[sms:stub]` and `[email] skipped`/logged-link outputs as your observable seams.

### Capstone C — Weekly summary: reference architecture

- **Separation:** `summary.service.js` computes `{ user, stats }` with zero knowledge of queues or email; the worker orchestrates (fetch users → compute → render → send → tally); the email template is a pure function `(name, stats) => ({ subject, html, text })`. This lets you test the interesting logic with a plain script before any infrastructure exists.
- **Queue wiring:** in `jobs/index.js`'s `initJobs()` (its doc comment names this as the extension point): `createQueue("weekly-summary")`, a BullMQ `Worker("weekly-summary", handler, { connection: createRedisConnection() })`, and a repeatable job added with `{ repeat: { pattern: "0 7 * * 1" } }`. Manual trigger for dev = `queue.add("run-now", {})` from a small script or dev-only route.
- **Date windows:** the models store both real `Date`s (`createdAt`, `submittedAt`) and `"YYYY-MM-DD"` strings (`StudyLog.date`-style, as seeded) — compute last-Monday..Sunday boundaries once and derive both representations; off-by-one weeks are *the* bug of this capstone.
- **Sending:** only ever through `sendMail`; skip-and-count users without email; let individual-user failures be caught per-user so one bad address doesn't fail the batch — but let *infrastructure* failures throw so BullMQ's retry (already configured: 3 attempts, exponential backoff in `queue.js`) does its job. Idempotency thought (stretch): if the job retries after sending 2 of 3 emails, who gets duplicates? A `sentAt` marker per user-week fixes it.
- **Shutdown:** track the Worker and close it alongside `closeQueues()`.

### Capstone D — Presence: reference architecture

- **Handshake auth:** `io.use((socket, next) => ...)` in `sockets/index.js` — parse `socket.handshake.headers.cookie`, extract the access-token cookie (name from `utils/cookie.util.js`), `verifyAccessToken` from `utils/jwt.util.js`, stash `socket.data.userId`, `next()` or `next(new Error("unauthorized"))`. Expired access token at handshake time is the known rough edge (sockets can't run the silent-refresh dance) — acceptable for this feature since the app refreshes on page load; noting that trade-off is part of the solution.
- **Presence state:** `Map<userId, number>` of connection counts. On connect: increment; on disconnect: decrement and delete at zero. Broadcast `presence:update` `{ online, userIds }` only when a user *appears or disappears*, not on every socket event. The multi-tab case is exactly why counts, not booleans.
- **Dev networking:** direct client connection `io("http://localhost:8080", { withCredentials: true })`; backend `.env` gets `CORS_ORIGIN=http://localhost:8081` because credentialed CORS forbids `*` — this is the capstone's designed "CORS finally bites" moment.
- **Frontend:** one module-level socket instance (`src/lib/socket.ts`) created lazily; a hook that subscribes in `useEffect`, updates state on `presence:update`, and cleans up its listener on unmount; the indicator in `AppLayout.tsx`. Guard against connecting before login (only mount the hook inside the authenticated layout).
- **Honest limits (write these down):** in-memory Map dies with the process and diverges across multiple instances (fix: Redis as shared presence store + the Socket.IO Redis adapter); userIds broadcast to all clients is a privacy decision to revisit before production.

---

*End of Module 7. Go build.*
