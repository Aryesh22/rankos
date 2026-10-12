# Lesson 4 — Life of a Request (Backend)

> **Goal:** follow ONE real request — *"create a study task"* — through every
> layer of your backend, file by file. After this lesson, the backend stops being
> magic.

Our request: the frontend sends

```
POST /api/tasks
Authorization: Bearer <the user's login token>

{ "title": "Solve 20 algebra problems", "subject": "Maths", "minutes": 60 }
```

## Stop 0 — The front door: `src/app.js`

Before any feature code runs, the request passes through the **middleware
pipeline** set up in `createApp()`. Middleware = checkpoint functions that every
request walks through, in order:

| Line in `app.js` | Middleware | What it does to our request |
|---|---|---|
| `app.use(requestId)` | tags it | attaches a unique ID so logs can trace this exact request |
| `app.use(helmet())` | armors it | adds security headers |
| `app.use(cors(...))` | border control | only allows requests from approved frontend origins |
| `app.use(express.json(...))` | translator | parses the JSON body text into a real JS object (`req.body`) |
| `app.use(sanitize)` | metal detector | strips characters used in database-injection attacks |
| `app.use(morgan(...))` | receptionist log | writes one log line about the request |
| `globalRateLimiter` | bouncer | blocks clients making absurdly many requests |
| `app.use(env.app.apiPrefix, apiRouter)` | 🚪 | hands the request to the ROUTES layer ↓ |

## Stop 1 — Routes: "which handler?"

`src/routes/index.js` sees the path starts with `/tasks` → forwards to
`src/routes/tasks.routes.js`:

```js
router.use(authenticate);                       // checkpoint: must be logged in
router.post("/", tasksController.createTask);   // POST /tasks → this function
```

**`authenticate`** (`src/middlewares/authenticate.js`) checks the login token —
it accepts either an `Authorization: Bearer ...` header or the httpOnly
**cookie** your frontend actually uses (the browser attaches it automatically).
Valid → it attaches the user to the request as `req.user` and waves it through.
Invalid → the request ends right here with `401`.

> Notice what routes DON'T do: no logic, no database. They only map URL → handler.

## Stop 2 — Controller: "read request, delegate, respond"

`src/controllers/tasks.controller.js`:

```js
export const createTask = asyncHandler(async (req, res) => {
  const task = await tasksService.createTask(req.user.id, req.body);
  res.status(HTTP_STATUS.CREATED).json(task);
});
```

Three jobs, three lines:
1. **Extract** what's needed from the request: `req.user.id` (who — from the
   token, *never* from the client, so nobody can act as someone else) and
   `req.body` (what).
2. **Delegate** the actual work to the service.
3. **Respond**: status `201 Created` + the new task as JSON.

`asyncHandler` is a small wrapper (`src/utils/asyncHandler.js`) that catches any
error thrown inside and passes it to the error handler (Stop 5) — so controllers
don't need try/catch everywhere.

## Stop 3 — Service: "the business logic"

`src/services/tasks.service.js`:

```js
export async function createTask(userId, body) {
  const task = await StudyTask.create({
    user: userId,
    date: body.date || todayStr(),     // default: today
    title: body.title,
    subject: body.subject,
    minutes: body.minutes ?? 0,        // default: 0  (?? = "if missing")
    type: body.type || "Concept",
    done: false,                       // new tasks always start not-done
  });
  return task;
}
```

This is where the *rules* live: defaults, ownership (`user: userId`), invariants
("new tasks start undone"). Notice the service knows nothing about HTTP — no
`req`, no `res`. That separation means the same logic could be reused by a
background job, a test, or a different API.

Also worth seeing — the service enforces **ownership on every query**:

```js
await StudyTask.findOneAndUpdate({ _id: taskId, user: userId }, ...)
```

Even if a user guesses someone else's task ID, the `user: userId` condition means
they can't touch it. Security by design.

## Stop 4 — Model: "the data shape"

`StudyTask` comes from `src/models/studyTask.model.js` — a **Mongoose model**
describing what a task looks like in MongoDB (fields, types, defaults).
`StudyTask.create(...)` writes a new document to the database and returns it.
(Full story in Lesson 5.)

## Stop 5 — The response (and what happens on errors)

The saved task flows back: model → service → controller → `res.json(task)` →
over the wire → frontend renders it. Total trip: often under 50 milliseconds.

If anything went wrong, the layers *throw* instead:

```js
if (!task) throw ApiError.notFound("Task not found");
```

Thrown errors skip everything and land in `src/middlewares/errorHandler.js`
(mounted **last** in `app.js`), which converts them into a clean JSON error
response with the right status code. One place formats ALL errors — that's why
your API's errors always look consistent.

## The map, one screen

```
Request
  → app.js middleware (id, security, parse JSON, sanitize, rate-limit)
  → routes/        which feature? which handler? [+ authenticate]
  → controllers/   unpack request → call service → send response
  → services/      business rules, ownership, defaults
  → models/        read/write MongoDB
  ← response JSON  (or → errorHandler if anything threw)
```

Every feature in your backend — tests, mistakes, leaderboard, mentor — follows
this exact shape. Learn it once, read everything.

---

## ✏️ Exercises

1. Trace `DELETE /tasks/123` the same way yourself: open the route, controller,
   and service. What status code does a successful delete return, and what
   happens if the task doesn't exist?
2. In the service, why is `user: userId` included in `deleteOne({ _id: taskId,
   user: userId })`? What could a malicious user do if it weren't?
3. Pick a different feature — say `mistakes` — and open its route + controller +
   service files. Confirm they follow the same pattern.
4. **Stretch:** in `src/middlewares/authenticate.js`, find the line that attaches
   `req.user`. That single line is what connects "a token string" to "a person."

**Next:** [Lesson 5 — Databases & MongoDB](05-database-mongodb.md)
