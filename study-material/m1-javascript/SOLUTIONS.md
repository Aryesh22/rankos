# Module 1 — Worked Solutions

> **Goal:** Full answers, with reasoning, for every exercise in chapters 1.1–1.5. Attempt each exercise honestly before reading — the struggle is where the learning happens.

## Chapter 1 — Values, Variables & Types

### 1.1 REPL warm-up

| Expression | Result | Why |
|---|---|---|
| `"5" + 3` | `"53"` | `+` with a string concatenates; `3` is coerced to `"3"` |
| `"5" - 3` | `2` | `-` has no string meaning, so `"5"` is coerced to `5` |
| `null ?? "x"` | `"x"` | `null` is nullish → fallback |
| `undefined ?? "x"` | `"x"` | `undefined` is nullish → fallback |
| `0 \|\| 10` | `10` | `0` is falsy, `\|\|` falls back |
| `0 ?? 10` | `0` | `0` is not nullish, `??` keeps it |
| `"" \|\| "empty"` | `"empty"` | `""` is falsy |
| `"" ?? "empty"` | `""` | `""` is not nullish |

The bottom four rows *are* the `||` vs `??` distinction — memorize this table.

### 1.2 Falsy list

`false`, `0`, `""`, `null`, `undefined`, `NaN`.

- `Boolean([])` → `true` — arrays are objects, all objects are truthy, even empty ones.
- `Boolean("false")` → `true` — any non-empty string is truthy; the *characters* "false" don't matter.
- `Boolean(NaN)` → `false` — NaN is on the falsy list.

### 1.3 Read the code — `createTask` with `{ "title": "Mock test", "subject": "Physics", "minutes": 0, "date": "" }`

From `backend/src/services/tasks.service.js`:

- `date` → **today's date string** (e.g. `"2026-08-11"`). `body.date` is `""` (falsy), so `body.date || todayStr()` takes the fallback.
- `minutes` → **`0`**. `body.minutes ?? 0` — `0` is not nullish, so the real value survives. (With `||` the result would coincidentally also be `0`, but only because the fallback happens to be `0` too.)
- `type` → **`"Concept"`**. `body.type` is absent → `undefined`, which is falsy → `body.type || "Concept"` falls back.
- `time` → **`null`**. `body.time` is absent → `undefined`, which is nullish → `body.time ?? null` produces the explicit `null` ("no scheduled time, on purpose").

### 1.4 `time: body.time ?? null` vs `body.time || null`

**Case for `||`:** an empty string is not a meaningful time, so coercing `""` → `null` normalizes the data — the DB never stores a junk value, and every consumer can rely on "either a time string or null."

**Case for keeping `??`:** `??` expresses the narrow intent "default only when absent," and silently rewriting client input can mask frontend bugs — if the UI sends `""`, you may *want* validation to reject it loudly rather than have the service quietly launder it. In a real API, the better fix is explicit validation of the time format, making the operator choice moot. (This is a genuine design discussion — there is no single right answer.)

### 1.5 Predict the log

For `"boom"`: `reason?.stack` — `"boom"` is not nullish, so `?.` proceeds and reads `.stack` off a string → `undefined`. Then `undefined || reason` → `"boom"`. Logged: `[process] unhandledRejection: boom`.

For `undefined`: `undefined?.stack` short-circuits to `undefined`; `undefined || undefined` → `undefined`; template literals stringify it, logging `[process] unhandledRejection: undefined`. Note the crucial part: **neither case crashes**, which is the whole point of `?.` in a last-resort error handler.

### 1.6 Fix the bug

The problem: `retries || 3` treats the legitimate value `0` as missing.

```js
// Fix 1 — nullish coalescing:
retries = retries ?? 3;

// Fix 2 — default parameter (triggers only on undefined):
function fetchWithRetries(url, retries = 3) { ... }
```

Subtle difference: fix 1 also defaults on an explicit `null`; fix 2 defaults only on `undefined` and would pass `null` through. Either fixes the `0` case.

### 1.7 Your own `num`

```js
function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
num("8080", 1);      // 8080
num("abc", 1);       // 1   (NaN → fallback)
num("", 1);          // 1?  — careful! Number("") is 0, which IS finite → returns 0
num(undefined, 1);   // 1   (Number(undefined) is NaN)
num("Infinity", 1);  // 1   (finite check rejects Infinity)
```

The `""` row is the interesting one: the real `env.js` `num` also returns `0` for an empty string. In practice env vars that are set-but-empty are rare, and `ensureRequired` catches the required ones — but noticing this edge case means you *really* read the function.

### 1.8 Your own `bool`

```js
function bool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}
bool("TRUE");     // true  — lowercased before comparing
bool("0");        // false — not in the accepted list
bool("no");       // false
bool(0);          // false — String(0) → "0", not in list
bool(undefined);  // false (the fallback)
```

`String(value)` first because the input might not be a string (a number, a boolean from a test) — `.toLowerCase()` exists only on strings, so calling it directly on `0` would throw `TypeError: value.toLowerCase is not a function`.

## Chapter 2 — Functions, Scope & Closures

### 2.1 Rewrite both ways

```js
// Arrow → declaration:
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Declaration → single-expression arrow (the ternary is one expression):
const num = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
```

Note the arrow version computes `Number(value)` twice — a small cost of forcing everything into one expression. Sometimes the braced body with a `const` is simply better; brevity is not a virtue by itself.

### 2.2 Predict the output

Prints `15 20 15`.

- `a = make()` creates a backpack with `n = 10`. `a()` sets `n = 15` and returns it; the second `a()` sets `n = 20` — **same backpack, the variable persisted between calls**.
- `b = make()` is a *fresh* call to `make`, so a fresh `n = 10` → `b()` returns `15`.

Each call to the factory creates an independent closure.

### 2.3 `asyncHandler` in your own words

`asyncHandler` receives one argument, `fn` — an async route function shaped `(req, res, next)`. It returns a *new* function with the same shape, which Express will store and call on each matching request. When created, the returned function packs `fn` into its closure ("backpack"), so even though `asyncHandler` itself finished executing during app startup, the wrapper still holds a live reference to `fn` an hour later. On every request it calls `fn`, wraps the result in `Promise.resolve`, and routes any rejection into `next`, Express's error channel.

### 2.4 Count the closures — `backend/src/index.js`

| Function | Captured from an outer scope |
|---|---|
| `bootstrap` | `server` (also `env`, `logger` — module-level imports) |
| `shutdown` | `shuttingDown` (reads *and writes*), `server` |
| the `setTimeout` callback inside `shutdown` | nothing local — only module-level `logger` |
| the `server.close(async () => ...)` callback | `forceTimer` (to cancel it on success) |
| `(reason) => ...` unhandledRejection handler | module-level `logger` |
| `(err) => ...` uncaughtException handler | `shutdown` |
| each `() => shutdown(sig)` signal listener | `shutdown` and its own `sig` |
| the `.catch((err) => ...)` on `bootstrap()` | module-level `logger` |

Key observation: `shutdown` and both signal listeners share the *same* `shuttingDown` variable — that's what makes the "only shut down once" guard work.

### 2.5 Build a factory

```js
const makePrefixer = (prefix) => (msg) => prefix + msg;

const logLine = makePrefixer("[server] ");
logLine("started");   // "[server] started"
```

Structurally identical to `asyncHandler`: outer function takes configuration, inner function does the work, closure connects them.

### 2.6 Spot the bug

`process.on(sig, shutdown(sig))` **calls `shutdown` right now** (the parentheses execute it) and passes its *return value* (a promise) as the listener. So shutdown runs during startup — logging "SIGTERM received," closing the not-yet-open server. The fix is passing a function that calls it later:

```js
["SIGTERM", "SIGINT"].forEach((sig) => process.on(sig, () => shutdown(sig)));
```

Rule: event registration APIs want a *function value*, not a function *call*.

### 2.7 `timed`

```js
const timed = (fn) => (...args) => {
  const start = Date.now();
  const result = fn(...args);
  console.log(`took ${Date.now() - start}ms`);
  return result;
};

const slowAdd = timed((a, b) => { for (let i = 0; i < 1e8; i++); return a + b; });
slowAdd(2, 3);   // logs e.g. "took 62ms", returns 5
```

`(...args)` collects any number of arguments into an array; `fn(...args)` spreads them back out. The wrapper is transparent: same inputs, same output, plus a side effect — exactly the `asyncHandler` architecture (which adds error-routing instead of timing).

### 2.8 Challenge — private state

```js
function makeBankAccount(initial) {
  let balance = initial;
  return {
    deposit(amount) {
      balance += amount;
      return balance;
    },
    getBalance() {
      return balance;
    },
  };
}

const acct = makeBankAccount(100);
acct.deposit(50);      // 150
acct.getBalance();     // 150
acct.balance;          // undefined — not a property!
```

`balance` is a *variable in a closed-over scope*, not a property on the returned object. Outside code can only reach names that are exported on the object; there is no syntax in JavaScript to reach into another function's scope. The two methods share one backpack, so they see each other's updates. This is privacy by scoping — classes only got truly private fields (`#balance`) recently; closures have done it forever.

## Chapter 3 — Objects, Arrays & Their Methods

### 3.1 REPL drills

| Expression | Result | Note |
|---|---|---|
| `[1, 2, 3].map(n => n * n)` | `[1, 4, 9]` | transform each |
| `[1, 2, 3, 4].filter(n => n % 2 === 0)` | `[2, 4]` | keep evens |
| `[5, 3, 9].find(n => n > 4)` | `5` | *first* match, not all |
| `[1, 2].some(n => n > 5)` | `false` | none qualify |
| `[1, 2].every(n => n > 0)` | `true` | all qualify |
| `[[1], [2, 3]].flat()` | `[1, 2, 3]` | one level un-nested |
| `[100, 25, 3].sort()` | `[100, 25, 3]` | string sort! `"100" < "25" < "3"` — it *looks* untouched but is "sorted" alphabetically. `.sort((a, b) => a - b)` gives `[3, 25, 100]` |

### 3.2 Destructure it

```js
const { done, id: taskId, meta: { source }, priority = "Low" } = res;
// done → true, taskId → "t1", source → "api", priority → "Low"
```

Caution with nested destructuring: if `res.meta` could be `undefined`, `{ meta: { source } }` throws. Guard with a default: `meta: { source } = {}`.

### 3.3 `new ApiError(404, "Task not found").toJSON()` by hand

Constructor: `statusCode = 404` (truthy, kept); no options object passed → destructuring default `= {}` kicks in → `code` is `undefined`, so `this.code = undefined || ApiError.defaultCodeFor(404)` → `map[404]` → `"NOT_FOUND"`. `details` and `fields` are `undefined`; `isOperational` defaults `true`.

`toJSON()` returns:

```js
{ code: "NOT_FOUND", message: "Task not found" }
```

`details`/`fields` are absent — not `undefined`-valued — because `...(this.details ? { details: this.details } : {})` spreads an **empty object** when the value is falsy, contributing zero keys. The response body stays clean.

### 3.4 Predict the config

- `env.cors.origin` → `["http://localhost:5173", "https://rankos.app"]`. The value isn't the literal `"*"`, so `list()` splits on commas and trims each piece (note the space before `https` disappears).
- `env.app.port` → `8080`. `PORT` is unset → `Number(undefined)` is `NaN` → not finite → fallback.
- `env.redis.isConfigured` → `false`. Getter computes `Boolean(undefined || undefined)`.
- `env.smtp.from` → `"RankOS <no-reply@rankos.app>"` — the `||` default, since `EMAIL_FROM` is unset.

### 3.5 Rebuild `list`

```js
function list(value, fallback = []) {
  if (!value) return fallback;
  return String(value)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}
list(" a, b ,,c ");   // ["a", "b", "c"]  — the empty piece between ",," is dropped by filter(Boolean)
list("");             // []  (falsy → fallback)
list(undefined);      // []
```

The step people forget is `filter(Boolean)` — without it, `"a,,b"` yields a ghost `""` element that later code trips over.

### 3.6 Reduce practice

```js
// (a) total minutes
tasks.reduce((total, t) => total + t.minutes, 0);   // 120

// (b) minutes per subject — computed key + spread accumulator
tasks.reduce(
  (acc, t) => ({ ...acc, [t.subject]: (acc[t.subject] ?? 0) + t.minutes }),
  {},
);  // { Physics: 60, Math: 60 }
```

Walk (b): start `{}` → Physics 40 → `{Physics: 40}` → Math 60 → `{Physics: 40, Math: 60}` → Physics 20: `acc["Physics"] ?? 0` is `40`, so `{Physics: 60, Math: 60}`. Note `?? 0` handling the first-time-seen subject — a chapter-1 operator earning its keep.

### 3.7 Immutable update

```js
const updated = {
  ...day,
  tasks: day.tasks.map((t) => (t.id === 1 ? { ...t, done: true } : t)),
};
```

Three new things are created: the outer object, the tasks array (`map` always returns new), and the one changed task object. Untouched tasks are *shared* — that's fine and efficient; the rule is only "never mutate," not "clone everything." Verify: `day.tasks[0].done` is still `false`.

### 3.8 Spot the vulnerability

`{ ...body, user: userId }` keeps `user` safe — it comes *after* the spread, so it always overwrites anything the client sent. The field that becomes abusable is **`done`**: the original code hardcodes `done: false`, but with the spread a client can send `{ "done": true, ... }` and create a task that's born completed — corrupting streaks, progress stats, anything derived from completion. (A client could also inject unexpected schema fields or an `_id`.) Moral: build documents from an explicit allowlist, exactly as the real `createTask` in `backend/src/services/tasks.service.js` does.

## Chapter 4 — Async Mastery

### 4.1 Ordering drill

Prints `a`, `d`, `c`, `b`.

`a` and `d` are the current "ticket" — synchronous code always finishes first. Then queued work runs: promise callbacks (`c`) live in the **microtask** queue, which is drained *before* timer callbacks (`b`) in the **macrotask** queue. You don't need the queue taxonomy daily; you *do* need "sync first, then promise callbacks, then timers."

### 4.2 Three styles

```js
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// (a) .then chaining
console.log("one");
delay(500).then(() => console.log("two"));

// (b) async/await
async function run() {
  console.log("one");
  await delay(500);
  console.log("two");
}
run();
```

`delay` is the standard promise-wrapper idiom: `new Promise((resolve, reject) => ...)` hands you the controls; you call `resolve` when the callback-style API finishes. Note (b) reads top-to-bottom like sync code — that's the entire sales pitch of `await`.

### 4.3 Forgotten `await` in `patchTask`

Without `await`, `tasksService.setTaskDone(...)` returns a **pending promise**, and execution continues immediately:

1. `res.status(200).json(result)` runs at once — `result` is a Promise, which serializes as `{}`. The client receives `200 OK` with an empty object, regardless of reality.
2. Later the service's query finishes; for a bad ID it does `throw ApiError.notFound("Task not found")`, rejecting the service's promise.
3. `asyncHandler`'s `.catch(next)` is watching the **controller fn's** promise — which already fulfilled in step 1. The service promise was never stitched into that chain, so its rejection is attached to nothing.
4. The `ApiError` ends up in `process.on("unhandledRejection", ...)` in `backend/src/index.js` — logged as a process-level warning, invisible to the client, who believes the patch succeeded.

The single keyword `await` is what connects service → controller → asyncHandler → errorHandler.

### 4.4 Sequential vs parallel timing

```js
async function slow() {
  console.time("slow");
  await delay(300); await delay(300); await delay(300);
  console.timeEnd("slow");   // ≈ 900ms
}
async function fast() {
  console.time("fast");
  await Promise.all([delay(300), delay(300), delay(300)]);
  console.timeEnd("fast");   // ≈ 300ms
}
```

Sequential: each `await` waits for the previous to finish → times add. Parallel: all three timers start before any awaiting happens → times overlap; total ≈ the longest one.

### 4.5 Parallelizing `bootstrap`

`connectRedis()` and `verifyEmailTransport()` are independent of each other and both non-fatal, so:

```js
await Promise.all([connectRedis(), verifyEmailTransport()]);
```

is safe. `configureCloudinary()` and `initJobs()` aren't candidates — they're synchronous. **`connectDatabase()` must stay first and alone**: the behavioral argument is fail-fast ordering — if Mongo is unreachable, the `await` throws before the server ever calls `server.listen`, so the process exits (via `bootstrap().catch`) instead of accepting HTTP requests it cannot serve. Merging it into a `Promise.all` with optional services would still fail, but you'd have also spent time starting things you're about to tear down — and, more importantly, later steps (jobs, sockets) are entitled to assume the DB exists.

### 4.6 `Promise.all` vs `allSettled`

The `Promise.all` version **rejects with `Error("boom")`** essentially immediately (the rejected promise is already settled) — the `await` throws, and the eventual `"a"`/`"c"` values are discarded (the delays still run; nobody observes them).

```js
const results = await Promise.allSettled([...same three...]);
// after ~200ms:
// [ { status: "fulfilled", value: "a" },
//   { status: "rejected",  reason: Error("boom") },
//   { status: "fulfilled", value: "c" } ]
```

`allSettled` never throws; you inspect each entry's `status`. Use it when partial success is meaningful (e.g., closing multiple resources during shutdown).

### 4.7 Fix the loop

`forEach` calls the async callback and **ignores the returned promise** — it has no idea the callback is async. All creates fire, `forEach` returns instantly, `"all saved!"` logs while zero saves have finished; any failure becomes an unhandled rejection.

```js
// Sequential (one at a time, preserves order, simplest to reason about):
async function saveAll(tasks) {
  for (const t of tasks) {
    await StudyTask.create(t);
  }
  console.log("all saved!");
}

// Parallel (all at once, fastest; map returns promises, all awaits them):
async function saveAll(tasks) {
  await Promise.all(tasks.map((t) => StudyTask.create(t)));
  console.log("all saved!");
}
```

### 4.8 Mini `asyncHandler` + the `Promise.resolve` question

```js
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
```

Why not `fn(req, res, next).catch(next)`? Because `fn` might not return a promise. Two failure cases for the simpler version:

```js
// 1. A synchronous handler — returns undefined:
asyncHandler((req, res) => { res.send("hi"); });
// undefined.catch → TypeError: Cannot read properties of undefined (reading 'catch')

// 2. A synchronous THROW before any promise exists:
asyncHandler((req, res) => { throw new Error("sync boom"); });
// the call itself throws; there's no promise to .catch on
```

`Promise.resolve(x)` normalizes: a promise passes through unchanged; a plain value becomes a fulfilled promise — so `.catch` is always legal. (Case 2 is technically only fixed by `Promise.resolve` when the throw happens inside an `async` fn; a fully bulletproof wrapper would also add `try/catch` around the call. The real one accepts that trade-off — route handlers there are always `async`.)

## Chapter 5 — Modules, Classes & Modern JS

### 5.1 Import audit — `backend/src/controllers/tasks.controller.js`

```js
import { HTTP_STATUS } from "../constants/index.js";          // named
import { asyncHandler } from "../utils/asyncHandler.js";      // named
import * as tasksService from "../services/tasks.service.js"; // namespace
```

A default import in the backend: `import apiRouter from "./routes/index.js"` in `backend/src/app.js` (also `import http from "node:http"` and the library imports like `import express from "express"` in the same files).

### 5.2 Predict the failure

- Extension dropped: Node ESM refuses to guess — the process fails at startup with `ERR_MODULE_NOT_FOUND` (`Cannot find module '.../utils/asyncHandler'`). Loud and immediate.
- `import asyncHandlers from "../utils/asyncHandler.js"`: **it works** — that's the sneaky part. The file has a default export (`export default asyncHandler`), and a default import binds it to *whatever local name you write*, typo included. No error, just a misleadingly named binding. Named imports are checked against real export names; default imports are not — one reason some teams prefer named exports everywhere.

### 5.3 What `extends Error` + `super(message)` provide

Inherited for free: the `.message` property (set by `super(message)`), the `.stack` trace, `Error`'s `toString` behavior, and truthy `instanceof Error` / `instanceof ApiError` checks (which the centralized error handler relies on to distinguish operational errors from bugs). `ApiError` sets everything else itself: `name`, `statusCode`, `code`, `details`, `fields`, `isOperational`, `cause`.

`defaultCodeFor` is `static` because it's a pure lookup (status number → code string) that needs no instance state — and it's called *during construction* (`ApiError.defaultCodeFor(this.statusCode)`), when treating it as a utility of the class rather than behavior of an instance is the honest description.

### 5.4 Error subclass

```js
class RateLimitError extends ApiError {
  constructor(retryAfterSeconds) {
    super(429, "Too many requests", { details: { retryAfterSeconds } });
    this.name = "RateLimitError";
  }
}

const e = new RateLimitError(30);
e.toJSON();
// { code: "RATE_LIMITED", message: "Too many requests", details: { retryAfterSeconds: 30 } }
```

`code` is `"RATE_LIMITED"` because we passed no `code` option, so `ApiError`'s constructor consulted `defaultCodeFor(429)`. The `toJSON` that ran is **`ApiError`'s** — `RateLimitError` doesn't define one, so the lookup walks up the inheritance chain. `details` appears because it's truthy, via the conditional spread.

### 5.5 JSON round-trip

`JSON.parse(JSON.stringify({ when: new Date(), fn: () => 1, missing: undefined, time: null }))` gives:

```js
{ when: "2026-08-11T…Z", time: null }
```

- `when`: `Date` has a built-in `toJSON` → ISO **string**; after parsing it stays a string (round trip does *not* revive Dates).
- `fn`: functions aren't representable in JSON → key silently dropped.
- `missing`: `undefined` isn't representable → key silently dropped.
- `time`: `null` is a real JSON value → preserved.

### 5.6 The `toJSON` hook

`console.log(e.statusCode)` prints `404` — `statusCode` is an ordinary property on the instance. But `JSON.stringify(e)` prints only `{"code":"NOT_FOUND","message":"Task not found"}` because stringify notices the `toJSON()` method and serializes **its return value** instead of the raw object — and `toJSON` deliberately returns only the client-safe envelope. Same object, two views: full internally, filtered on the wire.

### 5.7 Date drill

```js
// (a) today
new Date().toISOString().slice(0, 10);                        // "2026-08-11"

// (b) yesterday — now minus 86,400,000 ms (24h)
new Date(Date.now() - 86400000).toISOString().slice(0, 10);   // "2026-08-10"

// (c)
"2026-08-11" > "2026-08-09"   // true
```

(c) works because the format is **fixed-width, zero-padded, biggest-unit-first** (year, then month, then day): comparing character by character (how string `>` works) is then identical to comparing chronologically. `"2026-08-9"` (unpadded) would break it — padding is the load-bearing detail. This is exactly why `todayStr()` in `tasks.service.js` standardizes on ISO slices for the `date` field.

### 5.8 TS reading test — `rankos-ai-mentor/src/lib/api.ts`

- **(a)** `T` in `apiFetch<T>` is a placeholder for "the type of the parsed response body." The **caller** decides it at each call site — e.g. `apiFetch<StudyTask[]>("/tasks")` — and TS then types the awaited result accordingly. The function body never knows or cares what `T` is; the runtime behavior is identical for every `T` (types are erased).
- **(b)** In `RequestOptions`, **all four** properties are optional: `method?`, `body?`, `signal?`, `headers?` — the `?` after the name is the marker. That's why `apiFetch(path)` with no options object at all is legal (helped by the `= {}` default).
- **(c)** `error is ApiError` is a **type predicate**: it tells the compiler "when this function returns `true`, treat the argument as an `ApiError` from here on." So after `if (isApiError(err)) { ... }`, TS lets you access `err.status` and `err.fields` without complaint — an `instanceof` check with compile-time superpowers.
- **(d)** The conditional spread inside `apiFetch`:

  ```ts
  ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
  ```

  Same pattern as `ApiError.toJSON()` in the backend: include the header only when there is a body to describe. (Note it checks `!== undefined` rather than truthiness — a body of `0` or `""` should still get the header. Chapter 1 thinking, in TypeScript clothing.)

---

Back to the chapters: [1.1](./01-values-variables-types.md) · [1.2](./02-functions-scope-closures.md) · [1.3](./03-objects-arrays-methods.md) · [1.4](./04-async-mastery.md) · [1.5](./05-modules-classes-modern-js.md)
