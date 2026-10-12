# Module 7.2 — Guided Changes

> **Goal:** Make ten real changes to RankOS, from a one-line log tweak to fixing a genuine bug that ships in this codebase today. Every exercise gives you the exact files, the exact code, a way to verify it worked, and — most importantly — *why* it works.

**Ground rules for this whole chapter:**

- Backend running in one terminal (`cd ~/Desktop/myapp/backend && npm run dev`), frontend in another (`cd ~/Desktop/myapp/rankos-ai-mentor && npm run dev`), database seeded (`npm run seed`). See [Module 7.1](01-setup-and-first-run.md) if not.
- Type the code yourself instead of pasting when you can. Typos you make and fix teach more than clean pastes.
- If you get stuck, exercise 8 teaches you how to *read* what went wrong. Full solutions are in [SOLUTIONS.md](SOLUTIONS.md) — but only look after a genuine attempt.

Several exercises use `curl` against endpoints that require login. Do this once and reuse the cookie jar:

```bash
curl -s -c /tmp/rankos-cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"identifier":"aarav@example.com","password":"password123"}' \
  http://localhost:8080/api/auth/login
```

Expected: a JSON body starting `{"token":"eyJ...` — and, invisibly, session cookies saved to `/tmp/rankos-cookies.txt`. Every authenticated `curl` below passes `-b /tmp/rankos-cookies.txt` to send them back. (This mimics exactly what your browser does.)

---

## Exercise 1 — Change a log message and watch nodemon restart

**Goal:** feel the edit → save → auto-restart loop that you'll live in from now on.

**File:** `backend/src/index.js`

Find this block (around line 30):

```js
server.listen(env.app.port, () => {
  logger.info(
    `[server] ${env.app.name} listening on :${env.app.port} ` +
      `(${env.nodeEnv}) — API at ${env.app.apiPrefix}`,
  );
```

Change the string to include your own stamp:

```js
    `[server] ${env.app.name} listening on :${env.app.port} ` +
      `(${env.nodeEnv}) — API at ${env.app.apiPrefix} — Aryesh was here`,
```

**Verify:** save the file (`Cmd + S`) and *watch the backend terminal without touching it*. You'll see:

```
[nodemon] restarting due to changes...
[nodemon] starting `node src/index.js`
...
[server] RankOS API listening on :8080 (development) — API at /api — Aryesh was here
```

**What you learned:** `npm run dev` runs `nodemon`, which watches the filesystem and restarts Node on every save. The backtick string is a *template literal* — `${...}` splices variables in. Now revert your change (delete the stamp, save) and confirm it restarts again. Editing with confidence starts with knowing you can always undo.

---

## Exercise 2 — Add a new field to the health response

**Goal:** change a real API response and see the change come out of `curl`.

**File:** `backend/src/controllers/health.controller.js`

The `health` handler builds a plain JavaScript object and hands it to `ApiResponse.ok(...)`, which wraps it in the standard `{ success, message, data }` envelope. Add two fields — the process id and Node's process uptime — right after `node: process.version,`:

```js
      node: process.version,
      pid: process.pid,
      startedAtIso: new Date(startedAt).toISOString(),
```

(`startedAt` already exists at the top of the file — it's captured once when the module first loads.)

**Verify:**

```bash
curl -s http://localhost:8080/api/health | python3 -m json.tool
```

(`python3 -m json.tool` pretty-prints the JSON.) Expected inside `data`:

```json
"node": "v22.x.x",
"pid": 41523,
"startedAtIso": "2026-08-11T09:14:02.113Z"
```

**What you learned:** an API response is just an object a controller decides to send. There's no magic registry — add a key to the object, and it's in the response. Note `pid` changes every nodemon restart; that's the process id the `kill` command from Module 7.1's troubleshooting targets.

---

## Exercise 3 — Add a `GET /tasks/stats` endpoint (route → controller → service)

**Goal:** build a complete new read endpoint through all three backend layers, the same way every existing feature is built.

**Why three files?** Look at how `/tasks` already flows: `routes/tasks.routes.js` (maps URL → handler, applies `authenticate`) → `controllers/tasks.controller.js` (reads request, writes response, nothing else) → `services/tasks.service.js` (the actual logic and database queries). Keeping the layers thin means logic is reusable and testable without HTTP.

### 3a. Service — `backend/src/services/tasks.service.js`

First, add `mongoose` to the imports at the top of the file:

```js
import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError.js";
import { StudyTask } from "../models/index.js";
```

Then add this function above the final `export default` line, and add `getTaskStats` into that default export object:

```js
/** GET /tasks/stats?date=YYYY-MM-DD → counts for the day's plan. */
export async function getTaskStats(userId, date) {
  const day = date || todayStr();
  const match = { user: new mongoose.Types.ObjectId(userId), date: day };

  const [total, done, byTypeRaw] = await Promise.all([
    StudyTask.countDocuments(match),
    StudyTask.countDocuments({ ...match, done: true }),
    StudyTask.aggregate([
      { $match: match },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]),
  ]);

  const byType = Object.fromEntries(byTypeRaw.map((row) => [row._id, row.count]));
  return { date: day, total, done, pending: total - done, byType };
}
```

```js
export default { listTasks, setTaskDone, createTask, deleteTask, getTaskStats };
```

**Why `new mongoose.Types.ObjectId(userId)`?** Regular queries like `find()` auto-convert the string id for you. `aggregate()` does **not** — it passes your `$match` straight to MongoDB, and a string never equals an ObjectId. This is one of the most common Mongoose gotchas; you've now met it on purpose.

### 3b. Controller — `backend/src/controllers/tasks.controller.js`

Add above the `export default` and include it there:

```js
// GET /tasks/stats?date=YYYY-MM-DD
export const getStats = asyncHandler(async (req, res) => {
  const data = await tasksService.getTaskStats(req.user.id, req.query.date);
  res.status(HTTP_STATUS.OK).json(data);
});
```

```js
export default { listTasks, patchTask, createTask, deleteTask, getStats };
```

Note `req.user.id` — set by the `authenticate` middleware from the session cookie. **The client never tells the server whose tasks to count**; that would let anyone read anyone's data.

### 3c. Route — `backend/src/routes/tasks.routes.js`

Add one line after `router.get("/", ...)`:

```js
router.get("/", tasksController.listTasks);
router.get("/stats", tasksController.getStats);
```

**Verify** (after the login curl from the top of this chapter):

```bash
curl -s -b /tmp/rankos-cookies.txt http://localhost:8080/api/tasks/stats | python3 -m json.tool
```

Expected (with fresh seed data — 5 tasks today, 2 done):

```json
{
    "date": "2026-08-11",
    "total": 5,
    "done": 2,
    "pending": 3,
    "byType": { "Concept": 1, "Practice": 1, "Revision": 1, "Analysis": 1, "Mock": 1 }
}
```

And confirm auth is enforced:

```bash
curl -s -i http://localhost:8080/api/tasks/stats | head -1
```

Expected: `HTTP/1.1 401 Unauthorized` — because `router.use(authenticate)` at the top of the routes file guards *every* route below it.

**What you learned:** the full anatomy of an endpoint, MongoDB's aggregation pipeline (`$match` → `$group`), and why user scoping comes from the session, never the client.

---

## Exercise 4 — Add a `priority` field to StudyTask, end-to-end

**Goal:** evolve a data model and push the new field through the write path.

### 4a. Model — `backend/src/models/studyTask.model.js`

Add a field to the schema, right after `done`:

```js
    done: { type: Boolean, default: false },
    priority: {
      type: String,
      enum: ["low", "normal", "high"],
      default: "normal",
    },
```

`enum` means Mongoose rejects any other value with a ValidationError — which the central `errorHandler` middleware converts into a clean HTTP 422. **Honest note:** there is no request validator for tasks (the `backend/src/validators/` folder only contains `auth.validator.js` — only auth endpoints get Zod schemas so far). The schema enum is therefore your only guard here. Compare that with the auth routes and you'll see the gap; adding a Zod validator for tasks is a great stretch goal.

### 4b. Service (write path) — `backend/src/services/tasks.service.js`

In `createTask`, add priority to the created document:

```js
    type: body.type || "Concept",
    priority: body.priority || "normal",
    time: body.time ?? null,
```

**Why is the read path free?** `listTasks` returns whole documents, and the model's `toJSON` transform serializes every field — new fields ride along automatically.

**Verify:** create a high-priority task, then an invalid one:

```bash
curl -s -b /tmp/rankos-cookies.txt -H "Content-Type: application/json" \
  -d '{"title":"Thermodynamics — PYQ sprint","subject":"Physics","minutes":40,"type":"Practice","priority":"high","time":"21:30"}' \
  http://localhost:8080/api/tasks | python3 -m json.tool
```

Expected: HTTP 201 body containing `"priority": "high"` and an `"id"`.

```bash
curl -s -b /tmp/rankos-cookies.txt -H "Content-Type: application/json" \
  -d '{"title":"Bad one","priority":"URGENT!!"}' \
  http://localhost:8080/api/tasks | python3 -m json.tool
```

Expected: a 422 envelope — `"message": "Validation failed"` with a `details` entry for `priority`. That's your schema enum doing its job, translated by `middlewares/errorHandler.js`.

One more check — list today's tasks and find your new one:

```bash
curl -s -b /tmp/rankos-cookies.txt http://localhost:8080/api/tasks | python3 -m json.tool
```

**Heads-up:** the *seeded* tasks won't have a `priority` field (they were inserted before the field existed — MongoDB documents don't retroactively gain fields). New tasks get the default. That's normal schema evolution; keep it in mind for exercise 6, and remember `npm run seed` wipes your created tasks.

**What you learned:** models define shape *for new writes*; old documents keep their old shape; defaults and enums live in the schema; and the error handler turns model complaints into consistent API errors.

---

## Exercise 5 — Make a small frontend tweak

**Goal:** first contact with React code — change visible text and a color, watch hot-reload.

**File:** `rankos-ai-mentor/src/routes/app.planner.tsx` (the Planner page — open it at `/app/planner` in your browser first so you can watch it change).

**Tweak 1 — text.** Find the `PageHeader` (around line 139):

```tsx
<PageHeader
  eyebrow="AI planner"
  title="Your plan, rewritten nightly"
```

Change the title:

```tsx
  title="Your plan, rebuilt while you sleep"
```

Save. The browser updates **without a full reload** — that's Vite hot-module-replacement. No server restart, no refresh.

**Tweak 2 — color.** In the same file's timeline, each task renders a status dot (around line 189):

```tsx
<span
  className={cn(
    "mt-1.5 h-2.5 w-2.5 rounded-full",
    t.done ? "bg-success" : "bg-primary",
  )}
/>
```

Change pending tasks from `bg-primary` to the theme's warning color:

```tsx
    t.done ? "bg-success" : "bg-warning",
```

**Verify:** the dots next to unfinished tasks turn amber. (If the Today timeline shows "No tasks scheduled for today." — you've just met the bug you'll fix in exercise 9. Look at the *week* tab styling instead, or come back after exercise 9.)

**What you learned:** React pages are functions returning markup; `className` strings are Tailwind utility classes; `bg-success` / `bg-warning` / `bg-primary` are *semantic* color tokens defined once in `src/styles.css`, so the whole app stays consistent. `cn(...)` merges classes conditionally — the ternary `t.done ? A : B` picks a class per task.

---

## Exercise 6 — Display the new `priority` field in the planner UI

**Goal:** carry exercise 4's backend field all the way to pixels.

### 6a. Type — `rankos-ai-mentor/src/types/index.ts`

The frontend describes API shapes with TypeScript interfaces. Find `StudyTask` (top of the file) and add priority as *optional* — old seeded documents don't have it (exercise 4 taught you why):

```ts
export interface StudyTask {
  id: string;
  title: string;
  subject: string;
  minutes: number;
  type: "Concept" | "Practice" | "Revision" | "Mock" | "Analysis";
  priority?: "low" | "normal" | "high";
  done: boolean;
  time: string;
}
```

**Why bother?** TypeScript now knows `t.priority` exists and exactly which strings it can be — typos like `t.priorty` or `"hgih"` become red squiggles instead of runtime bugs.

### 6b. UI — `rankos-ai-mentor/src/routes/app.planner.tsx`

In the Today timeline, find the task meta line:

```tsx
<p className="mt-1 text-[12px] text-muted-foreground">
  {t.subject} · {t.minutes} min · {t.type}
</p>
```

Add a badge for high-priority tasks right below it (the `Badge` component is already imported at the top of this file):

```tsx
<p className="mt-1 text-[12px] text-muted-foreground">
  {t.subject} · {t.minutes} min · {t.type}
</p>
{t.priority === "high" && (
  <Badge variant="secondary" className="mt-1.5 rounded-full text-[10px]">
    High priority
  </Badge>
)}
```

The `{condition && <JSX/>}` pattern renders the badge only when the condition holds — for `undefined` or `"normal"` priority, nothing appears.

**Verify:** you need a high-priority task for *today* — the one you created with curl in exercise 4 qualifies (unless you re-seeded; re-run that curl if so). Open `/app/planner` → Today tab: your "Thermodynamics — PYQ sprint" task shows a **High priority** badge; seeded tasks don't. *(Requires the exercise 9 fix for the Today tab to show tasks at all — do 9 first if the list is empty.)*

**What you learned:** the full-stack path of one field: Mongo document → Mongoose schema → JSON over HTTP → TypeScript interface → conditional JSX. When you build features later, you'll repeat exactly this route.

---

## Exercise 7 — Write a test for the stats endpoint

**Goal:** prove your exercise-3 endpoint works *without* curl, in a way that reruns forever.

Read both existing test files first — you're imitating them:

- `backend/src/tests/health.test.js` — simplest possible: import the app, fire requests with supertest.
- `backend/src/tests/integration.test.js` — the full pattern: boots an **in-memory MongoDB** (`mongodb-memory-server`), runs the seed, logs in once in `before()`, reuses the session cookie.

Your endpoint needs auth + seeded data, so follow the integration pattern.

**New file:** `backend/src/tests/tasks.stats.test.js`

```js
/**
 * Tests for GET /tasks/stats (Module 7.2, exercise 3).
 * Same harness as integration.test.js: in-memory Mongo + seeded demo data.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongod;
let mongoose;
let api;
let cookies;

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.NODE_ENV = "test";
  process.env.SWAGGER_ENABLED = "false";

  const seeds = await import("../seeds/index.js");
  await seeds.run();

  const { app } = await import("../app.js");
  mongoose = (await import("mongoose")).default;
  const supertest = (await import("supertest")).default;
  api = supertest(app);

  const login = await api
    .post("/api/auth/login")
    .send({ identifier: "aarav@example.com", password: "password123" });
  cookies = login.headers["set-cookie"];
});

after(async () => {
  if (mongoose) await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

test("GET /tasks/stats requires authentication", async () => {
  assert.equal((await api.get("/api/tasks/stats")).status, 401);
});

test("GET /tasks/stats counts today's seeded plan", async () => {
  const res = await api.get("/api/tasks/stats").set("Cookie", cookies);
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 5); // seeds/data.js todayPlan has 5 tasks
  assert.equal(res.body.done, 2); // 2 are seeded with done: true
  assert.equal(res.body.pending, 3);
  assert.equal(res.body.byType.Mock, 1);
});
```

**Verify:**

```bash
cd ~/Desktop/myapp/backend
npm test
```

Expected: your two new tests among the passes (`# pass 19` overall, up from 17). First run may pause while `mongodb-memory-server` downloads its binary. Try breaking it on purpose: change `assert.equal(res.body.total, 5)` to `6`, rerun, and *read the failure diff* — expected vs actual. Then fix it back.

**What you learned:** tests are just code that calls your code and asserts on the result; the in-memory DB trick gives every run a pristine database; and why `before()` sets `MONGODB_URI` *before* importing the app (`config/env.js` validates env at import time — order matters).

---

## Exercise 8 — Break something on purpose and read the error

**Goal:** lose your fear of red text. Errors are the app *telling you exactly what's wrong* — if you know how to read them.

**Breakage 1 — a typo'd import (the most common real mistake).**
In `backend/src/services/tasks.service.js`, change the import to a name that doesn't exist:

```js
import { StudyTaskk } from "../models/index.js";
```

Save. The backend terminal erupts:

```
SyntaxError: The requested module '../models/index.js' does not provide an export named 'StudyTaskk'
    at ...
[nodemon] app crashed - waiting for file changes before starting...
```

How to read it: **first line = what went wrong** (an export by that name doesn't exist), the `at ...` lines below = *where* (the stack trace, most-specific frame first). Fix the typo, save, nodemon revives.

**Breakage 2 — a runtime error only some requests hit.**
Now break something the server can *start* with. In `getTaskStats` (exercise 3), change `StudyTask.countDocuments` to `StudyTask.countDocument` (no "s"). Server boots fine — the bug is dormant until the line runs. Trigger it:

```bash
curl -s -b /tmp/rankos-cookies.txt http://localhost:8080/api/tasks/stats | python3 -m json.tool
```

You get a 500 envelope — and because you're in development, it includes the **stack trace** (`middlewares/errorHandler.js` hides it in production only): `TypeError: StudyTask.countDocument is not a function`, pointing at your exact file and line. Meanwhile the backend terminal logs the same error at `error` level with the request's method, path, and `requestId`. Fix it back and re-curl.

**Breakage 3 — client-side mistakes get 4xx, not crashes.** Send garbage and note *nothing breaks*:

```bash
curl -s -b /tmp/rankos-cookies.txt -H "Content-Type: application/json" \
  -d '{broken json' http://localhost:8080/api/tasks
curl -s -i -b /tmp/rankos-cookies.txt -X PATCH \
  -H "Content-Type: application/json" -d '{"done":true}' \
  http://localhost:8080/api/tasks/not-a-real-id | head -1
```

Expected: `"Malformed JSON in request body"` (400) and `HTTP/1.1 400 Bad Request` ("Invalid value for '_id'" — a Mongoose CastError, normalized by the error handler). The server keeps running through all of it.

**What you learned:** the debugging reflex — *read the first line, then the top stack frame, then go to that file and line*. Distinguish boot-time errors (nodemon crash loop), request-time server bugs (500 + stack), and client errors (4xx envelope, server fine). Nothing you can type into these files is dangerous; the error handler exists precisely so mistakes are survivable.

---

## Exercise 9 — Fix a real bug: `/tasks?date=today` returns nothing

**Goal:** fix a genuine bug that exists in this codebase right now, discovered by reading the two halves of the app against each other. This is not a planted exercise.

**Symptom:** open `/app/planner` → **Today** tab. The timeline says "No tasks scheduled for today." — yet the *dashboard* (`/app`) happily shows today's plan. Same data, two answers.

**Trace it yourself before reading on.** The trail:

1. `rankos-ai-mentor/src/routes/app.planner.tsx` line ~115: `useQuery(tasksQueryOptions("today"))`.
2. `rankos-ai-mentor/src/services/tasks.ts`: `getTasks(date = "today")` → requests **`/tasks?date=today`** — the literal string `today`.
3. `backend/src/services/tasks.service.js`:

   ```js
   export async function listTasks(userId, date) {
     const day = date || todayStr();
     const tasks = await StudyTask.find({ user: userId, date: day }).sort({ time: 1 });
   ```

   `"today"` is a truthy string, so `date || todayStr()` keeps `"today"` — and the query becomes `find({ date: "today" })`. No document has the literal date `"today"`; they store `"2026-08-11"`-style strings. Result: always `[]`.
4. Why does the dashboard still work? `backend/src/services/dashboard.service.js` never trusts the client — it computes `todayStr()` itself.

**Confirm with curl:**

```bash
curl -s -b /tmp/rankos-cookies.txt "http://localhost:8080/api/tasks?date=today"
curl -s -b /tmp/rankos-cookies.txt "http://localhost:8080/api/tasks"
```

First: `{"data":[]}`. Second: the real task list (no `date` param → the `||` fallback fires).

**The fix (backend, one line).** The frontend treats `"today"` as a keyword (see the comment in `services/tasks.ts`: *"`date=today` or an ISO date"*) — so make the backend honor that contract in `listTasks`:

```js
  const day = !date || date === "today" ? todayStr() : date;
```

Make the same change in your `getTaskStats` from exercise 3 (it inherited the same flaw — bugs copy-paste themselves; that's why you fix the *pattern*, not just the instance).

**Verify:** re-run the first curl — real tasks now. Refresh `/app/planner` → Today tab: the seeded timeline appears (and, with exercises 4–6 done, your High priority badge).

**What you learned:** the most valuable kind of debugging — following one request across the frontend/backend boundary; that `||` fallbacks only catch *falsy* values, not *wrong* ones; and that a "contract" between client and server is only real if both sides implement it. You just did what senior engineers do daily.

---

## Exercise 10 — Document your endpoint in Swagger

**Goal:** make `GET /tasks/stats` show up in the interactive API docs, the same way the health endpoints do.

**How it works:** `backend/src/config/swagger.js` scans `./src/routes/*.js` for JSDoc comments tagged `@openapi` and builds the docs page from them. Look at `routes/health.routes.js` for the pattern you're copying.

**File:** `backend/src/routes/tasks.routes.js` — add the comment block directly above your stats route:

```js
/**
 * @openapi
 * /tasks/stats:
 *   get:
 *     tags: [Tasks]
 *     summary: Task counts for a day
 *     description: Totals, done/pending split, and per-type counts for the user's study plan.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema: { type: string, example: "2026-08-11" }
 *         description: ISO day (YYYY-MM-DD), or "today". Defaults to today.
 *     responses:
 *       200:
 *         description: Stats for the day
 *       401:
 *         description: Not authenticated
 */
router.get("/stats", tasksController.getStats);
```

**Verify:** save (nodemon restarts), open `http://localhost:8080/api/docs`, and find a new **Tasks** section with your endpoint, its query parameter, and response codes. The indentation inside the comment is YAML — if the endpoint doesn't appear, a mis-indented line is almost always why.

**What you learned:** docs-as-code — the documentation lives next to the route it describes, so it changes in the same commit. The `cookieAuth` scheme it references is declared once in `config/swagger.js`.

---

## Where you are now

You have shipped: a log change, an API field, a full three-layer endpoint, a model migration, UI changes, a test, three deliberate breakages, **a real bug fix**, and API documentation. That's the complete day-to-day vocabulary of a working developer — just at small scale.

The next chapter removes the guardrails: four real features, specs and hints only, no code handed to you.

**Next:** [Module 7.3 — Feature Capstones](03-feature-capstones.md)
