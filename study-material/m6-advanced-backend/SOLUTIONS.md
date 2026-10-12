# Module 6 — Worked Solutions

> **Goal:** Full solutions to every exercise in chapters [6.1](./01-realtime-sockets.md), [6.2](./02-background-jobs-redis.md), [6.3](./03-email-uploads-external-services.md), and [6.4](./04-testing-mastery.md). Attempt each exercise before reading its solution — the struggle is where the learning happens.

---

## Chapter 6.1 — Realtime & Sockets

### 1. Why `http.createServer(app)` instead of `app.listen(...)`

`app.listen(port)` is a convenience that internally does `http.createServer(app).listen(port)` — but it *returns* the server only as its return value and encourages you to never hold a reference to it. `backend/src/index.js` needs the server object **before** listening, for two consumers:

1. `initSockets(server)` (line 27) — Socket.IO must attach to the raw `http.Server` so it can intercept the `Upgrade: websocket` handshake on `/socket.io` before Express routing ever sees the request.
2. Graceful shutdown — `server.close(...)` (line 56) needs the same object to stop accepting connections.

If you replaced lines 13 and 30 with `app.listen(env.app.port, ...)`, the `server` created on line 13 would **never listen**. HTTP would appear to work (Express's own hidden server is listening), but `initSockets` would be attached to a deaf server: every frontend socket connection would fail with a connection/404 error on `/socket.io`, and `server.close` in `shutdown()` would be closing a server that was never open.

### 2. `server:time` broadcast every 10 seconds

```js
// backend/src/sockets/index.js
let io = null;
let timeTicker = null;                                   // NEW

export function initSockets(httpServer) {
  io = new SocketIOServer(httpServer, { /* unchanged */ });

  io.on("connection", (socket) => { /* unchanged */ });

  // NEW — broadcast the server clock to all connected clients.
  timeTicker = setInterval(() => {
    io.emit("server:time", { iso: new Date().toISOString() });
  }, 10_000);
  timeTicker.unref();   // never keep the process alive just for the ticker

  logger.info("[socket] Socket.IO initialised");
  return io;
}

export async function closeSockets() {
  if (timeTicker) {                                      // NEW
    clearInterval(timeTicker);
    timeTicker = null;
  }
  if (io) {
    await io.close();
    io = null;
    logger.info("[socket] Socket.IO closed");
  }
}
```

Points that earn full marks: `io.emit` (broadcast to everyone, vs `socket.emit` to one client); clearing the interval in `closeSockets` (otherwise shutdown logs "Socket.IO closed" while a timer still fires against a dead `io` — and in tests would keep the event loop busy); `.unref()` as extra insurance.

### 3. JWT auth handshake middleware

```js
// backend/src/sockets/index.js
import { verifyAccessToken } from "../utils/jwt.util.js";

export function initSockets(httpServer) {
  io = new SocketIOServer(httpServer, { /* unchanged */ });

  // Runs once per incoming connection, BEFORE "connection" fires.
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("unauthorized"));
      const decoded = verifyAccessToken(token);          // throws ApiError(401) on any problem
      socket.data.user = { id: decoded.sub, role: decoded.role };
      next();
    } catch {
      next(new Error("unauthorized"));                   // client gets connect_error
    }
  });
  ...
}
```

Why this mirrors HTTP auth so closely: `verifyAccessToken` (`backend/src/utils/jwt.util.js` lines 51–53) already checks signature, expiry, issuer/audience, and the `type: "access"` claim — reusing it means socket auth can never drift from HTTP auth. The client supplies the token as `io(url, { auth: { token } })`. On rejection the client receives a `connect_error` event with message `"unauthorized"`. (Note: one thing this doesn't get for free is the *silent refresh* that `authenticate` performs with the refresh cookie — an expired access token means the socket client must reconnect with a fresh one.)

### 4. Rooms + `emitToUser`

```js
// backend/src/sockets/index.js — inside initSockets, after io.use(...)
io.on("connection", (socket) => {
  logger.debug(`[socket] connected: ${socket.id}`);
  socket.join(`user:${socket.data.user.id}`);            // NEW
  socket.on("disconnect", (reason) => {
    logger.debug(`[socket] disconnected: ${socket.id} (${reason})`);
  });
});

// NEW export — safe no-op when realtime is down/uninitialised.
export function emitToUser(userId, event, payload) {
  if (!io) return false;
  io.to(`user:${userId}`).emit(event, payload);
  return true;
}
```

The room name is the whole trick: a user with three tabs open has three sockets, all in `user:<id>`, and one `io.to(room).emit` reaches all of them. Rooms are cleaned up automatically when sockets disconnect. The `if (!io) return false` guard is the answer to "what about tests / pre-boot / shutdown".

### 5. Wiring `notification:new`

The emit belongs **wherever a `Notification` document is created** — not in `listNotifications`/`markRead` (those are reads/acks). Today only the seed creates notifications, so the realistic patch is a small creation helper that future features call:

```js
// backend/src/services/notifications.service.js
import { emitToUser } from "../sockets/index.js";

/** Create a notification and push it live if the user is connected. */
export async function createNotification(userId, { type, title, body, link }) {
  const note = await Notification.create({ user: userId, type, title, body, link });
  emitToUser(String(userId), "notification:new", {
    id: String(note._id), type, title, body, link, read: false,
  });
  return note;
}
```

Why the DB write must stay primary: the socket emit only reaches users **connected at that instant**. Offline users must find the notification in `GET /api/notifications` when they return — the Mongo document is the source of truth; the emit is a best-effort acceleration. (Also: tests and any process where `initSockets` never ran would otherwise lose notifications entirely.)

### 6. Minimal client page

```html
<!doctype html>
<ul id="feed"></ul>
<script src="https://cdn.socket.io/4.8.1/socket.io.min.js"></script>
<script>
  const socket = io("http://localhost:8080", {
    path: "/socket.io",
    withCredentials: true,
    auth: { token: localStorage.getItem("access_token") }, // exercise-3 handshake
  });
  socket.on("connect",    () => console.log("connected", socket.id));
  socket.on("disconnect", (r) => console.log("disconnected:", r));
  socket.on("connect_error", (e) => console.warn("rejected:", e.message));
  socket.on("notification:new", (n) => {
    const li = document.createElement("li");
    li.textContent = `${n.title} — ${n.body}`;
    document.getElementById("feed").prepend(li);
  });
</script>
```

(Note the CSP-free plain page; in the real frontend you'd `npm install socket.io-client` instead of the CDN build, and the token would come from your auth state, not `localStorage`.)

### 7. Why `getIO()` crashes under test — and the fix

Trace: `npm test` runs files that import `../app.js` only. `initSockets` is called solely from `backend/src/index.js` (line 27), which tests never import — so the module-level `io` in `sockets/index.js` stays `null`, and `getIO()` returns `null`. The service's `getIO().emit(...)` is then `null.emit(...)` → `TypeError: Cannot read properties of null (reading 'emit')`. Under `npm start` it works because `bootstrap()` calls `initSockets(server)` *before* `server.listen(...)` — no request can arrive while `io` is still null.

Fix: never call `.emit` on the raw accessor from feature code. Either optional-chain — `getIO()?.emit("leaderboard:update", data)` — or, better, route all emits through the `emitToUser`-style helpers from exercise 4, which encapsulate the null-guard in one place.

---

## Chapter 6.2 — Background Jobs & Redis

### 1. Retry math

`defaultJobOptions` (`backend/src/jobs/queue.js` lines 14–19): `attempts: 3`, `backoff: { type: "exponential", delay: 5000 }`.

- **Execution 1** at t≈0 → fails. Job moves to `delayed`.
- Wait `5000 × 2⁰ = 5s`. **Execution 2** at t≈5s → fails.
- Wait `5000 × 2¹ = 10s`. **Execution 3** at t≈15s → fails.
- `attempts` (total executions, not "retries") is exhausted → the job moves to the **failed set**, where `removeOnFail: { age: 24 * 3600 }` keeps its record (data, error, stacktrace) for **24 hours**, then Redis cleanup removes it.

So: 3 executions, waits of 5s and 10s, ~15s total patience, then 24h of post-mortem visibility.

### 2. Why `maxRetriesPerRequest: null`

By default, ioredis fails any single command after ~20 retries if the connection is unhealthy. But a BullMQ worker's core loop is a *deliberately blocking* Redis command (a `BRPOPLPUSH`/`BZPOPMIN`-style "block until a job arrives") that may legitimately sit unanswered for minutes or hours on an idle queue. With a retry cap, ioredis would kill that long-parked command and the worker would error out or miss jobs. `maxRetriesPerRequest: null` means "never give up on a command", which BullMQ requires and enforces. Your codebase sets it in exactly one place — `getRedisOptions()` in `backend/src/config/redis.js` (lines 22, 28) — so every connection, shared or dedicated, inherits it.

### 3. The email queue feature

```js
// backend/src/jobs/email.jobs.js  (new file)
import { Worker } from "bullmq";
import { createQueue } from "./queue.js";
import { createRedisConnection } from "../config/redis.js";
import { sendMail } from "../services/email.service.js";
import { logger } from "../config/logger.js";

export const emailQueue = createQueue("email");          // null when Redis unset

export function enqueueWelcomeEmail(user) {
  if (!emailQueue) {
    logger.warn("[jobs] no queue — welcome email skipped");
    return null;
  }
  return emailQueue.add("welcome", { to: user.email, name: user.fullName });
}

let worker = null;
export function startEmailWorker() {
  if (!emailQueue) return null;
  worker = new Worker(
    "email",
    async (job) => {
      if (job.name === "welcome") {
        await sendMail({
          to: job.data.to,
          subject: "Welcome to RankOS!",
          text: `Hi ${job.data.name}, your rank journey starts now.`,
          html: `<p>Hi <b>${job.data.name}</b>, your rank journey starts now.</p>`,
        });
      }
    },
    { connection: createRedisConnection(), concurrency: 5 },
  );
  worker.on("failed", (job, err) =>
    logger.warn(`[jobs] email job ${job?.id} failed: ${err.message}`));
  return worker;
}

export function getEmailWorker() { return worker; }
```

Wiring into boot:

```js
// backend/src/jobs/index.js
import { startEmailWorker } from "./email.jobs.js";

export function initJobs() {
  if (!env.redis.isConfigured) {
    logger.warn("[jobs] disabled — no Redis configured");
    return;
  }
  startEmailWorker();
  logger.info("[jobs] queue system ready (email worker running)");
}
```

Producer call site (signup path in `auth.service.js`): `enqueueWelcomeEmail(user);` — deliberately *not* awaited for its completion semantics (add returns fast anyway) and null-safe by construction. Details that matter: the worker gets its **own** `createRedisConnection()` (the blocking-connection rule); jobs carry only primitives (`to`, `name`), not the Mongoose user document; the queue inherits `defaultJobOptions`, so a down SMTP server gets 3 attempts over ~15s for free.

### 4. Worker shutdown

```js
// backend/src/index.js — inside server.close(async () => { ... })
await closeSockets();
await getEmailWorker()?.close();   // NEW: finish the in-flight job, stop pulling
await closeQueues();
await disconnectRedis();
await disconnectDatabase();
```

It belongs **after** `closeSockets()` (sockets are a source of new work) and **before** `closeQueues()`/`disconnectRedis()` — `worker.close()` waits for the currently-processing job to finish and needs its Redis connection alive to ack it. Close Redis first and the in-flight job can't record completion, so it would re-run after restart (harmless only if you did exercise 7 properly). The 10-second `forceTimer` already in `shutdown()` caps how long a stuck job can delay exit.

### 5. The import-order trap

**The trace.** `backend/src/index.js` line 3 `import { app } from "./app.js"` → `app.js` line 14 `import { globalRateLimiter } from "./middlewares/rateLimiter.js"` → `rateLimiter.js` line 44 runs `createRateLimiter()` **at module evaluation time**, which calls `buildStore()` (line 30 → 13). At that instant `connectRedis()` hasn't run — it happens later, inside `bootstrap()` (index.js line 21) — so `isRedisReady()` is `false` (no client exists, let alone one with `status === "ready"`), `buildStore()` returns `undefined`, and the limiter permanently uses the in-memory store. Same story for the `uploadLimiter` built when `upload.routes.js` is imported. Redis-backed rate limiting is currently unreachable code.

**The fix — a lazy store.** `express-rate-limit` stores expose `increment`/`decrement`/`resetKey`; wrap the decision so it happens per-request, after boot:

```js
// backend/src/middlewares/rateLimiter.js
function lazyRedisStore() {
  let real = null;              // created on first use, once Redis is ready
  const backing = () => {
    if (!real && env.redis.isConfigured && isRedisReady()) {
      const client = getRedisClient();
      real = new RedisStore({ sendCommand: (...a) => client.call(...a), prefix: "rl:" });
      logger.info("[rate-limit] switched to Redis store");
    }
    return real;
  };
  // Fall back to a private MemoryStore until Redis is ready.
  const mem = new (require("express-rate-limit").MemoryStore)();
  return {
    init(opts)      { mem.init?.(opts); this.opts = opts; },
    async increment(key)  { const s = backing(); if (s) { s.init?.(this.opts); return s.increment(key); } return mem.increment(key); },
    async decrement(key)  { return (backing() ?? mem).decrement(key); },
    async resetKey(key)   { return (backing() ?? mem).resetKey(key); },
  };
}
```

(Any equivalent approach earns full marks — e.g. exporting a `initRateLimitStore()` called from `bootstrap()` after `connectRedis()`, with `app.js` mounting a thin `(req,res,next) => currentLimiter(req,res,next)` wrapper so the limiter instance can be swapped post-boot. The essential insight is *when* `buildStore` runs, not the specific mechanics.) Trade-off worth stating: counts accumulated in the memory store before the switch are lost — acceptable for rate limiting.

### 6. Cache-aside helper

```js
// backend/src/utils/cache.util.js  (new file)
import { getRedisClient, isRedisReady } from "../config/redis.js";
import { logger } from "../config/logger.js";

export async function cacheGetJSON(key) {
  if (!isRedisReady()) return null;
  try {
    const raw = await getRedisClient().get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    logger.warn(`[cache] get ${key} failed: ${err.message}`);
    return null;                                  // cache failure ≠ request failure
  }
}

export async function cacheSetJSON(key, value, ttlSeconds) {
  if (!isRedisReady()) return;
  try {
    await getRedisClient().set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    logger.warn(`[cache] set ${key} failed: ${err.message}`);
  }
}
```

Usage around an expensive leaderboard read:

```js
// inside leaderboard.service.js (illustrative)
const key = `lb:${scope}:${range}`;
const cached = await cacheGetJSON(key);
if (cached) return cached;
const fresh = await computeLeaderboard(scope, range);   // the expensive part
await cacheSetJSON(key, fresh, 60);
return fresh;
```

The two non-negotiables: every failure path degrades to "just compute it" (matching the codebase's Redis-is-optional contract), and the TTL bounds staleness — a 60s-stale leaderboard is fine; a forever-stale one is a bug.

### 7. Idempotent XP award

**Failure scenario:** execution 1 runs `Profile.updateOne({ user }, { $inc: { xp: 100 } })`, then the process dies (or the completion ack to Redis fails) *after* the write but *before* BullMQ marks the job complete. BullMQ sees a stalled/failed job and, with `attempts: 3`, runs it again → the user gets 200 (or 300) XP for one achievement.

**Redesign:** make the award a *recorded fact* with a unique identity, and make the write conditional on that fact not existing. Change the job data from `{ userId, amount }` to `{ userId, amount, reason: "attempt:6543ab...:submit" }` and the worker to:

```js
// XpAward model has a unique index on { user: 1, reason: 1 }
const res = await XpAward.updateOne(
  { user: job.data.userId, reason: job.data.reason },
  { $setOnInsert: { amount: job.data.amount, awardedAt: new Date() } },
  { upsert: true },
);
if (res.upsertedCount === 1) {                    // first (and only) time this fact was recorded
  await Profile.updateOne({ user: job.data.userId }, { $inc: { xp: job.data.amount } });
}
```

Run it once or five times: exactly one upsert wins, exactly one `$inc` happens. The general principle: *retries are guaranteed to happen eventually; design the handler so run-twice ≡ run-once* (unique keys + conditional writes, or naturally idempotent operations like `$set` to an absolute value).

### 8. Ordering quiz

Technically, **yes, today it would work**: `disconnectRedis()` only closes the *shared* client from `getRedisClient()`, while every queue owns a *dedicated* connection from `createRedisConnection()` (`queue.js` line 33) — `closeQueues()` would still close those fine afterwards. But the current order is still the right one, for two reasons. First, it is **defensive against future code**: the moment anything (a worker, a queue event listener, a cache write inside a job) touches the shared client during `queue.close()`, the reversed order turns shutdown into a race with "connection is closed" errors. Second, it encodes the *principle* — close things that **generate work** before closing the **infrastructure they work against** — which is the same reason sockets close before queues, and MongoDB (which everything writes to) closes dead last. Shutdown order should never depend on remembering which module happens to own which connection.

---

## Chapter 6.3 — Email, Uploads & External Services

### 1. Boot-log reading

Order follows `bootstrap()` in `backend/src/index.js` (lines 16–38):

1. *(step 1 — MongoDB connects; no skip line, it's required: `[db] MongoDB connected → ...`)*
2. `connectRedis()` → `[redis] not configured — skipping (set REDIS_URL to enable)` — `backend/src/config/redis.js` line 57.
3. `configureCloudinary()` → `[cloudinary] not configured — media uploads disabled` — `backend/src/config/cloudinary.js` line 13.
4. `verifyEmailTransport()` → `[email] SMTP not configured — emails will be skipped` — `backend/src/services/email.service.js` line 33. It **returns `false`** (its `getTransporter()` returned `null` because `env.smtp.isConfigured` requires both `SMTP_HOST` and `SMTP_USER`).
5. `initJobs()` → `[jobs] disabled — no Redis configured` — `backend/src/jobs/index.js` line 12.
6. `initSockets(server)` → `[socket] Socket.IO initialised` (sockets need no credentials — no skip line).
7. `[server] RankOS API listening on :8080 ...`.

Bonus lines that appear *lazily*, only when features are exercised: `[upload:stub] stored locally → ...`, `[ocr:stub] no Vision credentials — returning sample sheet`, `[sms:stub] → ...`, `[email] skipped (no SMTP) → ...`.

### 2. `sendPasswordResetEmail`

```js
// e.g. backend/src/services/emails/authEmails.js (new file)
import { sendMail } from "../email.service.js";

export function sendPasswordResetEmail(to, resetUrl) {
  const text =
    `You asked to reset your RankOS password.\n\n` +
    `Open this link within 30 minutes: ${resetUrl}\n\n` +
    `If this wasn't you, ignore this email — your password is unchanged.`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px">
      <h2>Reset your RankOS password</h2>
      <p>Click the button below within <b>30 minutes</b>.</p>
      <p><a href="${resetUrl}"
            style="background:#6366f1;color:#fff;padding:10px 18px;border-radius:6px;
                   text-decoration:none;display:inline-block">Reset password</a></p>
      <p style="color:#666">If this wasn't you, ignore this email — your password is unchanged.</p>
    </div>`;
  return sendMail({ to, subject: "Reset your RankOS password", text, html });
}
```

(The 30-minute framing matches `env.auth.passwordResetTtlMs` — `PASSWORD_RESET_EXPIRES`, default 30 min, in `config/env.js` line 178.) With SMTP unconfigured, `sendMail` logs `[email] skipped (no SMTP) → Reset your RankOS password to <addr>` and returns `null` — the reset *flow* still completes and, in dev, you grab the link from wherever the caller logs/exposes it. Acceptable because the degradation is loud (a warn per skipped email), scoped to environments that chose not to configure SMTP, and the API contract to the user ("if that email exists, we sent a link") is unchanged. Always send both `text` and `html`: spam filters distrust HTML-only mail.

### 3. Trace a 4 MB PNG upload (no Cloudinary, no Vision)

1. `backend/src/routes/upload.routes.js` line 19 matches `POST /` → `authenticate` (`middlewares/authenticate.js`) validates the cookie/JWT → `uploadLimiter` counts the hit (60/15 min) → `uploadSingle("file")`.
2. `backend/src/middlewares/upload.js`: multer parses the multipart stream; `fileFilter` sees `image/png` ∈ `ALLOWED_MIME` → accept; 4 MB < 15 MB cap → `req.file = { buffer, originalname, mimetype: "image/png", size }`.
3. `backend/src/controllers/upload.controller.js` `create`: `req.file` exists; `resolveKind(undefined, "image/png")` → `"image"`.
4. `storeFile(...)` in `backend/src/services/upload.service.js`: `ensureCloudinary()` → `configureCloudinary()` returns `null` → `false` → `storeLocally(...)`: mkdir `uploads/`, write `<uuid>-<sanitized-name>`, log `[upload:stub] stored locally → ...`, return `{ provider: "local", url: "/api/uploads/files/<name>", publicId: null }`.
5. Controller: `Upload.create({ ..., provider: "local", status: "uploaded" })` → `upload.__buffer = buffer` → `processUpload(upload)`.
6. `backend/src/services/ocr.service.js` `processUpload`: save `status: "processing"` → `extractText`: `isVisionConfigured()` false → log `[ocr:stub] ...` → `{ text: STUB_SHEET, provider: "stub" }` → `parseExam(text)` → 4 rows → save `rawText`, `ocrProvider: "stub"`, `parsed`, `status: "parsed"`.
7. Controller responds **201** with `{ id, kind: "image", url, provider: "local", status: "parsed", ocrProvider: "stub", parsedCount: 4, parsed: [...] }`.

Final document state: `status: "parsed"`, `ocrProvider: "stub"`.

### 4. Rejections

- **(a) 20 MB PDF → HTTP 413.** Multer aborts with `MulterError` code `LIMIT_FILE_SIZE` (the `limits.fileSize` cap at `upload.js` line 33); the wrapper at lines 46–53 maps that code to status 413 with message `"File is too large (max 15 MB)."` and `fields.file = "Max file size is 15 MB."`. Responsible line: `const code = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;` (line 47).
- **(b) `.exe` → HTTP 400.** `fileFilter` (lines 21–29) finds `application/x-msdownload` ∉ `ALLOWED_MIME` and passes `ApiError.badRequest(..., { code: "UNSUPPORTED_FILE_TYPE", fields: { file: ... } })` to multer's callback; the wrapper's `return next(err)` (line 55) forwards it untouched to the global `errorHandler`. This is exactly what the integration test asserts (`integration.test.js` lines 122–128).
- **(c) No file → HTTP 400.** Multer runs fine but sets no `req.file`; the *controller* throws — `upload.controller.js` lines 18–20: `if (!req.file) throw ApiError.badRequest("No file uploaded.", { fields: { file: "Choose a file to upload." } })`.

All three arrive at the client in the same error envelope — that consistency is the entire point of the `uploadSingle` wrapper.

### 5. The 16 MB rebuttal

1. **Hard ceiling.** A BSON document maxes out at 16 MB. Your cap is 15 MB *today*; the first "can we raise the upload limit?" request breaks the schema. Object storage has no such cliff.
2. **RAM poisoning.** MongoDB serves queries from its in-memory working set. Fat binary fields ride along with every un-projected read, evicting the hot documents (profiles, tasks, mistakes) that every page load needs. The codebase already fights a miniature version of this: `list` does `.select("-rawText")` to keep even *text* out of list payloads.
3. **Delivery.** Files should be served from a CDN edge (Cloudinary's `secure_url`) with caching and range requests — not streamed through your Express process, burning Node CPU per download.
4. **Operations.** Backups/restores and replication ship every byte of every file forever; storage tiers designed for blobs are dramatically cheaper.

And the codebase already states this position in code: `upload.controller.js` line 39 — `upload.__buffer = buffer` with the comment *"the raw buffer is passed transiently (not stored)"*. The buffer is attached as a **non-schema property** precisely so OCR can read it once while Mongo persists only metadata + parsed rows. GridFS is the "but Mongo *can* store files" counterpoint — and it exists for niche cases (no object store available), not as the default.

### 6. Implement Twilio's `sendViaProvider`

```js
// backend/src/services/sms.service.js
async function sendViaProvider(to, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        authorization: `Basic ${auth}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: to,
        From: process.env.TWILIO_FROM,
        Body: body,
      }),
      signal: AbortSignal.timeout(Number(process.env.SMS_TIMEOUT_MS) || 10000),
    },
  );
  if (!res.ok) throw new Error(`twilio ${res.status}: ${await res.text()}`);
  return res.json();
}
```

The graders' checklist: Basic auth built from SID + token (never in the URL); **form-encoded** body (Twilio's classic API is not JSON); `TWILIO_FROM` as the sender (so extend `isProviderConfigured` to require it too); the `AbortSignal.timeout` matching the AI adapters' discipline; throw on `!res.ok` so `sendSms`'s caller — and one day a BullMQ retry — sees the failure.

### 7. `weeklyDebrief` AI helper

```js
// backend/src/services/ai/index.js — append near the other helpers
/** Weekly debrief. ctx: { hoursThisWeek, accuracy, weakTopics[] } */
export function weeklyDebrief(ctx) {
  const { hoursThisWeek, accuracy, weakTopics = [] } = ctx;
  const list = weakTopics.map((t) => `${t.name} (${t.mastery}%)`).join(", ") || "none flagged";
  const prompt =
    `Write a 3–4 sentence end-of-week debrief for the student.\n` +
    `Data — hours studied this week: ${hoursThisWeek ?? "?"}; overall accuracy: ${accuracy ?? "?"}%; ` +
    `weak topics: ${list}.\n` +
    `Acknowledge the effort, name the biggest gap, and end with one concrete goal for next week.`;
  const fallback = () =>
    `You put in ${hoursThisWeek ?? "solid"} hours this week at ${accuracy ?? "steady"}% accuracy — ` +
    `that consistency is what compounds. ` +
    `${weakTopics[0] ? `The biggest gap is still ${weakTopics[0].name} at ${weakTopics[0].mastery}% mastery. ` : ""}` +
    `Next week: schedule ${weakTopics[0] ? weakTopics[0].name : "your weakest chapter"} in your first ` +
    `study block each day and clear its pending mistakes before Sunday's mock.`;
  return run({ system: MENTOR_SYSTEM, prompt, fallback, maxTokens: 400 });
}
```

(And add it to the default export.) **Why no provider-specific code is allowed:** the facade's `run()` already routes to whichever adapter `getProvider()` selects — helper code that mentioned Anthropic/OpenAI/Gemini would break the registry's guarantee that "switching providers is a pure env change" (`providers/index.js` comment, lines 6–12), triple the maintenance surface, and bypass the shared timeout/fallback/empty-reply handling. Feature helpers own *prompts and fallbacks*; adapters own *vendors*. That boundary is the whole architecture.

### 8. `parseExam` hand-trace

Line-by-line through `backend/src/services/ocr.service.js` `parseExam`:

- `"CHEMISTRY"` matches the heading regex → `flush()` (no block, no-op) → `currentSubject = "Chemistry"` (first letter upper, rest lower).
- `"Q7. Which of the following is aromatic?"` matches `^Q?\s*(\d+)[.)]\s*(.*)$` → new `block = { number: 7, subject: "Chemistry", lines: ["Which of the following is aromatic?"] }`.
- The options line and the answers line don't match heading/question → appended to `block.lines`.
- End of input → `flush()`: `joined = "Which of the following is aromatic? (A) Cyclobutadiene (B) Benzene (C) Cyclooctatetraene (D) None Your Answer: B Correct Answer: B"`.
  - `optZone` = everything before `"Your Answer"`; splitting on `/\(([A-D])\)/` yields `["…aromatic? ", "A", " Cyclobutadiene ", "B", " Benzene ", "C", " Cyclooctatetraene ", "D", " None "]`; `.slice(1)` pairs letters with texts → `options = ["Cyclobutadiene", "Benzene", "Cyclooctatetraene", "None"]`.
  - `studentAnswer = "B"`, `correctAnswer = "B"` from the two answer regexes.
  - `qText` = text before `(A)`, with the (already-absent) `Q7.` prefix stripped → `"Which of the following is aromatic?"`.

Result:

```js
[{
  questionNumber: 7,
  subject: "Chemistry",
  topic: null,
  text: "Which of the following is aromatic?",
  options: ["Cyclobutadiene", "Benzene", "Cyclooctatetraene", "None"],
  studentAnswer: "B",
  correctAnswer: "B",
}]
```

---

## Chapter 6.4 — Testing & Seeds

### 1. Runner mechanics

The runner (main process) spawns **one child process per test file — two here** (`health.test.js`, `integration.test.js`), plus itself as coordinator. The isolation prevents, concretely:

1. **Frozen-config clashes.** `config/env.js` reads `process.env` once at import and `Object.freeze`s the result. `health.test.js` wants `MONGODB_URI` = a dummy localhost URI; `integration.test.js` wants the in-memory server's URI, which doesn't exist until its `before()` runs. In one shared process, whichever file imported `env.js` first would lock its URI in for both — with separate processes, each file gets a fresh module cache and its own frozen config.
2. **Shared-state bleed.** The integration file *seeds and mutates* a database and holds module-level singletons (mongoose connection, the supertest agent, cookies). Process isolation guarantees the health tests can't observe or corrupt any of that, and a crash in one file can't take down the other.

### 2. Static-import thought experiment

ES module imports are hoisted and evaluated **before any statement in the importing module runs**. With `import { app } from "../app.js"` at the top, the chain `app.js → config/env.js` executes *before* `before()` ever assigns `process.env.MONGODB_URI`. What happens then depends on the shell: with no `MONGODB_URI` in the environment, `env.js`'s `ensureRequired()` prints `[env] Missing required environment variable(s): MONGODB_URI` and calls `process.exit(1)` — the test process dies before a single test registers, and the runner reports the file as failed with no useful stack. If a `.env`/shell variable *does* supply a URI, it's subtler and worse: `env` freezes pointing at that real database, the later `mongod.getUri()` assignment changes only the (now-ignored) `process.env`, and `seeds.run()` **wipes and reseeds your real development database** while tests run against it. Both failure modes are why every import in that file is a dynamic `await import()` sequenced after the env assignments.

### 3. Shipping `tasks.test.js`

The full file is in [Chapter 6.4, "Writing a new test"](./04-testing-mastery.md) — it is itself the solution; create it verbatim at `backend/src/tests/tasks.test.js` and run:

```bash
node --test src/tests/tasks.test.js
npm test
```

Common first-attempt failures (any of these counts as your "record the failure" answer):

- **Asserting `_id` instead of `id`.** Whether the response has `id` depends on the model's `toJSON` transform; `StudyTask` responses may expose `_id`. The chapter's `t.id ?? t._id` hedge exists because of exactly this — check one real response body before asserting.
- **`POST` asserting `res.body.data.length` styles** — the tasks list returns `{ data: [...] }` (service wraps it) while `POST` returns the bare task document. Mixing the two shapes is the classic first failure.
- **Forgetting `rememberMe` doesn't matter but forgetting `Cookie` replay does** — an unauthenticated PATCH returns 401, not your expected 200.

### 4. Cross-user ownership

Addition to `tasks.test.js`:

```js
test("a different user cannot patch Aarav's task", async () => {
  // teacher@example.com is seeded with the same DEMO_PASSWORD
  const tLogin = await api
    .post("/api/auth/login")
    .send({ identifier: "teacher@example.com", password: "password123" });
  const teacherCookies = tLogin.headers["set-cookie"];

  const list = await auth(api.get("/api/tasks"));           // as Aarav
  const victim = list.body.data[0];

  const res = await api
    .patch(`/api/tasks/${victim.id ?? victim._id}`)
    .set("Cookie", teacherCookies)
    .send({ done: true });
  assert.equal(res.status, 404);
});
```

The responsible code is `backend/src/services/tasks.service.js`, lines 21–26 — specifically the **query filter**:

```js
const task = await StudyTask.findOneAndUpdate(
  { _id: taskId, user: userId },   // ← ownership is part of the lookup itself
  { done: Boolean(done) },
  { new: true },
);
if (!task) throw ApiError.notFound("Task not found");
```

Because `user: userId` is in the *filter*, a foreign user's lookup simply finds nothing — there is no "found it, now check permission" step that could return 403, and no code path that could accidentally perform the edit. 404-on-foreign-resource is also the safer disclosure posture: a 403 would confirm to an attacker that the id exists.

### 5. A true unit test for `parseExam`

```js
// backend/src/tests/ocr.parse.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { parseExam } from "../services/ocr.service.js";

const SHEET = `CHEMISTRY
Q7. Which of the following is aromatic?
(A) Cyclobutadiene (B) Benzene (C) Cyclooctatetraene (D) None
Your Answer: B   Correct Answer: B
`;

test("parses subject, options, and answers from a well-formed block", () => {
  const rows = parseExam(SHEET);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    questionNumber: 7,
    subject: "Chemistry",
    topic: null,
    text: "Which of the following is aromatic?",
    options: ["Cyclobutadiene", "Benzene", "Cyclooctatetraene", "None"],
    studentAnswer: "B",
    correctAnswer: "B",
  });
});

test("keeps parentheses inside option text intact", () => {
  const rows = parseExam("PHYSICS\nQ1. Find a.\n(A) g sinθ (B) (2/3) g sinθ\nCorrect Answer: B\n");
  assert.deepEqual(rows[0].options, ["g sinθ", "(2/3) g sinθ"]);
});

test("lines before any question header are ignored", () => {
  const rows = parseExam("(A) orphan option\nsome noise\n");
  assert.deepEqual(rows, []);
});

test("subject heading carries down across questions", () => {
  const rows = parseExam("PHYSICS\nQ1. One?\n(A) x (B) y\nQ2. Two?\n(A) p (B) q\n");
  assert.equal(rows.length, 2);
  assert.equal(rows[1].subject, "Physics");
  assert.equal(rows[0].studentAnswer, null);   // no answers present → null, not crash
});
```

Note what's *absent*: no `before`, no memory server, no supertest, no env vars — `parseExam` is pure, and importing `ocr.service.js` only pulls in the logger. These four tests run in milliseconds; this is the bottom of the pyramid earning its keep. (Run: `node --test src/tests/ocr.parse.test.js`.)

### 6. Extending the seed

Patch to `backend/src/seeds/index.js`, after the existing user creation:

```js
const student2 = await User.create({
  fullName: "Isha Verma", email: "isha@example.com", mobile: "+919800000004",
  passwordHash, role: ROLES.STUDENT, exam: "NEET",
  isEmailVerified: true, isMobileVerified: true,
});
await Profile.create({ user: student2._id, exam: "NEET", xp: 12000, level: 9, streak: 5 });
await StudyTask.insertMany([
  { user: student2._id, date: today(), title: "Human Physiology — respiration PYQs",
    subject: "Biology", minutes: 45, type: "Practice", done: false, time: "07:00" },
  { user: student2._id, date: today(), title: "Optics — ray diagrams revision",
    subject: "Physics", minutes: 30, type: "Revision", done: false, time: "17:00" },
]);
```

Assertions to re-check afterwards:

- `dashboard returns seeded student data` (`todayPlan.length === 5`) — **safe**, because tasks are queried per-user (`{ user: userId, date }` in `tasks.service.js`); Isha's 2 tasks belong to her.
- Anything counting *global* documents would break — currently none of the suite counts users/tasks globally, but your own `tasks.test.js` list assertion stays at 5 for Aarav for the same per-user reason.
- Uniqueness: her email/mobile must not collide with existing seeds (they don't), or `User.create` throws and the whole seed fails.
- **The leaderboard insert (lines 237–246) is unaffected**: it iterates the *static* `D.leaderboard` array from `seeds/data.js` and links `user:` only for the row flagged `isYou` (Aarav). Isha gets no leaderboard row unless you add one to the data — the seed's leaderboard is display data, not derived from `User` documents. And because `clearAll()` wipes everything first, re-running the seed never duplicates her.

### 7. Why `health.test.js` passes with no MongoDB at all

Importing `app.js` executes: `config/env.js` (validation passes — the test set a dummy `MONGODB_URI` string; nothing *dials* it), logger setup, and `createApp()` — middleware, swagger mount, and the router tree, which transitively loads controllers, services, and models. Loading a Mongoose model merely **registers a schema** on the default connection object; no network I/O happens until a query runs against a connected client. `connectDatabase()` is called from exactly one place — `bootstrap()` in `backend/src/index.js` (line 18) — which tests never import.

The four health tests then only hit endpoints that never query Mongo. `GET /api/health` (`backend/src/controllers/health.controller.js` lines 47–73) calls `getDatabaseState()`, which just reads `mongoose.connection.readyState` — `0` → `"disconnected"` (`config/database.js` lines 56–60). So the response is a healthy 200 with `dependencies: { mongodb: "disconnected", redis: "not-configured" }`, and the test asserts only that `dependencies` *exists* — shape, not connectivity. (Contrast: `GET /api/health/ready` would return **503** in this state — which is why the test file smartly doesn't call it.)

### 8. Coverage gaps

Any three of these (with a sketch) earns full credit:

1. **The realtime layer.** Nothing tests that `initSockets` accepts a connection — it's only wired in `index.js`. *Sketch:* a test that imports `node:http` + `createApp()`, runs `initSockets(server)` and `server.listen(0)`, connects with `socket.io-client`, asserts the `connect` event fires, then closes everything.
2. **Graceful shutdown.** `shutdown()`'s ordering and the 10s force-exit are untested. *Sketch:* spawn `src/index.js` as a child process against a memory-server URI, send `SIGTERM`, assert exit code 0 and that the log contains `shutdown complete`.
3. **Redis-backed behavior.** Rate limiting with the Redis store, `createQueue` returning a real queue, `isRedisReady` — all dormant without Redis. *Sketch:* gate a test file on `REDIS_URL` being set (skip otherwise), enqueue a job on a throwaway queue, and assert a Worker processes it.
4. **`verifyEmailTransport` / `sendMail` no-op contract.** *Sketch:* unit-test that with `SMTP_*` unset, `verifyEmailTransport()` resolves `false` and `sendMail(...)` resolves `null` (never throws) — locking in the degradation contract the app depends on.
5. **The silent-refresh path in `authenticate`.** The suite tests valid-cookie and no-cookie, but not "expired access + valid refresh → rotated cookies". *Sketch:* log in, manually craft/expire the access cookie (or sign one with a 1s TTL), call `/api/auth/me`, assert 200 *and* fresh `Set-Cookie` headers.
6. **Multer's 413 path.** The suite tests the bad-mimetype 400 but not the size limit. *Sketch:* `.attach("file", Buffer.alloc(16 * 1024 * 1024), { filename: "big.png", contentType: "image/png" })` → assert 413 and `fields.file === "Max file size is 15 MB."`.

---

*End of Module 6 solutions. If any solution surprised you, re-read the corresponding "In your codebase" section — every answer is traceable to real lines in `backend/src/`.*
