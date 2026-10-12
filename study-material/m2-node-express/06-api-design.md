# Module 2.6 — API Design & Layered Architecture

> **Goal:** Learn REST as this codebase practices it, then master the layering — `routes/ → controllers/ → services/ → repositories/ → models/` — by tracing the real tasks feature end to end, and understand the supporting cast: zod validators, presenters, Swagger docs, and the pagination/filtering patterns used in the services.

## Concepts

### REST, minus the religion

REST (Representational State Transfer) as used in practice boils down to a handful of conventions that make an API predictable:

1. **URLs name resources (nouns), not actions.** `/tasks`, `/tasks/:id`, `/mistakes` — not `/getTasks` or `/deleteTask`.
2. **HTTP methods supply the verb.** `GET` reads (safe — no side effects), `POST` creates, `PATCH` partially updates, `PUT` replaces, `DELETE` removes. The same URL means different operations under different methods.
3. **Status codes carry the outcome** (Chapter 2.2's table): 200/201/204 for success flavors, 4xx for client mistakes, 5xx for server faults.
4. **Statelessness.** Every request carries everything needed to serve it (here: the JWT/cookie identifies the user). The server keeps no per-client conversation memory between requests.
5. **Query strings filter/paginate collections**: `/tasks?date=2026-08-11`, `/mistakes?status=Pending&page=2`.

Your tasks API is a textbook specimen (`backend/src/routes/tasks.routes.js`):

| Method + Path | Meaning | Success |
|---|---|---|
| `GET /api/tasks?date=` | list the day's tasks | 200 + array |
| `POST /api/tasks` | create a task | 201 + the task |
| `PATCH /api/tasks/:id` | partial update (toggle `done`) | 200 + `{ id, done }` |
| `DELETE /api/tasks/:id` | remove a task | 204, empty |

Note `PATCH` not `PUT`: the client sends only the field that changes (`{ done: true }`), not a full replacement. And `GET` never mutates — safe to retry, cache, prefetch.

### Why layers?

You *could* write everything in the route file: parse input, query Mongo, shape JSON. It works — until the file is 900 lines, business rules are copy-pasted between routes, and nothing can be tested without HTTP. The layering solves this by giving each concern exactly one home:

```
routes/        WHICH url+method → which handler; which middleware guards it
controllers/   HTTP ↔ JS translation: pull from req, call service, choose status
services/      BUSINESS LOGIC: rules, defaults, cross-model workflows; throws ApiError
repositories/  DATA ACCESS: encapsulated queries against one collection
models/        SCHEMA: shape, validation, indexes (Mongoose)
```

The dependency arrow points one way only: routes → controllers → services → repositories → models. A service never touches `req`/`res`; a controller never writes a Mongo query. Two big payoffs:

- **Testability** — services are plain async functions taking plain arguments (`listTasks(userId, date)`); test them without HTTP.
- **Swappability/consistency** — "how do we find a user without their soft-deleted rows?" is answered in exactly one file.

A rule of thumb for what goes where: *if it mentions `req` or `res`, it's controller; if it's an if-statement about what the product should do, it's service; if it's a Mongo query, it's repository/model.*

## In your codebase (the walkthrough)

### The tasks feature, end to end

Follow `POST /api/tasks` with body `{"title":"Rotational motion","subject":"Physics","minutes":45}` through every layer.

**Layer 1 — route** (`backend/src/routes/tasks.routes.js`, 14 lines):

```js
const router = Router();

router.use(authenticate);
router.get("/", tasksController.listTasks);
router.post("/", tasksController.createTask);
router.patch("/:id", tasksController.patchTask);
router.delete("/:id", tasksController.deleteTask);
```

The route layer's *only* jobs: attach guards (`authenticate` for the whole router) and map method+path → controller function. No logic. It's mounted at `/tasks` inside `backend/src/routes/index.js`'s `featureRouter`, which itself is mounted at both `/` and `/v1` under `/api` — so this one file serves `/api/tasks` *and* `/api/v1/tasks` (the versioning trick from Chapter 2.2).

**Layer 2 — controller** (`backend/src/controllers/tasks.controller.js:23-26`):

```js
// POST /tasks
export const createTask = asyncHandler(async (req, res) => {
  const task = await tasksService.createTask(req.user.id, req.body);
  res.status(HTTP_STATUS.CREATED).json(task);
});
```

Three lines, three responsibilities, nothing more: extract inputs from HTTP (`req.user.id` from the session, `req.body` from the wire), delegate to the service, translate the result back to HTTP (status 201 + JSON). The `asyncHandler` wrapper (Chapter 2.4) is the controller's standard-issue armor. Notice what the controller does *not* do: no validation logic, no query, no defaulting — and critically, the user id comes from `req.user` (set by `authenticate`), **never** from the client's body. The file's header comment states this as doctrine: "the current user comes from the session, never the client."

**Layer 3 — service** (`backend/src/services/tasks.service.js:31-43`):

```js
export async function createTask(userId, body) {
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
  return task;
}
```

Business decisions live here: no date → today (`todayStr()` builds `"YYYY-MM-DD"`); no minutes → 0; no type → `"Concept"`; new tasks are never born `done`. Note `??` vs `||`: `minutes: body.minutes ?? 0` keeps an explicit `0`, while `body.date || todayStr()` treats `""` as absent — deliberate operator choices. Also note the *whitelist* style: fields are copied one by one, so a malicious extra field (`user: "someone-else"`, `isAdmin: true`) in the body simply never reaches the database — mass-assignment protection by construction.

The failure paths in this same file show the service's error contract (Chapter 2.4):

```js
const task = await StudyTask.findOneAndUpdate({ _id: taskId, user: userId }, ...);
if (!task) throw ApiError.notFound("Task not found");
```

Two things: services **throw `ApiError`**, never touch `res`; and every query filters by `{ _id, user: userId }` *together* — you can't toggle or delete another user's task even with a valid id, because ownership is part of the query itself. The 404 you get for someone else's task is also deliberately indistinguishable from "doesn't exist" (no information leak).

**Layer 3.5 — repositories: where are they for tasks?** They aren't — and that's an honest lesson in architecture. Tasks are simple single-collection CRUD, so the service uses the model directly. The repository layer earns its place where data access has real policy. Look at `backend/src/repositories/user.repository.js`:

```js
const notDeleted = { deletedAt: null };

async findById(id, session = null) {
  return withSession(User.findOne({ _id: id, ...notDeleted }), session);
},

async findByEmailWithPassword(email, session = null) {
  return withSession(
    User.findOne({ email: email.toLowerCase(), ...notDeleted }).select("+passwordHash"),
    session,
  );
},
```

Three policies enforced in one place, for every caller: **soft deletes** (users with `deletedAt` set are invisible to all reads — the file's comment: "the ONLY place that talks to the User collection"), **normalization** (emails lowercased), **transaction support** (every method threads an optional Mongoose `session` so calls compose inside a transaction — note `User.create([data], { session })` needs the array form). If auth services each hand-wrote `User.findOne`, someone would eventually forget `deletedAt: null` and resurrect a deleted account. The pragmatic rule this codebase follows: *repositories where data policy exists; direct model use where it doesn't.*

**Layer 4 — model** (`backend/src/models/studyTask.model.js`):

```js
const studyTaskSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: String }, // "YYYY-MM-DD"
    title: { type: String, required: true },
    minutes: { type: Number, default: 0 },
    type: { type: String, enum: ["Concept", "Practice", "Revision", "Mock", "Analysis"], default: "Concept" },
    done: { type: Boolean, default: false },
    ...
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

studyTaskSchema.index({ user: 1, date: 1 });
```

The schema is the last line of defense (`title` required, `type` restricted to an enum — a bad value here throws a Mongoose `ValidationError`, which `errorHandler.js` converts to a 422). Three details worth owning:

- `timestamps: true` — Mongoose maintains `createdAt`/`updatedAt` automatically.
- The `toJSON.transform` renames `_id` → `id` and drops `__v` **at serialization time** — so when the controller does `res.json(task)`, the client sees frontend-friendly `id` without any manual mapping. Presentation concerns handled once, in the schema.
- `index({ user: 1, date: 1 })` — a compound index matching exactly the query `listTasks` runs (`{ user, date }`). Queries you run often should have indexes shaped like them; this one line is why listing a day's tasks stays fast at a million rows.

The response ripples back up: model → service returns the document → controller `res.status(201).json(task)` → the client receives the created task with `id`, defaults filled, timestamps set.

### Validators — zod at the door

The tasks routes accept raw bodies (the service's defaults + schema enums are deemed enough for this internal shape), but the auth routes show the full pattern. From `backend/src/routes/auth.routes.js:28`:

```js
router.post("/signup", authLimiter, validate({ body: signupSchema }), authController.signup);
```

`validate` (Chapter 2.4's `backend/src/middlewares/validate.js`) is a factory taking zod schemas per request segment. The schema, from `backend/src/validators/auth.validator.js`:

```js
const mobile = z.string().trim().min(1, "Mobile number is required")
  .regex(/^\+?[0-9\s-]{10,15}$/, "Enter a valid mobile number");

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  mobile,
  password,
  exam: z.enum(EXAM_OPTIONS),
});
```

What the validators folder is *for*: declarative input contracts, kept out of controllers, with **human-ready messages** attached to each rule. Two design points from the file itself:

- The header comment: field names and rules "deliberately MIRROR the frontend zod schemas... so the same payloads validate on both ends and error `fields` map onto the forms." Client-side validation is UX; server-side is security — same contract, both ends.
- On success, `validate` replaces `req.body` with the **parsed** result — trimmed strings, applied `.default(...)`s — so controllers receive canonical data. On failure: 422 with `fields: { mobile: "Enter a valid mobile number" }` that the frontend drops straight into its form errors.

Reusable atoms (`mobile`, `password`, `objectId`) are composed into schemas — note `objectId`'s regex (`/^[a-fA-F0-9]{24}$/`) rejecting malformed ids *before* Mongoose ever sees them.

### Presenters — controlling the output shape

Validators guard what comes *in*; presenters shape what goes *out*. `backend/src/presenters/user.presenter.js`:

```js
export function presentAuthUser(user, profile = null) {
  const exam = profile?.exam ?? user.exam ?? null;
  return {
    id: String(user._id),
    role: user.role,
    name: user.fullName,
    initials: user.initials,
    email: user.email ?? "",
    exam,
    examLabel: profile?.examLabel ?? examLabelFor(exam) ?? "",
    ...
    streak: profile?.streak ?? 0,
  };
}
```

Why not just `res.json(user)`? Three reasons, all visible here:

1. **Security** — a raw user document could carry `passwordHash` or internal flags; a presenter is a whitelist, so nothing leaks by accident.
2. **Contract stability** — the comment says it: this is "the exact shape the frontend's `GET /api/auth/me` expects... Field names and types must match precisely." The DB schema can evolve; the presenter absorbs the difference.
3. **Composition** — it merges *two* documents (User + optional Profile) into one client-facing object, with `??` fallback chains deciding precedence.

Presenter = one-way mapping, domain object → API shape. (The `toJSON` transform in `studyTask.model.js` is the lightweight cousin of the same idea, for cases where the document shape *is* the contract.)

### Swagger — self-documenting routes

`backend/src/config/swagger.js` wires up OpenAPI docs in three moves:

1. **A base `definition`**: title/version/servers, plus `securitySchemes` declaring the two auth styles (`bearerAuth` JWT header, `cookieAuth` session cookie).
2. **`swaggerJSDoc({ definition, apis: ["./src/routes/*.js", "./src/docs/*.js"] })`** — scans those files for `@openapi` JSDoc comments and merges them into one OpenAPI spec object. The docs live *next to the routes they describe*; e.g. `backend/src/routes/health.routes.js`:

   ```js
   /**
    * @openapi
    * /health/ready:
    *   get:
    *     tags: [Health]
    *     summary: Readiness probe
    *     responses:
    *       200: { description: Ready }        # (in the file: expanded form)
    *       503: { description: Not ready }
    */
   router.get("/health/ready", readiness);
   ```

   Reusable schemas go in `backend/src/docs/components.js`. Doc-next-to-code maximizes the odds it stays true.
3. **`mountSwagger(app)`** (called from `app.js`): serves interactive Swagger UI at `/api/docs` and the raw JSON at `/api/docs.json`, unless `SWAGGER_ENABLED=false` — in which case it logs a warning and mounts nothing (in production you often turn docs off).

Run `npm run dev` and open `http://localhost:8080/api/docs` — you can execute requests from the browser.

### Pagination & filtering patterns

Collections can't be returned whole forever. Two real patterns in the services:

**Offset pagination + filters** — `backend/src/services/mistakes.service.js`:

```js
const PAGE_SIZE = 20;

export async function listMistakes(userId, { status, category, q, page = 1 } = {}) {
  const str = (v) => (typeof v === "string" && v ? v : undefined);
  const filter = { user: userId };
  if (str(status)) filter.status = str(status);
  if (str(category)) filter.category = str(category);
  if (str(q)) {
    const rx = new RegExp(escapeRegex(str(q)), "i");
    filter.$or = [{ question: rx }, { chapter: rx }];
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const [total, docs] = await Promise.all([
    Mistake.countDocuments(filter),
    Mistake.find(filter).sort({ createdAt: -1 }).skip((pageNum - 1) * PAGE_SIZE).limit(PAGE_SIZE),
  ]);
  ...
  return { data, total };
}
```

Everything you need to copy for your own list endpoints is in these 20 lines:

- **Build the filter incrementally** from optional query params, starting from the non-negotiable base `{ user: userId }` (scoping first, always).
- **Type-guard the inputs**: the `str()` helper drops non-string values — the comment explains a sanitized injection attempt may arrive as an object/array; ignore it rather than pass it to Mongo. Defense in depth beyond `sanitize.js`.
- **`escapeRegex`** before building a `RegExp` from user text — otherwise `q=a+` is a regex syntax error (crash) and cleverer inputs cause catastrophic backtracking (DoS).
- **Clamp the page**: `Math.max(1, Number(page) || 1)` makes `page=0`, `page=-3`, `page=banana` all behave as page 1. Never let the client drive `skip()` negative.
- **`skip/limit` + `countDocuments` in `Promise.all`** — the two independent queries run concurrently (Chapter 2.1's event loop paying rent), returning `{ data, total }` so the client can render page controls.
- The **page size is server-owned** (`PAGE_SIZE = 20`) — clients can't request `?limit=1000000`.

**Sort-and-slice ranking** — `backend/src/services/leaderboard.service.js` computes rankings and then pages the ranked array in memory (`ranked.slice((pageNum - 1) * PAGE_SIZE, ...)`) — appropriate because rank depends on the whole ordered set. And `teacher.service.js` shows clamped client-driven limits: `const n = Math.max(1, Number(limit) || 6)`.

**Simple filter, no pagination** — `tasks.service.js`'s `listTasks`: one user's tasks for one day is naturally small, so `find({ user, date }).sort({ time: 1 })` returns everything, sorted for display. Pagination is a tool, not a ritual — use it when the set can grow unboundedly.

## Pitfalls & gotchas

- **Skipping layers "just this once."** A Mongo query in a controller works today and metastasizes tomorrow. The layering survives only if violations stay at zero — the whole value is being able to *trust* where things live.
- **Trusting the client for identity or ownership.** The two-part discipline: user id from `req.user` only (controller), and ownership inside the query filter (`{ _id, user: userId }`, service). Forgetting the second gives an IDOR vulnerability — any logged-in user can modify anyone's data by guessing ids.
- **`res.json(mongooseDoc)` without a transform/presenter** can leak fields you never meant to ship (`__v`, internal flags, hashes). Either a schema `toJSON` transform (StudyTask) or a presenter (auth user) must stand between DB and wire.
- **Unescaped user input in `new RegExp(...)`** — syntax errors at best, regex-DoS at worst. `escapeRegex` is mandatory, not decorative.
- **Client-controlled `limit`/`skip` without clamping** lets one request ask for a million documents. Server owns page size; clamp everything numeric.
- **`skip()` pagination degrades on deep pages** (Mongo must walk and discard all skipped docs). Fine at this app's scale; know that cursor/keyset pagination (`?after=<id>`) is the upgrade path.
- **Docs drift.** An `@openapi` comment describing a parameter you renamed is worse than no docs. Treat the JSDoc block as part of the route change, reviewed together.
- **PATCH vs PUT confusion.** `patchTask` intentionally updates only `done`. If you later "improve" it to write the whole body with `findOneAndUpdate(filter, body)`, you've both changed semantics and opened mass-assignment — update named fields only.

## Exercises

Answers in [SOLUTIONS.md](./SOLUTIONS.md).

1. **(Comprehension)** For `DELETE /api/tasks/:id`, name each file the request touches in order (from `app.js` to the model) and state the single responsibility each file exercises for this request.
2. **(Code reading)** In `tasks.service.js`, `setTaskDone` passes `{ new: true }` to `findOneAndUpdate`. Look at what the function returns to the controller — what would the client receive without `{ new: true }`, and why would that be a subtle bug for a toggle endpoint?
3. **(Prediction)** A logged-in attacker sends `POST /api/tasks` with body `{"title":"x","user":"64ff...someoneelse","done":true}`. What ends up in the database for `user` and `done`, and which exact lines of which file guarantee it?
4. **(Comprehension)** Explain the difference in *purpose* between the zod `signupSchema` (validator), the `studyTaskSchema` enum (model), and `presentAuthUser` (presenter). All three "check/shape data" — why are all three needed, at different layers?
5. **(Code reading)** In `user.repository.js`, why does `findByEmailWithPassword` need `.select("+passwordHash")`, and what does that imply about the User schema's definition of `passwordHash`? Why is this *good* default behavior?
6. **(Prediction)** `GET /api/mistakes?q=(&page=-2` arrives (note the lone `(` and negative page). Walk through `listMistakes` and state exactly what filter and skip/limit hit MongoDB, and why nothing crashes.
7. **(Small task)** Design (on paper) `GET /api/tasks/range?from=YYYY-MM-DD&to=YYYY-MM-DD` following the codebase's conventions: write the route line, the controller function, and the service query — including which existing index serves it and how you'd validate the two params with zod.
8. **(Code reading)** Open `backend/src/config/swagger.js`. If you set `SWAGGER_ENABLED=false` in `.env`, list every observable difference in the running app (think: routes, logs, and `routes/index.js`'s metadata endpoint).

---

You've completed Module 2. Check your exercise answers in [SOLUTIONS.md](./SOLUTIONS.md).
