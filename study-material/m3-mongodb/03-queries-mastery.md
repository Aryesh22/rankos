# Module 3.3 — Query Mastery

> **Goal:** Learn every query method and operator you'll actually use — create, read, update, delete, filter operators, `sort/skip/limit/select` chaining, `lean()`, and `populate()` — each one illustrated with a **real query quoted from your own services and repositories**.

---

## Concepts

A Mongoose query has an anatomy worth internalizing before the catalog:

```js
await StudyTask                      // the Model (→ studytasks collection)
  .find({ user: userId, date: day }) // FILTER: which docs match
  .sort({ time: 1 })                 // shape the result: order…
  .skip(20).limit(20)                // …window…
  .select("title minutes done")      // …projection (which fields)
```

Two big ideas:

1. **Filters are data, not code.** `{ user: userId, date: day }` is a plain object describing conditions. Complex conditions use `$`-operators nested in that object. Because filters are just objects, you can build them programmatically — your `mistakes.service.js` does exactly that.
2. **Queries are lazy builders.** `find()` returns a *Query* object; each chained call refines it; `await` executes it. Nothing hits the database until await/then.

### Reading: `find`, `findOne`, `findById`

- `Model.find(filter)` → **array** of documents (possibly empty — never null).
- `Model.findOne(filter)` → the **first matching document or `null`**.
- `Model.findById(id)` → sugar for `findOne({ _id: id })`.

Real ones, from `backend/src/services/tasks.service.js`:

```js
const tasks = await StudyTask.find({ user: userId, date: day }).sort({ time: 1 });
```

from `backend/src/services/tests.service.js`:

```js
const test = await Test.findOne({ code });
if (!test) throw ApiError.notFound("Test not found");
```

and from `backend/src/services/attempts.service.js`:

```js
const test = await Test.findById(attempt.test).populate("questions");
```

Note the discipline after every `findOne`/`findById`: **check for null and 404**. `find` never needs that check; the other two always do.

The most important filter in your entire app is two fields long:

```js
// attempts.service.js — ownedAttempt()
const attempt = await TestAttempt.findOne({ _id: attemptId, user: userId });
if (!attempt) throw ApiError.notFound("Attempt not found");
```

By putting **both** the id *and* the owner in the filter, "exists but belongs to someone else" and "doesn't exist" are indistinguishable — both 404. Authorization enforced *by the query itself*. You'll see `user: userId` in virtually every query in this module; it's the app's security backbone (and its indexing strategy — Module 3.4).

### Creating: `create` and `insertMany`

`Model.create(obj)` validates against the schema, applies defaults, inserts, and returns the full document. From `tasks.service.js`:

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

`Model.insertMany(array)` inserts a batch in **one round-trip** — dramatically faster than N `create` calls. Your app uses it whenever one action fans out into many documents. From `attempts.service.js` (auto-filing every wrong answer into the mistake bank at submit):

```js
await Mistake.insertMany(
  wrong.map((q) => ({
    user: userId,
    question: q.text,
    subject: q.subject,
    chapter: q.topic || q.subject,
    category: "Concept Error",
    priority: "Medium",
    status: "Pending",
    occurredOn,
    timesRepeated: 1,
    aiNote: "",
  })),
);
```

and again in `scheduleRevision`: `if (tasks.length) await StudyTask.insertMany(tasks);` — note the length guard; no reason to hit the DB with an empty array.

One more `create` variant worth knowing — from `backend/src/repositories/user.repository.js`:

```js
// create() with a session requires the array form.
const [user] = await User.create([data], session ? { session } : {});
```

When you pass options (like a transaction `session`), `create` demands the array form — hence the destructure.

### Updating: `updateOne`, `updateMany`, `findOneAndUpdate` (+ the `{new: true}` gotcha)

Three tools, one decision: **do you need the resulting document back?**

**`updateOne(filter, update)`** — fire-and-forget; returns only counts (`matchedCount`, `modifiedCount`). From `user.repository.js`:

```js
/** Record a successful login timestamp (best-effort, no session needed). */
async touchLastLogin(id) {
  return User.updateOne({ _id: id }, { lastLoginAt: new Date() });
},
```

**`updateMany(filter, update)`** — same, for every matching doc. From `backend/src/services/notifications.service.js`:

```js
const res = await Notification.updateMany({ user: userId, read: false }, { read: true });
```

One round-trip marks the whole inbox read — never loop-and-save.

**`findOneAndUpdate(filter, update, options)`** — atomically find one doc, update it, and *return a document*. Here's the gotcha: **by default it returns the document as it was BEFORE the update.** That default trips everyone. From `tasks.service.js`:

```js
const task = await StudyTask.findOneAndUpdate(
  { _id: taskId, user: userId },
  { done: Boolean(done) },
  { new: true },
);
if (!task) throw ApiError.notFound("Task not found");
return { id: String(task._id), done: task.done };
```

Without `{ new: true }`, `task.done` would report the **old** value — the API would tell the frontend the toggle didn't happen, while the DB says it did. A maddening bug, silently wrong. Your codebase passes `{ new: true }` on *every single* `findOneAndUpdate` (grep it: tasks, mistakes, all four repositories). Notice also the pattern doing double duty again: filter `{ _id, user: userId }` = ownership check + update + fetch in **one atomic operation** — no separate find-then-save race.

Its sibling `findByIdAndUpdate` appears in `backend/src/repositories/otp.repository.js`:

```js
Otp.findByIdAndUpdate(id, { $inc: { attempts: 1 } }, { new: true }),
```

**Update operators** (the right-hand side): a bare object like `{ done: true }` is treated as `$set` by Mongoose. Explicit operators used in your codebase:

- **`$inc`** — atomic increment (above). Read-modify-write (`doc.attempts += 1; doc.save()`) loses updates under concurrency; `$inc` cannot.
- **`$addToSet`** — append to array only if not already present. From `user.repository.js`:

  ```js
  { $addToSet: { authProviders: provider } }
  ```

  Linking Google twice stays one entry — idempotency from the operator itself.

There's also the **document-modify-then-`save()`** style, which your `attempts.service.js` uses for the multi-field submit flow (`attempt.status = "submitted"; attempt.score = score; … await attempt.save();`) and `gamification.service.js` uses to award achievements. Rule of thumb: `save()` when you already have the doc loaded and business logic touches many fields; atomic update operators when concurrency or round-trips matter.

### Deleting: `deleteOne` (and friends)

From `tasks.service.js`:

```js
const res = await StudyTask.deleteOne({ _id: taskId, user: userId });
if (res.deletedCount === 0) throw ApiError.notFound("Task not found");
```

`deleteOne` returns `{ deletedCount }` — checking it is how you distinguish "deleted" from "was never yours / never existed" (again both → 404). `deleteMany` clears every match — in your app it appears only in `backend/src/seeds/index.js` (`M.deleteMany({})` to wipe collections before reseeding). Notice what's *absent*: no `deleteOne` on User anywhere — users are soft-deleted (Module 3.2).

### Counting & existence: `countDocuments`, `exists`

Never fetch documents just to count them. From `notifications.service.js`:

```js
const unread = await Notification.countDocuments({ user: userId, read: false });
```

And for pagination, `mistakes.service.js` runs the count **in parallel** with the page fetch:

```js
const [total, docs] = await Promise.all([
  Mistake.countDocuments(filter),
  Mistake.find(filter)
    .sort({ createdAt: -1 })
    .skip((pageNum - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE),
]);
```

`Model.exists(filter)` is even cheaper than counting — it returns a stub (`{ _id }`) or null. From `attempts.service.js` (skip already-filed mistakes):

```js
if (await Mistake.exists({ user: userId, question: q.text })) continue;
```

### Query operators — the `$` family

Operators nest inside the filter where a plain value would go: `{ field: { $op: value } }`.

**Comparison — `$gt`/`$gte`/`$lt`/`$lte`/`$ne`.** Real `$gt` from `otp.repository.js` (an OTP is valid only if not expired):

```js
Otp.findOne({
  user,
  purpose,
  consumedAt: null,
  expiresAt: { $gt: new Date() },
}).sort({ createdAt: -1 })
```

Real `$ne` from `tests.service.js` (`Test.find({ scheduledFor: { $ne: null } })` — "has a schedule label") and from `user.repository.js`:

```js
User.findOne({ username, _id: { $ne: excludeUserId }, ...notDeleted })
```

— "is this username taken by a *different* user," the classic profile-update check. `$gte`/`$lte` work identically (`{ mastery: { $gte: 50, $lt: 80 } }` would be "mastery in [50, 80)"); your services currently do range-ish filtering of small per-user arrays in JS (e.g. `topics.filter((t) => t.mastery < 50)` in `analytics.service.js`) — fine at per-user scale, but know the operator exists for when the data outgrows that.

**`$in`** — value is any of these. From `attempts.service.js`:

```js
const topics = await Topic.find({ user: userId, key: { $in: topicIds } });
```

One query fetches all requested topics instead of a loop of `findOne`s. Also inside an aggregation in `tests.service.js`: `{ subject: { $in: subjects } }`.

**`$regex` / RegExp** — pattern matching. Your `mistakes.service.js` builds a case-insensitive search over two fields, combined with **`$or`**:

```js
function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
// ...
if (str(q)) {
  const rx = new RegExp(escapeRegex(str(q)), "i");
  filter.$or = [{ question: rx }, { chapter: rx }];
}
```

A JS `RegExp` in a filter is equivalent to `{ $regex: ..., $options: "i" }`. Two lessons baked in: **escape user input** before compiling it into a pattern (else `.*` from a user breaks/abuses your search), and note the service also refuses non-string filter values (`typeof v === "string"`) so a crafted object like `{ $gt: "" }` can't be smuggled in as an operator — **operator injection** defense.

**`$exists`** — does the field exist at all (`{ time: { $exists: false } }` = docs missing the field entirely). Your codebase doesn't need it in queries — schemas give every field a `default`, so fields are always present — but its cousin **`$type`** guards the User partial indexes: `email: { $type: "string" }` (Module 3.2).

**`$elemMatch`** — match array elements where *one element* satisfies multiple conditions. From `user.repository.js`:

```js
User.findOne({
  authProviders: { $elemMatch: { provider, providerId } },
  ...notDeleted,
})
```

Why not `{ "authProviders.provider": provider, "authProviders.providerId": providerId }`? Because that form matches if *any* element has the provider and *any (possibly different)* element has the providerId. `$elemMatch` requires them on the **same** element — precisely what "this Google identity" means.

### Shaping results: `sort`, `limit`, `skip`, `select`

- **`sort({ field: 1 | -1 })`** — 1 ascending, −1 descending. Everywhere: `sort({ createdAt: -1 })` (mistakes, newest first), `sort({ xp: -1 })` (leaderboard), `sort({ submittedAt: -1, createdAt: -1 })` (test history — a two-key sort with a tiebreaker), `sort({ mastery: 1 })` (weakest topics first).
- **`limit(n)`** — cap the results. `dashboard.service.js`: `Mistake.find({ user: userId, status: "Pending" }).sort({ createdAt: -1 }).limit(4)` — the widget shows 4, so fetch 4.
- **`skip(n)`** — jump past n results; with `limit`, classic pagination (`mistakes.service.js` above: page N = skip `(N-1)*20`, limit 20). Caveat: the server still walks the skipped docs, so `skip(100000)` is slow — fine at your page depths, but "range-based pagination" (filter on `createdAt < lastSeen`) is the scalable alternative.
- **`select("a b")` / `select("-a")`** — projection: fetch only what you need. From `user.repository.js`, both directions:

  ```js
  User.findOne({ mobile, ...notDeleted }).select("_id")     // existence check: fetch nothing but the id
  User.findOne({ ... }).select("+passwordHash")             // opt IN to a select:false field
  ```

- A combined real chain, from `analytics.service.js`:

  ```js
  Topic.find({ user: userId }).sort({ mastery: 1 }).limit(5)
  ```

  "This user's five weakest topics" — filter, order, window, three links in a chain. (Chain order doesn't matter; execution is always filter → sort → skip → limit.)

### `lean()` — documents vs plain objects

Every result so far is a **hydrated document**: a Mongoose object carrying change tracking, virtuals, `.save()`, the `toJSON` transform. That machinery costs memory and CPU. `.lean()` says: give me **plain JS objects** — often several times faster for big read-only result sets.

Honest note: your codebase doesn't currently use `.lean()` anywhere. The clearest candidate is `backend/src/services/leaderboard.service.js`:

```js
const entries = await LeaderboardEntry.find({ scope, range }).sort({ xp: -1 });
```

It reads the *entire* scope/range slice (unbounded), immediately maps to plain result objects, and never mutates or saves — hydration buys nothing:

```js
const entries = await LeaderboardEntry.find({ scope, range }).sort({ xp: -1 }).lean();
```

The trade: lean objects have **no virtuals, no `toJSON` transform** (so `_id` and `__v` come back raw — Module 3.2's pitfall list), and **no `.save()`**. Rule: `lean()` for read-only lists you re-shape yourself; hydrated docs when you'll mutate/save or rely on virtuals/transforms.

### `populate()` — following refs

A ref field stores only an ObjectId. `populate("field")` runs a **second query** and splices the referenced document(s) in. Three real variants:

```js
// attempts.service.js — full populate of an array of refs:
const test = await Test.findOne({ code }).populate("questions");
// test.questions is now an array of full Question docs (with text/options/correctIndex)

// tests.service.js — populate with a PROJECTION (fetch only 2 fields of the ref):
const attempts = await TestAttempt.find({ user: userId, status: "submitted" })
  .populate("test", "code title")
  .sort({ submittedAt: -1, createdAt: -1 });

// analytics.service.js — same idea, different fields:
.populate("test", "code")
```

The second argument is a field list — fetching `code title` instead of whole Test docs (including their `questions` ObjectId arrays) keeps the payload tiny. After populating, `a.test?.code` — note the **optional chaining**: if the referenced Test was deleted, populate leaves `null` (Mongo doesn't enforce refs — Module 3.1), and `?.` plus a fallback (`a.test?.code ?? String(a.test)` in `tests.service.js`) keeps a dangling ref from crashing the endpoint.

Under the hood populate is: collect the distinct ids → one `$in` query per populated path → stitch in memory. It's a convenience join in your app's process, not a database join — cheap for one extra query, worth watching if you populate inside loops.

---

## In your codebase

The single most instructive real-world query flow to study end-to-end is **`submitAttempt`** in `backend/src/services/attempts.service.js` — it uses nearly everything above in ~60 lines: `findOne` with ownership filter → `findById().populate("questions")` → score in JS → mutate many fields and `save()` → `insertMany` mistakes → a `countDocuments` inside `gamification.service.js`. Read it now with fresh eyes.

Also re-read `backend/src/services/mistakes.service.js` → `listMistakes` as the canonical **dynamic filter builder**: start from `{ user: userId }`, conditionally add `status`, `category`, and an `$or` regex — then feed the *same* filter object to both `countDocuments` and the paginated `find` under `Promise.all`. One filter, two questions asked of it.

And keep the layering straight: services usually call models directly, but for auth-critical collections (User, Otp, RefreshToken, PasswordResetToken) all queries live in `backend/src/repositories/` so cross-cutting rules — `deletedAt: null`, transaction sessions, `select("+passwordHash")` — are applied in exactly one place.

---

## Pitfalls & gotchas

1. **`findOneAndUpdate` returns the OLD doc unless `{ new: true }`.** The number-one Mongoose gotcha. Your codebase never omits it — don't be the first.
2. **`find` → `[]`, `findOne` → `null`.** An empty array is truthy! `if (await Model.find(...))` is always true. Check `.length` for `find`, null for `findOne`.
3. **Updates skip validators by default.** Enums/required can be violated via `updateOne`/`findOneAndUpdate` unless you pass `runValidators: true` (as `user.repository.js` → `updateById` does).
4. **Never trust client filters.** Passing `req.query` straight into `find()` invites operator injection (`?status[$ne]=x`). Copy the defense in `mistakes.service.js`: whitelist fields, accept only strings, escape regex input.
5. **`skip()` gets slower the deeper you go.** It walks past skipped docs server-side. Fine for page 5; wrong for page 5000.
6. **Query objects execute per-await.** Awaiting the same query builder twice re-runs it; also `find()` without await inside `Promise.all` arrays is fine (thenable), but forgetting `await` entirely gives you a Query object, not data — `typeof result.then === "function"` is the tell.
7. **Populate can go null.** Always `?.` after populate (`a.test?.code`) — a dangling ref is data corruption you must *tolerate*, since Mongo won't prevent it.
8. **Read-modify-write races.** `doc.counter += 1; await doc.save()` under two concurrent requests loses one increment. Use `$inc` (see `otp.repository.js`) for counters; use single atomic `findOneAndUpdate` for check-and-set flows.

---

## Exercises

Solutions in [SOLUTIONS.md](./SOLUTIONS.md) (§ Module 3.3).

1. **(Trivial)** What does `StudyTask.find({ user: userId })` return when the user has no tasks — and what does `StudyTask.findOne({ user: userId })` return in the same situation?
2. **(Open file X)** Open `backend/src/services/tasks.service.js` → `setTaskDone`. Explain what would go wrong, precisely and observably, if `{ new: true }` were removed — trace the value the frontend receives.
3. **(Open file X)** Open `backend/src/repositories/user.repository.js` → `findByProvider`. Rewrite the filter *without* `$elemMatch` using dot-notation, then construct a concrete `authProviders` array for which your rewrite matches but `$elemMatch` correctly does not.
4. **(Write queries)** Using the real schemas, write Mongoose queries for: (a) all of a user's `Mistake` docs with priority High **or** Medium, newest first; (b) the count of a user's submitted `TestAttempt`s with `percentile ≥ 95`; (c) page 3 (20/page) of a user's `Notification`s, unread first then newest, fetching only `title`, `read`, `createdAt`.
5. **(Open file X)** In `backend/src/services/mistakes.service.js`, why are `countDocuments` and the paginated `find` wrapped in `Promise.all`? What is the cost of the "obvious" sequential version, and why must both calls receive the *same* `filter` object?
6. **(Concept — injection)** A request arrives as `GET /mistakes?status[$ne]=Mastered`. Express parses `status` as `{ "$ne": "Mastered" }`. Walk through `listMistakes` and state exactly which line neutralizes this and what the resulting Mongo filter is.
7. **(Refactor)** Rewrite `leaderboard.service.js`'s read as discussed to use `.lean()`, and explain (a) why it's safe *here*, and (b) one concrete thing that would break if you added `.lean()` to `dashboard.service.js`'s `Profile.findOne` instead… or would it? Check what `getDashboard` actually does with `profile` before answering.
8. **(Challenging — atomicity)** `saveResponse` in `attempts.service.js` does: load attempt → find index in `responses` → `set`/`push` → `save()`. Two autosaves for *different* questions race: describe an interleaving where one response is lost. Then sketch an atomic alternative for the "new response" case using a single `findOneAndUpdate` with `$push` (don't worry about the update-existing case).

---

**Next:** [Module 3.4 — Data Modeling & Performance](./04-modeling-and-performance.md) — embed vs reference, the full 25-model relationship map, indexes, and the aggregation pipeline.
