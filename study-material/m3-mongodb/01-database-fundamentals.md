# Module 3.1 — Database Fundamentals & MongoDB

> **Goal:** Understand *why* databases exist at all, what makes MongoDB different from SQL databases (honestly — including where Mongo is *worse*), and exactly how your own app connects to MongoDB, by walking through `backend/src/config/database.js` line by line.

---

## Concepts

### Why databases exist

Your app's variables live in RAM. RAM is fast but it has two fatal flaws:

1. **It vanishes.** Restart the server (deploy, crash, laptop reboot) and every user, task and test score is gone.
2. **It doesn't scale or share.** Two server processes can't see each other's variables. Ten million mistake entries won't fit in memory, and even if they did, finding "all Pending mistakes for user X" would mean scanning everything.

A database is a program whose entire job is to solve those problems:

- **Durability** — data survives restarts because it's written to disk (carefully, so a power cut mid-write doesn't corrupt it).
- **Fast lookup at scale** — via **indexes** (Module 3.4), a database can find one record among millions in a handful of disk reads instead of scanning all of them.
- **Concurrency** — hundreds of requests can read and write at the same time without stomping on each other.
- **A query language** — you *describe* the data you want ("Pending mistakes for user X, newest first, page 2") and the database figures out how to fetch it.

Think of it as a filing department for your app: you hand it records, and later you ask precise questions and get precise answers, no matter how big the archive grows.

### SQL vs NoSQL — an honest comparison

**SQL (relational) databases** — PostgreSQL, MySQL, SQLite — store data in **tables** with fixed columns. Rows in one table point to rows in another via foreign keys, and you recombine them with `JOIN`.

**MongoDB** (the most popular "NoSQL" document database) stores data as **documents** — JSON-like objects — grouped into **collections**.

Neither is "better." They make different trade-offs:

| Aspect | SQL (e.g. PostgreSQL) | MongoDB |
|---|---|---|
| Shape of data | Rows in tables, fixed columns | JSON-like documents, flexible fields |
| Schema | Enforced *by the database* | Enforced by your app layer (Mongoose), DB itself is permissive |
| Relationships | First-class: foreign keys + `JOIN`s, referential integrity enforced | References are just stored IDs; joins via `populate()` (extra queries) or `$lookup`; **nothing stops a dangling reference** |
| Multi-record transactions | Mature, default workflow | Supported (replica sets only), but the culture is "design so you rarely need them" |
| Nested/list data | Awkward (extra tables or JSON columns) | Natural — arrays and sub-objects live inside the document |
| Changing the shape of data | Migrations (`ALTER TABLE`) | Just start writing the new field; old docs simply lack it |
| Ad-hoc analytical queries | SQL is superb at this | Aggregation pipeline works but is more verbose |
| Learning curve for JS devs | New language (SQL) | Queries are JS objects; documents look like your JS objects |

**Where MongoDB shines:**

- Data that is naturally document-shaped: a test attempt *with* its per-question responses inside it, a chat *with* its messages inside it (both real examples in your app).
- Rapidly evolving products — you add a field to a Mongoose schema and ship; no migration ceremony.
- Read patterns like yours: "everything for **this one user**" — fetch a handful of documents, no joins needed.
- JavaScript teams: one mental model (objects) end to end.

**Where MongoDB is honestly weaker:**

- **Integrity is on you.** Delete a `User` and Mongo will happily keep 500 orphaned `Mistake` documents pointing at it. Postgres would refuse (or cascade) via foreign keys. Your app handles this with *soft delete* instead — see Module 3.2.
- **Cross-entity analytics.** "Average accuracy per institute across all users, joined with profile data" is one elegant SQL statement; in Mongo it's a multi-stage aggregation pipeline.
- **Duplicated data can drift.** If you denormalize (copy a name into another collection — your `LeaderboardEntry` does exactly this with `name`, `institute`, `state`), you must remember to update every copy.
- Multi-document transactions exist but are more ceremony than in SQL (your app wraps them in `backend/src/utils/transaction.util.js`).

Your app is a good fit for Mongo: almost every query is "documents belonging to user X," documents have natural nested structure, and the schema evolved fast during development.

### Databases → collections → documents

MongoDB organizes data in three levels. The SQL analogy helps at first — but note where it breaks:

| MongoDB | SQL analogy | Caveat |
|---|---|---|
| **Database** (e.g. `myapp`) | Database | Same idea: a named container |
| **Collection** (e.g. `users`, `studytasks`) | Table | But no fixed columns — two docs in one collection *may* have different fields |
| **Document** | Row | But a document can nest arrays and objects; a row cannot |

Mongoose derives the collection name from the model name automatically: `mongoose.model("StudyTask", …)` → collection `studytasks` (lowercased, pluralized). Your 25 models (Module 3.4 lists them all) become 25 collections.

A real document from your `studytasks` collection looks like:

```js
{
  _id: ObjectId("66b1f2a4c1d2e3f4a5b6c7d8"),
  user: ObjectId("66b1f0009999888877776666"),   // reference to a users doc
  date: "2026-08-11",
  title: "Rotational motion problem set",
  subject: "Physics",
  minutes: 45,
  type: "Practice",
  done: false,
  time: null,
  createdAt: ISODate("2026-08-11T04:12:00Z"),
  updatedAt: ISODate("2026-08-11T04:12:00Z"),
  __v: 0
}
```

### ObjectId — the primary key you never generate

Every document gets an `_id`. Unless you supply one, MongoDB creates an **ObjectId**: a 12-byte value shown as 24 hex characters, e.g. `66b1f2a4c1d2e3f4a5b6c7d8`. Its structure is clever:

- bytes 1–4: **timestamp** (seconds since 1970) — so ObjectIds sort roughly by creation time
- bytes 5–9: random value per machine/process
- bytes 10–12: incrementing counter

Consequences you'll actually use:

- IDs are generated *client-side* (by the driver) — no round-trip to ask "what's the next ID?", and no collisions across servers.
- Sorting by `_id` ≈ sorting by creation time (your app usually sorts by `createdAt` instead, which is more explicit).
- An ObjectId is **not a string**. Mongoose converts valid strings for you, but comparing needs care — your `leaderboard.service.js` does `String(e.user) === String(userId)` precisely because comparing an ObjectId to a string with `===` is always false.
- A malformed string (wrong length/characters) makes queries **throw a CastError**, which is why `attempts.service.js` guards with `mongoose.isValidObjectId(attemptId)` before querying.

### BSON vs JSON

MongoDB does not literally store JSON text. It stores **BSON** ("Binary JSON"):

- **Binary**, length-prefixed encoding → the server can skip fields without parsing text.
- **More types than JSON**: JSON only has string/number/boolean/null/array/object. BSON adds `ObjectId`, real `Date` (your `deletedAt`, `expiresAt`, `submittedAt`…), 32-bit and 64-bit integers, doubles, `Decimal128`, and binary blobs.

You mostly don't see BSON — the driver converts JS objects ⇄ BSON. But it explains real things in your code: why `expiresAt` can be a genuine `Date` MongoDB can run TTL expiry on (Module 3.2), and why `_id` is its own type rather than a string.

### How a Node app talks to MongoDB

The chain, top to bottom:

```
your service code (tasks.service.js)
        ↓ StudyTask.find({...})
Mongoose  — schemas, validation, casting, populate     (ODM layer)
        ↓
MongoDB Node.js driver — connection pool, BSON, wire protocol
        ↓ TCP (mongodb:// or mongodb+srv://)
mongod server / Atlas cluster — storage, indexes, query engine
```

**Mongoose** is an ODM (Object-Document Mapper). MongoDB itself doesn't care what fields you write; Mongoose is the layer that adds schemas, validation, defaults, middleware and `populate`. Module 3.2 is entirely about it.

**Connection pooling** matters: opening a TCP connection is slow, so the driver keeps a *pool* of open connections and lends one out per query. Your app configures this pool explicitly — see below.

---

## In your codebase

### Walkthrough: `backend/src/config/database.js`

This one file owns the entire MongoDB connection lifecycle. Read it top to bottom:

```js
import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "./logger.js";

// Fail fast on bad queries rather than buffering them indefinitely.
mongoose.set("strictQuery", true);
```

- The URI comes from `env.mongo.uri`, which `backend/src/config/env.js` reads from the `MONGODB_URI` environment variable (it's listed in `REQUIRED`, so the app refuses to boot without it). Secrets never live in code.
- `strictQuery: true` tells Mongoose: if a query filter mentions a field that isn't in the schema, that's an error — don't silently strip it. Without this, a typo like `{ usre: userId }` could quietly become `{}` and match **every** document. Fail fast beats fail silently.

```js
let isConnected = false;
```

A module-level flag. Because Node caches modules, every file that imports this module shares one flag and one connection — a simple singleton.

```js
export async function connectDatabase({ retries = 5, delayMs = 3000 } = {}) {
  if (isConnected) return mongoose.connection;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await mongoose.connect(env.mongo.uri, {
        serverSelectionTimeoutMS: 10000,
        maxPoolSize: 20,
        minPoolSize: 2,
      });
      isConnected = true;
      logger.info(`[db] MongoDB connected → ${maskUri(env.mongo.uri)}`);
      break;
    } catch (err) {
      logger.error(`[db] Connection attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt === retries) throw err;
      await sleep(delayMs);
    }
  }
```

Piece by piece:

- **Idempotent**: if already connected, return the existing connection instead of opening a second one.
- **Retry loop**: up to 5 attempts, 3 s apart. The comment above the function explains why: "a cold Atlas cluster or a container still starting up doesn't kill the process on boot." In Docker Compose, your API and MongoDB start at the same time — the API must tolerate the DB being a few seconds behind. Only after the *final* failure does it `throw`, which crashes startup deliberately (an API without a DB is useless).
- **`serverSelectionTimeoutMS: 10000`** — how long the driver hunts for a reachable server before erroring. Default is 30 s; 10 s gives faster feedback per retry attempt.
- **`maxPoolSize: 20` / `minPoolSize: 2`** — the connection pool: at most 20 simultaneous sockets to MongoDB, and keep at least 2 warm even when idle. 20 concurrent requests can query in parallel; the 21st waits for a free connection. This is why one `connectDatabase()` at boot serves your whole app — individual queries never "connect."
- **`maskUri`** (bottom of the file) replaces the password in `mongodb://user:secret@host/...` with `****` before logging. Connection strings contain credentials; logs get shipped to third-party services. Never log secrets.

```js
  mongoose.connection.on("disconnected", () => {
    isConnected = false;
    logger.warn("[db] MongoDB disconnected");
  });
  mongoose.connection.on("reconnected", () => {
    isConnected = true;
    logger.info("[db] MongoDB reconnected");
  });
  mongoose.connection.on("error", (err) => {
    logger.error(`[db] MongoDB error: ${err.message}`);
  });
```

The connection is an event emitter. Network blips happen; the driver auto-reconnects, and these handlers keep the `isConnected` flag honest and the logs informative. Note the app does **not** crash on `disconnected` — it rides it out.

```js
export async function disconnectDatabase() { ... }
```

Called on graceful shutdown (SIGTERM during deploys) so in-flight writes finish and the socket closes cleanly.

```js
export function getDatabaseState() {
  // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  return states[mongoose.connection.readyState] ?? "unknown";
}
```

`mongoose.connection.readyState` is a number; this maps it to a readable word. It powers the health endpoint (`backend/src/controllers/health.controller.js`) so a load balancer or you-with-curl can ask "is the DB actually up?"

### Who calls this?

`backend/src/index.js` calls `connectDatabase()` **before** the HTTP server starts listening. Order matters: accepting requests before the DB is ready would mean instant 500s.

---

## Pitfalls & gotchas

1. **ObjectId ≠ string.** `doc.user === userId` is `false` even when they "look" equal. Use `String(a) === String(b)` (as `leaderboard.service.js` does) or `a.equals(b)`.
2. **Invalid ObjectId strings throw, not "not found."** `findById("abc")` raises a CastError → an ugly 500. That's why `attempts.service.js` checks `mongoose.isValidObjectId(attemptId)` first and returns a clean 404.
3. **Mongo won't protect your relationships.** Deleting a user leaves orphaned tasks/mistakes/attempts unless *you* clean up. Your app sidesteps much of this with soft delete (`deletedAt`) — Module 3.2.
4. **Don't connect per request.** Connections are pooled and expensive. One `connectDatabase()` at boot; everything else reuses the pool. If you ever see "creating a new connection" per query in code, it's a bug.
5. **`strictQuery` off = typo-matches-everything.** With it off, a misspelled filter field is silently dropped and your query matches all documents. Your app turns it on globally — keep it that way.
6. **The URI is a secret.** It embeds the DB password. Environment variable only (as `env.js` enforces), and mask it in logs (as `maskUri` does).
7. **Collection names are derived, not declared.** `model("StudyTask")` → collection `studytasks`. When you open a Mongo shell/Compass and can't find "StudyTask," look for the lowercase plural.

---

## Exercises

Solutions for every exercise are in [SOLUTIONS.md](./SOLUTIONS.md) (§ Module 3.1).

1. **(Trivial)** In your own words, two sentences max: what two problems does a database solve that a JavaScript variable can't?
2. **(Trivial)** Open `backend/src/config/database.js`. What are the values of `maxPoolSize` and `serverSelectionTimeoutMS`, and what does each control?
3. **(Read the code)** Open `backend/src/config/env.js`. What exactly happens if you start the server without `MONGODB_URI` set? Find the mechanism (hint: look near the top of the file at `REQUIRED`).
4. **(Concept)** Your `StudyTask` model produces which collection name in MongoDB? Explain the rule. What about `ExamDNA` (check how it's registered in `backend/src/models/examDna.model.js` before answering)?
5. **(Concept)** Given the ObjectId `66b1f2a4c1d2e3f4a5b6c7d8`, which part encodes *when* it was created, and what useful property does that give a sort on `_id`?
6. **(Read the code)** In `connectDatabase`, exactly when does the function `throw` instead of retrying? What happens to the process as a result, and why is that the *right* behavior at boot but the wrong behavior mid-flight (compare with the `disconnected` event handler)?
7. **(Challenging)** Suppose 30 requests arrive simultaneously and every one runs one query taking 100 ms. With `maxPoolSize: 20`, sketch what happens to requests 21–30. Roughly how long does the slowest request wait, and what single config change would help?
8. **(Challenging — design)** Your app copies `name`, `institute` and `state` into `LeaderboardEntry` instead of referencing the User/Profile (open `backend/src/models/leaderboardEntry.model.js` and check). Name one concrete benefit and one concrete failure mode of that choice, and describe when the failure would surface in the UI.

---

**Next:** [Module 3.2 — Mongoose Schemas & Models](./02-mongoose-schemas-models.md), where the permissive database meets the strict schema layer — every option your codebase uses, explained on your real models.
