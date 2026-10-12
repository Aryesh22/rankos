# Module 1.5 — Modules, Classes & Modern JS

> **Goal:** Read and write ES modules (named vs default exports), understand classes well enough to dissect `ApiError` and recognize mongoose models, use JSON and Date confidently, and recognize TypeScript syntax when you open the frontend.

## Concepts

### 1. ES Modules — how files talk to each other

Every file in `backend/src/` is a **module**: its top-level variables are private unless **exported**, and it pulls in others' exports with **import**. Two export styles exist, and your codebase uses both:

**Named exports** — a module can have many; import them by exact name in braces:

```js
// exporting (env.js does this)
export const env = Object.freeze({ ... });

// importing (app.js does this)
import { env } from "./config/env.js";
```

**Default export** — one per module, no name required; the importer picks any name, no braces:

```js
// exporting (app.js, last line)
export default app;

// importing — braces gone, name is your choice
import app from "./app.js";
import whateverYouLike from "./app.js";   // works, but don't confuse readers
```

Many of your files export *both*, ending like `backend/src/utils/ApiError.js`:

```js
export class ApiError extends Error { ... }   // named, at the definition
...
export default ApiError;                       // default, at the bottom
```

so importers can use either form. Two more import shapes you'll meet daily:

```js
// Namespace import — everything the module names, as one object:
import * as tasksService from "../services/tasks.service.js";   // tasks.controller.js
tasksService.listTasks(...)

// Node built-ins use the node: prefix (index.js):
import http from "node:http";
```

Details that matter in this repo:

- **Extensions are mandatory in Node ESM**: `"./app.js"`, not `"./app"`. (The frontend's bundler relaxes this — you'll see `"@/types"` there.)
- Imports are **live, read-only views** — you can't reassign an imported binding.
- **Modules run once.** The first import executes the file top-to-bottom; every later import gets the *same, cached* result. That's why `export const app = createApp();` in `app.js` and the frozen `env` are effectively singletons shared by the whole app — and why merely importing `env.js` triggers its validation side effects (`dotenv.config()`, `ensureRequired()`).
- Typo trap: importing a name the module doesn't export (`import { Env }`) fails; a wrong *default* import just silently gives you the default under a misleading name.

### 2. Classes — blueprints for objects

A **class** bundles data (properties) and behavior (methods) into a blueprint; `new` stamps out **instances**:

```js
class Timer {
  constructor(label) {         // runs at `new Timer("db")`
    this.label = label;        // `this` = the instance under construction
    this.start = Date.now();
  }
  elapsed() {                  // method — shared by all instances
    return Date.now() - this.start;
  }
  get seconds() {              // getter — computed, read without ()
    return this.elapsed() / 1000;
  }
  static now() {               // static — on the CLASS, not instances
    return new Timer("anon");
  }
}

const t = new Timer("db");
t.elapsed();     // instance method
t.seconds;       // getter — no parentheses
Timer.now();     // static method — no instance needed
```

**Inheritance**: `class Child extends Parent` — the child gets everything the parent has, adds or overrides pieces, and its constructor must call `super(...)` (the parent's constructor) before touching `this`.

Where you'll actually meet classes as a beginner: you'll *use* them (mongoose's `StudyTask.find(...)`, `new Date()`) and *extend* one particular family — **errors**.

### 3. Error classes — why `extends Error` matters

`throw` accepts anything, but throwing `Error` (or a subclass) buys you a **stack trace**, a conventional `.message`, and — the real prize — **`instanceof` checks** so `catch` blocks can react differently to different kinds of failure:

```js
try { ... } catch (err) {
  if (err instanceof ApiError) {
    // expected, safe-to-show failure → use err.statusCode
  } else {
    // unknown bug → mask as 500, log loudly
  }
}
```

That two-branch `catch` is precisely the contract described in the comment atop `ApiError.js`: operational errors are shown to clients; unexpected ones are masked as 500s in production. A custom error class is the *type tag* that makes the distinction possible.

### 4. JSON — the wire format

**JSON** (JavaScript Object Notation) is a text format for data — what actually travels in HTTP bodies. Two methods convert:

```js
JSON.stringify({ minutes: 90, time: null })   // '{"minutes":90,"time":null}'  object → text
JSON.parse('{"minutes":90}')                   // { minutes: 90 }               text → object
```

JSON is *stricter* than JS literals: keys must be double-quoted, no comments, no trailing commas, no `undefined` (it's dropped or becomes `null`), no functions, no `Date` objects (they become ISO strings). `JSON.parse` **throws** on malformed input — always guard it (see the frontend's `safeParse` below).

Magic hook: if an object has a **`toJSON()` method, `JSON.stringify` calls it** and serializes the return value instead. That's why `ApiError` defines `toJSON()` — when the error handler drops an `ApiError` into a response, it serializes as the clean `{ code, message, ... }` envelope, never leaking `stack` or `isOperational`.

In Express you rarely stringify by hand: `res.json(data)` (every controller in `tasks.controller.js`) stringifies and sets `Content-Type: application/json`; `express.json()` in `app.js` parses incoming bodies into `req.body`.

### 5. Date basics

```js
const d = new Date();            // now (a class instance!)
Date.now()                       // ms since 1970-01-01 UTC (a static method! just a number)
d.toISOString()                  // "2026-08-11T09:30:00.000Z" — the ONE format to standardize on
d.getFullYear(); d.getMonth();   // note: getMonth() is 0-based — January is 0!
new Date("2026-08-11")           // parse ISO strings (other formats: unreliable)
```

Your codebase's date needs are almost entirely this one idiom from `backend/src/services/tasks.service.js`:

```js
const todayStr = () => new Date().toISOString().slice(0, 10);
```

ISO datetime → first 10 characters → `"2026-08-11"`, a sortable, comparable, timezone-unambiguous (UTC) day key stored on every task. And `index.js` uses the number side: `setTimeout(..., 10000)` and TTLs in `env.js` (`durationMs` converting `"15m"` → `900000`) all speak milliseconds.

### 6. TypeScript at recognition level

Your frontend (`rankos-ai-mentor/`) is TypeScript: **JavaScript plus type annotations**, checked at build time, erased at runtime. Everything you learned in chapters 1-4 applies verbatim; TS adds a layer of labels. Learn to *read* these five constructs:

```ts
// 1. Type annotations — `name: Type` after variables/params/returns
function greet(name: string): string { return `hi ${name}`; }

// 2. Interfaces — the SHAPE an object must have
interface StudyTask { id: string; minutes: number; done: boolean; }

// 3. Union types — "one of these exact values"
type Difficulty = "Easy" | "Medium" | "Hard";

// 4. Optional properties — `?` means "may be absent"
interface TestSummary { score?: number; }

// 5. Generics — type PLACEHOLDERS, filled in by the caller
function first<T>(items: T[]): T | undefined { return items[0]; }
first<number>([1, 2, 3]);   // T = number; usually inferred, no need to write it
```

Mental model for generics: a function (or type) with a **parameter that is a type instead of a value**. `Promise<StudyTask[]>` reads as "a promise that fulfills with an array of StudyTask."

## In your codebase

### `ApiError` — a full class dissection — `backend/src/utils/ApiError.js`

```js
export class ApiError extends Error {
  constructor(statusCode, message, { code, details, fields, isOperational = true, cause } = {}) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
    this.code = code || ApiError.defaultCodeFor(this.statusCode);
    ...
    Error.captureStackTrace(this, this.constructor);
  }
```

Line by line:

- `extends Error` — inherits message/stack behavior and, critically, makes `err instanceof Error` *and* `err instanceof ApiError` both true.
- `super(message)` — runs `Error`'s constructor first, which stores `.message`. Mandatory before any `this.` line.
- `this.statusCode = ...`, `this.code = ...` — extra instance properties that plain `Error` lacks; the error handler reads them to build the HTTP response.
- `this.code = code || ApiError.defaultCodeFor(this.statusCode)` — a class calling its **own static method**, by class name, from inside the constructor.
- `Error.captureStackTrace(this, this.constructor)` — a Node nicety: trims the constructor itself out of the stack trace so it starts at the `throw` site.

Then the **static factory methods**:

```js
static notFound(message = "Resource not found", opts) {
  return new ApiError(HTTP_STATUS.NOT_FOUND, message, opts);
}
```

Compare the two ways to create the same error:

```js
throw new ApiError(404, "Task not found");     // caller must know 404
throw ApiError.notFound("Task not found");     // intent-named, status encapsulated
```

`tasks.service.js` uses the second — `if (!task) throw ApiError.notFound("Task not found");`. Factories on the class (`static`) make sense because you call them *to get* an instance — there's no instance yet to call a method on. Note also `ApiError.internal` sets `isOperational: false` (via the spread-override from chapter 3): "this one is a bug, not a client mistake."

Finally `toJSON()` — the `JSON.stringify` hook from Concepts §4 — completes the picture: this one class defines how errors are *created* (factories), *classified* (`isOperational`, `statusCode`), and *serialized* (envelope shape). One class, whole error policy.

### Getters and statics in a plain object — `backend/src/config/env.js`

Getters aren't classes-only. Inside the frozen `env` literal:

```js
smtp: {
  host: process.env.SMTP_HOST || null,
  ...
  get isConfigured() {
    return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
  },
},
```

`env.smtp.isConfigured` computes live, looks like data. And you've been using a *static method* since chapter 1 without noticing: `Number.isFinite(n)` in `num()` — a function living on the `Number` class itself.

### The module graph in action

Trace one request's worth of imports, bottom-up:

- `backend/src/utils/asyncHandler.js` → exports `asyncHandler` (named + default).
- `backend/src/services/tasks.service.js` → `import { ApiError } from "../utils/ApiError.js"` (named), exports four named functions *plus* a default object bundle.
- `backend/src/controllers/tasks.controller.js` → `import * as tasksService from "../services/tasks.service.js"` (namespace) and `import { asyncHandler } from "../utils/asyncHandler.js"` (named).
- `backend/src/app.js` → `import apiRouter from "./routes/index.js"` (default) and builds+exports the singleton `app` (named *and* default: `export const app = createApp(); export default app;`).
- `backend/src/index.js` → `import { app } from "./app.js"` (chose the named form!) and finally `export { server }` — a third export syntax: export an existing binding by name, after the fact.

Notice the flexibility bought by dual exports: `index.js` happens to use `{ app }`, a test file could use the default. Same object either way — modules are cached.

### TypeScript, for real — `rankos-ai-mentor/src`

From `rankos-ai-mentor/src/types/index.ts` — recognize constructs 2, 3, and 4:

```ts
export type ExamTrack = "JEE" | "NEET" | "UPSC" | "GATE" | "CAT" | "SSC" | "Banking";

export interface StudyTask {
  id: string;
  title: string;
  subject: string;
  minutes: number;
  type: "Concept" | "Practice" | "Revision" | "Mock" | "Analysis";
  done: boolean;
  time: string;
}
```

This is the frontend's contract for the very objects your backend's `tasks.service.js` creates — note `type` is a union of exactly the strings the backend defaults to (`body.type || "Concept"`). In `rankos-ai-mentor/src/lib/api.ts`, a **generic function** ties it together:

```ts
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
```

Read: "call me with a type `T`, and I promise to return a `Promise<T>`." A caller writes `apiFetch<StudyTask[]>("/tasks")` and TS then knows the result is an array of tasks. The same file has a TS-flavored twin of your backend error class:

```ts
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, status: number, code = "ERROR", fields?: Record<string, string>) {
    super(message);
    ...
```

Same `extends Error`, same `super(message)` — plus TS extras: declared property types, `readonly` (can't be reassigned after construction), `?` optional param, and `Record<string, string>` ("object whose keys and values are strings"). And its `safeParse` helper is the JSON-guard idiom from Concepts §4:

```ts
function safeParse(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
```

You can now read both halves of your stack.

## Pitfalls & gotchas

1. **Named-vs-default confusion.** `import ApiError from ...` vs `import { ApiError } from ...` — with dual-exporting files both work, but with single-export files the wrong one gives `undefined` (default-importing a named-only module) or an error. When imports are `undefined`, check the braces first.
2. **Extension-less imports break Node ESM.** `from "./app"` fails in the backend; the frontend's bundler allows it. Know which world each file lives in.
3. **Forgetting `new`.** `const err = ApiError(404, "x")` throws (`Class constructor cannot be invoked without 'new'`). Factories like `ApiError.notFound(...)` sidestep this — one more reason they exist.
4. **Forgetting `super()` in a subclass constructor** → `ReferenceError: Must call super constructor... before accessing 'this'`.
5. **Module side effects run on first import.** Importing `env.js` runs validation and can `process.exit(1)`; importing `app.js` *builds the app*. Import order and mere imports have consequences — this is why `index.js` imports are arranged the way they are.
6. **`JSON.parse` throws; `JSON.stringify` drops.** Parse inside try/catch (like `safeParse`); know that `undefined` and functions vanish when stringifying, and `Date`s become strings that won't revive as `Date`s on parse.
7. **`getMonth()` is 0-based.** August is month `7`. Off-by-one date bugs are a rite of passage — prefer `toISOString().slice(0, 10)` manipulation, like `todayStr()`.
8. **TS types don't exist at runtime.** An `interface` can't validate an API response — it's a compile-time promise. If the backend sends the wrong shape, TS won't catch it at runtime; that's what server-side validation is for.

## Exercises

Solutions in [SOLUTIONS.md](./SOLUTIONS.md) under "Chapter 5".

1. **Import audit.** Open `backend/src/controllers/tasks.controller.js` and classify each of its three imports: named, default, or namespace? Then find one file in the backend that uses a default import (hint: `app.js`'s router import).
2. **Predict the failure.** What exactly happens with `import { asyncHandler } from "../utils/asyncHandler"` (extension dropped) in the backend? And with `import asyncHandlers from "../utils/asyncHandler.js"` (misspelled default import) — error, or something sneakier?
3. **Read the code.** In `backend/src/utils/ApiError.js`, list everything `ApiError` gains from `extends Error` + `super(message)` that it doesn't set itself. Then explain in two sentences why `defaultCodeFor` is `static` rather than an instance method.
4. **Build an error subclass.** Write `class RateLimitError extends ApiError` whose constructor takes only `retryAfterSeconds` and calls `super` with status 429, message `"Too many requests"`, and `details: { retryAfterSeconds }`. Then create one and call `.toJSON()` on it by hand — what comes out, and which class's `toJSON` ran?
5. **JSON round-trip.** In the REPL, run `JSON.parse(JSON.stringify({ when: new Date(), fn: () => 1, missing: undefined, time: null }))`. Explain each property's fate.
6. **`toJSON` hook.** Create `const e = ApiError.notFound("Task not found")` (copy the class into the REPL, stubbing `HTTP_STATUS`/`ERROR_CODES` with plain values) and compare `console.log(e.statusCode)` with `JSON.stringify(e)`. Why does `statusCode` appear in one and not the other?
7. **Date drill.** Using only `new Date`, `toISOString`, and `slice`: (a) reproduce `todayStr()` from `tasks.service.js`; (b) compute yesterday's `YYYY-MM-DD` (hint: `Date.now() - 86400000`); (c) explain why string comparison `"2026-08-11" > "2026-08-09"` correctly compares these dates.
8. **Challenge — TS reading test.** Open `rankos-ai-mentor/src/lib/api.ts` and answer: (a) what does `apiFetch<T>`'s `T` represent and who decides it? (b) in `RequestOptions`, which properties are optional and how can you tell? (c) what does `error is ApiError` mean in `isApiError`'s return type (search term: "type predicate")? (d) find one line using conditional spread (chapter 3 pattern) inside `apiFetch`.

---

You've completed Module 1. Check your exercise answers in [SOLUTIONS.md](./SOLUTIONS.md).
