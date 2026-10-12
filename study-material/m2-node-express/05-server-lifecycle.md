# Module 2.5 — Server Lifecycle: Boot, Run, Die Gracefully

> **Goal:** Walk `backend/src/index.js` line by line and master the full life of a server process: why `http.createServer` instead of `app.listen`, the bootstrap order and its fatal/non-fatal split, graceful shutdown with a force-timer, the process-level safety nets, and why `app.js` and `index.js` are separate files.

## Concepts

### A server has a lifecycle, not just routes

Beginners think of a backend as "the routes". In production, the parts that distinguish a solid service from a toy are the *edges* of the process's life:

- **Boot**: acquire dependencies (DB, cache, mail) in the right order, fail loudly if the essentials are missing, then — and only then — accept traffic.
- **Run**: survive dependency blips; never die from a single bad request.
- **Shutdown**: when told to stop (deploy, scale-down, Ctrl-C), finish in-flight requests, release connections, and exit cleanly — because the platform *will* kill you if you dawdle.

Every deploy triggers this cycle: the orchestrator sends the old process `SIGTERM`, waits (typically ~30s), then `SIGKILL`s it. A server without graceful shutdown drops whatever requests were mid-flight at every single deploy.

### Signals, in one paragraph

A **signal** is an asynchronous notification the OS sends a process. `SIGINT` is what Ctrl-C sends; `SIGTERM` is the standard "please terminate" (what Docker/Kubernetes/systemd send first); `SIGKILL` cannot be caught — the process just dies. Node lets you intercept the catchable ones with `process.on("SIGTERM", handler)`, replacing the default behavior (immediate exit) with your own cleanup.

### The separation: app vs server

- `backend/src/app.js` **defines behavior**: what happens to a request. It never opens a port.
- `backend/src/index.js` **runs a process**: creates the network server, connects dependencies, listens, and manages death.

Why it matters — **testability**: `backend/src/tests/*.test.js` can import `app` and use `supertest` to fire fake requests through the full middleware chain *without binding a port, without MongoDB config, without signal handlers*. Tests get millisecond feedback; the app code exercised is byte-for-byte what production runs. If `app.js` called `listen()` at import time, merely importing it in a test would start a real server (and try to connect to a real database). The rule generalizes: **modules should export capabilities; only the entrypoint should have side effects on the outside world.** (You've seen the one nuance already: `app.js` does build the app at import time — but building an app object is pure computation; *listening* is the side effect that's quarantined in `index.js`.)

## In your codebase (the walkthrough)

The whole of `backend/src/index.js` is 87 lines. We take it top to bottom.

### Imports — the boot manifest

```js
import http from "node:http";

import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { connectRedis, disconnectRedis } from "./config/redis.js";
import { configureCloudinary } from "./config/cloudinary.js";
import { verifyEmailTransport } from "./services/email.service.js";
import { initJobs, closeQueues } from "./jobs/index.js";
import { initSockets, closeSockets } from "./sockets/index.js";
```

Read the import list as a table of contents for the process's life: every dependency appears as a **pair** — a connect and a disconnect (`connectDatabase`/`disconnectDatabase`, `connectRedis`/`disconnectRedis`, `initJobs`/`closeQueues`, `initSockets`/`closeSockets`). Whatever boot opens, shutdown must close. Also remember Chapter 2.1: these imports *execute* modules — importing `env.js` runs validation (and may `process.exit(1)` before anything else happens), importing `app.js` builds the entire middleware chain. By line 12, config is validated and the app exists.

### Lines 13–14 — the explicit HTTP server

```js
const server = http.createServer(app);
let shuttingDown = false;
```

Express offers a shortcut — `app.listen(port)` — which internally does exactly this `http.createServer(app)` and listens. So why write it out? Because two other actors need the **raw server object**:

1. **Socket.IO** — `initSockets(server)` attaches the WebSocket layer to the *same* HTTP server (same port; upgrade requests are intercepted before Express sees them). You can't do that with a server you never got a reference to.
2. **Graceful shutdown** — `server.close()` needs `server`.

`shuttingDown` is a module-level guard flag; its purpose appears in `shutdown()` below.

### Lines 16–39 — `bootstrap()`: ordered, with a fatal/non-fatal split

```js
async function bootstrap() {
  // 1) Required dependency — MongoDB (fails fast if unreachable).
  await connectDatabase();

  // 2) Optional dependencies — never fatal in the foundation build.
  await connectRedis();
  configureCloudinary();
  await verifyEmailTransport();
  initJobs();

  // 3) Realtime layer.
  initSockets(server);

  // 4) Start listening.
  server.listen(env.app.port, () => {
    logger.info(`[server] ${env.app.name} listening on :${env.app.port} (${env.nodeEnv}) — API at ${env.app.apiPrefix}`);
    if (env.swagger.enabled) {
      logger.info(`[server] docs → http://localhost:${env.app.port}${env.app.apiPrefix}/docs`);
    }
  });
}
```

The order encodes a policy. Step by step:

**Step 1 — MongoDB is fatal.** `connectDatabase()` (in `backend/src/config/database.js`) tries up to 5 times with a 3-second pause (linear backoff — the comment explains why: a cold Atlas cluster or a container that's still starting shouldn't kill the boot). But if the *last* attempt fails, it `throw`s. That throw propagates out of `bootstrap()` into the `.catch` at the bottom of the file → `process.exit(1)`. Why fatal? An API whose every endpoint needs the database but which happily reports "listening on :8080" is worse than a dead one — it would answer health checks while failing every real request. **Fail fast, fail loud.**

**Step 2 — everything else is optional.** Contrast with `connectRedis()` (`backend/src/config/redis.js`): if Redis isn't configured, it logs a warning and returns `null`; if the initial `ping()` *fails*, it logs a warning — and does **not** throw:

```js
} catch (err) {
  logger.warn(`[redis] initial ping failed: ${err.message}`);
}
```

The design comment in `redis.js` states the policy: "If it isn't configured, the app still boots — features that need it (BullMQ, distributed rate limiting, caching) simply stay dormant... a Redis blip never crashes the API." The same graceful degradation applies to Cloudinary (image uploads) and SMTP (email) — each guarded by its `env.*.isConfigured` getter from Chapter 2.4. The principle: **a dependency is fatal only if the service is useless without it.** Mongo: yes. A cache, a mailer, an image CDN: no — degrade, warn, carry on.

**Step 3 — sockets before listen.** Socket.IO must be attached before traffic arrives, so upgrade requests are never missed.

**Step 4 — `listen` last.** Only after dependencies are settled does the server bind the port. The OS starts queueing connections from this moment. Listening *first* would accept requests that are doomed to fail. The callback runs once the port is bound — that's your "we're live" log line, including a clickable docs URL in dev.

### Lines 44–70 — `shutdown()`: the choreography of dying well

```js
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`[server] ${signal} received — shutting down gracefully`);
```

The guard makes shutdown **idempotent**: press Ctrl-C twice, or have `uncaughtException` fire during a SIGTERM shutdown, and the second call is a no-op instead of a double-close crash.

```js
  // Force-exit if cleanup hangs.
  const forceTimer = setTimeout(() => {
    logger.error("[server] forced shutdown (cleanup timed out)");
    process.exit(1);
  }, 10000);
  forceTimer.unref();
```

The **dead-man's switch**. If cleanup deadlocks — say Mongo's close hangs because the network vanished — the process would otherwise linger until the platform SIGKILLs it. This timer guarantees exit within 10 seconds, whatever happens.

`forceTimer.unref()` is the subtle gem. Node keeps the process alive as long as *referenced* handles exist (open servers, sockets, pending timers). An un-unref'd force timer would itself keep the process alive for the full 10 seconds **even after cleanup finished** — the safety net would cause the delay it guards against. `unref()` says: "don't count this timer as a reason to stay alive." If everything closes early, the process exits naturally; the timer silently dies with it. (The `clearTimeout(forceTimer)` in the success path below is belt *and* braces.)

```js
  server.close(async () => {
    try {
      await closeSockets();
      await closeQueues();
      await disconnectRedis();
      await disconnectDatabase();
      logger.info("[server] shutdown complete");
      clearTimeout(forceTimer);
      process.exit(0);
    } catch (err) {
      logger.error(`[server] error during shutdown: ${err.message}`);
      process.exit(1);
    }
  });
```

`server.close(cb)` does two things: **stop accepting new connections** immediately, and invoke `cb` once all *existing* connections have finished. That's the "graceful" part — in-flight requests complete; new ones are refused (the load balancer, seeing refused connections, routes them to the new deploy's instance).

Then teardown runs in **reverse dependency order**, outermost first: sockets (clients disconnected) → job queues (workers stop taking jobs) → Redis → MongoDB last (everything above it might still have needed the DB to finish). Compare with bootstrap: Mongo was first up, and is last down. Clean exit → `process.exit(0)` ("success" to the supervisor); a failed cleanup → `exit(1)`.

### Lines 72–80 — process-level safety nets

```js
process.on("unhandledRejection", (reason) => {
  logger.error(`[process] unhandledRejection: ${reason?.stack || reason}`);
});
process.on("uncaughtException", (err) => {
  logger.error(`[process] uncaughtException: ${err.stack || err.message}`);
  shutdown("uncaughtException");
});
["SIGTERM", "SIGINT"].forEach((sig) => process.on(sig, () => shutdown(sig)));
```

Three nets, three different policies — the asymmetry is deliberate:

- **`unhandledRejection`** — a promise rejected and nobody `.catch`ed it. Since Node 15 the *default* is to crash the process. Here it's **log and continue**: with `asyncHandler` routing all request-path rejections to the error handler, anything reaching this hook is likely a stray background promise; killing the whole server for it would be an overreaction. The log (with stack) ensures it isn't invisible.
- **`uncaughtException`** — a synchronous throw escaped everything. This is worse: the throw interrupted some code mid-operation, so the process state is suspect (half-written state, orphaned locks — you can't know). Policy: log, then **graceful shutdown** — don't limp on with corrupted state, but do exit cleanly rather than instantly. The supervisor restarts a fresh process.
- **`SIGTERM` / `SIGINT`** — normal, healthy termination requests (deploy / Ctrl-C). Straight to `shutdown(sig)`; the signal name flows into the log line so you can tell a deploy from a crash in the logs.

### Lines 82–87 — ignition

```js
bootstrap().catch((err) => {
  logger.error(`[server] failed to start: ${err.stack || err.message}`);
  process.exit(1);
});

export { server };
```

`bootstrap()` is async; if it rejects (in practice: MongoDB unreachable after 5 attempts), log with stack and `exit(1)`. Note this `.catch` is what *makes* Mongo fatal — the fatality isn't in `database.js` (which merely throws); it's the entrypoint that chooses death as the response. `database.js` stays reusable in contexts (like seeds — `backend/src/seeds/index.js`) that may want different policies.

The `export { server }` at the bottom lets integration tests import the *real* booted server if they need to.

### Timeline of a deploy, end to end

```
old process                              new process
───────────                              ───────────
                                          node src/index.js
                                          env validated (env.js import)
                                          Mongo connect (retry ×5)
                                          Redis ping (warn if down)
                                          sockets attached
                                          listen :8080 → "listening"
platform: SIGTERM ──▶ shutdown("SIGTERM")
  forceTimer armed (10s, unref'd)
  server.close() — port refuses new conns
  in-flight requests finish
  sockets → queues → redis → mongo closed
  "shutdown complete", exit(0)
```

## Pitfalls & gotchas

- **`app.listen()` hides the server object.** It *returns* it, so `const server = app.listen(...)` also works — but the codebase's explicit `http.createServer(app)` makes the layering visible and keeps creation separate from listening. Know that both are equivalent under the hood.
- **`server.close()` does not kill open connections** — it waits for them. A long-polling or WebSocket connection can stall closure indefinitely; that's one reason the force timer *and* `closeSockets()` exist. (Node 18.2+ added `server.closeAllConnections()` for the hard variant.)
- **Forgetting `unref()` on watchdog timers** means every shutdown takes the full timeout, even when cleanup finished in 50 ms.
- **Doing real work in `uncaughtException` and continuing.** The Node docs are explicit: after an uncaught exception the process is in an undefined state; resuming normal operation is unsafe. Log, clean up, exit — which is exactly what this file does.
- **Listening before dependencies are up** turns your health endpoint into a liar. Order: connect → listen. Your `bootstrap()` gets this right; keep it that way when adding dependencies.
- **Boot-order coupling via imports.** `import { env }` runs validation *before* `bootstrap()` is even defined. If you ever add config that depends on an async source (a secrets manager), it can't live in `env.js`'s import-time flow — it must join `bootstrap()`.
- **Testing against a listening server by accident.** If a test imports `index.js` instead of `app.js`, it boots Mongo connections and signal handlers. Import `app` for request tests; that's the whole point of the split.

## Exercises

Answers in [SOLUTIONS.md](./SOLUTIONS.md).

1. **(Comprehension)** List the four phases of `bootstrap()` in order and state, for each dependency touched, whether its failure kills the process — and *where in the code* that fatality (or tolerance) is implemented. (Careful: the Mongo answer spans two files.)
2. **(Prediction)** MongoDB is down and stays down. You run `npm run dev`. Describe the exact observable behavior — how many log lines about connection attempts, over roughly how many seconds, and what happens at the end. (Read `backend/src/config/database.js:14-32`.)
3. **(Prediction)** The server is handling a slow 8-second request when you press Ctrl-C. Walk through what happens at t=0, during the 8 seconds, and at completion. Now rerun the scenario with a request that takes 20 seconds. What changes, and at exactly which line?
4. **(Code reading)** Explain why `forceTimer.unref()` exists by describing the bug that occurs without it. Then explain why `clearTimeout(forceTimer)` on line 63 is *also* there when `unref` alone would mostly suffice.
5. **(Comprehension)** Why do `unhandledRejection` and `uncaughtException` get different policies (continue vs shutdown)? Tie your answer to what each event implies about process state, and to the existence of `asyncHandler`.
6. **(Code reading)** Trace the shutdown ordering: why are sockets closed before queues, and the database last? Give a concrete failure that could occur if `disconnectDatabase()` ran first.
7. **(Prediction)** A colleague "simplifies" the code by moving `server.listen(...)` to the top of `bootstrap()`, before `connectDatabase()`. The server boots fine and Mongo connects 2 seconds later. What can go wrong in those 2 seconds, and which requests are affected? Is there a scenario where the process now stays alive *without* a database forever?
8. **(Comprehension)** `backend/src/tests/health.test.js`-style tests import `app`, not `server`. Explain precisely which side effects they avoid by that choice, and which single line of `app.js` makes the app importable without them.

---

Next: [Module 2.6 — API Design & Layered Architecture](./06-api-design.md)
