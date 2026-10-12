# Module 3 — Worked Solutions

> **Goal:** Full solutions to every exercise in Modules 3.1–3.4. Attempt each exercise honestly before reading; the learning happens in the attempt.

---

## § Module 3.1 — Database Fundamentals

### 1. Two problems a database solves that a variable can't

Example answer: (1) **Durability** — variables live in RAM and are wiped by any restart or crash; a database writes to disk so data survives. (2) **Scale/shared access with fast lookup** — a database lets many processes read and write the same data concurrently and uses indexes to find records among millions without scanning everything, which in-memory variables in one process can't do.

### 2. Pool and timeout values

From `backend/src/config/database.js`:

- `maxPoolSize: 20` — the driver keeps at most 20 open connections to MongoDB; queries borrow one each, so up to 20 queries run truly in parallel and the 21st waits for a free connection. (`minPoolSize: 2` keeps two warm even when idle.)
- `serverSelectionTimeoutMS: 10000` — when the driver can't find a reachable, suitable server, it keeps trying for 10 seconds before failing the operation. It bounds *how long one connection attempt hangs* before the retry loop sees the error.

### 3. Missing `MONGODB_URI`

In `backend/src/config/env.js`, `const REQUIRED = ["MONGODB_URI"]` and `ensureRequired()` filters for required vars that are unset or blank. If any are missing it prints

```
[env] Missing required environment variable(s): MONGODB_URI
[env] Copy .env.example to .env and fill them in.
```

and calls **`process.exit(1)`** — the process dies immediately at import time, before Express or Mongoose start. (It deliberately uses `console.error` because the logger isn't initialized yet.) Fail-fast: an API with no database URI can't do anything useful, so refusing to boot beats booting broken.

### 4. Collection names

Mongoose lowercases and pluralizes the *model name*: `mongoose.model("StudyTask", ...)` → collection **`studytasks`**. For ExamDNA, open `backend/src/models/examDna.model.js` — the model is registered as `mongoose.model("ExamDNA", examDnaSchema)`, and Mongoose's pluralizer produces **`examdnas`**. The lesson: the collection name comes from the registration string, not the file name or export name (the barrel exports it as `ExamDNA`).

### 5. ObjectId structure

The **first 4 bytes** (first 8 hex chars, `66b1f2a4`) are a Unix timestamp — the creation second. Because the timestamp is the most significant part, sorting by `_id` orders documents approximately by creation time for free, with no extra field or index.

### 6. When `connectDatabase` throws

Inside the retry loop: `if (attempt === retries) throw err;` — it throws only after the **final** (5th by default) failed attempt; earlier failures sleep 3 s and retry. The throw propagates to the caller in `backend/src/index.js`, so startup fails and the process exits — correct at boot, because serving HTTP without a database yields nothing but 500s, and a crash lets the process manager restart it cleanly. Mid-flight is different: the `disconnected` event handler just logs a warning and flips `isConnected`, because the driver auto-reconnects; killing a live process (dropping all in-flight requests) over a transient network blip would turn a hiccup into an outage.

### 7. 30 concurrent requests, pool of 20

Requests 1–20 each borrow a connection and finish in ~100 ms. Requests 21–30 queue inside the driver waiting for a connection to be returned; as the first batch completes, they acquire connections and run. So the slowest requests take roughly **two query-times ≈ 200 ms** (100 ms waiting + 100 ms querying), assuming even distribution. The single config change: raise `maxPoolSize` (e.g. to 30+), trading more open sockets/server load for less queueing. (Bonus insight: brief queueing is often fine — pools exist precisely to smooth bursts.)

### 8. Leaderboard denormalization trade-off

`backend/src/models/leaderboardEntry.model.js` stores `name`, `institute`, `state` directly (plus a *nullable* `user` ref).

- **Benefit:** rendering a leaderboard page needs a single query — no populate of hundreds of User/Profile docs per page view; it also allows synthetic rows with `user: null` that correspond to no real account.
- **Failure mode:** the copies go stale. If a user renames themselves or changes institute in their profile, existing entries keep the old strings.
- **When it surfaces:** the user edits their profile, then opens `/app/leaderboard` — their row (found via the `isYou` check on the `user` ref in `leaderboard.service.js`) still shows the *old* name/institute until some job rewrites entries. Data isn't lost, it's *inconsistent between two screens* — the classic denormalization symptom.

---

## § Module 3.2 — Mongoose Schemas & Models

### 1. Schema / model / document via StudyTask

- **Schema:** `studyTaskSchema` — the blueprint declaring fields (`user`, `date`, `title`, …), types, defaults, enum, indexes; holds no data.
- **Model:** `StudyTask` — the class compiled by `mongoose.model("StudyTask", studyTaskSchema)`, bound to the `studytasks` collection; what you query (`StudyTask.find(...)`).
- **Document:** one actual task instance returned by a query or `create()` — real data plus `.save()`, virtuals, and the `toJSON` transform.

### 2. Enums in `mistake.model.js`

| Field | Allowed values | Default |
|---|---|---|
| `category` | `"Concept Error"`, `"Formula Error"`, `"Calculation Error"`, `"Guess"`, `"Memory Error"`, `"Time Pressure"`, `"Careless Mistake"` | none — the field is `required` |
| `priority` | `"High"`, `"Medium"`, `"Low"` | `"Medium"` |
| `status` | `"Pending"`, `"Revised"`, `"Mastered"` | `"Pending"` (also `index: true`) |

### 3. One profile per user

The ref itself is a unique index:

```js
user: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  required: true,
  unique: true,
  index: true,
},
```

`unique: true` on `user` makes MongoDB reject a second Profile document with the same user id (`E11000`), turning "1-to-1" from a convention into a database-enforced invariant.

### 4. `select: false` *and* the `toJSON` delete

Not redundant — they guard different doors. `select: false` stops the hash leaving the **database** on ordinary queries. But login code legitimately opts back in: `user.repository.js` → `findByEmailWithPassword` uses `.select("+passwordHash")`. Scenario: the auth service loads a user with the hash to verify a login, then (perhaps via an error path or careless refactor) that same *hydrated document* gets passed to `res.json(...)`. At that moment `select: false` has already been bypassed — the only thing preventing the hash from serializing is the transform's `delete ret.passwordHash`. Two independent layers, one for "don't fetch by default," one for "never serialize regardless."

### 5. Why plain `unique: true` on `mobile` would break signup

From `user.model.js`:

```js
userSchema.index(
  { mobile: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null, mobile: { $type: "string" } } },
);
```

1. **The null-collision problem.** Many users sign up by email/OAuth with `mobile: null`. A plain unique index treats `null` as a value: the *first* mobile-less user inserts fine, the *second* hits `E11000 duplicate key: mobile: null`. `mobile: { $type: "string" }` keeps null-mobile docs out of the index entirely, so any number of them coexist.
2. **The deleted-user problem.** With plain unique, a soft-deleted account (doc still exists!) would hold its number hostage forever — the person could never re-register. `deletedAt: null` in the filter drops deleted users from the index, freeing the number while preserving the old document for audit.

### 6. `_id: false` vs `_id: true` subdocuments

- `authProviderSchema` (`_id: false`): a provider link is *identified by its content* (`provider` + `providerId`); nothing ever addresses "auth provider entry #3" individually — lookups use `$elemMatch` on the fields, and `$addToSet` needs entries to be pure value objects. An `_id` would be dead weight (and would actually break `$addToSet` de-duplication, since each entry would differ by its generated `_id`).
- `messageSchema` (`_id: true`): chat messages need stable individual identity — the frontend renders lists keyed by id, and future features (edit/delete one message, deep-link to a message) must address a specific element. Content can't identify it (two identical "ok" messages are distinct messages).

### 7. `pinnedResource.model.js`

```js
import mongoose from "mongoose";

/**
 * PinnedResource model — a study resource (video/article/pdf) the user pinned.
 */
const pinnedResourceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    url: { type: String, required: true, trim: true },
    label: { type: String, required: true },
    kind: {
      type: String,
      enum: ["video", "article", "pdf"],
      default: "article",
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      },
    },
  },
);

pinnedResourceSchema.index({ user: 1, kind: 1 });

export const PinnedResource =
  mongoose.models.PinnedResource || mongoose.model("PinnedResource", pinnedResourceSchema);

export default PinnedResource;
```

Barrel line for `backend/src/models/index.js`:

```js
export { PinnedResource } from "./pinnedResource.model.js";
```

(Checklist you should have hit: required+indexed owning ref · trim on url · enum with default · `timestamps` · standard transform · compound index · the `mongoose.models.X ||` re-registration guard.)

### 8. RefreshToken security design

- **(a) Hash-only storage** defeats *database-leak replay*: if an attacker dumps the `refreshtokens` collection, they get SHA-256 hashes, from which the raw JWTs cannot be reconstructed — so nothing in the dump can be presented to `/auth/refresh`. (The server verifies by hashing the presented raw token and comparing.)
- **(b) TTL is approximate** because MongoDB's TTL monitor is a background thread sweeping roughly every 60 seconds — a doc may outlive `expiresAt` by up to a minute (more under load). Acceptable because TTL here is *garbage collection*, not security: the security check is (c).
- **(c) The `isActive` virtual is still required** — `!this.revokedAt && this.expiresAt.getTime() > Date.now()` — for two reasons: the doc may still exist in its post-expiry grace window (b), and more importantly TTL knows nothing about **revocation**: a token revoked on logout/rotation (`revokedAt` set) sits unexpired in the DB precisely so that *reuse of a rotated token can be detected as theft* (see the model's doc comment). Auth logic must check real validity per request; TTL just keeps the collection from growing forever.

---

## § Module 3.3 — Query Mastery

### 1. Empty results

`find` → `[]` (an empty array — truthy, remember). `findOne` → `null`. Neither throws.

### 2. Removing `{ new: true }` from `setTaskDone`

`findOneAndUpdate` would still perform the update in the database, but would **return the pre-update document**. Trace with a task currently `done: false` and a request to set it true: DB now holds `done: true`, but `task.done` in the service is `false`, so the endpoint responds `{ id, done: false }`. The frontend un-checks the checkbox the user just checked (or its optimistic state gets "corrected" to wrong). Refreshing the page shows it checked — because the DB was right all along. A silent, confusing UI lie: the update happened but the response reports the old state.

### 3. `findByProvider` without `$elemMatch`

Dot-notation rewrite:

```js
User.findOne({
  "authProviders.provider": provider,
  "authProviders.providerId": providerId,
  ...notDeleted,
})
```

Counterexample where this wrongly matches — a user with two linked providers:

```js
authProviders: [
  { provider: "google", providerId: "G-111" },
  { provider: "apple",  providerId: "A-222" },
]
```

Query for `provider: "google", providerId: "A-222"`: dot-notation matches (element 1 satisfies the provider condition, element 2 satisfies the providerId condition — each condition may be satisfied by a *different* element), so an Apple id "authenticates" against the Google slot. `$elemMatch` requires one *single* element to have both `provider: "google"` **and** `providerId: "A-222"` — no element does, so it correctly returns null.

### 4. Three queries

```js
// (a) High or Medium priority mistakes, newest first
const docs = await Mistake.find({
  user: userId,
  priority: { $in: ["High", "Medium"] },
}).sort({ createdAt: -1 });

// (b) count of submitted attempts at percentile ≥ 95
const n = await TestAttempt.countDocuments({
  user: userId,
  status: "submitted",
  percentile: { $gte: 95 },
});

// (c) page 3 of notifications, unread first then newest, 3 fields only
const page = await Notification.find({ user: userId })
  .sort({ read: 1, createdAt: -1 })   // false < true → unread first; then newest
  .skip(2 * 20)                        // page 3 ⇒ skip (3−1)×20
  .limit(20)
  .select("title read createdAt");
```

Notes: (a) also accepts `{ $or: [{ priority: "High" }, { priority: "Medium" }] }` — `$in` is the cleaner form for one field. (c)'s sort is exactly what notification.model.js's `{ user: 1, read: 1, createdAt: -1 }` index is shaped for.

### 5. `Promise.all` in `listMistakes`

The count and the page fetch are **independent** — neither needs the other's result — so running them concurrently costs max(t₁, t₂) instead of the sequential t₁ + t₂; on a remote database (Atlas) that's one network round-trip time saved per request, on every page load. They must share the *same* `filter` object because the UI contract is "total results for **this** filter" driving the pagination controls: if the count used a different filter than the page (say, count unfiltered but page filtered), the UI would show "247 results" over a list that can only ever produce 30 — page numbers pointing at nothing.

### 6. Operator injection walkthrough

Express parses `?status[$ne]=Mastered` into `req.query.status = { "$ne": "Mastered" }`. Inside `listMistakes`:

```js
const str = (v) => (typeof v === "string" && v ? v : undefined);
if (str(status)) filter.status = str(status);
```

`typeof {"$ne": "Mastered"} === "object"`, not `"string"`, so `str(status)` returns `undefined` and the `if` never adds `status` to the filter. **That `typeof` check is the neutralizing line.** The resulting Mongo filter is just `{ user: userId }` (plus any other *valid* params) — the injected operator is dropped rather than executed. Without the guard, the filter would become `{ user, status: { $ne: "Mastered" } }` — an attacker-chosen query condition; harmless-looking here, but the same door admits `$regex` DoS patterns or, in login-style queries, `{ $gt: "" }` password bypasses. Whitelist-and-type-check is the pattern.

### 7. `lean()` on the leaderboard

```js
const entries = await LeaderboardEntry.find({ scope, range }).sort({ xp: -1 }).lean();
```

- **(a) Safe here** because the service is a pure read that immediately re-maps every doc into its own plain shape (`{ rank, name, institute, ... }`) — it never calls `.save()`, uses no virtuals, and never `res.json`'s the raw docs, so losing hydration and the `toJSON` transform changes nothing observable. It's also the query fetching the *most* documents in the app (a whole scope/range slice), so it's where hydration overhead is largest.
- **(b) The dashboard's `Profile.findOne`** — check `getDashboard`: it only *reads* fields off `profile` (`profile?.streak`, `profile?.xp`, …) into a hand-built `student` object; the doc is never saved or serialized directly. So — trick answer — `.lean()` would actually be safe there too, just with negligible benefit (one small doc). The point of the exercise: "would `.lean()` break this?" is answered by *how the result is used* (mutation? virtuals? direct serialization?), not by dogma. Where it *would* break things: any code returning the document itself to `res.json` (you'd leak `_id`/`__v` and lose the `id` field the frontend expects), or any code calling `.save()` after.

### 8. The `saveResponse` race and an atomic `$push`

**Lost-update interleaving** (two autosaves, questions 5 and 9, neither yet in `responses`):

1. Request A loads the attempt → `responses = []`.
2. Request B loads the attempt → `responses = []` (same state).
3. A pushes `{questionId: 5, ...}` and `save()`s → DB has `[5]`.
4. B pushes `{questionId: 9, ...}` onto **its stale copy** and `save()`s → B writes its whole array `[9]` — DB now has `[9]`. **Question 5's answer is gone.**

Each request modified a private in-memory copy; last write wins at the array level. Atomic alternative for the new-response case — make the DB do the append:

```js
await TestAttempt.updateOne(
  { _id: attemptId, user: userId, "responses.questionId": { $ne: questionId } },
  { $push: { responses: { questionId, selectedIndex, status, marked, timeSpentSec } } },
);
```

`$push` appends server-side without replacing the array, so concurrent pushes of different questions both survive; the `"responses.questionId": { $ne: questionId }` guard makes it a no-op if that question was already saved (the update-existing case would be a companion `updateOne` with the `responses.$` positional operator — beyond the exercise). The principle: *ship the operation to the data, don't ship the data to the operation.*

---

## § Module 3.4 — Data Modeling & Performance

### 1. Embed or reference

- **(a) Responses → embed** (as `testAttempt.model.js` does): only ever read with their attempt, bounded by the test's question count, updated atomically with the attempt's status/score. Heuristics: "read with parent" + "atomic parent+child writes."
- **(b) Mistakes → reference** (own collection with a `user` ref): queried independently (filtered, searched, paginated on their own page) and unbounded over a student's career. Heuristics: "queried on its own" + "unbounded growth."
- **(c) A test's questions → reference** (`Test.questions: [ObjectId]`): one question belongs to many tests — embedding would duplicate the text/options/answer into every test and edits would diverge. Heuristic: "shared by many parents."

### 2. StudyPlan's two-level embedding

`studyPlanSchema` embeds `days: [planDaySchema]`, and each day embeds `items: [planItemSchema]` — plan → days → items, all inside one document. Items are *not* refs to `StudyTask` because a plan item and a task are different things with different lifecycles: an item is a lightweight *proposal* inside the plan (title/subject/minutes/type — note: no `done`, no `date` of its own, no `_id`), read and written only as part of the whole plan, and naturally bounded (7–31 days × a few items). A StudyTask is a live, individually addressable to-do the user checks off day by day. Referencing would force every plan render through dozens of populates and would couple editing a plan draft to mutating real tasks.

### 3. Unique vs non-unique compound date indexes

- `studyLog`: `{ user: 1, date: 1 }, { unique: true }` — the model's *meaning* is "**one** activity record per user per day" (a heatmap cell). Two logs for the same day would make the heatmap ambiguous, so the index enforces the business rule; writers must upsert/increment the day's single doc.
- `weeklyGoal`: `{ user: 1, weekStart: 1 }` without unique — a user legitimately has **several goals in the same week** ("6 mocks," "40 hours," …: distinct `label`/`target`/`unit` rows sharing one `weekStart`). The index exists purely to make "this user's goals for this week" fast; uniqueness would break the feature.

### 4. Prefix rule on `{ user: 1, status: 1, category: 1 }`

- (a) `{ user }` — **yes**: `user` is a prefix.
- (b) `{ user, category }` — **the interesting case**: partially. The index narrows to the `user` prefix efficiently, but because `status` (the middle key) is unconstrained, `category` can't be used to *seek* — the DB scans all of that user's index entries and filters by category (still far better than a collection scan; per-user that's cheap). A dedicated `{ user: 1, category: 1 }` index would be needed to make it a pure seek.
- (c) `{ status }` — **no**: `status` is not a prefix; without leading `user` the index is ordered by user first, so status values are scattered — full scan (or a different index).
- (d) `{ user, status }` — **yes**: exactly the first two keys, a proper prefix.

### 5. The `createCustomTest` pipeline

- `{ $match: scoped }` — narrows the stream to candidate questions; `scoped` is `{ subject: { $in: subjects } }` when subjects were requested, or `{}` (match everything) otherwise. Filtering *first* means `$sample` draws only from eligible docs.
- `{ $sample: { size: n } }` — picks `n` random documents inside the database; no way to express this with `find`, and the alternative (fetch all, shuffle in Node) would ship the whole question bank over the wire.
- `{ $project: { _id: 1 } }` — strips everything but ids, because the caller only needs refs to store in `Test.questions` (and, security-relevant: `correctIndex` never leaves the DB here).

The fallback re-runs without `$match` when the subject-scoped sample comes back empty — i.e. the bank has no questions for those subjects yet. It protects the UX of "Create custom test": instead of a dead-end error, the student still gets *a* practice test drawn from the full bank. (The code then still throws `badRequest` only if the bank is entirely empty.)

### 6. Mistakes-by-subject pipeline

```js
const rows = await Mistake.aggregate([
  { $match: { user: new mongoose.Types.ObjectId(userId) } },
  { $group: {
      _id: "$subject",
      pending: { $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] } },
      total:   { $sum: 1 },
  } },
  { $sort: { pending: -1 } },
]);
// → e.g. [{ _id: "Physics", pending: 7, total: 19 }, { _id: "Maths", pending: 3, total: 11 }]
```

Two details worth noticing: aggregation **bypasses Mongoose casting**, so the string `userId` must be wrapped in `new mongoose.Types.ObjectId(...)` yourself (in `find()`, Mongoose casts for you); and `$cond` inside `$sum` is the standard "count only rows matching a condition" idiom — sum 1 for Pending, 0 otherwise, while `$sum: 1` counts everything.

### 7. The leaderboard recompute job

A worked design (variations are fine if they hit the same points):

- **Reads:** `TestAttempt` (status `"submitted"`, `submittedAt` within the range window) for scoring; `Profile` joined per user for `xp`, `streak`, `accuracy`, `institute`, `state`; `User` for `fullName` (and to skip `deletedAt != null` users).
- **Pipeline sketch (per `range`):** `$match` submitted attempts in-window → `$group` by `$user` (aggregate score/accuracy) → `$lookup` profiles and users → `$project` the denormalized row `{ user, name: fullName, institute, state, xp, accuracy, streak }` → `$sort { xp: -1 }` → `$limit` (e.g. top 500). Derive `scope` variants by re-grouping/filtering on `state` and `institute`; `"overall"` skips the date `$match`.
- **Schedule:** via the app's BullMQ infrastructure (`createQueue("leaderboard")` from `backend/src/jobs/queue.js`) — a repeatable job, e.g. every 15 minutes for `weekly`, hourly for `monthly`/`overall`. Staleness of minutes is acceptable for a leaderboard.
- **Idempotent write:** two sound options. *Delete-and-insert:* for each `(scope, range)`, `deleteMany({ scope, range })` then `insertMany(rows)` — simplest, but a reader mid-swap sees a partial board (mitigate: write to a temp marker/generation field, or wrap in a transaction). *Upsert per row:* `bulkWrite` of `updateOne({ user, scope, range }, { $set: row }, { upsert: true })` — no empty window, but you must also remove users who dropped off the board (a follow-up `deleteMany` on entries not in the new set, matchable via a `generation` timestamp field). Either way, re-running the job twice must yield the same state — that's the idempotency requirement.
- **Denormalized from `profile.model.js`:** `xp`, `accuracy`, `streak`, `institute`, `state` (and `fullName` from User) — exactly the fields `leaderboardEntry.model.js` already declares, which is the tell that the schema was designed for this job to exist.

### 8. Rate limiting across 3 replicas — and why tasks stay in Mongo

**Why in-memory breaks:** each replica keeps its own counter, and the load balancer spreads requests. With a limit of 100 req/min, a client sending 300 req/min lands ~100 on each replica — every replica sees "100/100, fine" and the client gets **3× the intended limit**. Worse, the enforcement is non-deterministic (depends on LB distribution), and a replica restart resets its counters entirely.

**How Redis fixes it:** `backend/src/middlewares/rateLimiter.js` plugs a `RedisStore` into the limiter when Redis is up (the code comment says it exactly: "so limits hold across instances"). All replicas increment *one shared counter* keyed by client in Redis — atomic increments, one number, 300 req/min is seen as 300 wherever the requests land. Redis is ideal for this data: tiny, hot, needs atomic `INCR`, and worthless after its 60-second window — losing it on a Redis restart merely resets rate windows.

**Why the same argument doesn't move StudyTask to Redis:** the shared-across-replicas property is necessary but not sufficient — Mongo is *also* shared across replicas. What Redis trades away is durability and rich querying: it's in-memory (a crash/flush loses data — acceptable for counters, catastrophic for a student's study plan) and has no schema validation, no secondary indexes for `{ user, date }` queries, no document model for the task's fields. StudyTasks are exactly the "losing it would anger a user" data from the module's dividing line: they belong in the durable source of truth, with Redis (optionally) *in front* as a disposable cache — never *instead*.

---

*End of Module 3 solutions. If any answer surprised you, re-open the referenced file and trace the code — the codebase is the textbook.*
