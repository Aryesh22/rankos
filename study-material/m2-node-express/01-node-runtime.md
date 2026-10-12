# Module 2.1 — The Node.js Runtime

> **Goal:** Understand what Node.js actually *is* — not "a thing you install", but a specific machine made of V8, libuv, and an event loop — and see how every piece of that machine is already at work inside `backend/src/`.

## Concepts

### What is Node.js, really?

JavaScript was born inside browsers. A browser gives JS two things: an engine that executes the language, and a set of *host APIs* (the DOM, `fetch`, timers). Take the engine out of the browser, bolt on a *different* set of host APIs (files, network sockets, processes), and you get Node.js.

So Node.js is three layers glued together:

1. **V8** — Google's JavaScript engine (the same one in Chrome). It parses your `.js` files, compiles them to machine code (just-in-time compilation), and runs them. V8 knows *nothing* about files, HTTP, or databases. It only knows the JavaScript language: objects, functions, promises, `Math.max`.
2. **libuv** — a C library that provides the things V8 lacks: access to the operating system's network sockets, file system, DNS, and — crucially — the **event loop** that decides *when* your JavaScript callbacks run.
3. **Node's own C++/JS bindings** — the bridge layer that exposes libuv and OS features to your JavaScript as modules like `node:http`, `node:fs`, `node:crypto`, plus globals like `process`.

Analogy: V8 is the engine of a car, libuv is the drivetrain and wheels, and Node's built-in modules are the pedals and steering wheel you actually touch. But land on the precise truth: **when you call `server.listen(8080)`, JavaScript is not listening on a port — libuv asked the operating system to open a TCP socket, and the OS notifies libuv when bytes arrive; libuv then schedules your JavaScript callback to run.**

### The event loop, at practical depth

Node runs your JavaScript on **one thread**. There is no parallel execution of your code (ignoring worker threads, which this project doesn't use). Instead, Node interleaves work using the event loop, which is roughly this cycle, repeated forever:

```
┌─> timers          — run callbacks for expired setTimeout/setInterval
│   pending I/O     — run some deferred system callbacks
│   poll            — WAIT here for I/O events (sockets, files); run their callbacks
│   check           — run setImmediate callbacks
└── close callbacks — e.g. socket "close" events
```

Between *every* step above — in fact after every single callback — Node drains two **microtask queues**:

- `process.nextTick(...)` callbacks (highest priority), then
- resolved **Promise** callbacks (`.then`, and every `await` continuation).

Practical consequences you will actually feel:

- `await` doesn't "pause the server". It pauses *that one function*, returns control to the event loop, and the loop serves other requests. When the awaited promise settles, the rest of your function is queued as a microtask.
- **Blocking the loop blocks everyone.** A `while (true) {}` or a huge synchronous `JSON.parse` on a 200 MB string freezes *every* request in flight, because there is only one thread running JS.
- Order puzzle you should be able to solve after this module:

```js
console.log("A");
setTimeout(() => console.log("B"), 0);
Promise.resolve().then(() => console.log("C"));
console.log("D");
// Prints: A, D, C, B
```

Synchronous code first (`A`, `D`), then microtasks (`C`), then the timer phase of the *next* loop iteration (`B`).

One more nuance: libuv keeps a small **thread pool** (default 4 threads) for operations that can't be done in a non-blocking way at the OS level — file system calls, DNS lookups, and CPU-heavy crypto like `pbkdf2`. Your JS is still single-threaded; the thread pool is hidden plumbing. This is why `bcrypt` (used in this project for password hashing) doesn't freeze the server: the hashing runs on a libuv worker thread and calls back when done.

### Why Node suits I/O-heavy servers

A backend like yours spends almost all of its time **waiting**: waiting for MongoDB to answer a query, waiting for Redis, waiting for the client to finish uploading a body. In a classic thread-per-request server, each waiting request holds an entire thread hostage (each thread costs ~MBs of stack memory and context-switching overhead). Node instead parks the *tiny* state of each pending request (a closure + a promise) and lets one thread juggle thousands of in-flight requests.

The trade-off: Node is a poor fit for **CPU-heavy** work (video encoding, big number crunching) because one long computation starves everyone. Your app is exactly the good case — practically every service function in `backend/src/services/` is a chain of `await Model.find(...)` calls: pure I/O.

### CommonJS vs ES Modules

Two module systems exist in Node:

- **CommonJS (CJS)**: `const x = require("x")` / `module.exports = ...` — the historical default.
- **ES Modules (ESM)**: `import x from "x"` / `export ...` — the modern standard.

Your backend uses ESM. The switch is a single line in `backend/package.json`:

```json
"type": "module",
```

That line tells Node to treat every `.js` file in the package as an ES module. Two things follow that will bite you if you forget:

1. Relative imports **must include the file extension**: `import { app } from "./app.js";` — note the `.js`. CJS let you omit it; ESM does not.
2. There is no `__dirname` global in ESM (the codebase avoids needing it by using `process.cwd()` in `logger.js`).

### The `node:` builtins your codebase uses

The `node:` prefix (e.g. `node:http` instead of `http`) is the modern, explicit way to import a built-in module. It guarantees you get *Node's* module, never a same-named package someone sneaked into `node_modules`.

- **`node:http`** — the raw HTTP server. Used once, in `backend/src/index.js`:

  ```js
  import http from "node:http";
  const server = http.createServer(app);
  ```

  `http.createServer(handler)` creates a TCP server that parses incoming bytes into HTTP requests and calls `handler(req, res)` for each one. The twist here: an Express `app` *is* a function with the signature `(req, res)`, so it can be passed directly as the handler. Express is a layer *on top of* `node:http`, not a replacement for it. (Why not `app.listen()`? Chapter 2.5 — the explicit server object is needed for Socket.IO and graceful shutdown.)

- **`node:path` and `node:fs`** — path arithmetic and file system. Used in `backend/src/config/logger.js`:

  ```js
  import path from "node:path";
  import fs from "node:fs";
  const logDir = path.resolve(process.cwd(), env.log.dir);
  ```

  `path.resolve(a, b)` joins path segments into an absolute path using the correct separator for the OS (never concatenate paths with `+ "/" +`). `fs.mkdirSync` / `fs.accessSync` are the *synchronous* file APIs — acceptable here because they run **once at boot**, not per-request. Synchronous I/O during request handling would block the loop; synchronous I/O during startup is fine and simpler.

- **`node:crypto`** — cryptography and randomness. Used in `backend/src/middlewares/requestId.js`:

  ```js
  import { randomUUID } from "node:crypto";
  req.id = incoming || randomUUID();
  ```

  `randomUUID()` produces a v4 UUID from a cryptographically secure random source — the right tool for IDs that must be unguessable. Never build IDs from `Math.random()`, which is predictable.

### The `process` object

`process` is a global (no import needed) representing the running OS process itself. Your codebase touches nearly all of its important faces:

| API | What it does | Where your code uses it |
|---|---|---|
| `process.env` | All environment variables, as strings | `backend/src/config/env.js` — everywhere |
| `process.exit(code)` | Terminate immediately; `0` = success, non-zero = failure | `env.js` (missing config), `index.js` (shutdown paths) |
| `process.on(signal, fn)` | React to OS signals / process events | `index.js` — `SIGTERM`, `SIGINT`, `unhandledRejection`, `uncaughtException` |
| `process.cwd()` | The directory you launched Node *from* | `logger.js` — resolving the log directory |
| `process.uptime()`, `process.memoryUsage()` | Introspection | health controller |

Key subtlety: **everything in `process.env` is a string**. `PORT=8080` in `.env` arrives as `"8080"`. That is precisely why `env.js` has `num()`, `bool()`, and `list()` coercion helpers (Chapter 2.4).

### npm scripts and nodemon

`npm run <name>` looks up `<name>` in the `scripts` object of `package.json` and runs it in a shell, with `node_modules/.bin` on the `PATH` (which is why `nodemon` works without a global install). Your real scripts, from `backend/package.json`:

```json
"scripts": {
  "start": "node src/index.js",
  "dev": "nodemon src/index.js",
  "seed": "node src/seeds/index.js",
  "test": "node --test \"src/tests/**/*.test.js\"",
  "lint": "eslint .",
  "format": "prettier --write \"src/**/*.js\""
}
```

- `npm start` — production style: run the entrypoint once with plain `node`. If it crashes, it stays down (in production, a supervisor like Docker/systemd/Kubernetes restarts it).
- `npm run dev` — development: **nodemon** watches your source files and restarts the process on every save. Node itself never "hot reloads"; a restart is a full process death and re-boot, which is exactly why the boot sequence in `index.js` (Chapter 2.5) matters — you exercise it hundreds of times a day.
- `npm test` — uses Node's **built-in test runner** (`node --test`), no Jest/Mocha dependency. It runs every file matching `src/tests/**/*.test.js`.
- Also note `"engines": { "node": ">=20.0.0" }` — a declaration that this code relies on Node 20+ features.

## In your codebase (the walkthrough)

Trace one request to see every runtime concept fire in order. Suppose a client calls `GET /api/tasks`:

1. **OS → libuv**: bytes arrive on the TCP socket the OS opened when `server.listen(env.app.port, ...)` ran (`backend/src/index.js:30`). libuv's *poll* phase notices.
2. **libuv → Node's http module**: `node:http` parses the bytes into a request object and invokes the handler passed to `http.createServer(app)` (`index.js:13`) — your Express app.
3. **Express (still synchronous JS)** runs the middleware chain in `backend/src/app.js` — request ID, helmet, CORS, body parsing… all plain synchronous-or-callback JS on the main thread.
4. **First `await`**: the tasks service runs
   ```js
   const tasks = await StudyTask.find({ user: userId, date: day }).sort({ time: 1 });
   ```
   (`backend/src/services/tasks.service.js:15`). Mongoose serializes a query, hands it to the MongoDB driver, which writes it to another TCP socket. **The function suspends. The event loop is free.** A second, third, hundredth request can now be processed while MongoDB thinks.
5. **MongoDB replies** → libuv's poll phase fires the driver's callback → the promise resolves → the *continuation* of `listTasks` (everything after the `await`) is queued as a microtask and runs.
6. `res.status(200).json(data)` serializes the response; `node:http` writes bytes back to the socket via libuv.

One thread. Thousands of concurrent requests. Zero of your code running in parallel — just cleverly interleaved waiting.

Also notice the boot-time/request-time split as a *pattern* across the codebase:

- **Boot-time, synchronous is fine**: `dotenv.config()` reads `.env` from disk synchronously (`env.js:5`); `fs.mkdirSync` in `logger.js:17`. Runs once; blocking for a millisecond at startup costs nothing.
- **Request-time, everything async**: every controller is wrapped in `asyncHandler`, every service function is `async`, every DB call is `await`ed. Nothing blocks the loop while a user waits.

## Pitfalls & gotchas

- **Forgetting `.js` in imports.** With `"type": "module"`, `import { env } from "./config/env"` throws `ERR_MODULE_NOT_FOUND`. Every relative import in this codebase ends in `.js` — copy that habit.
- **`process.env` values are always strings.** `if (process.env.SWAGGER_ENABLED)` is `true` even for the string `"false"` (non-empty strings are truthy!). This is the entire reason `env.js` has a `bool()` helper.
- **Blocking the event loop.** `fs.readFileSync` inside a route handler, giant synchronous loops, `JSON.stringify` of huge objects — all freeze every concurrent request. Boot-time sync is fine; request-time sync I/O is a bug.
- **`setTimeout(fn, 0)` is not "immediately".** Microtasks (promises, `process.nextTick`) always run first. Predicting output order is a classic interview question — see the exercise below.
- **Module side effects run on import.** Importing `env.js` *executes* it: `dotenv.config()`, `ensureRequired()`, possibly `process.exit(1)` — all before a single route exists. Import order is execution order; ES module imports are also **cached** (imported once, shared by every importer), which is exactly how `env` and `logger` behave as singletons.
- **A crashed Node process does not restart itself.** nodemon restarts you in dev; in production that's the job of Docker/Kubernetes/systemd. `process.exit(1)` in `index.js` is a *request* to be restarted by the supervisor.

## Exercises

Answers in [SOLUTIONS.md](./SOLUTIONS.md).

1. **(Comprehension)** In your own words: which of the three layers (V8 / libuv / Node bindings) is responsible for (a) running `array.map(...)`, (b) noticing that MongoDB's reply arrived on a socket, (c) exposing `randomUUID` to your code?
2. **(Prediction)** What does this print, and in what order? Explain each line's queue.
   ```js
   console.log("1");
   setTimeout(() => console.log("2"), 0);
   Promise.resolve().then(() => console.log("3"));
   process.nextTick(() => console.log("4"));
   console.log("5");
   ```
3. **(Code reading)** Open `backend/src/index.js` line 13. Explain why `http.createServer(app)` works — what must `app` be, for this call to make sense? Verify your answer by finding what `createApp()` returns in `backend/src/app.js`.
4. **(Prediction)** `backend/src/config/logger.js` line 13 uses `process.cwd()`. You run the server two ways: `cd backend && npm run dev` versus `node backend/src/index.js` from the repo root. Where does the `logs/` directory land in each case, and why?
5. **(Comprehension)** Why is it acceptable that `fs.mkdirSync` (synchronous, blocking) is used in `logger.js`, but it would be a bug to call `fs.readFileSync` inside `listTasks` in `backend/src/services/tasks.service.js`?
6. **(Code reading)** In `backend/package.json`, compare the `start` and `dev` scripts. What exactly does nodemon add, and why is it wrong for production?
7. **(Prediction)** A teammate adds this route: `router.get("/report", (req, res) => { let s = 0; for (let i = 0; i < 5e9; i++) s += i; res.json({ s }); })`. What happens to *other* users' requests while `/report` runs, and why doesn't `async`/`await` help here?
8. **(Safe experiment)** Run `node -e 'console.log(typeof process.env.PORT, process.env.PORT)'` with and without `PORT=8080` prefixed. What type is the value in each case, and which helper in `backend/src/config/env.js` exists because of this?

---

Next: [Module 2.2 — Express Fundamentals](./02-express-fundamentals.md)
