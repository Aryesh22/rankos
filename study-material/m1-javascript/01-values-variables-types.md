# Module 1.1 — Values, Variables & Types

> **Goal:** Understand what values are, how `const`/`let` really work, JavaScript's primitive types, and the exact behavior of `||`, `??`, `?.`, truthy/falsy, and `null` vs `undefined` — using real lines from your RankOS backend.

Open a terminal and run `node` (no arguments). That drops you into the **REPL** — Read, Eval, Print, Loop. Type any snippet from this chapter and press Enter to see what it evaluates to. This is the single fastest way to build intuition. Exit with `Ctrl+C` twice.

## Concepts

### 1. Everything is a value

A program is mostly a pipeline of **values**: numbers, text, `true`/`false`, lists, objects. Every expression *evaluates to* a value:

```js
2 + 3            // 5
"Rank" + "OS"    // "RankOS"
5 > 3            // true
```

### 2. Variables: `const` and `let`

A variable is a **named label pointing at a value**. Modern JS gives you two keywords:

```js
const port = 8080;   // label can never point to a different value
let count = 0;       // label can be re-pointed later
count = count + 1;   // fine
port = 9090;         // TypeError: Assignment to constant variable.
```

Rule of thumb used throughout your codebase: **use `const` always, `let` only when you genuinely need reassignment.** Why? Because when you read `const x = ...`, you *know* `x` still means the same thing 200 lines later. That's one less thing your brain has to track.

There is also `var`, the pre-2015 keyword. You will see it in old tutorials. Don't use it — it has confusing scoping rules (covered in chapter 2).

One subtlety: `const` prevents **reassignment of the label**, not mutation of the value:

```js
const user = { name: "Vartika" };
user.name = "Aryesh";   // allowed! we changed the object, not the label
user = {};              // TypeError — this re-points the label
```

### 3. The primitive types

JavaScript has 7 **primitive** (indivisible) types. The five you'll use daily:

```js
typeof "hello"    // "string"
typeof 42         // "number"  (JS has ONE number type — no int vs float)
typeof true       // "boolean"
typeof undefined  // "undefined"
typeof null       // "object"  ← a famous 30-year-old bug in the language!
```

The other two — `bigint` and `symbol` — are rare; recognize them and move on.

Everything that isn't a primitive is an **object** (including arrays and functions).

### 4. `null` vs `undefined` — two flavors of "nothing"

This trips up every beginner, so let's nail it:

- **`undefined`** = "nobody ever set this." The language produces it: a declared-but-unassigned variable, a missing object property, a function that returns nothing.
- **`null`** = "somebody deliberately set this to nothing." The language almost never produces `null` on its own — a *programmer* writes it to say "intentionally empty."

```js
let a;
a               // undefined  (never assigned)
const obj = {};
obj.missing     // undefined  (property doesn't exist)
const b = null; // a human said: "empty, on purpose"
```

Your codebase uses this distinction deliberately. In `backend/src/config/env.js`:

```js
url: process.env.REDIS_URL || null,
```

If `REDIS_URL` isn't set, the config stores an explicit `null` — "Redis is intentionally not configured" — rather than leaving it `undefined` ("we forgot to think about it").

### 5. Type coercion — where JS bites

JS will silently **convert types** when operators mix them. Sometimes helpful, often surprising:

```js
"5" + 1     // "51"   (+ with a string means concatenate!)
"5" - 1     // 4      (- has no string meaning, so JS converts to number)
1 == "1"    // true   (== coerces before comparing)
1 === "1"   // false  (=== compares type AND value — no coercion)
Number("")  // 0      (!!)
Number("abc") // NaN  ("Not a Number" — and NaN !== NaN, weirdly)
```

**Rules to live by:**
1. Always use `===` and `!==`. Never `==`/`!=` (one exception pros use: `x == null` matches both `null` and `undefined`).
2. Convert explicitly instead of letting JS guess: `Number(x)`, `String(x)`, `Boolean(x)`.

Your codebase does exactly this. `backend/src/config/env.js` never trusts raw env strings:

```js
function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
```

`Number(value)` is the explicit conversion; `Number.isFinite(n)` rejects `NaN` and `Infinity` so garbage like `PORT=abc` falls back to a sane default instead of poisoning the app. (The `? :` is the **ternary operator**: `condition ? valueIfTrue : valueIfFalse` — an `if/else` that produces a value.)

### 6. Truthy and falsy

When JS needs a boolean (in an `if`, `!`, `&&`, `||`), it coerces the value. Exactly **six** values are **falsy** — memorize them:

```js
false, 0, "" (empty string), null, undefined, NaN
```

*Everything else* is truthy — including `"0"`, `"false"`, `[]` (empty array), and `{}` (empty object). Those last two surprise everyone.

```js
if ("0") console.log("runs!");   // runs — non-empty string is truthy
if ([]) console.log("runs!");    // runs — arrays are objects, objects are truthy
```

### 7. `||` (OR) — fallback on *falsy*

`a || b` evaluates to `a` if `a` is truthy, otherwise `b`. It's used constantly for defaults:

```js
const name = process.env.APP_NAME || "RankOS API";  // real line from env.js
```

Danger: `||` treats **all six falsy values** as "missing" — including `0` and `""`, which are often *legitimate values*:

```js
const minutes = 0;
minutes || 30    // 30  ← wrong! 0 was a real answer, but || discarded it
```

### 8. `??` (nullish coalescing) — fallback on *null/undefined only*

`a ?? b` evaluates to `b` **only** when `a` is `null` or `undefined`. `0`, `""`, and `false` survive:

```js
0 ?? 30          // 0   ✅ zero is kept
"" ?? "default"  // ""  ✅ empty string is kept
null ?? 30       // 30
undefined ?? 30  // 30
```

**Mental model:** `||` asks "is this *usable*?", `??` asks "is this *present*?"

### 9. `?.` (optional chaining) — safe property access

Accessing a property of `null`/`undefined` throws:

```js
const x = undefined;
x.stack        // TypeError: Cannot read properties of undefined
x?.stack       // undefined — no crash, short-circuits to undefined
```

`?.` says: "if the thing before me is null/undefined, stop and produce `undefined`; otherwise continue." Also works for calls (`fn?.()`) and indexing (`arr?.[0]`).

### 10. Template literals

Backtick strings interpolate expressions with `${...}` and can span lines:

```js
const port = 8080;
`listening on :${port}`          // "listening on :8080"
`total: ${2 + 3} items`          // "total: 5 items" — any expression works
```

Far more readable than `"listening on :" + port` chains.

## In your codebase

### `const` vs `let` — `backend/src/index.js`

```js
const server = http.createServer(app);
let shuttingDown = false;
```

`server` is created once and never replaced → `const`. But `shuttingDown` is a flag that flips from `false` to `true` when a shutdown signal arrives → `let`. This two-line pair is the entire `const`/`let` doctrine in miniature. Later in the same file:

```js
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
```

The reassignment is the whole point of the flag — press Ctrl+C twice and the second `shutdown` call bails out immediately instead of double-closing connections.

### `??` vs `||` side by side — `backend/src/services/tasks.service.js`

The `createTask` function is a masterclass in choosing the right default operator:

```js
const task = await StudyTask.create({
  user: userId,
  date: body.date || todayStr(),
  title: body.title,
  subject: body.subject,
  minutes: body.minutes ?? 0,
  type: body.type || "Concept",
  time: body.time ?? null,
  done: false,
});
```

Dissect each choice:

- `body.date || todayStr()` — uses `||` **on purpose**. If the client sends `date: ""` (empty string), that's not a valid date, so we *want* the fallback to today. Falsy = unusable here.
- `body.minutes ?? 0` — uses `??` **on purpose**. If the client sends `minutes: 0` ("a zero-minute placeholder task"), `0` is a legitimate value that must survive. With `||` it would be silently replaced by... `0` here (harmless), but the real intent is: "default only when the field is absent." `??` states that intent precisely.
- `body.time ?? null` — if `time` is absent, store an explicit `null` ("no scheduled time"), the deliberate-emptiness convention from section 4. If the client sent `time: ""` — hmm, `""` would pass through. Whether that's desirable is a design question (see exercises).

### `?.` guarding an error log — `backend/src/index.js`

```js
process.on("unhandledRejection", (reason) => {
  logger.error(`[process] unhandledRejection: ${reason?.stack || reason}`);
});
```

A rejected promise can reject with *anything* — an `Error` object (which has `.stack`), a string, even `undefined`. `reason?.stack` safely tries to read `.stack` without crashing when `reason` is nullish; then `|| reason` falls back to printing the raw value if there was no stack. Two operators from this chapter, one robust log line. Note it's all inside a template literal, too.

### Truthy/falsy validation — `backend/src/config/env.js`

```js
const missing = REQUIRED.filter((key) => !process.env[key] || process.env[key].trim() === "");
```

`!process.env[key]` is a truthiness check: it catches both `undefined` (variable not set) *and* `""` (set but empty). The extra `.trim() === ""` also catches whitespace-only values like `MONGODB_URI="   "`. Defensive layers.

And the `bool` helper shows the explicit null-vs-undefined check pattern:

```js
function bool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}
```

Why not just `if (!value)`? Because... actually here it would behave the same for env strings — but writing the three cases out documents *exactly* which inputs mean "absent." Also note `String(value).toLowerCase()`: explicit conversion (rule from section 5) so `SMTP_SECURE=TRUE` works.

Finally, spot the intentional `undefined` in the cookie config:

```js
domain: process.env.COOKIE_DOMAIN || undefined,
```

Why `undefined` and not `null` this time? Because this object is passed to Express's cookie API, and libraries treat an `undefined` option as "not provided" (using their own default), whereas `null` might be taken literally. `undefined` = "pretend I didn't mention it."

### Template literals — `backend/src/index.js`

```js
logger.info(
  `[server] ${env.app.name} listening on :${env.app.port} ` +
    `(${env.nodeEnv}) — API at ${env.app.apiPrefix}`,
);
```

Three interpolations, and two template literals joined with `+` purely to keep lines short. Prints something like `[server] RankOS API listening on :8080 (development) — API at /api`.

## Pitfalls & gotchas

1. **`||` eating legitimate zeros/empty strings.** `body.minutes || 30` would turn a real `0` into `30`. Use `??` when `0`, `""`, or `false` are valid values.
2. **`typeof null === "object"`.** Historic bug, kept forever for compatibility. Check null with `value === null`.
3. **`NaN` is contagious and never equals itself.** `NaN === NaN` is `false`. Test with `Number.isNaN(x)` — or better, `Number.isFinite(x)` like `env.js` does, which also rejects `Infinity`.
4. **`==` coercion surprises.** `"" == 0` is `true`; `null == 0` is `false`; `[] == ""` is `true`. Just use `===`.
5. **`const` doesn't freeze objects.** `const env = {...}` still allows `env.port = 999`. That's why `env.js` wraps its export in `Object.freeze(...)` (more in chapter 3).
6. **`??` can't be mixed with `&&`/`||` without parentheses.** `a || b ?? c` is a SyntaxError. Write `(a || b) ?? c`.
7. **Empty array/object are truthy.** `if (tasks)` does NOT check "has tasks" — an empty array passes. Check `tasks.length > 0`.

## Exercises

Solutions in [SOLUTIONS.md](./SOLUTIONS.md) under "Chapter 1".

1. **REPL warm-up.** Predict, then verify in `node`: `"5" + 3`, `"5" - 3`, `null ?? "x"`, `undefined ?? "x"`, `0 || 10`, `0 ?? 10`, `"" || "empty"`, `"" ?? "empty"`.
2. **Falsy list.** From memory, write the six falsy values. Then predict what `Boolean([])`, `Boolean("false")`, and `Boolean(NaN)` return, and verify.
3. **Read the code.** Open `backend/src/services/tasks.service.js`. A client calls `POST /tasks` with body `{ "title": "Mock test", "subject": "Physics", "minutes": 0, "date": "" }`. For each of `date`, `minutes`, `type`, and `time`, write down the exact value that will be stored, and *why* (which operator decided it).
4. **Spot the design question.** In the same file, `time: body.time ?? null` lets an empty string `""` through as the stored time. Would changing it to `body.time || null` be better or worse? Argue both sides in 2-3 sentences.
5. **Predict the log.** Open `backend/src/index.js`. If a promise rejects with the plain string `"boom"` (not an Error), what exactly does the `unhandledRejection` handler log? What if it rejects with `undefined`?
6. **Fix the bug.** This function should default `retries` to 3 but keep an explicit 0: `function fetchWithRetries(url, retries) { retries = retries || 3; ... }`. Rewrite the default so `fetchWithRetries(url, 0)` really does 0 retries. Give two different fixes.
7. **Write your own `num`.** Without looking, re-implement `num(value, fallback)` from `backend/src/config/env.js`: converts to a number, returns the fallback for anything non-finite. Test it in the REPL against `"8080"`, `"abc"`, `""`, `undefined`, `"Infinity"`. Then compare with the real one.
8. **Challenge — build `bool`.** Re-implement `bool(value, fallback)` from `env.js`: treat `undefined`/`null`/`""` as absent (return fallback), and return `true` only for `"1"`, `"true"`, `"yes"`, `"on"` in any letter-case. Test with `"TRUE"`, `"0"`, `"no"`, `0`, `undefined`. Why does the real implementation call `String(value)` before `.toLowerCase()`?

---

Next: [Module 1.2 — Functions, Scope & Closures](./02-functions-scope-closures.md)
