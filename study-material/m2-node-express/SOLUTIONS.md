# Module 2 — SOLUTIONS

> **Goal:** Full worked answers for every exercise in Module 2. Attempt each exercise honestly before reading; the reasoning here is the lesson, not just the answer.

## Chapter 2.1 — The Node.js Runtime

### 1. Which layer does what?

- **(a) `array.map(...)`** — **V8**. Pure JavaScript language execution: objects, functions, built-in prototypes. No I/O involved.
- **(b) Noticing MongoDB's reply on a socket** — **libuv**. Its poll phase watches OS file descriptors (sockets) and schedules the driver's callback when bytes arrive.
- **(c) Exposing `randomUUID`** — **Node's binding layer**: the `node:crypto` module is Node-provided glue over OS/OpenSSL crypto, made available to V8-land JavaScript.

### 2. Output order

```
1
5
4
3
2
```

- `1`, `5`: synchronous code runs to completion first.
- `4`: `process.nextTick` has its own queue drained **before** promise microtasks.
- `3`: promise microtasks drain next.
- `2`: `setTimeout(..., 0)` waits for the timers phase of the next event-loop iteration — always after all microtasks.

### 3. Why `http.createServer(app)` works

`http.createServer(handler)` needs a function of shape `(req, res)`. An Express app **is** such a function — `express()` returns a callable that also has methods like `.use` and `.get` hung off it. Verification: `createApp()` in `backend/src/app.js` returns the value of `express()` (line 24 creates it, line 76 returns it), and `index.js:13` passes it straight to `http.createServer`. Express is a request handler with a routing brain, not a server.

### 4. Where does `logs/` land?

`path.resolve(process.cwd(), env.log.dir)` resolves relative to the directory you *launched Node from*, not the file's location:

- `cd backend && npm run dev` → cwd is `backend/` → `backend/logs/`.
- `node backend/src/index.js` from the repo root → cwd is `myapp/` → `myapp/logs/`.

(Caveat from the file: the directory is only created when `env.isProduction` is true — in dev, no directory appears at all.)

### 5. Sync at boot vs sync per request

`fs.mkdirSync` in `logger.js` runs **once**, at module load, before the server accepts any traffic — blocking for a millisecond then costs nothing and simplifies the code (no async bootstrapping of the logger). `fs.readFileSync` inside `listTasks` would run **per request on the single JS thread**: while it blocks, every other in-flight request is frozen. Rule: synchronous I/O is acceptable at boot, a bug on the request path.

### 6. `start` vs `dev`

`"start": "node src/index.js"` runs the process once, plainly. `"dev": "nodemon src/index.js"` wraps it in a file-watcher that kills and restarts the process on every source change. Wrong for production because: the watcher costs resources and adds a crash-restart loop with no backoff or health integration; production restarts should be the supervisor's job (Docker/Kubernetes/systemd), which also handles logs, restart policies, and rollout; and you never want a stray file write to bounce a live server.

### 7. The CPU-bound route

The loop `for (let i = 0; i < 5e9; i++)` is synchronous CPU work on the one JS thread. Until it finishes, the event loop cannot advance — every other request (and every timer, and every DB callback) is stalled. `async`/`await` doesn't help because `await` only yields at *asynchronous boundaries*; this code has none. The fixes are: don't do it, chunk it (`setImmediate` between slices), or move it to a worker thread/separate service.

### 8. `process.env` types

- Without the prefix: `undefined undefined` — the variable is absent, and `typeof undefined` is `"undefined"`.
- With `PORT=8080`: `string 8080` — env values are **always strings**, never numbers.

The helper that exists because of this: `num()` in `backend/src/config/env.js:27-30`, which converts and falls back (`num(process.env.PORT, 8080)`).

## Chapter 2.2 — Express Fundamentals

### 1. Full path of `PATCH /api/v1/tasks/665f.../`

1. `backend/src/app.js:67` — `app.use("/api", apiRouter)` strips `/api`.
2. `backend/src/routes/index.js:80` — `router.use("/v1", featureRouter)` strips `/v1`.
3. `backend/src/routes/index.js:39` — `router.use("/tasks", tasksRoutes)` strips `/tasks`.
4. `backend/src/routes/tasks.routes.js:8` — `router.use(authenticate)` runs, sets `req.user`.
5. `tasks.routes.js:11` — `router.patch("/:id", ...)` matches; controller `patchTask` runs.

Final values: `req.params = { id: "665f00aa11bb22cc33dd44ee" }`; `req.body = { done: true }` (parsed by `express.json`); `req.user = { id: "<user's id>", role: "<role>" }` (shape set in `authenticate.js:33`).

### 2. Wrong Content-Type

`express.json` only parses when `Content-Type` matches JSON; for `text/plain` it initializes `req.body` to `{}` and skips parsing (body-parser's documented behavior: `req.body` is `{}` when the type doesn't match). So inside `createTask`, `req.body.title` is `undefined`. The service then calls `StudyTask.create({ ..., title: undefined, ... })`; the schema says `title: { type: String, required: true }`, so Mongoose throws a `ValidationError`, which `errorHandler.js:15-25` converts to **422** with `details: [{ field: "title", message: ... }]`. Nothing crashes — the layered error story absorbs it.

### 3. One router, two prefixes

A Router is just an object holding an ordered list of handlers; `router.use(prefix, featureRouter)` stores a *reference* to it under a mount path. Registering the same reference twice means both prefix matches dispatch into the same handler list — no copying, no conflict. The metadata route (`router.get("/", ...)`, `routes/index.js:63`) lives on the **root apiRouter**, not on `featureRouter` — so it answers `GET /api` (and `/api/`) only. `GET /api/v1` does **not** hit it: inside the `/v1` mount, `featureRouter` has no `"/"` route (health routes define `/health` etc.), so `/api/v1` falls through to `notFound` → 404.

### 4. 204 vs 201

- `deleteTask` → **204 No Content**: the operation succeeded and there is *nothing meaningful to return* — the resource is gone. 204 explicitly promises an empty body, hence `.send()` with no argument.
- `createTask` → **201 Created** + the task: the client needs the server-generated state (the new `id`, applied defaults, timestamps) to update its UI.

`200 {"message":"deleted"}` "works" but is semantically mushy: it forces clients to parse prose for a fact the status line already encodes, and it breaks generic HTTP tooling that treats 204 as "done, no body expected". Precision in status codes is free documentation.

### 5. `?date[$gt]=` — injection attempt

Express's extended query parser turns `date[$gt]=` into `req.query = { date: { $gt: "" } }`. Then `sanitize` (`app.js:47`) scrubs `req.query`: the key `$gt` starts with `$` → deleted (`sanitize.js:20-22`), and the cleaned object is pinned back onto `req` with `Object.defineProperty` (the Express-4 getter workaround). By `listTasks`, `req.query.date` is `{}` — an empty object, operator gone. Downstream, `{}` is truthy so the service uses it as `day`; Mongoose then refuses to cast a plain object to the `String` path `date` (`CastError`), and `errorHandler.js:28-33` returns **400 "Invalid value for 'date'"**. The essential point: no `$gt` operator ever reaches MongoDB, so the query can never be widened by the client.

### 6. Token sources in `authenticate`

`backend/src/middlewares/authenticate.js:29`:

```js
const token = bearerToken(req) || readAccessCookie(req);
```

Priority: (1) the `Authorization: Bearer ...` header, (2) the access-token cookie. The header wins when both exist; the `||` short-circuit *is* the fallback mechanism. (If neither yields a valid token, the middleware then tries the refresh cookie for a silent refresh, else throws 401 at line 48.)

### 7. `GET /tasks/summary` placement

It must be inside the router **after `router.use(authenticate)`** (so `req.user` exists). Relative to `patch("/:id")` — trick question: order does **not** technically matter here, because Express matches on *method + path*; a `PATCH /:id` route can never capture a `GET /summary` request. But the convention "literal paths before parameterized ones" is still worth following: the day someone adds `router.get("/:id", ...)`, a `/summary` route registered *below* it would be shadowed (`id = "summary"`). Register literals first and that future bug can't happen. Sketch:

```js
router.use(authenticate);
router.get("/summary", tasksController.taskSummary);   // literal first
router.get("/", tasksController.listTasks);
...
```

### 8. `GET /api/nope`

It traverses the whole chain (requestId … rate limiter — yes, it *counts* against the limit), enters `apiRouter`, matches no feature route, exits, and reaches `notFound` (`app.js:73`). That file forwards `next(ApiError.notFound("Route not found: GET /api/nope"))`; `errorHandler` responds:

```json
{
  "success": false,
  "error": { "code": "NOT_FOUND", "message": "Route not found: GET /api/nope" },
  "requestId": "..."
}
```

Status **404**. The two cooperating files: `backend/src/middlewares/notFound.js` and `backend/src/middlewares/errorHandler.js` (plus `ApiError.js` supplying the vocabulary).

## Chapter 2.3 — Middleware Deep Dive

### 1. Everything that runs for a successful `POST /api/tasks`

In order: `requestId` (adds `req.id`, sets response header) → `helmet()` (response headers only) → `cors(...)` (headers) → `express.json` (**adds `req.body`**) → `express.urlencoded` (no-op for JSON, ensures `req.body` exists) → `cookieParser` (**adds `req.cookies`**) → `sanitize` (mutates `req.body`/`req.query` by deleting dangerous keys) → `compression` (wraps `res`) → `morgan` (arms a log on response finish) → `globalRateLimiter` (counts the IP; adds `RateLimit-*` headers) → `apiRouter` → `featureRouter` → tasks router's `authenticate` (**adds `req.user`**) → `createTask` controller. Mutators of `req`: requestId, the two parsers, cookieParser, sanitize, authenticate.

### 2. `sanitize` before `express.json`

At that position, `req.body` is `undefined` when `sanitize` runs. Its `scrub()` starts with `if (!value || typeof value !== "object") return;` — so it silently returns. No error, no log line, nothing: the middleware still calls `next()` and the request proceeds normally. Result: **body scrubbing is disabled** (NoSQL-operator keys and `__proto__` pass through to services), while query/params scrubbing still works. This is the textbook "silent ordering bug": everything appears to function, and only a security test would reveal the regression. It's why `app.js` groups and comments its sections — order is load-bearing.

### 3. No token, no cookies, `GET /api/tasks`

The chain runs normally until the tasks router's `authenticate`. `bearerToken(req)` → null; `readAccessCookie(req)` → nothing; `readRefreshCookie(req)` → nothing; so line 48 executes: `throw ApiError.unauthorized("Authentication required")`. `authenticate` is wrapped in `asyncHandler`, so the rejection becomes `next(err)`. Express skips remaining 3-arg middleware and lands in `errorHandler`: already an `ApiError` (pass-through in `normalizeError`), operational and `401 < 500` → `logger.warn("401 Authentication required", {...})`. Client receives **401**:

```json
{ "success": false, "error": { "code": "UNAUTHORIZED", "message": "Authentication required" }, "requestId": "..." }
```

### 4. `buildStore()` returning `undefined`

It returns `undefined` when Redis isn't configured (`env.redis.isConfigured` false), isn't ready (`isRedisReady()` false — status not `"ready"`), or the client is null. express-rate-limit then uses its default **in-memory store**: counters live in this process's heap. Acceptable single-node: one process sees all traffic, so counts are accurate. With 3 replicas behind a load balancer, each replica keeps its own counter — a client effectively gets 3× the limit (and inconsistently, depending on routing), and a restart wipes counters. The Redis store makes the counter shared and durable across instances, which is why `rateLimiter.js` prefers it whenever available.

### 5. Why `notFound` forwards instead of responding

Two concrete losses with a direct `res.status(404).json(...)`:

1. **Envelope drift** — the 404 body would be hand-built and would inevitably diverge from the standard error shape (`code`, `requestId`, prod/dev stack policy) the moment `errorHandler` evolves. Forwarding guarantees byte-identical formatting for all errors.
2. **Lost logging/observability** — `errorHandler` is where errors are logged with method/path/status/requestId at the right level. A self-responding 404 would be invisible to that policy (or would duplicate it).

The general principle: exactly **one** place turns errors into HTTP; everything else just describes errors (`ApiError`) and forwards.

### 6. `/api/health/live`: Morgan and the rate limiter

- **Morgan: not logged.** The skip function is `(req) => req.path === `${env.app.apiPrefix}/health/live`` → `"/api/health/live"` — matches, so the access line is suppressed (`app.js:56`).
- **Rate limiter: yes, counted.** It's mounted with `app.use(env.app.apiPrefix, globalRateLimiter)` (`app.js:61`), i.e., on everything under `/api`, with no health exemption. An orchestrator probing every 2s consumes ~450 requests per 15-minute window from *its own IP* — worth knowing if probes ever share an IP with real traffic.

### 7. `authLimiter, validate({ body: signupSchema }), authController.signup`

Left-to-right, each gating the next via `next()`:

- **(a) IP over its limit**: `authLimiter` immediately responds **429** with the JSON error body configured in `createRateLimiter` (`rateLimiter.js:31-38`). `validate` and the controller never execute — no CPU on parsing schemas, no DB work, for throttled clients.
- **(b) body missing `mobile`**: the limiter passes (`next()`); `validate` runs `signupSchema.parse(req.body)`, zod throws a `ZodError` for the missing key (default message `"Required"`), and `validate.js:44-51` converts it to `next(new ApiError(422, "Validation failed", { fields: { mobile: "Required" }, details: [...] }))`. The controller never runs; `errorHandler` sends the 422.

### 8. Response-time middleware

Mount it **immediately after `requestId`** (`app.js:32`) — after, so `req.id` exists; that early, so the measurement covers nearly the whole pipeline. Shape:

```js
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    logger.http(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`, { requestId: req.id });
  });
  next();
});
```

The trick is `res.on("finish")`: middleware runs *before* the handler, so you can't measure by code position — you subscribe to the response's completion event. (Morgan does exactly this internally.)

## Chapter 2.4 — Config, Logging & Errors

### 1. Coercion outcomes

- `env.app.port` → **8080**. `num("abc", 8080)`: `Number("abc")` is `NaN`, `Number.isFinite(NaN)` false → fallback (`env.js:27-30, 104`).
- `env.swagger.enabled` → **false**. `bool("false", true)`: `"false"` is not in `["1","true","yes","on"]` → `false` (`env.js:32-35, 164`). (Plain truthiness would have gotten this wrong.)
- `env.cors.origin` → **`["https://a.com", "https://b.com"]`**. The value isn't the literal `"*"`, so `list()` splits on commas, trims, drops empties (`env.js:37-43, 114`).

### 2. `console.*` in boot files

`env.js` can't use the logger because of import order: `logger.js` imports `env.js` (it needs `env.log.level`, `env.isProduction`). If `env.js` imported the logger back, you'd have a circular dependency — and at the moment `ensureRequired()` runs, the logger genuinely does not exist yet. `logger.js`'s own `console.warn` covers the case where *the logger's file transport setup itself* fails — you can't rely on a system to report its own construction failure. "Fixing" `env.js` to use the logger would create a cycle where `logger.js` evaluates `env` as an incomplete module (or crashes), likely breaking boot entirely. Both files comment this deliberately.

### 3. Production destinations (default `LOG_LEVEL` = `info`)

Levels: `error:0 < warn:1 < info:2 < http:3 < debug:5`. The logger passes only entries ≤ its level (2); the error-file transport additionally requires level `error`.

- **(a) `logger.debug`** — dropped at the logger gate. Nowhere.
- **(b) Morgan line (`logger.http`, level 3)** — also dropped: 3 > 2. In production with defaults, **access logs are suppressed entirely** until you set `LOG_LEVEL=http` (or lower). A deliberate knob, worth knowing before you go hunting for "missing" access logs.
- **(c) `logger.warn`** — console + combined file. Not the error file (warn < error).
- **(d) `logger.error`** — console + error file + combined file. All three.

### 4. Duplicate key (11000)

Mongo raises error code `11000` when an insert/update violates a **unique index** — e.g., a users collection with `email: { unique: true }` and a signup for an email that already exists. The handler (`errorHandler.js:36-43`) reads `err.keyValue` (e.g. `{ email: "a@b.com" }`) and returns **409 Conflict**, `code: "CONFLICT"`, message `"Duplicate value for: email"`, with `details: { email: "a@b.com" }`. Note this arrives as a *numeric code*, not a Mongoose class — hence the `err.code === 11000` check rather than `instanceof`.

### 5. `req.usr.id` typo in production

Execution: `TypeError: Cannot read properties of undefined (reading 'id')` thrown inside the async controller → `asyncHandler`'s `.catch(next)` → `errorHandler`. `normalizeError` falls through every branch to the fallback (`errorHandler.js:54-57`): a `TypeError` has no `statusCode`, so → 500, and — the deciding line — `isOperational: false`. Logging: the `else` branch → **`logger.error` with the full stack** plus `{ method, path, status, requestId }`. The client sees exactly:

```json
{ "success": false, "error": { "code": "INTERNAL_ERROR", "message": "Internal server error" }, "requestId": "..." }
```

— real message masked (`statusCode >= 500 && env.isProduction`), no stack (production). In development the same bug would show the real message and stack in the response.

### 6. `durationMs` walk-through

`durationMs("15m", 900000)`: the regex `/^(\d+)\s*(ms|s|m|h|d)?$/i` matches with `match[1] = "15"`, `match[2] = "m"` → `amount = 15`, `unit = "m"`, multiplier `60000` → returns `900000` (15 minutes in ms). `durationMs("soon", 900000)`: the regex doesn't match → return `fallbackMs` = `900000`. Falling back (rather than throwing) is right for config parsing of *optional* values: a typo degrades to a sane default instead of crashing boot; only *required* config (like `MONGODB_URI`) merits process death.

### 7. First-message-per-field in `validate.js`

The loop keeps only the first message per field (`if (!(field in fields)) fields[field] = issue.message;`) because — per the code comment — "react-hook-form shows one" message per field: sending five messages for one input would be wasted bytes the UI can't display. The complete list still exists in `details` for clients that want it. This connects directly to `ApiError`'s JSDoc for `fields`: "Per-field messages keyed by form field name — consumed directly by the frontend (`ApiError.fields`)" — i.e., `fields` is *designed as a UI contract*, and its shape (one string per field name) mirrors how form libraries store errors.

### 8. Adding `MAX_UPLOAD_MB`

Following `env.js`'s patterns:

1. **Coercion + default** — inside the frozen object, add a section (say `upload`) near its siblings:
   ```js
   upload: {
     maxMb: num(process.env.MAX_UPLOAD_MB, 10),
   },
   ```
2. **Production guardrail** — in the existing `if (NODE_ENV === "production") { ... }` block (before the export), add:
   ```js
   if (num(process.env.MAX_UPLOAD_MB, 10) <= 0) {
     console.error("\n[env] MAX_UPLOAD_MB must be a positive number.\n");
     process.exit(1);
   }
   ```
3. Consumers read `env.upload.maxMb` — never `process.env` directly. (And you'd document it in `.env.example`, since the file's error messages point users there.)

Key points for full marks: use `num()` (env values are strings), put validation in the prod block with `console.error` + `process.exit(1)` (the file's fail-fast style), and place the value inside the single frozen export.

## Chapter 2.5 — Server Lifecycle

### 1. Bootstrap phases and fatality

1. **`connectDatabase()` — fatal.** Two files implement it: `database.js:29` throws after the 5th failed attempt (`if (attempt === retries) throw err;`), and `index.js:82-85`'s `bootstrap().catch(...)` turns that throw into `process.exit(1)`. The policy lives at the entrypoint; the library only reports.
2. **Optional tier — never fatal.** `connectRedis()` catches its own ping failure and only warns (`redis.js:64-66`); `configureCloudinary()` and `verifyEmailTransport()` no-op/warn when unconfigured (guarded by `env.*.isConfigured` getters); `initJobs()` depends on Redis availability.
3. **`initSockets(server)`** — attaches Socket.IO to the raw server.
4. **`server.listen(...)`** — binds the port; only now is traffic accepted.

### 2. Mongo down, `npm run dev`

You'll see 5 lines of `[db] Connection attempt N/5 failed: <reason>` (`database.js:28`). Timing: each attempt can take up to ~10s (`serverSelectionTimeoutMS: 10000`) with 3s sleeps between attempts — worst case roughly `5×10 + 4×3 ≈ 62` seconds (much faster if the connection is refused outright rather than timing out). After the 5th failure the function throws; `bootstrap().catch` logs `[server] failed to start: <stack>` and calls `process.exit(1)`. Because you're under nodemon, it prints its "app crashed — waiting for file changes before starting..." message and idles until you save a file.

### 3. Ctrl-C during a slow request

**8-second request:** t=0 — `SIGINT` → `shutdown("SIGINT")`: guard flag set, log line, 10s force timer armed (unref'd), `server.close()` called → the listening socket stops accepting new connections immediately. t=0→8s — the in-flight request keeps running and completes; its response is delivered. t≈8s — with all connections drained, the `server.close` callback fires: sockets → queues → Redis → Mongo closed, `"shutdown complete"`, `clearTimeout`, `process.exit(0)`.

**20-second request:** same start, but at **t=10s** the force timer fires first (`index.js:50-53`): logs `[server] forced shutdown (cleanup timed out)` and `process.exit(1)`. The request dies mid-flight — that's the deliberate trade: bounded shutdown time beats waiting forever.

### 4. `unref()` and `clearTimeout` — why both

Node keeps a process alive while any *referenced* handle (like a pending timer) exists. Without `unref()`, the 10-second timer itself is a reason to stay alive: in any path where the code doesn't explicitly exit but all real work is done, the process would hang around up to 10 extra seconds just for its own watchdog — the safety net causing the delay it guards against. As written, all three outcomes call `process.exit` explicitly, so `unref()` is defense-in-depth: it keeps the natural-exit path safe if the code ever changes (e.g., someone removes `process.exit(0)` and lets the process end when handles drain). `clearTimeout(forceTimer)` in the success path is the complementary hygiene: once shutdown has *succeeded*, the force-exit is affirmatively cancelled rather than left pending. Redundant in combination — deliberately so; shutdown code is exactly where you want overlapping guarantees.

### 5. Different policies for the two safety nets

- **`unhandledRejection` → log and continue.** A stray rejected promise usually means a background task forgot a `.catch`. Request-path rejections can't reach here — `asyncHandler` catches them all and routes them to `errorHandler` — so what's left is likely peripheral. The event doesn't imply corrupted interpreter state; killing the server for it would trade a minor bug for an outage.
- **`uncaughtException` → graceful shutdown.** A synchronous throw escaped every handler, interrupting some code mid-operation. Node's docs are blunt: the process is in an undefined state and resuming is unsafe (half-mutated data structures, dangling resources). So: log with stack, run the *orderly* shutdown (finish in-flight work where possible, close connections), exit non-zero, let the supervisor start a clean process.

The asymmetry is the policy: continue when state is presumed intact, die (gracefully) when it isn't.

### 6. Shutdown ordering

Teardown runs outermost-inward, reverse of boot: `closeSockets()` first (stop realtime clients — their handlers may still enqueue jobs or hit the DB), then `closeQueues()` (BullMQ workers finish/stop taking jobs — they need Redis *and* possibly Mongo to complete gracefully), then `disconnectRedis()`, and `disconnectDatabase()` **last** because every layer above it may need one final write. Concrete failure if Mongo closed first: a job mid-processing (or a socket handler finishing a save) issues a write into a closed connection → error thrown during shutdown, data lost, and the `catch` branch exits with code 1 — a dirty shutdown caused purely by ordering.

### 7. `listen()` before `connectDatabase()`

During the gap, the server accepts real traffic with no database. Incoming queries hit Mongoose with no connection: by default Mongoose *buffers* operations for ~10s then fails them — so users get slow errors (500s via the error pipeline) instead of fast failures; if Mongo takes the full retry budget (~a minute), you serve a minute of failures while the liveness probe happily says "alive" (the process is up!), so the orchestrator won't restart you. Does the process stay alive *forever* without a DB? Not in this code: if all 5 attempts fail, `connectDatabase` still throws and `bootstrap().catch` still calls `process.exit(1)` — the `.catch` is what preserves fatality. The reordering's real damage is the lying window: accepting requests you know you can't serve, and reporting healthy while doing so. Connect first, listen last.

### 8. Why tests import `app`

By importing `app` (from `backend/src/app.js:79`, `export const app = createApp();`), a test gets the complete middleware + routing pipeline as a plain callable that supertest can invoke **without**: binding a TCP port (no port conflicts, no firewall prompts), connecting MongoDB/Redis/SMTP/Cloudinary (all of that lives in `bootstrap()`), attaching Socket.IO, or registering signal handlers and safety-net listeners (`process.on(...)` in `index.js` — which would leak between test files). Building the app is pure computation; every external side effect is quarantined in `index.js` — that quarantine *is* the reason for the two-file split.

## Chapter 2.6 — API Design & Layered Architecture

### 1. `DELETE /api/tasks/:id`, file by file

1. `backend/src/app.js` — the global middleware chain (Chapter 2.3) and mounting of `/api`.
2. `backend/src/routes/index.js` — root router; dispatches `/tasks` into the feature router.
3. `backend/src/routes/tasks.routes.js` — guards the router with `authenticate`; maps `DELETE /:id` → controller. *Responsibility: wiring + guarding.*
4. `backend/src/middlewares/authenticate.js` — verifies the token / silently refreshes; sets `req.user`. *Responsibility: identity.*
5. `backend/src/controllers/tasks.controller.js` — `deleteTask`: extracts `req.user.id` + `req.params.id`, calls the service, replies `204 .send()`. *Responsibility: HTTP translation.*
6. `backend/src/services/tasks.service.js` — `deleteTask`: `StudyTask.deleteOne({ _id: taskId, user: userId })`; throws `ApiError.notFound` when `deletedCount === 0`. *Responsibility: business rule + ownership scoping.*
7. `backend/src/models/index.js` → `backend/src/models/studyTask.model.js` — the schema/collection the query runs against. *Responsibility: data shape.*

(Supporting utils: `asyncHandler.js` wraps the controller; `ApiError.js` + `errorHandler.js` handle the failure path.)

### 2. `{ new: true }`

`findOneAndUpdate` returns the document **as it was before the update** by default. `setTaskDone` returns `{ id: String(task._id), done: task.done }` to the controller — without `{ new: true }`, `task.done` would be the *old* value: toggle a task to done and the API answers `{ done: false }`. A client that trusts the response (the correct thing to do) would render the checkbox un-toggled even though the DB updated — a maddening "works on refresh" bug. `{ new: true }` makes the return value the post-update document, so the response reflects reality.

### 3. The mass-assignment attempt

`user` in the database: **the attacker's own id** — the controller passes `req.user.id` (from the verified session) as the first argument (`tasks.controller.js:24`), and the service writes `user: userId` (`tasks.service.js:33`). `done`: **false** — hardcoded at `tasks.service.js:40` (`done: false`). The body's `user` and `done` keys are simply never read: `createTask` copies *named fields only* (`body.date`, `body.title`, `body.subject`, `body.minutes`, `body.type`, `body.time`). The guarantee comes from the whitelist construction plus the "session, never the client" rule in the controller — not from any blacklist.

### 4. Validator vs model enum vs presenter

- **Zod validator** (`signupSchema`) — the *request contract at the door*: rejects bad input before any business logic or DB work, with human-ready, per-field messages shaped for the frontend's forms (422 + `fields`). Exists for UX precision and early rejection.
- **Model enum** (`studyTaskSchema.type`) — the *data-integrity backstop*: enforced no matter how data arrives — controllers, seeds (`backend/src/seeds/`), future scripts, a colleague's new service. It protects the database from every path, not just HTTP.
- **Presenter** (`presentAuthUser`) — the *output contract*: a whitelist mapping internal documents to the exact shape clients depend on, preventing accidental leakage and decoupling DB schema evolution from the API.

All three exist because they guard **different boundaries** (wire→app, app→DB, DB→wire) with different trust assumptions and different failure audiences. Removing any one leaves its boundary unguarded even though the other two remain.

### 5. `.select("+passwordHash")`

The `+` prefix force-includes a field that the schema declares with `select: false` — so the User schema must define `passwordHash: { ..., select: false }`. That default is *good* because it makes leaking the hash an opt-in mistake rather than an opt-out one: every ordinary query (`findById`, profile fetches, anything later serialized to JSON) simply never contains the hash. Only the one repository method whose job is credential checking (`findByEmailWithPassword`, used by login) asks for it explicitly — and the method's name announces it. Secure-by-default, with the exception visible and greppable.

### 6. `?q=(&page=-2`

- `q = "("` — it's a non-empty string, so `str(q)` keeps it. `escapeRegex` turns `(` into `\(` (`mistakes.service.js:14-16`), so `new RegExp("\\(", "i")` compiles fine — without escaping, `new RegExp("(")` would **throw** a SyntaxError and 500 the request. Filter becomes `{ user: userId, $or: [{ question: /\(/i }, { chapter: /\(/i }] }` (a *server-built* `$or` — legitimate; `sanitize` only strips client-supplied keys).
- `page = "-2"` → `Number(-2)` → `Math.max(1, -2)` = **1** → `skip(0).limit(20)`.

MongoDB receives a well-formed query: the user scope, a literal-paren regex search, newest-first sort, first page of 20, plus a concurrent `countDocuments`. Nothing crashes because every client input passed through a type guard, an escaper, or a clamp.

### 7. Designing `GET /api/tasks/range`

**Validator** (new file or added to a `tasks.validator.js`), following `auth.validator.js` style:

```js
const isoDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
export const rangeQuerySchema = z
  .object({ from: isoDate, to: isoDate })
  .refine((v) => v.from <= v.to, { message: "'from' must not be after 'to'", path: ["from"] });
```

(String comparison is safe here precisely because the format is zero-padded ISO.)

**Route** (`tasks.routes.js`, inside the `authenticate`d router, literal path — placed above any future `/:id` GET):

```js
router.get("/range", validate({ query: rangeQuerySchema }), tasksController.listTasksInRange);
```

**Controller** (`tasks.controller.js` pattern):

```js
export const listTasksInRange = asyncHandler(async (req, res) => {
  const data = await tasksService.listTasksInRange(req.user.id, req.query.from, req.query.to);
  res.status(HTTP_STATUS.OK).json(data);
});
```

**Service** (`tasks.service.js` pattern — ownership in the filter, sorted for display):

```js
export async function listTasksInRange(userId, from, to) {
  const tasks = await StudyTask.find({ user: userId, date: { $gte: from, $lte: to } })
    .sort({ date: 1, time: 1 });
  return { data: tasks };
}
```

**Index**: the existing compound index `studyTaskSchema.index({ user: 1, date: 1 })` serves this perfectly — equality on the `user` prefix, then a bounded range scan on `date`. No new index needed.

### 8. `SWAGGER_ENABLED=false` — observable differences

1. `env.swagger.enabled` becomes `false` via `bool()` (`env.js:164`).
2. At app build, `mountSwagger` logs `[swagger] disabled (SWAGGER_ENABLED=false)` (a `warn`) and registers nothing (`swagger.js:45-48`) — so `GET /api/docs` and `GET /api/docs.json` now fall through to `notFound` → standard 404 JSON errors.
3. At boot, `index.js:35-37` skips the `docs → http://localhost:...` log line.
4. `GET /api` metadata (`routes/index.js:71`) reports `docs: null` instead of `"/api/docs"`.
5. Subtlety: `swaggerSpec` is still *computed* — `swaggerJSDoc(options)` runs at module import (`swagger.js:38`) regardless of the flag; only the mounting is conditional. The spec exists in memory; it just isn't served.

---

Back to the module: [2.1](./01-node-runtime.md) · [2.2](./02-express-fundamentals.md) · [2.3](./03-middleware-deep-dive.md) · [2.4](./04-config-logging-errors.md) · [2.5](./05-server-lifecycle.md) · [2.6](./06-api-design.md)
