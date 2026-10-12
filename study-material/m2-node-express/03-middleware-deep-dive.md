# Module 2.3 — Middleware Deep Dive

> **Goal:** Master the middleware model — the single idea that makes Express *Express* — then walk through `backend/src/app.js` line by line and understand why every middleware is mounted exactly where it is.

## Concepts

### The chain model

A middleware is a function with this signature:

```js
function middleware(req, res, next) { ... }
```

Express keeps an ordered **list** of every middleware and route you register. When a request arrives, Express walks the list top to bottom. For each entry whose path/method matches, it calls the function and then *stops and waits*. The function must do exactly one of three things:

1. **Call `next()`** — "I'm done with my part; continue to the next matching entry."
2. **Send a response** (`res.json(...)`, `res.send(...)`) — the chain ends; nobody else runs.
3. **Call `next(err)`** — "something went wrong"; Express *skips every normal middleware* and jumps to the nearest **error-handling middleware**.

Analogy: airport security. Your request is a passenger walking past a row of desks — ID check, baggage scan, boarding-pass check — and finally the gate (the route handler). Each desk either waves you on (`next()`), handles you completely (sends a response — e.g. "you're on the no-fly list, here's your rejection"), or radios ahead to the incident desk (`next(err)`). The precise technical truth underneath: it's just an array of functions and an index; `next()` increments the index and invokes the next matching function. Nothing more magical than that.

Three consequences follow, and they explain the entire design of `app.js`:

**1. Order is everything.** A middleware can only affect middlewares *after* it. Body parsing must precede anything that reads `req.body`. Authentication must precede anything that reads `req.user`. The 404 handler must come after all real routes — otherwise it would answer everything.

**2. Middlewares communicate by mutating `req` (and `res`).** There's no other channel. `requestId` sets `req.id`; `express.json` sets `req.body`; `cookieParser` sets `req.cookies`; `authenticate` sets `req.user`. Each later middleware finds the accumulated work of the earlier ones.

**3. Forgetting `next()` hangs the request.** If a middleware neither responds nor calls `next()`, Express waits forever; the client eventually times out. This is the #1 beginner middleware bug.

### Where middleware can be mounted

- `app.use(fn)` — every request, every method.
- `app.use("/prefix", fn)` — every request whose path starts with `/prefix` (your rate limiter: `app.use(env.app.apiPrefix, globalRateLimiter)`).
- `router.use(fn)` — every request that reaches that router (your `router.use(authenticate)` in `tasks.routes.js`).
- Per route: `router.post("/signup", authLimiter, validate({ body: signupSchema }), controller.signup)` — a mini-chain for one route (real line from `backend/src/routes/auth.routes.js:28`). Handlers listed left to right run in that order; each must `next()` to reach the one after.

### Middleware *factories*

Many "middlewares" you import are actually functions that **return** a middleware, configured by arguments: `express.json({ limit: "1mb" })`, `cors({ origin })`, `helmet()`, `morgan("dev", {...})`, and your own `validate({ body: schema })` and `createRateLimiter(overrides)`. Spot the pattern: if you call it with options at mount time, it's a factory; the thing it returns is the actual `(req, res, next)` function.

### Error-handling middleware — the 4-argument signature

Express distinguishes error handlers from normal middleware **by arity** (the declared number of parameters):

```js
function errorHandler(err, req, res, next) { ... }   // FOUR params → error handler
```

When any middleware calls `next(err)` — or a synchronous handler `throw`s — Express skips ahead to the next *4-arg* middleware, passing the error as `err`. Normal 3-arg middlewares are bypassed entirely. This is why `backend/src/middlewares/errorHandler.js:64-65` carries this exact comment and shape:

```js
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
```

The `next` parameter is *unused* — but it cannot be deleted. Removing it would make the function 3-arg, Express would treat it as a normal middleware, and your error handling would silently vanish. The eslint-disable comment exists precisely to protect that fourth parameter from a well-meaning cleanup.

One more wrinkle, the most important practical detail in Express 4: **rejected promises are not caught automatically.** `throw` inside a *synchronous* handler → Express catches it → error handler. `throw` inside an `async` handler → a rejected promise that Express 4 never sees → unhandled rejection, hung request. The bridge is `backend/src/utils/asyncHandler.js`:

```js
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
```

Wrap the async function; if its promise rejects, `.catch(next)` routes the error into the chain. Every controller in this codebase is wrapped this way. (Full error-flow story in Chapter 2.4.)

## In your codebase (the walkthrough)

Now read `backend/src/app.js` top to bottom. Every line is quoted; for each, we answer *what it does* and *why it sits at this position in the chain*.

```js
export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.disable("x-powered-by");
```

Settings, not middleware — they don't join the chain, they configure matching/behavior. `trust proxy` must be set before the rate limiter is *created into the chain* because express-rate-limit keys clients by `req.ip`, which is computed from `X-Forwarded-For` only when the proxy is trusted. `x-powered-by` off = don't advertise the framework. (Chapter 2.2 covered both.)

### 1. `app.use(requestId)` — first, on purpose

```js
  // ── Security & correlation ─────────────────────────────────
  app.use(requestId);
```

From `backend/src/middlewares/requestId.js`: reuse the inbound `x-request-id` header or generate `randomUUID()`, store it as `req.id`, echo it back via `res.setHeader`. It runs **first** so that *every* later actor — Morgan logs, error handler, even a failure inside helmet — can tag its output with the correlation id. If it ran after logging, logs would have no id; after the error handler was registered, errors would have no id. First = everyone downstream benefits. This is the general placement principle: *the earlier a middleware runs, the more of the request's life it can observe or serve.*

### 2. `app.use(helmet())` — security headers early

```js
  app.use(helmet());
```

Helmet sets a battery of defensive response headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options`, a conservative `Content-Security-Policy`, etc.). It's cheap and touches only headers, so it goes early — headers must be set before *any* response could be sent, and you want them present even on error responses produced later in the chain.

### 3. CORS

```js
  app.use(
    cors({
      origin: env.cors.origin,
      credentials: env.cors.credentials,
    }),
  );
```

Browsers block cross-origin `fetch` unless the server opts in. The `cors` middleware answers preflight `OPTIONS` requests and stamps `Access-Control-Allow-Origin` on responses. Config comes from `env.cors` (`backend/src/config/env.js:113-116`): `CORS_ORIGIN` may be `*` or a comma-separated list (`list()` helper splits it), and `credentials: true` allows cookies to cross origins — essential because this app's auth rides on cookies. Placement note: CORS must run **before the rate limiter and routes**, so even a `429 Too Many Requests` or an error response carries CORS headers — otherwise the browser hides the real error from the frontend and you debug a ghost.

### 4. Body parsing & cookies

```js
  // ── Body parsing & cookies ─────────────────────────────────
  app.use(express.json({ limit: APP.JSON_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: APP.JSON_BODY_LIMIT }));
  app.use(cookieParser());
```

Three producers of parsed input: `req.body` (JSON), `req.body` (form-encoded), `req.cookies`. `APP.JSON_BODY_LIMIT` is `"1mb"` (`backend/src/constants/index.js:19`) — a denial-of-service guard; a 50 MB body dies with 413 before parsing. These must precede **sanitize** (which scrubs `req.body` — can't scrub what isn't parsed yet), **authenticate** (which reads cookies), and every route. Note `express.json` can also *throw*: malformed JSON produces an `entity.parse.failed` error that the error handler specifically normalizes to a 400 (`errorHandler.js:46-51`) — an early example of the chain's error lane in action.

### 5. `app.use(sanitize)` — immediately after parsing

```js
  // ── Input sanitization (NoSQL injection / prototype pollution) ─
  app.use(sanitize);
```

From `backend/src/middlewares/sanitize.js`: recursively walks `req.body`, `req.params`, `req.query` and **deletes** any key that starts with `$`, contains `.`, or is `__proto__`/`constructor`/`prototype`. Why: MongoDB queries are objects, and `{ "email": { "$gt": "" } }` in a login body could match *any* user if passed to `User.findOne` naively — that's NoSQL operator injection. `__proto__` keys can poison every object in the process (prototype pollution). Two subtleties worth reading in the file itself:

- String *values* are left intact deliberately — the comment explains that study content contains `∫, θ, <, >` and blanket HTML-stripping would corrupt it. Sanitizing has a *target*: the query layer, not display (output encoding is the frontend's job).
- The `req.query` dance (`Object.defineProperty(req, "query", ...)`): in Express 4, `req.query` is a getter that **re-parses the URL on every access**, so scrubbing the returned object wouldn't stick. The middleware captures it once, scrubs it, and pins the clean object back onto `req`. A perfect example of "know your framework's internals or your security middleware silently does nothing."

Position: after the parsers (needs `req.body` to exist), before everything that touches the database.

### 6. `app.use(compression())`

```js
  // ── Performance ────────────────────────────────────────────
  app.use(compression());
```

Gzip/brotli-compresses response bodies when the client sends `Accept-Encoding`. JSON compresses extremely well (often 5–10×). It wraps `res` so that later handlers' writes get compressed — hence it must be mounted before the routes that produce those responses.

### 7. Morgan — HTTP access logging through Winston

```js
  // ── HTTP request logging (through Winston) ─────────────────
  app.use(
    morgan(env.isProduction ? "combined" : "dev", {
      stream: morganStream,
      skip: (req) => req.path === `${env.app.apiPrefix}/health/live`,
    }),
  );
```

Morgan logs one line per request (`GET /api/tasks 200 12.3 ms`). Three deliberate choices:

- **Format by environment**: `dev` (terse, colored) locally; `combined` (Apache-style, machine-parseable) in production.
- **`stream: morganStream`**: instead of writing to stdout directly, Morgan pipes each line into Winston (`backend/src/config/logger.js:74-76` — `logger.http(message.trim())`). One logging pipeline, one format, one destination set. (Why that matters: Chapter 2.4.)
- **`skip` for `/health/live`**: orchestrators poll liveness every few seconds; logging each poll is pure noise. Note it skips only `live`, not `ready` — readiness flaps are worth seeing.

Placement: after the parsers is fine (Morgan doesn't need the body), before the routes so every API hit is logged — including rate-limited and 404 responses, since Morgan logs when the response *finishes*, whoever wrote it.

### 8. Rate limiting — scoped to the API prefix

```js
  // ── Rate limiting (applied to the API surface) ─────────────
  app.use(env.app.apiPrefix, globalRateLimiter);
```

From `backend/src/middlewares/rateLimiter.js`: `express-rate-limit` with `windowMs`/`max` from env (defaults: 300 requests per 15 minutes per IP), modern `RateLimit-*` headers (`standardHeaders: "draft-7"`), and a **Redis-backed store when Redis is up** (`buildStore()` checks `isRedisReady()`), so limits are shared across multiple server instances; otherwise it falls back to in-memory counting, fine for one node. When tripped, it responds itself with 429 and a JSON error body shaped exactly like the error handler's (`{ success: false, error: { code: "RATE_LIMITED", ... } }`) — consistent envelopes even from middleware that never reaches your handler.

Two placement facts: it's mounted **on `/api` only** — static-ish endpoints like the `/` redirect and Swagger docs aren't throttled; and it sits **after CORS** (so blocked responses still carry CORS headers) but **before the routes** (so blocked requests never cost you a database query). Note also `auth.routes.js` layers a *stricter* `authLimiter` on top for login/signup — per-route chains compose with app-level ones.

### 9. Swagger docs

```js
  // ── API docs (Swagger) ─────────────────────────────────────
  mountSwagger(app);
```

Not `app.use(mountSwagger)` — it's a plain function *call* that registers routes (`/api/docs`, `/api/docs.json`) on the app if `env.swagger.enabled` (see `backend/src/config/swagger.js:44-66`, and Chapter 2.6). Mounted before the API router simply so docs exist regardless of API routing; being above `notFound` is what actually matters.

### 10. The routes

```js
  // ── Routes ─────────────────────────────────────────────────
  app.use(env.app.apiPrefix, apiRouter);

  // Bare root → friendly redirect to the API root.
  app.get("/", (_req, res) => res.redirect(env.app.apiPrefix));
```

The whole feature tree from Chapter 2.2 mounts here, at `/api`. By this point in the chain a request has: an id, security headers, CORS clearance, parsed body/cookies, sanitized input, a log line pending, and a rate-limit check passed. *That* is what the ordering bought you — every route handler can assume all of it.

### 11. The tail: 404 and the error handler — must be last

```js
  // ── 404 + centralized error handling (must be last) ────────
  app.use(notFound);
  app.use(errorHandler);
```

- `notFound` (3-arg) only *runs* if nothing above matched — that's what makes it a 404 detector. It doesn't respond directly; it forwards `next(ApiError.notFound(...))` into the error lane (`backend/src/middlewares/notFound.js:8`). Put it before the routes and every request would 404.
- `errorHandler` (4-arg) is the chain's terminus for the error lane. Every `next(err)` from *anywhere* above — sanitizers, parsers, controllers via `asyncHandler`, `notFound` — lands here. It must be **after** everything that can produce an error, i.e., dead last.

```js
  return app;
}

export const app = createApp();
export default app;
```

The factory returns the configured app; a module-level singleton is exported for `index.js` and for tests.

### The complete chain, at a glance

```
request ──▶ requestId ─▶ helmet ─▶ cors ─▶ json ─▶ urlencoded ─▶ cookieParser
        ─▶ sanitize ─▶ compression ─▶ morgan ─▶ [ /api ] rateLimiter
        ─▶ swagger routes ─▶ [ /api ] apiRouter (auth, tasks, …) ─▶ GET /
        ─▶ notFound ─▶ errorHandler
              ▲ any next(err) from anywhere jumps ──────────────────┘
```

## Pitfalls & gotchas

- **Deleting the "unused" `next` in `errorHandler`** turns it into a normal middleware and disables all error handling. The arity *is* the API.
- **`next()` vs `next(err)` vs `next("route")`.** `next()` = continue; `next(anything-else)` = error lane. (Even `next("route")` — a rarely-used skip within a route's handler stack — is a special string; passing any other truthy value means "error".)
- **Calling `next()` after sending a response.** The chain continues and someone else may try to respond → `ERR_HTTP_HEADERS_SENT`. Respond *or* forward; never both.
- **Async middleware that throws without `asyncHandler`.** In Express 4 the rejection never reaches `errorHandler`; the request hangs. Note `authenticate` itself is wrapped in `asyncHandler` (`backend/src/middlewares/authenticate.js:28`) because it awaits the session rotation.
- **Mount-order bugs are silent.** Move `sanitize` above `express.json` and it becomes a no-op (nothing to scrub yet) with zero errors — you'd only find out during a pentest. Order can't be unit-tested by reading one file; it's a property of `app.js` as a whole.
- **`req.query` mutation doesn't stick in Express 4** — the getter re-parses per access. `sanitize.js` handles it with `Object.defineProperty`; if you ever write middleware that rewrites the query, copy that technique.
- **Middleware factories vs middleware.** `app.use(helmet)` (forgetting `()`) mounts the *factory* as if it were middleware — requests hang or crash confusingly. If it takes options, call it.

## Exercises

Answers in [SOLUTIONS.md](./SOLUTIONS.md).

1. **(Comprehension)** For a successful `POST /api/tasks`, list every middleware that runs, in order, from `requestId` to the controller — including router-level ones. Which of them mutate `req`, and what do they add?
2. **(Prediction)** Swap lines: move `app.use(sanitize)` to *before* `app.use(express.json(...))`. What breaks, what still works, and why is nothing logged about it?
3. **(Prediction)** A request hits `GET /api/tasks` with no token and no cookies. Trace the exact path to the client's response: which middleware throws, which file converts it, and what status/body comes out? (Read `authenticate.js:48` and `errorHandler.js`.)
4. **(Code reading)** In `rateLimiter.js`, `buildStore()` can return `undefined`. When does that happen, what does express-rate-limit do in that case, and why is that acceptable "for a single-node foundation build" but a real problem with 3 replicas behind a load balancer?
5. **(Comprehension)** Why is `notFound` written to call `next(ApiError.notFound(...))` instead of just `res.status(404).json({...})` directly? Name two concrete behaviors that would be lost with the direct approach.
6. **(Prediction)** What happens to a request for `/api/health/live`: does Morgan log it? Does the rate limiter count it? Justify both from the code in `app.js`.
7. **(Code reading)** `auth.routes.js:28` chains three handlers: `authLimiter, validate({ body: signupSchema }), authController.signup`. Explain the execution order, and what happens at each step if (a) the IP is over its limit, (b) the body is missing `mobile`.
8. **(Thought experiment)** Suppose you add a middleware that measures response time and logs it with `req.id`. Where exactly in `app.js` would you mount it, and how would it learn when the response finished? (Hint: `res.on("finish", ...)` — and compare with where `requestId` sits.)

---

Next: [Module 2.4 — Config, Logging & the Error Story](./04-config-logging-errors.md)
