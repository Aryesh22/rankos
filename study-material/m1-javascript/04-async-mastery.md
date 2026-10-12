# Module 1.4 — Async Mastery

> **Goal:** Understand the event loop from first principles, walk the callbacks → promises → async/await progression, use `Promise.all` and `try/catch` correctly, and learn to spot the async bugs (forgotten `await`, accidental sequential awaits) that bite every Node developer.

This is the most important chapter in the module. Your entire backend — every route, every DB call — is async. Get this right and Express stops being magic.

## Concepts

### 1. Why async exists

JavaScript runs your code on **one thread** — one instruction at a time, no parallel lines of your code. Yet a server must handle hundreds of simultaneous requests, each waiting on a database that takes ~5ms to answer. 5ms is an eternity: a CPU could run millions of instructions in that time. If the thread just *stood there waiting*, one slow query would freeze every other request.

Node's answer: **never wait — leave a note.** When you start something slow (DB query, file read, network call, timer), Node hands the work to the system, you attach a "call me when done" note, and your code *returns immediately*. The thread moves on to other work. When the slow thing finishes, your note — a **callback** — is queued to run.

### 2. The event loop, for beginners

Picture a chef (the thread) in a kitchen with a **ticket rail** (the queue):

1. The chef executes one ticket (one chunk of your code) start to finish — nothing interrupts it.
2. Slow tasks (the oven = the DB) run *outside* the chef; when the oven dings, a new ticket goes on the rail.
3. When the current ticket is done, the chef takes the next ticket. Forever. That cycle is the **event loop**.

Two consequences you must internalize:

- **Async code never runs "in the middle" of your code.** Your current function always finishes before any callback starts. That's why `let shuttingDown = false; if (shuttingDown)...` in `index.js` needs no locks — no other code can interleave mid-function.
- **Blocking the chef blocks everyone.** A CPU-heavy loop (`while(true)`) or synchronous file read stalls all requests. Keep tickets small.

Prove the ordering to yourself in the `node` REPL:

```js
console.log("1");
setTimeout(() => console.log("3 — from the queue"), 0);
console.log("2");
// prints 1, 2, 3 — even with a 0ms timer!
```

The timer callback *can't* run until the current code finishes, because the chef finishes his ticket first.

### 3. Stage one: callbacks

The original pattern — pass a "call me later" function:

```js
setTimeout(() => console.log("later"), 1000);
server.listen(8080, () => console.log("listening"));   // shape used in index.js
```

Fine for one step. Painful for sequences — each step nests inside the last ("callback hell"), and error handling has to be repeated manually in every callback.

### 4. Stage two: promises

A **promise** is an object representing a *future value* — a receipt for work in progress. It's in one of three states: **pending**, then either **fulfilled** (with a value) or **rejected** (with an error). Exactly one settle, ever.

You attach notes to the receipt:

```js
StudyTask.find({ user })          // returns a promise immediately (pending)
  .then((tasks) => ...)           // runs if fulfilled, receives the value
  .catch((err) => ...);           // runs if rejected, receives the error
```

Two big upgrades over raw callbacks: `.then` chains *flat* instead of nesting, and **errors flow down the chain** to a single `.catch` — like a gutter under the pipeline catching anything thrown from any step.

### 5. Stage three: `async`/`await` — promises in comfortable clothing

`async`/`await` is *syntax* over promises, not a new mechanism:

- Marking a function `async` makes it **always return a promise**.
- Inside it, `await somePromise` **pauses this function** (only this function — the chef serves other tickets meanwhile) until the promise settles, then hands you the fulfilled value — or **throws** the rejection error, right at that line.

```js
async function demo() {
  const tasks = await StudyTask.find({ user });   // reads like sync code
  return tasks.length;                             // fulfills demo()'s promise
}
```

Because rejections become ordinary throws, ordinary `try/catch` works:

```js
try {
  const tasks = await StudyTask.find({ user });
} catch (err) {
  // network down, bad query, whatever — lands here
}
```

This is the progression: callbacks (manual everything) → promises (chainable receipts, error gutter) → async/await (looks synchronous, still non-blocking).

### 6. Sequential vs parallel — `Promise.all`

`await` one-at-a-time serializes:

```js
const a = await fetchA();   // 300ms
const b = await fetchB();   // 300ms — starts only AFTER a finishes
// total ≈ 600ms
```

If `b` doesn't need `a`'s result, start both, then await both:

```js
const [a, b] = await Promise.all([fetchA(), fetchB()]);
// both in flight at once — total ≈ 300ms
```

Key insight: **calling** an async function starts the work; **awaiting** just waits for the receipt. `Promise.all` takes an array of promises and fulfills with an array of results (same order) — or rejects as soon as *any* one rejects. Its lenient sibling `Promise.allSettled` never rejects; it reports each outcome so one failure doesn't hide the others.

### 7. The unhandled rejection

A promise that rejects with *nobody* attached to catch it is an **unhandled rejection** — the async equivalent of an uncaught exception. In Node this prints a warning and (in recent versions) can crash the process. Every promise you create must eventually meet an `await`+`try/catch`, a `.catch`, or a deliberate policy handler. Your codebase has all three, as you're about to see.

## In your codebase

### `asyncHandler` — the error gutter for every route

`backend/src/utils/asyncHandler.js`:

```js
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
```

You know the closure mechanics from chapter 2; now the *async* mechanics:

1. `fn(req, res, next)` runs your async route logic. Being `async`, it returns a promise.
2. `Promise.resolve(...)` wraps the result — a safety net so even a non-async `fn` (returning a plain value) becomes a promise and the next step is always legal.
3. `.catch(next)` — if the route's promise rejects (a `throw` anywhere inside it, like `throw ApiError.notFound(...)` in `tasks.service.js`), the error is passed to Express's `next(err)`, which forwards it to the centralized `errorHandler` mounted last in `app.js`.

Without this wrapper, a rejected route promise would be an **unhandled rejection**: Express 4 doesn't watch promises, the client would hang, and the process would log a scary warning. Three lines convert "every route must remember try/catch" into "no route ever thinks about it." Trace one error end-to-end: `deleteTask` in `backend/src/services/tasks.service.js` runs `throw ApiError.notFound("Task not found")` → the controller's async fn rejects → `.catch(next)` → `errorHandler` → clean 404 JSON.

### Controllers: `await` at every step — `backend/src/controllers/tasks.controller.js`

```js
export const deleteTask = asyncHandler(async (req, res) => {
  await tasksService.deleteTask(req.user.id, req.params.id);
  res.status(HTTP_STATUS.NO_CONTENT).send();
});
```

That `await` is load-bearing even though nothing uses a return value. Two reasons:

1. **Ordering** — without it, `res.status(204).send()` would run *while the delete is still in flight*, telling the client "done" before it's true (or worse, before a failure).
2. **Error capture** — `asyncHandler` can only catch rejections that are part of *this* function's promise chain. `await` stitches the service's promise into the controller's chain. Drop the `await` and a "Task not found" rejection floats away unhandled, the client already got a 204, and Node logs an unhandled rejection. **This is the forgotten-`await` bug**, and it's the most common async mistake in Express codebases. It's extra sneaky because the code *usually appears to work* — until the operation fails.

### `bootstrap` — deliberate sequential awaits — `backend/src/index.js`

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
  server.listen(env.app.port, () => { ... });
}
```

Study the ordering decisions:

- `await connectDatabase()` first and alone: if Mongo is down, the `await` throws, `bootstrap`'s promise rejects, and the server **never starts listening**. Sequential-on-purpose: don't accept traffic you can't serve.
- `connectRedis` and `verifyEmailTransport` are awaited one after another. They're independent — a parallelization candidate: `await Promise.all([connectRedis(), verifyEmailTransport()])` would overlap their network round-trips and shave startup time. The sequential version trades a few hundred ms for simpler, clearer logs. Both are defensible; *knowing it's a choice* is the skill.
- `configureCloudinary()` and `initJobs()` have no `await` — they're synchronous setup functions. Awaiting a non-promise is harmless but misleading; not awaiting an async function is a bug. You must know which is which.
- `server.listen(port, callback)` is the *old callback style* — core Node APIs predate promises. The `async` world and callback world coexist in one function.

And at the bottom of the file, the two safety nets from section 7:

```js
bootstrap().catch((err) => {
  logger.error(`[server] failed to start: ${err.stack || err.message}`);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error(`[process] unhandledRejection: ${reason?.stack || reason}`);
});
```

`bootstrap()` is called at top level, so *someone* must own its rejection — `.catch` style is natural here. The `unhandledRejection` listener is the last-resort net for any promise that escaped every other handler: it logs loudly so the forgotten-`await` class of bug is at least visible in production instead of silent.

### `shutdown` — try/catch around a cleanup sequence — `backend/src/index.js`

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

An `async` callback handed to a callback-style API, with one `try/catch` guarding four sequential awaits — any failure jumps to the single `catch`. Here sequence *matters*: close the layers in reverse dependency order (sockets before the DB they might still be using). Note the belt-and-braces design around it: `server.close`'s callback only fires when existing connections drain, so the `forceTimer` (`setTimeout(..., 10000)`) guarantees exit even if draining hangs — and `clearTimeout` cancels the doomsday device on success. Also a subtlety worth knowing: passing an `async` function as a plain callback means *nobody awaits it* — safe here only because the `try/catch` inside catches everything, so its promise can never reject.

## Pitfalls & gotchas

1. **Forgotten `await`.** `service.deleteTask(...)` without `await`: response sent early, errors unhandled, and — since it usually still "works" — invisible until production. Habit: every call to an async function gets `await` (or an explicit `.catch`, or a comment saying why fire-and-forget is intended).
2. **Sequential awaits that should be parallel.** `const a = await getA(); const b = await getB();` doubles your latency when they're independent. Reach for `Promise.all` — but only when they truly don't depend on each other.
3. **`Promise.all` fail-fast.** One rejection rejects the whole thing and the other results are discarded (though the operations themselves keep running). For "do all, report all" semantics, use `Promise.allSettled`.
4. **`forEach` + `async` doesn't wait.** `items.forEach(async (x) => await save(x))` fires all saves and moves on immediately — `forEach` ignores returned promises. Use `for (const x of items) await save(x)` (sequential) or `await Promise.all(items.map(save))` (parallel).
5. **`try/catch` only catches what you `await`.** `try { service.doThing(); } catch (e) {}` catches *nothing* if `doThing` is async and un-awaited — the rejection happens after the `try` block already exited.
6. **Mixing `.then` and `await` styles.** Both are fine; interleaving them in one function (`await x.then(...)`) reads terribly. Pick `await` and stay consistent; `.catch(next)` at a boundary (like `asyncHandler`) is the classic exception.
7. **Async work "in the background" of a request.** Returning a response and then continuing to `await` things works, but errors thrown after `res.json(...)` can't change the response — they need their own handling. Be deliberate about what happens after the response is sent.
8. **Blocking the loop.** A giant synchronous loop or `JSON.parse` of a 100MB string stalls *every* concurrent request. If profiling ever shows one route slowing all others, look for synchronous CPU work.

## Exercises

Solutions in [SOLUTIONS.md](./SOLUTIONS.md) under "Chapter 4".

1. **Ordering drill.** Predict the exact print order, then verify in the REPL:
   ```js
   console.log("a");
   setTimeout(() => console.log("b"), 0);
   Promise.resolve().then(() => console.log("c"));
   console.log("d");
   ```
   (Bonus if you can explain why `c` beats `b` — search "microtask vs macrotask" after guessing.)
2. **Three styles, one task.** Write `delay(ms)` that returns a promise resolving after `ms` milliseconds (wrap `setTimeout` in `new Promise((resolve) => ...)`). Then use it (a) with `.then` chaining to log "one", wait 500ms, log "two"; (b) with `async/await` doing the same.
3. **Read the code.** Open `backend/src/controllers/tasks.controller.js` and delete (mentally) the `await` in `patchTask`. Describe, step by step, what the client experiences when patching a task ID that doesn't exist. Which line of `asyncHandler` is defeated, and where does the `ApiError` end up instead?
4. **Sequential vs parallel.** Using your `delay` from exercise 2: write `slow()` that awaits `delay(300)` three times in a row, and `fast()` that does the three delays with one `Promise.all`. Time both with `console.time("x")` / `console.timeEnd("x")` and report the numbers.
5. **Read the code.** In `backend/src/index.js`, exactly which awaited calls inside `bootstrap` could be merged into a single `Promise.all` without changing correctness? Which call must stay first and alone, and what is the *behavioral* argument (not just style) for it?
6. **Predict the outcome.** `await Promise.all([delay(100).then(() => "a"), Promise.reject(new Error("boom")), delay(200).then(() => "c")])` — what happens? Rewrite with `Promise.allSettled` and describe the resolved value's shape.
7. **Fix the loop.** This should save tasks one at a time but doesn't wait at all — explain why, then write both a sequential and a parallel fix:
   ```js
   async function saveAll(tasks) {
     tasks.forEach(async (t) => { await StudyTask.create(t); });
     console.log("all saved!");
   }
   ```
8. **Challenge — mini `asyncHandler`.** Without looking at the real file, write your own `asyncHandler(fn)` from scratch, then compare. Then answer: why does the real one use `Promise.resolve(fn(req, res, next))` instead of just `fn(req, res, next).catch(next)`? Construct an `fn` for which the simpler version crashes.

---

Next: [Module 1.5 — Modules, Classes & Modern JS](./05-modules-classes-modern-js.md)
