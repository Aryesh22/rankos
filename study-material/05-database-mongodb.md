# Lesson 5 — Databases & MongoDB

> **Goal:** understand where your app's data actually lives, what a "model" is,
> and how to read the files in `backend/src/models/`.

## Why a database at all?

Variables in your program vanish when it restarts. A **database** is a separate,
specialized program whose whole job is storing data *permanently* and finding it
*fast* — even with millions of records.

Your app uses **MongoDB**, a "document database": it stores JSON-like documents.

## The three levels

| MongoDB term | Everyday analogy | RankOS example |
|---|---|---|
| **Database** | a filing cabinet | the whole RankOS database |
| **Collection** | one drawer | `users`, `studytasks`, `testattempts` |
| **Document** | one file in the drawer | one user, one task |

A document looks like JSON:

```json
{
  "_id": "66b1f2...",
  "user": "66a0c9...",
  "date": "2026-08-11",
  "title": "Solve 20 algebra problems",
  "subject": "Maths",
  "minutes": 60,
  "done": false
}
```

`_id` is a unique identifier MongoDB gives every document — that's the "123" in
`PATCH /tasks/123`.

## Mongoose: the translator between JS and MongoDB

Your backend talks to MongoDB through **Mongoose** (see it in
`backend/package.json` dependencies). Mongoose gives you:

1. **Schemas** — a declared shape for documents (MongoDB itself doesn't enforce
   shape; Mongoose adds that discipline).
2. **Models** — JS objects with methods like `.find()`, `.create()`, tied to a
   collection.

## Reading a real model: `src/models/user.model.js`

```js
const userSchema = new mongoose.Schema({
  email:        { type: String, lowercase: true, trim: true, default: null },
  passwordHash: { type: String, select: false, default: null },
  fullName:     { type: String, required: true, trim: true },
  role:         { type: String, enum: ROLE_VALUES, default: ROLES.STUDENT, index: true },
  isActive:     { type: Boolean, default: true },
  ...
});
```

Each field's options tell a story:

- `type` — what kind of value (String, Number, Boolean, Date…)
- `required: true` — refuse to save without it (`fullName` is mandatory)
- `default` — value used if none given
- `enum` — only these values allowed (`role` must be a real role)
- `lowercase`/`trim` — auto-clean the input (`"  Ab@X.com "` → `"ab@x.com"`)
- `index: true` — build a lookup index so searching by this field is fast
  (like a book's index vs. reading every page)
- `select: false` — ⭐ never include this field in query results unless
  explicitly asked. That's why `passwordHash` can't accidentally leak into an
  API response. Security encoded in the schema itself.

Three more pro-level ideas in this file worth knowing about:

- **Soft delete:** users aren't actually erased — a `deletedAt` date is set.
  Data is recoverable; "deleted" users are just filtered out of queries.
- **Relations:** a task's `user` field stores the User's `_id` — that's how
  documents point at each other across collections.
- **Partial unique indexes:** email/username must be unique, but only among
  non-deleted users who actually have one — so optional fields don't collide.

## The queries you'll see everywhere

From real service files:

```js
StudyTask.find({ user: userId, date: day }).sort({ time: 1 })  // many, sorted
StudyTask.create({ user: userId, title, ... })                 // insert one
StudyTask.findOneAndUpdate({ _id, user }, { done: true }, { new: true })
StudyTask.deleteOne({ _id, user })
User.findOne({ email }).select("+passwordHash")                // opt IN to hidden field
```

The first argument is always a **filter** — "which documents?" — written as an
object of conditions. All of these are `await`-ed, because the database lives
across a network hop.

## Redis — the other data store (small role)

You'll also see **Redis** in the config. It's not the main database — it's a
super-fast in-memory store used for short-lived things: rate-limit counters,
caches, job queues (BullMQ). Rule of thumb: **MongoDB = permanent truth,
Redis = fast scratchpad.** Your app treats Redis as optional (remember
`index.js`: Mongo failure is fatal, Redis failure isn't).

---

## ✏️ Exercises

1. Open `src/models/studyTask.model.js`. List its fields and their types.
   Which are required? Which have defaults?
2. Why is `select: false` on `passwordHash` such a big deal? What kind of bug
   does it prevent even a careless developer from writing?
3. Write the Mongoose query (just on paper) to find all of a user's tasks in
   subject "Physics" that aren't done yet.
4. Look at `src/models/index.js` — it re-exports every model from one place.
   Why might that be nicer than importing each model file individually?
5. **Explore:** skim the model filenames. Based on names alone, guess what
   `examDna.model.js` stores. Then open it and check your guess. (Guessing
   before checking is a real developer skill.)

**Next:** [Lesson 6 — Authentication](06-authentication.md)
