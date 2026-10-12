# Module 1.3 — Objects, Arrays & Their Methods

> **Goal:** Get deeply fluent with objects (destructuring, spread, shorthand, computed keys) and the array method toolkit (`map`, `filter`, `reduce`, `find`, `some`, `every`, `sort`, `flat`), plus the immutability habits your codebase relies on.

These two data structures carry ~95% of the data in RankOS: every request body, every config, every Mongo document, every JSON response. Fluency here pays off everywhere.

## Concepts

### 1. Objects: labeled boxes of values

```js
const task = {
  title: "Mock test",       // key: value
  minutes: 90,
  done: false,
};

task.title            // "Mock test"   — dot access
task["title"]         // same           — bracket access (key as a string)
task.owner            // undefined      — missing keys don't throw
task.done = true;     // mutate a property (allowed even under const — ch.1)
```

Values can be anything — including functions (then we call them **methods**) and other objects (nesting). Your entire `env` object in `backend/src/config/env.js` is one big nested object literal: `env.app.port`, `env.cors.origin`, etc.

### 2. Property shorthand

When the variable name equals the key name, write it once:

```js
const title = "Mock test";
const minutes = 90;
const task = { title, minutes };   // same as { title: title, minutes: minutes }
```

Real example — the bottom of `backend/src/services/tasks.service.js`:

```js
export default { listTasks, setTaskDone, createTask, deleteTask };
```

Four functions bundled into an object with four shorthand properties.

### 3. Destructuring — unpacking in one line

Destructuring mirrors the literal syntax to *extract* values:

```js
const { title, minutes } = task;        // two consts from one object
const { title: t } = task;              // rename → const t
const { type = "Concept" } = task;      // default if property is undefined
const [first, second] = ["a", "b"];    // array version — by position
```

The killer combo: destructuring **in a function's parameter list**, with defaults, with a default for the *whole object*. The `ApiError` constructor in `backend/src/utils/ApiError.js` uses all three at once:

```js
constructor(statusCode, message, { code, details, fields, isOperational = true, cause } = {}) {
```

Read it slowly:
- The third parameter is an *options object*, immediately destructured into five variables.
- `isOperational = true` — per-property default.
- `= {}` at the end — if the caller passes no third argument at all, destructure an empty object instead of crashing on `undefined`. (Without it, `new ApiError(404, "nope")` would throw `Cannot destructure property 'code' of undefined`.)

This "options object" pattern beats positional arguments once you have 3+ optional settings: callers write `{ fields: {...} }` and skip everything else, and the call site is self-documenting.

### 4. Spread `...` — copy and merge

Inside a literal, `...source` copies all of `source`'s properties in:

```js
const base = { retries: 3, verbose: false };
const custom = { ...base, verbose: true };   // { retries: 3, verbose: true }
```

Later spreads win — which makes spread perfect for "defaults, then overrides" *and* for "your input, then my non-negotiables". `ApiError.internal` uses the second form:

```js
static internal(message = "Internal server error", opts) {
  return new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, message, {
    ...opts,
    isOperational: false,
  });
}
```

Whatever the caller passed in `opts` is kept, but `isOperational: false` comes *after* the spread, so it always wins — internal errors are never marked operational, no matter what.

Spread also works in arrays (`[...a, ...b]`) and copies are **shallow**: nested objects are shared, not cloned (see Pitfalls).

**Conditional spread** — a pro pattern from `ApiError.toJSON()`:

```js
toJSON() {
  return {
    code: this.code,
    message: this.message,
    ...(this.details ? { details: this.details } : {}),
    ...(this.fields ? { fields: this.fields } : {}),
  };
}
```

`...(cond ? { key: val } : {})` includes the property *only if* the condition holds — spreading an empty object adds nothing. Result: error responses without validation details simply don't have a `details` key at all, instead of carrying `details: undefined`.

### 5. Computed keys — `[expression]: value`

Normally keys are literal names. Brackets let a key come from an expression:

```js
const field = "minutes";
const patch = { [field]: 90 };   // { minutes: 90 }
```

`ApiError.defaultCodeFor` builds its whole lookup table this way:

```js
const map = {
  [HTTP_STATUS.BAD_REQUEST]: ERROR_CODES.BAD_REQUEST,
  [HTTP_STATUS.NOT_FOUND]: ERROR_CODES.NOT_FOUND,
  // ...
};
return map[statusCode] || ERROR_CODES.INTERNAL;
```

The keys are the *values of* constants (like `400`, `404`), not the names. Then `map[statusCode]` is a bracket lookup — an object used as a dictionary, replacing a 7-branch `switch`.

### 6. Arrays and the method toolkit

An array is an ordered list. The transformation methods below all take a callback (chapter 2 skills!) and — crucially — **the first group returns new arrays/values without touching the original**.

```js
const nums = [3, 1, 4, 1, 5];

// map — transform EVERY element (same length out)
nums.map((n) => n * 2)                    // [6, 2, 8, 2, 10]

// filter — KEEP elements where the callback returns truthy
nums.filter((n) => n > 2)                 // [3, 4, 5]

// find — FIRST element matching (or undefined)
nums.find((n) => n > 2)                   // 3

// some — does AT LEAST ONE match? → boolean
nums.some((n) => n > 4)                   // true

// every — do ALL match? → boolean
nums.every((n) => n > 0)                  // true

// reduce — boil the array down to ONE value
nums.reduce((acc, n) => acc + n, 0)       // 14  (acc starts at 0)

// flat — un-nest one level
[[1, 2], [3]].flat()                      // [1, 2, 3]

// includes / join / slice
nums.includes(4)                          // true
["a", "b"].join(", ")                    // "a, b"
nums.slice(0, 2)                          // [3, 1] — copy of a range
```

`reduce` deserves a slower look, since it can express *all* the others. It carries an **accumulator** through the array:

```js
// total minutes of a day's tasks
const tasks = [{ minutes: 30 }, { minutes: 45 }, { minutes: 0 }];
tasks.reduce((total, t) => total + t.minutes, 0);   // 75
// step by step: (0, {30})→30, (30, {45})→75, (75, {0})→75
```

**`sort` is the odd one out — it mutates in place.** It also sorts *as strings* by default:

```js
[10, 9, 1].sort()                    // [1, 10, 9]  ← "10" < "9" as strings!
[10, 9, 1].sort((a, b) => a - b)     // [1, 9, 10]  ← comparator: negative = a first
[...nums].sort((a, b) => a - b)      // spread first = sort a COPY, original safe
```

**Chaining** is where fluency shows. From `backend/src/config/env.js`:

```js
function list(value, fallback = []) {
  if (!value) return fallback;
  return String(value)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}
```

`CORS_ORIGIN="https://a.app, https://b.app,,"` → split on commas → trim whitespace from each piece → drop empties. `filter(Boolean)` is an idiom: `Boolean` is itself a function, so it works as the callback — keep only truthy elements. Each step returns a new array that the next step consumes.

### 7. Immutability patterns

**Mutating** shared data is a top source of bugs: some far-away code changes an object you were relying on. The defensive habits:

```js
const withExtra = { ...obj, extra: 1 };        // new object, not obj.extra = 1
const longer = [...arr, item];                  // new array, not arr.push(item)
const shorter = arr.filter((x) => x !== item);  // "remove" without splice
const sorted = [...arr].sort(cmp);              // sort a copy
```

And for objects that must *never* change, `Object.freeze`. The last line of config assembly in `backend/src/config/env.js`:

```js
export const env = Object.freeze({
  nodeEnv: NODE_ENV,
  ...
});
```

Every file in the backend imports this `env`. Freezing guarantees no code anywhere can do `env.app.port = 3000` and silently sabotage others — with 30+ importers, that guarantee is gold. (Note: freeze is shallow — `env.app` itself isn't frozen — but the signal of intent is set.)

React (your `rankos-ai-mentor/` frontend) takes this further: state must *always* be replaced, never mutated, or the UI won't re-render. The habits you build here are load-bearing there.

### 8. Getters — computed properties

A `get` property runs a function when *read*, no parentheses needed. From `env.js`:

```js
redis: {
  url: process.env.REDIS_URL || null,
  host: process.env.REDIS_HOST || null,
  ...
  get isConfigured() {
    return Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);
  },
},
```

Callers write `env.redis.isConfigured` — it *looks* like plain data but computes its answer live. The same pattern appears for `cloudinary.isConfigured` and `smtp.isConfigured`: "is this optional service set up?" derived from its parts, never stored (so it can't drift out of sync).

## In your codebase

### The request-body-to-document pipeline — `backend/src/services/tasks.service.js`

```js
export async function createTask(userId, body) {
  const task = await StudyTask.create({
    user: userId,
    date: body.date || todayStr(),
    title: body.title,
    subject: body.subject,
    minutes: body.minutes ?? 0,
    ...
  });
```

`body` is the parsed JSON object from the HTTP request (`express.json()` in `app.js` produced it). This function builds a *new* object literal, picking fields explicitly — never `...body`. Why not spread the whole body? Security: a malicious client could send `{ "user": "someone-else's-id", "done": true }` and spreading would obediently include it. Explicit field-picking is an allowlist. Compare `user: userId` — the owner comes from the authenticated session, never the client (the file's own comment says exactly this).

Also spot object-shorthand's cousin in `listTasks`:

```js
const tasks = await StudyTask.find({ user: userId, date: day }).sort({ time: 1 });
return { data: tasks };
```

Two tiny object literals as *query descriptions* (`{ user: userId, date: day }` — "match these fields"; `{ time: 1 }` — "ascending by time"): Mongo's whole query language is object literals. And `{ data: tasks }` wraps the array in an envelope so the JSON response is `{ "data": [...] }`.

### Arrays driving startup validation — `backend/src/config/env.js`

```js
const REQUIRED = ["MONGODB_URI"];

function ensureRequired() {
  const missing = REQUIRED.filter((key) => !process.env[key] || process.env[key].trim() === "");
  if (missing.length > 0) {
    console.error(
      `\n[env] Missing required environment variable(s): ${missing.join(", ")}\n` + ...
```

`filter` produces the subset of names that are absent; `missing.length > 0` is the correct "non-empty?" check (remember: `if (missing)` would pass even when empty — arrays are always truthy); `join(", ")` renders them for the human. Three methods, one clean fail-fast message. The production-secret checks further down reuse the identical `filter` pattern on `["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"]`.

Also from `bool`: `["1", "true", "yes", "on"].includes(String(value).toLowerCase())` — an inline array as a set of accepted values.

And from `backend/src/index.js`, array-as-dispatch:

```js
["SIGTERM", "SIGINT"].forEach((sig) => process.on(sig, () => shutdown(sig)));
```

`forEach` is the one iteration method that returns nothing — use it when you want side effects (registering listeners), not a new array.

### The whole object toolkit in one class — `backend/src/utils/ApiError.js`

Re-skim the file and notice you can now name every pattern in it: parameter destructuring with defaults (`{ code, details, fields, isOperational = true, cause } = {}`), computed keys (`[HTTP_STATUS.BAD_REQUEST]: ...`), object-as-dictionary lookup (`map[statusCode] || ERROR_CODES.INTERNAL`), spread-with-override (`{ ...opts, isOperational: false }`), and conditional spread (`...(this.details ? { details: this.details } : {})`). One 80-line file, five patterns.

## Pitfalls & gotchas

1. **Spread and `Object.freeze` are shallow.** `{ ...task }` copies one level; nested objects are still *shared* — mutating `copy.nested.x` also changes `original.nested.x`. For deep copies use `structuredClone(obj)`.
2. **`sort()` mutates AND string-sorts.** `[10, 9, 1].sort()` → `[1, 10, 9]`. Always pass a comparator for numbers, and spread first (`[...arr].sort(...)`) if you need the original intact.
3. **`map` when you mean `forEach`.** If you ignore the returned array, use `forEach` (or a `for...of` loop). If you *use* the result, `map`. Mixing them up confuses readers about intent.
4. **Forgetting `reduce`'s initial value.** `[].reduce((a, b) => a + b)` throws on an empty array. `[].reduce((a, b) => a + b, 0)` returns 0. Almost always pass the initial value.
5. **`find` returns `undefined` on no match** — chain carefully: `tasks.find(t => t.id === id)?.title`, or check before using.
6. **Objects compare by reference.** `{ a: 1 } === { a: 1 }` is `false` — two different boxes. Same for arrays. Equality checks on contents need field-by-field comparison (or `JSON.stringify`, crudely).
7. **Spreading untrusted input.** As shown above, `StudyTask.create({ ...body })` would let clients set *any* schema field, including `user`. Allowlist explicitly.
8. **`delete obj.key` vs destructuring-rest.** The immutable "remove a key" is `const { user, ...rest } = doc;` — `rest` is a new object without `user`.

## Exercises

Solutions in [SOLUTIONS.md](./SOLUTIONS.md) under "Chapter 3".

1. **REPL drills.** Predict, then verify: `[1, 2, 3].map(n => n * n)` · `[1, 2, 3, 4].filter(n => n % 2 === 0)` · `[5, 3, 9].find(n => n > 4)` · `[1, 2].some(n => n > 5)` · `[1, 2].every(n => n > 0)` · `[[1], [2, 3]].flat()` · `[100, 25, 3].sort()`.
2. **Destructure it.** Given `const res = { id: "t1", done: true, meta: { source: "api" } };` write one line that extracts `done`, renames `id` to `taskId`, pulls out `meta.source` as `source`, and defaults a missing `priority` to `"Low"`.
3. **Read the code.** Open `backend/src/utils/ApiError.js` and evaluate `new ApiError(404, "Task not found").toJSON()` by hand. Which properties does the returned object contain, and why are `details`/`fields` absent rather than `undefined`? What does `code` end up as? (Trace through `defaultCodeFor` — assume `HTTP_STATUS.NOT_FOUND` is `404` and `ERROR_CODES.NOT_FOUND` is `"NOT_FOUND"`.)
4. **Predict the config.** Open `backend/src/config/env.js`. With `.env` containing exactly `MONGODB_URI=mongodb://localhost/rankos` and `CORS_ORIGIN=http://localhost:5173, https://rankos.app`, what are the values of `env.cors.origin`, `env.app.port`, `env.redis.isConfigured`, and `env.smtp.from`? Explain each in one line.
5. **Rebuild `list`.** Without peeking, implement `list(value, fallback = [])` from `env.js` (split a comma-separated string, trim pieces, drop empties). Test against `" a, b ,,c "`, `""`, and `undefined`. Then compare with the real one — did you remember `filter(Boolean)`?
6. **Reduce practice.** Given `const tasks = [{ subject: "Physics", minutes: 40 }, { subject: "Math", minutes: 60 }, { subject: "Physics", minutes: 20 }];` — (a) total minutes with `reduce`; (b) *challenge*: produce `{ Physics: 60, Math: 60 }` (minutes per subject) with a single `reduce` using a computed key.
7. **Immutable update.** Given `const day = { date: "2026-08-11", tasks: [{ id: 1, done: false }] };` write code that produces a new `day` where task 1 is done — **without mutating** `day` or anything inside it. (Hint: spread at both levels; `map` the tasks.)
8. **Spot the vulnerability.** A teammate "simplifies" `createTask` in `backend/src/services/tasks.service.js` to `StudyTask.create({ ...body, user: userId })`. Is `user` still safe? What *other* field from the original code can a client now abuse, and how? (Look at what `createTask` currently hardcodes.)

---

Next: [Module 1.4 — Async Mastery](./04-async-mastery.md)
