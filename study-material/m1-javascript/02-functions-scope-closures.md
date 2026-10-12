# Module 1.2 — Functions, Scope & Closures

> **Goal:** Master the two ways to write functions, understand where variables "live" (scope), truly *get* closures — the concept behind `asyncHandler` — and become fluent with higher-order functions and callbacks.

Keep the `node` REPL open. Closures only click when you poke them yourself.

## Concepts

### 1. Two ways to write a function

**Function declaration** — the classic form:

```js
function add(a, b) {
  return a + b;
}
```

**Arrow function** — an expression assigned to a variable:

```js
const add = (a, b) => {
  return a + b;
};
```

Arrows have a shorthand: if the body is a *single expression*, drop the braces and the `return`:

```js
const add = (a, b) => a + b;      // implicit return
const double = (n) => n * 2;      // one param still needs parens in this codebase's style
const now = () => new Date();     // zero params: empty parens
```

Real differences (not just style):

| | Declaration | Arrow |
|---|---|---|
| Hoisted (usable before its line)? | Yes | No |
| Has its own `this`? | Yes | No (inherits from surroundings) |
| Good for | Top-level named operations | Callbacks, small helpers, one-liners |

Your backend uses both, deliberately. `backend/src/index.js` uses declarations for the big named phases:

```js
async function bootstrap() { ... }
async function shutdown(signal) { ... }
```

while `backend/src/services/tasks.service.js` uses an arrow for a tiny helper:

```js
const todayStr = () => new Date().toISOString().slice(0, 10);
```

One expression, implicit return — reads like a formula: "today's string *is* the first 10 chars of the ISO date."

### 2. Parameters, arguments, defaults

**Parameters** are the names in the definition; **arguments** are the values you pass. Missing arguments become `undefined` — JS never complains:

```js
function greet(name) { return `hi ${name}`; }
greet();          // "hi undefined"  — no error!
```

**Default parameters** fill in when the argument is `undefined` (only `undefined` — `null` does *not* trigger a default):

```js
function bool(value, fallback = false) { ... }   // real signature from env.js
bool("yes");            // fallback is false
bool("yes", true);      // fallback is true
```

And from `backend/src/utils/ApiError.js`:

```js
static notFound(message = "Resource not found", opts) { ... }
```

so `ApiError.notFound()` with no arguments still produces a sensible message — exactly how `tasks.service.js` calls it with a custom one: `ApiError.notFound("Task not found")`.

### 3. Scope — where a name is visible

**Scope** = the region of code where a variable exists. Three levels matter:

```js
const top = "module scope — visible to the whole file";

function outer() {
  const mid = "function scope — visible inside outer only";
  if (true) {
    const inner = "block scope — visible inside these braces only";
  }
  // inner is NOT visible here
}
// mid is NOT visible here
```

`const` and `let` are **block-scoped** (live inside the nearest `{}`); the old `var` is function-scoped, which is why we avoid it. Inner scopes can *read* outer scopes; never the reverse. When JS sees a name, it looks in the current scope, then the enclosing one, then the next, until it finds it — like searching your desk, then the room, then the building.

### 4. Closures — the genuinely intuitive version

Here's the idea, no jargon first:

> **A function remembers the variables that were around when it was created — even after the place that created them is long gone.**

Think of a function as a **backpack-wearing traveler**. When a function is created, it packs into its backpack every outer variable it references. Wherever the function is later carried and called — another file, a callback queue, five minutes in the future — it opens the backpack and those variables are still there. And crucially, the backpack holds the *variables themselves*, not photocopies: if the variable changes, the function sees the change.

Watch it happen:

```js
function makeCounter() {
  let count = 0;                 // lives in makeCounter's scope
  return () => {
    count = count + 1;           // the arrow packed `count` in its backpack
    return count;
  };
}

const tick = makeCounter();      // makeCounter has now RETURNED. Its scope "should" be gone...
tick();   // 1   ...but `count` lives on inside tick's backpack
tick();   // 2
tick();   // 3

const other = makeCounter();     // a brand-new backpack with its own count
other();  // 1  — independent!
```

`count` survived the end of `makeCounter` because `tick` still references it. *That* is a closure: the function plus its backpack. Nothing more mystical than that.

Why care? Closures let you:
- **Preconfigure functions** (a function factory bakes settings into the returned function),
- **Keep private state** (nobody can touch `count` except through `tick`),
- **Wrap behavior around other functions** — which is exactly what `asyncHandler` does. See below.

### 5. Higher-order functions

A **higher-order function (HOF)** takes a function as an argument, returns a function, or both. Since functions are ordinary values in JS, this is everywhere:

```js
[1, 2, 3].map((n) => n * 2);     // map TAKES a function → [2, 4, 6]
makeCounter();                    // RETURNS a function
```

### 6. Callbacks

A **callback** is a function you hand to someone else to call later: "when X happens, run this." It's the foundational async pattern in Node:

```js
setTimeout(() => console.log("2 seconds later"), 2000);
```

You don't call the arrow — `setTimeout` does, when the time comes. Try that in the REPL and notice the prompt returns *immediately*; the log arrives later. That's the shape of all async code (chapter 4 goes deep).

## In your codebase

### `asyncHandler` — a closure, a HOF, and a factory in 3 lines

`backend/src/utils/asyncHandler.js` — the whole file body:

```js
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
```

This is *two arrows in a row*, which beginners misread. Add the invisible parentheses:

```js
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
```

Now dissect:

1. `asyncHandler` is a function that takes **a function** `fn` (your route logic) — HOF, check.
2. It **returns a new function** with the `(req, res, next)` shape Express expects — HOF again, and a **factory**.
3. The returned function references `fn`, which belongs to `asyncHandler`'s scope. By the time Express calls the returned function — minutes later, on some HTTP request — `asyncHandler` has long since returned. The inner function still knows `fn` because **`fn` is in its backpack**. That is the closure.

See it being used in `backend/src/controllers/tasks.controller.js`:

```js
export const listTasks = asyncHandler(async (req, res) => {
  const data = await tasksService.listTasks(req.user.id, req.query.date);
  res.status(HTTP_STATUS.OK).json(data);
});
```

Read it inside-out: the `async (req, res) => {...}` is `fn`. `asyncHandler(fn)` runs **once, at file load**, and returns the wrapped function; *that wrapper* is what gets exported and mounted on the router. Every incoming `GET /tasks` calls the wrapper, which calls your `fn` and forwards any rejection to `next` — so one crash-handling policy protects every route. Each of the four controllers gets its own wrapper with its own `fn` in the backpack.

Why does this matter? Without the wrapper, an `async` route that throws would produce an unhandled promise rejection and Express (v4) would never see the error — the request would just hang. One 3-line closure fixes an entire class of bug, project-wide.

### A shared flag captured by closures — `backend/src/index.js`

```js
let shuttingDown = false;
...
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
```

`shutdown` closes over the module-level `shuttingDown`. Now look at who *carries* `shutdown` around:

```js
["SIGTERM", "SIGINT"].forEach((sig) => process.on(sig, () => shutdown(sig)));
```

Unpack this dense line:
- `forEach` is a HOF: it calls `(sig) => ...` once per array element.
- `process.on(sig, callback)` registers a callback for an OS signal.
- The callback `() => shutdown(sig)` closes over `sig` — each registered listener remembers *which* signal it was created for, so the log can say `SIGINT received`.

Because both listeners' `shutdown` calls share the *same* `shuttingDown` variable (same backpack contents, remember — variables, not copies), a second Ctrl+C during shutdown is ignored.

And a closure across time:

```js
const forceTimer = setTimeout(() => {
  logger.error("[server] forced shutdown (cleanup timed out)");
  process.exit(1);
}, 10000);
...
server.close(async () => {
  ...
  clearTimeout(forceTimer);
```

The `server.close` callback closes over `forceTimer` so that, if cleanup finishes in time, it can cancel the 10-second doomsday timer created earlier in the same function call.

### Callbacks configuring a library — `backend/src/app.js`

```js
app.use(
  morgan(env.isProduction ? "combined" : "dev", {
    stream: morganStream,
    skip: (req) => req.path === `${env.app.apiPrefix}/health/live`,
  }),
);
```

`skip` is a callback *you* write and morgan calls on every request; return `true` and the request isn't logged. Here it silences the health-check endpoint that a load balancer pings constantly. Notice the closure again: the arrow references `env`, imported at the top of the file — packed in the backpack.

And in `backend/src/config/env.js`, a HOF one-liner you now can fully read:

```js
const missing = REQUIRED.filter((key) => !process.env[key] || process.env[key].trim() === "");
```

`filter` calls the arrow for each required var name and keeps the ones where the arrow returned `true` (i.e., the missing ones).

## Pitfalls & gotchas

1. **Calling vs passing.** `process.on(sig, shutdown(sig))` — spot the bug? That *calls* `shutdown` immediately and passes its return value. You want `() => shutdown(sig)` (pass a function). If a "later" thing happens *now*, check for accidental parentheses.
2. **Arrows aren't hoisted.** You can call `bootstrap()` above its `function bootstrap()` declaration, but `todayStr()` above `const todayStr = ...` throws `ReferenceError`. This is why files often define arrow helpers at the top.
3. **Default params ignore `null`.** `function f(x = 5) {}` — `f(undefined)` gives 5, but `f(null)` gives `null`. Defaults only trigger on `undefined`.
4. **Closures capture variables, not values.** The classic trap: `for (var i = 0; i < 3; i++) setTimeout(() => console.log(i))` prints `3 3 3` — all three callbacks share one `i`. With `let i`, each loop iteration gets a fresh `i`, so it prints `0 1 2`. (Another reason `var` is banned.)
5. **Forgetting `return` in a braced arrow.** `const f = (n) => { n * 2 };` returns `undefined` — braces mean "statement body," so you need `return n * 2`, or drop the braces.
6. **Returning an object literal from an arrow.** `() => { id: 1 }` is parsed as a *body*, not an object. Wrap it: `() => ({ id: 1 })`.
7. **`this` in arrows.** Arrows don't get their own `this` — usually what you want in callbacks, but it means arrows make poor object methods and can't be constructors. (Chapter 5 covers `this` in classes.)

## Exercises

Solutions in [SOLUTIONS.md](./SOLUTIONS.md) under "Chapter 2".

1. **Rewrite both ways.** Convert `const todayStr = () => new Date().toISOString().slice(0, 10);` into a function declaration. Then convert `function num(value, fallback) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }` into a single-expression arrow.
2. **Predict the output.** Without running it, what does this print?
   ```js
   const make = () => { let n = 10; return () => (n = n + 5); };
   const a = make(); const b = make();
   console.log(a(), a(), b());
   ```
   Then verify in the REPL.
3. **Read the code.** Open `backend/src/utils/asyncHandler.js`. In your own words (3-4 sentences, backpack metaphor welcome): what does `asyncHandler` receive, what does it return, and why does the returned function still know about `fn` when a request arrives an hour after startup?
4. **Count the closures.** Open `backend/src/index.js` and list every function that closes over `shuttingDown`, `server`, or `forceTimer`. For each, name the variable(s) in its backpack.
5. **Build a factory.** Write `makePrefixer(prefix)` that returns a function which prepends the prefix: `const logLine = makePrefixer("[server] "); logLine("started")` → `"[server] started"`. One line total if you use double arrows.
6. **Spot the bug.** A teammate writes `["SIGTERM", "SIGINT"].forEach((sig) => process.on(sig, shutdown(sig)));` and the server shuts down immediately at startup. Explain exactly why, and fix it.
7. **Write your own `asyncHandler`-style wrapper.** Write `timed(fn)` that returns a new function which calls `fn(...args)`, logs how long it took using `Date.now()`, and returns `fn`'s result. Test it: `const slowAdd = timed((a, b) => { for (let i = 0; i < 1e8; i++); return a + b; }); slowAdd(2, 3);` (Hint: rest parameters `(...args)` collect any number of arguments.)
8. **Challenge — private state.** Using only closures (no classes), write `makeBankAccount(initial)` returning `{ deposit(amount), getBalance() }` where the balance variable is impossible to modify except through `deposit`. Then explain: why can't any outside code touch the balance directly?

---

Next: [Module 1.3 — Objects, Arrays & Their Methods](./03-objects-arrays-methods.md)
