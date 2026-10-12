# Module 3.2 — Mongoose Schemas & Models

> **Goal:** Master the layer that gives your permissive database its rules. You'll learn every schema option your codebase actually uses, then walk **line by line** through `backend/src/models/user.model.js` (partial indexes, soft delete, `toJSON` transform, subdocuments) and `backend/src/models/studyTask.model.js`, and finish with the barrel pattern in `backend/src/models/index.js`.

---

## Concepts

### Schema vs Model vs Document

Three words Mongoose uses constantly:

- A **Schema** is a *blueprint*: which fields exist, their types, validation rules, defaults, indexes. It's pure configuration — it touches no data.
- A **Model** is a *class compiled from a schema*, bound to a collection. It's what you call methods on: `User.findOne(...)`, `StudyTask.create(...)`.
- A **Document** is one *instance*: the object you get back from a query or `create()`. It has your data plus methods like `.save()` and any virtuals.

```
Schema (blueprint) --mongoose.model()--> Model (class ↔ collection) --queries--> Documents (instances)
```

Remember from Module 3.1: MongoDB itself doesn't enforce any of this. Nothing stops a raw driver from writing `{ done: "banana" }` into `studytasks`. The schema is a contract enforced *by your Node process* — which is exactly why all reads/writes should go through the models.

### Every schema option used in this codebase

All examples below are quoted from real model files in `backend/src/models/`.

**`type`** — the field's data type. Your models use `String`, `Number`, `Boolean`, `Date`, `mongoose.Schema.Types.ObjectId`, `mongoose.Schema.Types.Mixed`, and arrays of each (`[String]`, `[authProviderSchema]`). Mongoose *casts* incoming values to the type ("5" → 5 for a Number) and rejects what it can't cast.

**`required: true`** — the document cannot be saved without this field. Validation error otherwise. E.g. `title: { type: String, required: true }` in `studyTask.model.js`. Note what your User model *doesn't* require: email, mobile, username are all optional — the auth *service* decides which combination a given signup flow needs. Schema-level `required` is for invariants that hold in **every** flow.

**`default`** — value used when the field is absent at creation. Can be a value (`default: 0`, `default: null`, `default: []`) or a function (`startedAt: { type: Date, default: Date.now }` in `testAttempt.model.js` — note it's the function *reference*, not `Date.now()`, so it's evaluated per-document at creation time).

**`enum`** — a whitelist of allowed values. From `mistake.model.js`:

```js
status: {
  type: String,
  enum: ["Pending", "Revised", "Mastered"],
  default: "Pending",
  index: true,
},
```

Saving `status: "Done"` throws a ValidationError. Enums turn "stringly-typed" fields into safe finite state machines — the DB-level cousin of a TypeScript union type.

**`trim: true`** — strips leading/trailing whitespace before saving. `"  Vartika  "` → `"Vartika"`. Used on `email`, `username`, `mobile`, `fullName` in `user.model.js`. Cheap insurance against copy-paste whitespace breaking equality checks.

**`lowercase: true`** — lowercases before saving. On `email` in `user.model.js`: `Vartika55@Gmail.com` and `vartika55@gmail.com` must be the *same account*, so normalize at write time. Crucially, queries must match: `user.repository.js` always queries `email.toLowerCase()` — normalization must be symmetric on both write and read.

**`select: false`** — the field is **excluded from every query result by default**. The one use in your codebase is the most important field in the app:

```js
// user.model.js
passwordHash: {
  type: String,
  select: false,
  default: null,
},
```

`User.findOne({...})` returns a user with **no** `passwordHash` property. Only code that explicitly opts in gets it — `user.repository.js`:

```js
User.findOne({ email: email.toLowerCase(), ...notDeleted }).select("+passwordHash")
```

The `+` prefix means "additionally include this hidden field." Defense in depth: even if a presenter forgets to strip it, it was never fetched.

**`index: true`** — build a secondary index on this field for fast lookups (full story in Module 3.4). Used on nearly every `user` ref field, plus `role` and `deletedAt` in `user.model.js`.

**`unique: true`** — a *unique index*: the DB rejects a second document with the same value. E.g. `code: { type: String, required: true, unique: true }` in `test.model.js`, and `user` in `profile.model.js` (enforcing one profile per user — that's how a 1-to-1 relationship is guaranteed in Mongo). Two gotchas: (1) `unique` is an **index property, not a validator** — violations surface as a MongoDB `E11000 duplicate key` error, not a Mongoose ValidationError; (2) plain `unique` treats `null` as a value, so two users with `email: null` would collide — which is exactly why your User model uses **partial indexes** instead (below).

**`timestamps: true`** (schema option, second argument) — Mongoose automatically maintains `createdAt` and `updatedAt` on every document. Every model in your app uses it. Free audit trail, and the standard sort key ( `sort({ createdAt: -1 })` all over your services).

**Subdocuments** — a schema nested inside another schema; the child documents live *inside* the parent document (embedding — Module 3.4 covers when to embed vs reference). From `user.model.js`:

```js
const authProviderSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: ["google", "apple"], required: true },
    providerId: { type: String, required: true },
    email: { type: String, default: null },
  },
  { _id: false },
);
```

`{ _id: false }` means child entries don't get their own `_id` (they're not addressed individually). Compare `aiChat.model.js`, whose `messageSchema` uses `{ _id: true }` — chat messages *do* need stable identities. Other subdocument examples: `responseSchema` and `subjectBreakdownSchema` in `testAttempt.model.js`, `planDaySchema`/`planItemSchema` in `studyPlan.model.js`.

**Refs** — how documents point at documents in *other* collections:

```js
// studyTask.model.js
user: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  required: true,
  index: true,
},
```

What's stored is just an ObjectId. `ref: "User"` is metadata for Mongoose telling `populate()` (Module 3.3) which model to fetch the full document from. There is no foreign-key enforcement — the ref can dangle.

**`Mixed`** — the escape hatch: `preferences: { type: mongoose.Schema.Types.Mixed, default: {} }` in `profile.model.js` stores any shape at all (free-form settings groups). Cost: no validation, and Mongoose can't detect mutations inside it (you must call `markModified("preferences")` if you mutate it in place — your `settings.service.js` avoids this by replacing the whole object via `updateOne`).

**Virtuals** — computed properties that are *not stored*, e.g. `initials` on User (below) and `isActive` on `refreshToken.model.js`:

```js
refreshTokenSchema.virtual("isActive").get(function isActive() {
  return !this.revokedAt && this.expiresAt.getTime() > Date.now();
});
```

Derived truth stays derived — you can't forget to update a stored copy.

**TTL indexes** — not a field option but an index option worth meeting now (all four token models use it):

```js
// refreshToken.model.js / otp.model.js / passwordResetToken.model.js / emailVerificationToken.model.js
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

MongoDB itself deletes the document once `expiresAt` passes (a background sweep runs ~every 60 s, so expiry is approximate). Self-cleaning collections — no cron job needed. This only works because `expiresAt` is a real BSON `Date` (Module 3.1).

---

## In your codebase

### Line-by-line: `backend/src/models/user.model.js`

This is the richest model in the app. Open it and follow along.

**The doc comment (lines 4–21).** Read it — it *is* the design document. Key decision: identity is flexible (mobile OTP, email, or OAuth), so `email`/`username`/`mobile`/`passwordHash` are all optional at the schema level and each auth flow enforces its own combination in the service layer. (Context: the frontend contract is mobile/OTP-first — see the auth-contract note in your project memory.)

**The subdocument (lines 22–29):**

```js
const authProviderSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: ["google", "apple"], required: true },
    providerId: { type: String, required: true },
    email: { type: String, default: null },
  },
  { _id: false },
);
```

One linked social login. `providerId` is Google/Apple's stable ID for the person. Embedded (not a separate collection) because provider links are few, only ever needed *with* the user, and queried during login. Later, `authProviders: { type: [authProviderSchema], default: [] }` embeds an array of these — one user can link both Google *and* Apple. `user.repository.js` queries into it with `$elemMatch`, and adds entries idempotently with `$addToSet` (Module 3.3).

**Identity fields (lines 33–53).** `email` gets `lowercase + trim + default: null`; `username`/`mobile` get `trim + default: null`; `passwordHash` gets `select: false + default: null` (OAuth-only users legitimately have no password). Note none are `required` and none say `unique` — uniqueness comes later, done properly.

**Profile-ish fields (lines 54–90).** `fullName` is the *only* required identity field — every flow collects a name. `role` uses `enum: ROLE_VALUES` imported from `backend/src/constants/roles.js` (single source of truth shared with the authorization middleware) with `default: ROLES.STUDENT` and `index: true` (admin screens filter by role). Then booleans with sensible defaults (`isEmailVerified`, `isMobileVerified`, `isActive`), `lastLoginAt`, the `authProviders` array, and nullable RankOS profile fields (`exam`, `institute`, `state`, `avatarUrl`).

**Soft delete (lines 92–96):**

```js
deletedAt: {
  type: Date,
  default: null,
  index: true,
},
```

When a user deletes their account, the app does **not** run a Mongo delete. `user.repository.js` → `softDelete()` sets `{ deletedAt: new Date(), isActive: false }`. Why?

- Nothing orphans: mistakes, attempts, tasks still reference a document that exists.
- Recovery and audit are possible ("restore my account", legal retention).
- The document stays out of sight because **every read filters it out**: the repository spreads `const notDeleted = { deletedAt: null }` into every single query filter.

The cost: "deleted" must be enforced by convention in every query — which is precisely why *all* User access is funneled through the repository ("the ONLY place that talks to the User collection," per its doc comment).

**Schema options (lines 98–111):**

```js
{
  timestamps: true,
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform(_doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.passwordHash;
      delete ret.deletedAt;
      return ret;
    },
  },
},
```

`toJSON` runs whenever a document is serialized — i.e. whenever Express `res.json(user)` happens. This transform is the model's **public face**:

- `virtuals: true` — include computed props (`initials`) in API output.
- `versionKey: false` — drop Mongoose's internal `__v` field.
- `ret.id = ret._id; delete ret._id` — the API speaks `id`, not the Mongo-ism `_id`. Frontend never learns Mongo exists.
- `delete ret.passwordHash; delete ret.deletedAt` — belt *and* suspenders: `select: false` already hides the hash from queries; this guarantees it never serializes even if someone did `.select("+passwordHash")` and then `res.json`'d the doc.

Nearly every model in the app repeats this `toJSON` pattern — consistency is the point.

**Partial unique indexes (lines 114–127)** — the subtlest, best part of this file:

```js
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null, email: { $type: "string" } } },
);
```

(Same shape for `username` and `mobile`.) A **partial index** only indexes documents matching the filter — and a *unique partial* index only enforces uniqueness among those. Two problems solved at once:

1. **`email: { $type: "string" }`** — only docs where email is actually a string are indexed. Millions of users with `email: null` (mobile-only signups) never collide. A plain `unique: true` would allow exactly *one* null-email user, then reject every mobile signup after the first. This is the Mongo idiom that replaces SQL's "unique where not null."
2. **`deletedAt: null`** — deleted users leave the index, so their email/username/mobile become reusable by new signups, while the old document still exists for audit.

**The provider lookup index (line 129):**

```js
userSchema.index({ "authProviders.provider": 1, "authProviders.providerId": 1 });
```

Dot-notation indexes *into the subdocument array* (a "multikey" index — one index entry per array element), making the OAuth-callback query in `findByProvider` fast.

**The virtual (lines 132–137):**

```js
userSchema.virtual("initials").get(function initials() {
  const parts = String(this.fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
});
```

"Vartika Sharma" → "VS". Note the classic `function` (not arrow) — a virtual getter's `this` must be the document, and arrow functions don't bind `this`.

**Model registration (line 139):**

```js
export const User = mongoose.models.User || mongoose.model("User", userSchema);
```

`mongoose.model("User", ...)` compiles and registers globally. Calling it twice for the same name throws `OverwriteModelError` — a real hazard when test runners or dev hot-reload re-import modules. The `mongoose.models.User ||` guard means "reuse if already compiled." Every model file in your app ends with this exact pattern.

### Full walkthrough: `backend/src/models/studyTask.model.js`

A compact model — perfect for seeing the whole anatomy in one screen:

```js
const studyTaskSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    date: { type: String }, // "YYYY-MM-DD"
    title: { type: String, required: true },
    subject: { type: String },
    minutes: { type: Number, default: 0 },
    type: {
      type: String,
      enum: ["Concept", "Practice", "Revision", "Mock", "Analysis"],
      default: "Concept",
    },
    done: { type: Boolean, default: false },
    time: { type: String, default: null },
  },
  {
    timestamps: true,
    toJSON: { /* same id/_id transform as User */ },
  },
);

studyTaskSchema.index({ user: 1, date: 1 });
```

- **`user`** — the *owning ref*. `required` (a task can't be orphaned by construction) and indexed (every query filters by it). This exact field appears in ~20 of your models; it is *the* structural pattern of the app.
- **`date` as a `String`** `"YYYY-MM-DD"`, not a `Date`. Deliberate: a task belongs to a *calendar day* in the student's life, not to an instant. A `Date` is a UTC timestamp — "today" then depends on timezone math and midnight boundaries. A `"2026-08-11"` string is timezone-proof, and because ISO format sorts lexicographically = chronologically, string sorting/equality just works. Same choice in `studyLog`, `studyPlan`, `weeklyGoal`. Trade-off: no date *arithmetic* in queries, and nothing stops a malformed string — the service layer formats it (`new Date().toISOString().slice(0, 10)` in `tasks.service.js`).
- **`type` enum** — the five planner categories, defaulting to `"Concept"`. UI chips map 1:1 to this enum.
- **`done`, `minutes`, `time`** — defaults mean `create()` can pass only `user + title` and get a valid doc. `time` is a nullable human label ("07:30"), used as a sort key by `listTasks` (`sort({ time: 1 })`).
- **The compound index** `{ user: 1, date: 1 }` exists because the hot query is `StudyTask.find({ user: userId, date: day })` — "this user's plan for this day" (both `tasks.service.js` and `dashboard.service.js` run it). A compound index answers both-fields filters in one index walk; Module 3.4 digs into how.

### The barrel: `backend/src/models/index.js`

The file is nothing but re-exports:

```js
export { User } from "./user.model.js";
export { RefreshToken } from "./refreshToken.model.js";
// ... 23 more ...
export { Note } from "./note.model.js";
```

Why bother?

1. **One import line** wherever multiple models are needed — `attempts.service.js` does `import { Test, TestAttempt, Mistake, ExamDNA, Topic, StudyTask } from "../models/index.js";` instead of six separate imports with six paths.
2. **Guaranteed registration.** Importing the barrel *executes every model file*, so every `mongoose.model(...)` call has run. That matters for `populate("test")` — populate resolves the ref by *name* at query time and throws `MissingSchemaError` if "Test" was never registered. The barrel makes registration order a non-issue.
3. **One place to see the whole data layer** — the barrel is effectively the table of contents of your database (also note it exports the `OTP_PURPOSES` constant alongside the `Otp` model).
4. **Refactor freedom** — rename a file, fix one export line; no ripple across services.

Convention in this codebase: services import from the barrel; repositories (`user.repository.js` etc.) import their single model directly — they *are* the dedicated owner of that collection.

---

## Pitfalls & gotchas

1. **Validation runs on `save()`/`create()` — updates skip it by default.** `findOneAndUpdate` bypasses validators unless you pass `runValidators: true` (your `user.repository.js` → `updateById` does exactly this). An enum can be violated by a careless update.
2. **`unique` is not a validator.** It's an index. You get an `E11000` MongoDB error, not a friendly ValidationError — catch and translate it in the service. And the index must actually *exist* in the DB (Mongoose creates it in dev via autoIndex; production deploys should ensure indexes deliberately).
3. **`select: false` bites you later.** Fetch a user normally, then check `if (user.passwordHash)` — always undefined, "bug" that isn't. Any code path needing the hash must go through the repository's `...WithPassword` methods.
4. **Soft delete is a promise every query must keep.** One `User.findOne(...)` written outside the repository, without `deletedAt: null`, resurrects deleted accounts. That's the real argument for the repository pattern.
5. **`default: Date.now` vs `default: Date.now()`.** The first (used in `testAttempt.model.js`) evaluates per-document. The second would bake in *boot time* for every document. Classic footgun.
6. **Mutating `Mixed` (and array elements) silently doesn't persist.** Mongoose can't observe deep mutation of `Mixed`. Note how `attempts.service.js` → `saveResponse` uses `attempt.responses.set(idx, next)` — the DocumentArray `.set()` method — rather than `attempt.responses[idx] = next`, precisely so the change is tracked before `save()`.
7. **Schema changes don't touch old documents.** Add a field with a default and pre-existing docs *in the DB* still lack it; the default only materializes on docs loaded through Mongoose (and only saves if the doc is saved). Reports querying the raw collection can be surprised.
8. **`toJSON` only runs on documents.** `.lean()` results (Module 3.3) are plain objects — no transform, so `_id`, `__v` come through raw. If an endpoint suddenly leaks `_id`, someone added `.lean()`.

---

## Exercises

Solutions in [SOLUTIONS.md](./SOLUTIONS.md) (§ Module 3.2).

1. **(Trivial)** Define schema, model, and document in one sentence each, using `StudyTask` as the example.
2. **(Open file X)** Open `backend/src/models/mistake.model.js`. List every field that has an `enum`, with the allowed values, and state the default for each where one exists.
3. **(Open file X)** Open `backend/src/models/profile.model.js`. How does this schema guarantee *one profile per user*? Quote the exact field definition that does it.
4. **(Concept)** Why does `passwordHash` use both `select: false` *and* a `delete ret.passwordHash` in the `toJSON` transform? Aren't they redundant? Describe one scenario where the second line is the only thing standing between the hash and the API response.
5. **(Concept — partial indexes)** A plain `unique: true` on `mobile` would break your app's signup flows in two distinct ways that the partial index fixes. Explain both, referencing the actual `partialFilterExpression` in `user.model.js`.
6. **(Open file X)** Compare the subdocument options in `user.model.js` (`authProviderSchema`) and `aiChat.model.js` (`messageSchema`): one uses `{ _id: false }`, the other `{ _id: true }`. Why is each the right choice for its data?
7. **(Write code)** Write a new model file `pinnedResource.model.js` in the style of this codebase: a per-user pinned study resource with `user` (ref, required, indexed), `url` (required, trimmed), `label` (required), `kind` (enum: `"video" | "article" | "pdf"`, default `"article"`), timestamps, the standard `toJSON` transform, a compound index on `{ user: 1, kind: 1 }`, and the safe model-registration line. Then state the one line you'd add to `models/index.js`.
8. **(Challenging)** Your `refreshToken.model.js` stores `tokenHash` instead of the raw token and adds a TTL index on `expiresAt`. Explain (a) what attack storing only the hash defeats, (b) why TTL deletion is *approximate* and why that's acceptable here, and (c) why the `isActive` virtual is still needed even though expired docs get auto-deleted.

---

**Next:** [Module 3.3 — Query Mastery](./03-queries-mastery.md) — every CRUD method and operator, illustrated with real queries from your services.
