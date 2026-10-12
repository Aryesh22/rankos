# Module 2.2 — Express Fundamentals

> **Goal:** Learn Express from zero — the app object, routing, the `req` and `res` objects in real depth, and how Routers compose — using the actual routes and controllers in `backend/src/`.

## Concepts

### What Express adds on top of `node:http`

Chapter 2.1 showed that raw Node gives you `http.createServer((req, res) => ...)` — *one* function for *every* request. With only that, you'd write a giant `if (req.url === "/tasks" && req.method === "GET") ...` ladder, hand-parse query strings, hand-assemble JSON bodies from stream chunks, and hand-set headers.

Express is a small framework that turns that one function into an organized pipeline. It gives you:

1. **Routing** — declare "for `GET /tasks`, run this function" instead of if-ladders.
2. **Enriched `req`/`res`** — Express wraps Node's raw request/response objects with conveniences: `req.query`, `req.params`, `res.json()`, `res.status()`.
3. **Middleware** — a chain of functions each request flows through (the whole of Chapter 2.3).

Crucially, an Express app **is still just a handler function** `(req, res) => void`. That's why `http.createServer(app)` works in `backend/src/index.js`. Express doesn't replace Node's HTTP machinery; it organizes what happens after Node parses the request.

### Creating an app

```js
import express from "express";
const app = express();
```

`express()` returns the app. In your codebase this happens inside a factory (`backend/src/app.js:23`):

```js
export function createApp() {
  const app = express();
  ...
  return app;
}
export const app = createApp();
```

The factory pattern means tests can build a *fresh* app without starting a network server — hold that thought until Chapter 2.5.

Two app-level settings appear immediately after (`app.js:28-29`):

```js
app.set("trust proxy", 1);
app.disable("x-powered-by");
```

- `app.set(name, value)` stores app-wide configuration. `"trust proxy", 1` tells Express: "there is exactly one reverse proxy (nginx / a load balancer) in front of me — believe the `X-Forwarded-For` header it sets." Without this, `req.ip` would always be the proxy's IP, and the rate limiter would throttle *everyone together* as one client.
- `x-powered-by` is a default header advertising "Express". Removing it is basic hygiene — don't tell attackers your stack.

### Routing

A route = HTTP **method** + URL **path** + handler function(s):

```js
app.get("/", (_req, res) => res.redirect(env.app.apiPrefix));   // app.js:70
```

Methods map to `app.get`, `app.post`, `app.patch`, `app.put`, `app.delete`, plus `app.use` (matches *every* method, and matches any path that *starts with* the given prefix).

Paths can contain **named parameters** marked with `:`:

```js
router.patch("/:id", tasksController.patchTask);   // tasks.routes.js:11
```

A request to `PATCH /api/tasks/665f1a.../` matches, and Express fills `req.params.id = "665f1a..."`. Parameters match a single path segment (up to the next `/`).

Matching is **top-down, first match wins** — Express checks routes in the order you registered them. This becomes crucial with middleware (Chapter 2.3).

### `req` — the request, in depth

`req` extends Node's `http.IncomingMessage`. The parts you'll use daily, each with its real source in your codebase:

**`req.params` — path parameters.** Set by the route pattern. In `backend/src/controllers/tasks.controller.js:18`:

```js
const result = await tasksService.setTaskDone(req.user.id, req.params.id, req.body.done);
```

`req.params.id` came from the `/:id` in the route. Always a **string** — even if it looks like a number.

**`req.query` — the query string, parsed.** `GET /api/tasks?date=2026-08-11` gives `req.query.date === "2026-08-11"`. Used in `tasks.controller.js:12`:

```js
const data = await tasksService.listTasks(req.user.id, req.query.date);
```

Warning: query values are strings *or arrays or nested objects* — `?a=1&a=2` yields `["1","2"]`, and Express's extended parser turns `?filter[x]=1` into an object. Your `mistakes.service.js` defends against exactly this with a "strings only" guard (`const str = (v) => (typeof v === "string" && v ? v : undefined)`), and `sanitize.js` scrubs operator keys. Never assume a query value's shape.

**`req.body` — the parsed request body.** Node delivers bodies as a raw byte stream; **`req.body` is `undefined` unless a body-parsing middleware ran first.** Your app mounts two (`app.js:42-43`):

```js
app.use(express.json({ limit: APP.JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: APP.JSON_BODY_LIMIT }));
```

`express.json()` reads the stream, checks `Content-Type: application/json`, parses it, and assigns the result to `req.body`. The `limit: "1mb"` (from `backend/src/constants/index.js`) rejects oversized bodies with a 413 before they eat your memory. `express.urlencoded` does the same for HTML-form encoding (`a=1&b=2`); `extended: true` allows nested objects.

**`req.headers` — all HTTP headers**, lower-cased keys, string values. Two real uses:

- `backend/src/middlewares/requestId.js:10`: `req.headers[APP.REQUEST_ID_HEADER]` reads `x-request-id`.
- `backend/src/middlewares/authenticate.js:13`: `req.headers.authorization` — then `header.startsWith("Bearer ")` and `header.slice(7)` extract the JWT.

**`req.cookies` — parsed cookies.** Like `req.body`, this only exists because of middleware: `app.use(cookieParser())` (`app.js:44`). After it runs, `Cookie: session=abc; theme=dark` becomes `req.cookies = { session: "abc", theme: "dark" }`. Your auth reads tokens from cookies via helpers in `backend/src/utils/cookie.util.js` (`readAccessCookie(req)` / `readRefreshCookie(req)` in `authenticate.js`).

**Other useful properties**: `req.method` (`"GET"`), `req.path` (`"/api/tasks"`), `req.originalUrl` (full URL incl. query — used in `notFound.js` and `errorHandler.js` for messages), `req.ip` (client IP — honest only because of `trust proxy`).

**You can also attach your own properties.** Express middlewares communicate downstream by decorating `req`:

- `req.id` — set by `requestId.js`, read by the error handler.
- `req.user` — set by `authenticate.js` (`req.user = { id: decoded.sub, role: decoded.role }`), read by every controller (`req.user.id`).

This is idiomatic Express: `req` is the per-request shared scratchpad.

### `res` — the response, in depth

`res` extends Node's `http.ServerResponse`. The essential methods:

- **`res.status(code)`** — set the status code. Returns `res`, so it chains.
- **`res.json(obj)`** — serialize `obj` to JSON, set `Content-Type: application/json`, send, and **end the response**.
- **`res.send(body)`** — send a string/Buffer/object; with no argument, ends an empty body (used for 204s).
- **`res.setHeader(name, value)`** — set a header *before* the body goes out (`requestId.js:12` echoes `x-request-id` back).
- **`res.redirect(url)`** — send a 302 with a `Location` header (`app.js:70`).
- **`res.cookie(name, value, opts)` / `res.clearCookie(...)`** — set cookies (used inside `cookie.util.js` by `setAuthCookies`).

The four real response patterns in `backend/src/controllers/tasks.controller.js`:

```js
res.status(HTTP_STATUS.OK).json(data);        // 200 with a body
res.status(HTTP_STATUS.CREATED).json(task);   // 201 after creating
res.status(HTTP_STATUS.NO_CONTENT).send();    // 204 — success, no body
```

A response can be sent **exactly once**. Calling `res.json()` twice throws `ERR_HTTP_HEADERS_SENT` — a classic bug caused by forgetting a `return` before an early response.

### Status codes as this codebase uses them

Codes live in `backend/src/constants/httpStatus.js` so nobody types magic numbers:

| Code | Constant | When your API sends it |
|---|---|---|
| 200 | `OK` | Successful reads and updates (`listTasks`, `patchTask`) |
| 201 | `CREATED` | Resource created (`createTask`) |
| 204 | `NO_CONTENT` | Success with nothing to say (`deleteTask`) |
| 400 | `BAD_REQUEST` | Malformed input — bad ObjectId, broken JSON (`errorHandler.js`) |
| 401 | `UNAUTHORIZED` | Not logged in (`authenticate.js`) — really means *unauthenticated* |
| 403 | `FORBIDDEN` | Logged in but not allowed (`authorize()` role check) |
| 404 | `NOT_FOUND` | No such route (`notFound.js`) or no such document (`ApiError.notFound`) |
| 409 | `CONFLICT` | Duplicate unique value (Mongo error 11000 → `errorHandler.js`) |
| 422 | `UNPROCESSABLE_ENTITY` | Validation failed (zod, via `validate.js`) |
| 429 | `TOO_MANY_REQUESTS` | Rate limited (`rateLimiter.js`) |
| 500 | `INTERNAL_SERVER_ERROR` | Unexpected bug — masked in production |

Rule of thumb: 2xx "we did it", 4xx "you (the client) got it wrong", 5xx "we (the server) broke".

### Router composition

`express.Router()` creates a mini-app: it has `.get/.post/.use` just like `app`, but it isn't a server — it's a mountable bundle of routes. Composition means building small routers per feature and mounting them at prefixes:

```js
const router = Router();
router.get("/", tasksController.listTasks);      // relative path!
// mounted later at "/tasks" → final URL /api/tasks
```

The mount point comes from the parent: `router.use("/tasks", tasksRoutes)` means "any request whose path starts with `/tasks` is handled by `tasksRoutes`, with the prefix **stripped**". Inside `tasks.routes.js`, `"/"` really means "whatever I'm mounted at".

## In your codebase (the walkthrough)

### Three levels of routers

Your API is composed in three layers. Follow `GET /api/tasks?date=2026-08-11` down the tree.

**Level 1 — the app** (`backend/src/app.js:67`):

```js
app.use(env.app.apiPrefix, apiRouter);   // apiPrefix = "/api"
```

Everything under `/api` goes to the root router. The prefix comes from config, not hard-code — change `API_PREFIX` in `.env` and every route moves.

**Level 2 — the root API router** (`backend/src/routes/index.js`). Three interesting things happen here:

```js
router.get("/", (_req, res) => {          // line 63
  res.json({ success: true, message: `${env.app.name} is running`, ... });
});

const featureRouter = buildFeatureRouter();
router.use("/", featureRouter);           // line 79
router.use("/v1", featureRouter);         // line 80
```

- `GET /api` itself returns service metadata (name, environment, docs link).
- `buildFeatureRouter()` assembles one router holding *all* features:
  ```js
  router.use("/auth", authRoutes);
  router.use("/dashboard", dashboardRoutes);
  router.use("/tasks", tasksRoutes);
  // ... 19 feature routers total
  ```
- **The same `featureRouter` object is mounted twice** — at `/` and at `/v1`. So `GET /api/tasks` and `GET /api/v1/tasks` hit the *identical* handlers. That's API versioning for free: when a breaking v2 arrives, mount a new router at `/v2` and old clients keep working. Mounting one router at two prefixes costs nothing — routers are just handler lists.

**Level 3 — the feature router** (`backend/src/routes/tasks.routes.js`, all 14 lines):

```js
import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import * as tasksController from "../controllers/tasks.controller.js";

const router = Router();

router.use(authenticate);
router.get("/", tasksController.listTasks);
router.post("/", tasksController.createTask);
router.patch("/:id", tasksController.patchTask);
router.delete("/:id", tasksController.deleteTask);

export default router;
```

Read it like a sentence: *every* tasks request must first pass `authenticate` (`router.use` with no path = applies to all routes in this router); then four routes cover the CRUD surface. Note the REST shape — same path `/`, different methods; `:id` only where a specific task is addressed.

So the full journey of `GET /api/tasks?date=2026-08-11`:

```
app  ── "/api" matches ──▶ apiRouter (routes/index.js)
     ── "/" featureRouter ──▶ "/tasks" matches ──▶ tasksRouter
     ── authenticate sets req.user ──▶ GET "/" matches ──▶ listTasks
```

### The controller's-eye view of req/res

`backend/src/controllers/tasks.controller.js` shows every req/res concept in 35 lines:

```js
// GET /tasks?date=YYYY-MM-DD
export const listTasks = asyncHandler(async (req, res) => {
  const data = await tasksService.listTasks(req.user.id, req.query.date);
  res.status(HTTP_STATUS.OK).json(data);
});
```

- `req.user.id` — attached by middleware, *never* taken from the client. The file's own comment says why: "the current user comes from the session, never the client." A client sending `{ userId: "someone-else" }` in the body simply gets ignored — that's an authorization bug avoided by design.
- `req.query.date` — optional filter; the service defaults it to today.
- `req.params.id` (in `patchTask`/`deleteTask`) — which task.
- `req.body.done` (in `patchTask`) — the new state, courtesy of `express.json()`.
- Status codes chosen deliberately: 200 / 201 / 204 as in the table above.

One more response style exists in the codebase — the standardized envelope in `backend/src/utils/ApiResponse.js` (`{ success, message, data, meta }` with `ApiResponse.ok(res, data)` helpers). The tasks controller deliberately returns **raw** shapes instead because the frontend contract (API_SPEC) expects them; knowing both styles exist stops you from being confused when you see them side by side.

## Pitfalls & gotchas

- **`req.body` is `undefined`?** The JSON body parser didn't run — either it's mounted after your route, or the client forgot `Content-Type: application/json`. Same story for `req.cookies` and `cookieParser()`.
- **Everything from the wire is a string.** `req.params.id`, `req.query.page`, header values — all strings. `req.query.page + 1` gives `"11"` not `11`. The codebase converts explicitly: `Number(page) || 1` in `mistakes.service.js`.
- **Double-send crashes.** `res.json(x)` then falling through to another `res.json(y)` throws "Cannot set headers after they are sent". Always `return` when you respond early.
- **Route order matters.** If you had `router.get("/:id", ...)` *above* `router.get("/stats", ...)`, then `GET /tasks/stats` would match `/:id` with `id="stats"`. Register literal paths before parameterized ones (your tasks router avoids the issue by having no literal siblings).
- **`app.use("/x", ...)` matches by prefix.** It catches `/x`, `/x/y`, `/x/anything`. `app.get("/x", ...)` matches only exactly `/x` (method + exact path).
- **Forgetting `trust proxy` behind a load balancer** makes `req.ip` the proxy's address — the rate limiter then throttles all users as one. Your `app.js:28` sets it; know *why* before you copy it elsewhere (setting it when there's no proxy lets clients spoof their IP via the header).
- **`req.user` doesn't exist by magic.** It exists only after `authenticate` ran. A route registered *outside* `router.use(authenticate)`'s reach that reads `req.user.id` will crash with `Cannot read properties of undefined`.

## Exercises

Answers in [SOLUTIONS.md](./SOLUTIONS.md).

1. **(Comprehension)** For `PATCH /api/v1/tasks/665f00aa11bb22cc33dd44ee` with body `{"done":true}`, list every router/mount it passes through (file by file) and the final values of `req.params`, `req.body`, and (assuming a valid session) `req.user`'s shape.
2. **(Prediction)** A client sends `POST /api/tasks` with body `{"title":"Physics"}` but header `Content-Type: text/plain`. What is `req.body` inside `createTask`, and what will `StudyTask.create` receive for `title`? (Read `express.json()` behavior and `backend/src/services/tasks.service.js:31-42`.)
3. **(Code reading)** In `backend/src/routes/index.js`, the same `featureRouter` is mounted at `/` and `/v1`. Explain how one router object can serve two prefixes, and what URL(s) reach the metadata route defined at line 63.
4. **(Comprehension)** Why does `deleteTask` respond `204` + `.send()` while `createTask` responds `201` + `.json(task)`? What would be wrong with returning `200 {"message":"deleted"}`?
5. **(Prediction)** `GET /api/tasks?date[$gt]=` arrives. Considering `sanitize.js` (Chapter 2.3) and Express's extended query parsing, what does `req.query.date` look like by the time `listTasks` runs, and why doesn't it hit the database as an operator?
6. **(Code reading)** `backend/src/middlewares/authenticate.js` reads the token from two places, in a specific priority order. Which two, which wins, and what line implements the fallback?
7. **(Small task)** Write (on paper — don't commit) a new route `GET /api/tasks/summary` that returns `{ total: <number> }` of the user's tasks for today. Where must it be registered *within* `tasks.routes.js` relative to `patch("/:id")`, and why does the order matter here even though `/:id` is a PATCH?
8. **(Prediction)** What status code and body shape does `GET /api/nope` return, and which two files cooperate to produce it?

---

Next: [Module 2.3 — Middleware Deep Dive](./03-middleware-deep-dive.md)
