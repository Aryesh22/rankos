# Module 2.4 — Config, Logging & the Complete Error Story

> **Goal:** Understand the three support pillars every serious backend needs — validated configuration (`env.js`), structured logging (`logger.js`), and centralized error handling (`ApiError` → `asyncHandler` → `notFound` → `errorHandler`) — by walking the real files line by line, ending with the full journey of an error from `throw` to JSON response.

## Concepts

### Why config is a module, not scattered `process.env` reads

Three problems with sprinkling `process.env.PORT` all over a codebase:

1. **Strings everywhere** — `process.env` values are always strings; every consumer must re-convert and re-default.
2. **Late failure** — a missing `MONGODB_URI` should kill the app *at boot* with a clear message, not crash the first request an hour later with a cryptic driver error.
3. **No single source of truth** — you can't answer "what config does this app take?" without grepping.

The fix is the pattern in `backend/src/config/env.js`: read the environment **once**, validate it, coerce types, apply defaults, freeze the result, and export one object. Every other file imports `env` and reads clean, typed values.

### Why a logger, not `console.log`

`console.log` is fine for scratch debugging, but it fails as production logging on every axis:

- **No levels** — you can't say "in production, show info and above; in dev, show debug too". Winston levels (npm convention: `error:0 < warn:1 < info:2 < http:3 < verbose:4 < debug:5 < silly:6`) make verbosity a config knob (`logger.level`), not a code change.
- **No structure** — grepping free text is miserable; production tooling (Datadog, CloudWatch, `jq`) wants JSON with fields (`timestamp`, `level`, `service`, `requestId`).
- **No destinations** — console can't also write rotating files, and `console.log` is *synchronous* to a terminal (it can actually slow a busy server).
- **No context** — a logger can stamp every line with metadata (`defaultMeta: { service }`).

### The error-handling philosophy: operational vs programmer errors

Two fundamentally different kinds of "error":

- **Operational errors** — expected, normal outcomes of running a server: task not found, invalid password, rate limited, validation failed. They're *part of the API contract*; the client caused them and should hear about them precisely (4xx + a helpful message).
- **Programmer errors** — bugs: `undefined is not a function`, a typo'd field name, a broken invariant. The client did nothing wrong, the message may leak internals (stack traces, query fragments), and the only honest response is a generic 500.

This codebase encodes the distinction as a boolean on the error object: `ApiError.isOperational`. Everything downstream (logging level, message masking) branches on it. That single idea organizes all four error files.

---

## In your codebase (the walkthrough)

### `backend/src/config/env.js` — configuration as a validated, frozen module

```js
import dotenv from "dotenv";
dotenv.config();
```

`dotenv.config()` reads the `.env` file and copies its keys into `process.env` — *without overwriting* variables that are already set (real environment beats file). The comment notes it's a no-op if the file is absent, e.g. in Docker where the runtime injects vars. Because ES modules execute on first import, and `env.js` is imported near the top of `index.js`'s import graph, this runs before anything else needs config.

```js
const REQUIRED = ["MONGODB_URI"];

function ensureRequired() {
  const missing = REQUIRED.filter((key) => !process.env[key] || process.env[key].trim() === "");
  if (missing.length > 0) {
    console.error(`\n[env] Missing required environment variable(s): ${missing.join(", ")}\n` + ...);
    process.exit(1);
  }
}
```

**Fail fast.** Only one variable is truly required — the database URI; everything else has a sane default or is optional. Missing/blank? Print an actionable message ("Copy .env.example to .env") and `process.exit(1)`. Note the comment in the file: it deliberately uses `console.error`, because the logger *can't exist yet* — `logger.js` itself imports `env.js`. Bootstrapping order is real: the config module must be dependency-free.

The coercion helpers — small, but each solves a genuine footgun:

```js
function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
```

`Number(undefined)` is `NaN`; `Number("abc")` is `NaN`; `Number.isFinite` rejects both (and `Infinity`), falling back cleanly. So `PORT=oops` gives you `8080`, not a server listening on port `NaN`.

```js
function bool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}
```

The critical insight (from Chapter 2.1): env values are strings, and the string `"false"` is *truthy* in JS. This helper defines an explicit truthy vocabulary; everything else is `false`.

```js
function list(value, fallback = []) { ... String(value).split(",").map(v => v.trim()).filter(Boolean); }
```

Turns `CORS_ORIGIN=https://a.com, https://b.com` into a clean array — trimmed, empties dropped.

```js
function durationMs(value, fallbackMs) {
  const match = String(value).trim().match(/^(\d+)\s*(ms|s|m|h|d)?$/i);
  ...
  const multipliers = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return amount * multipliers[unit];
}
```

Lets `.env` say `JWT_ACCESS_EXPIRES=15m` or `7d` in human units, while code gets milliseconds. Non-matching input falls back rather than exploding — config parsing should never crash on format, only on absence of required values.

Then the production-only guardrails (`env.js:63-94`) — read these as "the mistakes this file refuses to let you ship":

```js
if (NODE_ENV === "production") {
  // 1) JWT secrets MUST be set...
  // 2) ...and must not match /change-me|dev-/  → "Generate strong values (openssl rand -base64 48)."
  // 3) COOKIE_SAME_SITE=none requires COOKIE_SECURE=true, "or browsers drop them."
}
```

Each check exits the process with instructions. In development, defaults like `"dev-access-secret-change-me"` keep friction low; in production those same defaults are a security hole, so the file makes them *impossible*. This dev-lenient/prod-strict split is a pattern to internalize.

Finally the export:

```js
export const env = Object.freeze({
  nodeEnv: NODE_ENV,
  isProduction: NODE_ENV === "production",
  ...
  app: { name: ..., port: num(process.env.PORT, 8080), apiPrefix: process.env.API_PREFIX || "/api", ... },
  mongo: { uri: process.env.MONGODB_URI },
  cors: { origin: process.env.CORS_ORIGIN === "*" ? "*" : list(process.env.CORS_ORIGIN, ["*"]), ... },
  redis: {
    url: process.env.REDIS_URL || null,
    ...
    get isConfigured() {
      return Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);
    },
  },
  ...
});
```

- **`Object.freeze`** makes the top-level object immutable — an accidental `env.app.port = 3000` somewhere deep in the app throws in strict mode instead of silently reconfiguring the server. (Precision: `freeze` is *shallow* — it freezes `env` itself, not nested objects like `env.app`. It's a guardrail, not a vault.)
- **Getter properties** like `redis.isConfigured` compute derived truths (`"is Redis configured at all?"`) so consumers write `if (env.redis.isConfigured)` instead of re-deriving it — one definition of "configured", used by `redis.js`, `rateLimiter.js`, and the jobs system alike. Same pattern for `cloudinary.isConfigured` and `smtp.isConfigured`, which is exactly what makes those services *optional* at boot (Chapter 2.5).
- Precomputed convenience flags (`isProduction`, `isDevelopment`, `isTest`) keep `NODE_ENV === "production"` string comparisons out of the codebase.

### `backend/src/config/logger.js` — Winston, line by line

```js
const { combine, timestamp, printf, colorize, errors, json, splat } = winston.format;
```

Winston formats are composable transforms applied to each log entry. The ones used here: `timestamp` (adds time), `errors({ stack: true })` (if you log an `Error` object, capture its stack), `splat` (printf-style `%s` interpolation), `colorize` (terminal colors), `json` (emit as JSON), `printf` (custom template).

```js
const logDir = path.resolve(process.cwd(), env.log.dir);
let fileLoggingEnabled = env.isProduction;
if (env.isProduction) {
  try {
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.accessSync(logDir, fs.constants.W_OK);
  } catch (err) {
    fileLoggingEnabled = false;
    console.warn(`[logger] file logging disabled (${logDir} not writable: ${err.code}) — console only`);
  }
}
```

File logging is production-only, and even then it's *best-effort*: the comment explains that many production targets (containers running as non-root, serverless) have read-only filesystems, and the logger "must NEVER crash boot". If the directory can't be created or written (`accessSync` with `W_OK` checks writability), it degrades to console-only with a warning. Defensive boot code: a *logging* failure should never take down the *service*.

```js
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  splat(),
  printf(({ level, message, timestamp: ts, stack }) => `${ts} ${level}: ${stack || message}`),
);

const prodFormat = combine(timestamp(), errors({ stack: true }), splat(), json());
```

Two audiences, two formats. Dev: a human at a terminal — short colored lines, time-of-day only, stack traces inline. Prod: a log pipeline — one JSON object per line, full ISO timestamps, machine-parseable. Same events, different serialization.

```js
const transports = [
  new winston.transports.Console({ format: env.isProduction ? prodFormat : devFormat }),
];

if (fileLoggingEnabled) {
  transports.push(
    new DailyRotateFile({ dirname: logDir, filename: "error-%DATE%.log", datePattern: "YYYY-MM-DD",
                          level: "error", maxFiles: "14d", format: prodFormat }),
    new DailyRotateFile({ dirname: logDir, filename: "combined-%DATE%.log", ... maxFiles: "14d", ... }),
  );
}
```

A **transport** is a destination. Console always; in production, two rotating files as well: `error-YYYY-MM-DD.log` (only level `error` — note a transport can have its own level filter) and `combined-YYYY-MM-DD.log` (everything). `maxFiles: "14d"` auto-deletes logs older than 14 days — without rotation, log files grow until the disk fills and the *whole server* falls over. Rotation is not optional in production.

```js
export const logger = winston.createLogger({
  level: env.log.level,
  levels: winston.config.npm.levels,
  defaultMeta: { service: env.app.name },
  transports,
  exitOnError: false,
  silent: env.isTest,
});
```

- `level` comes from env: default `"info"` in production, `"debug"` in dev (`env.js:124`) — meaning `logger.debug(...)` lines exist in the code but are invisible in prod until you flip `LOG_LEVEL`.
- `defaultMeta` stamps `service: "RankOS API"` on every entry — vital once multiple services share one log pipeline.
- `exitOnError: false` — a transport error shouldn't kill the process.
- `silent: env.isTest` — tests run quiet.

```js
export const morganStream = {
  write: (message) => logger.http(message.trim()),
};
```

The bridge from Chapter 2.3: Morgan thinks it's writing to a stream; actually each access-log line enters Winston at level `http`. That level sits between `info` and `debug` — so production (`info`) hides per-request noise from files/console by default, while dev (`debug`) shows it. One knob controls everything.

### The error pipeline — four files, one story

**File 1: `backend/src/utils/ApiError.js` — the vocabulary.**

```js
export class ApiError extends Error {
  constructor(statusCode, message, { code, details, fields, isOperational = true, cause } = {}) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
    this.code = code || ApiError.defaultCodeFor(this.statusCode);
    this.details = details;
    this.fields = fields;
    this.isOperational = isOperational;
    if (cause) this.cause = cause;
    Error.captureStackTrace(this, this.constructor);
  }
```

A subclass of `Error` carrying everything an HTTP error response needs:

- `statusCode` — which HTTP status to send.
- `code` — a *machine-readable* string (`"NOT_FOUND"`, `"VALIDATION_ERROR"`, from `ERROR_CODES` in `backend/src/constants/index.js`) so frontends can branch on error type without parsing English. `defaultCodeFor` maps status→code so callers rarely specify it.
- `details` — array/object of specifics (e.g. per-field validation issues).
- `fields` — `{ fieldName: message }`, shaped for direct consumption by frontend forms (the JSDoc says so explicitly).
- `isOperational` — the philosophy bit, defaulting to `true`: *if you threw an ApiError, you meant it.*
- `cause` — the underlying error, preserved for logs.
- `Error.captureStackTrace(this, this.constructor)` — records the stack but omits the constructor frame itself, so traces point at the `throw` site.

Then the convenience factories — `ApiError.badRequest(...)`, `.unauthorized(...)`, `.notFound(...)`, `.conflict(...)`, `.unprocessable(...)` — which make service code read like intent: `throw ApiError.notFound("Task not found")` (`tasks.service.js:26`). Note `ApiError.internal(...)` is special: it forces `isOperational: false`.

**File 2: `backend/src/utils/asyncHandler.js` — the on-ramp.** All 3 lines of logic:

```js
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
```

A higher-order function: takes an async handler, returns a normal 3-arg middleware. `Promise.resolve(...)` normalizes whatever `fn` returns into a promise (even if someone passes a sync function); `.catch(next)` forwards any rejection — i.e., any `throw` anywhere inside the `async` function, including deep inside awaited service calls — into Express's error lane. Without this, Express 4 never sees async errors (Chapter 2.3). Every controller in `backend/src/controllers/` is wrapped; so is `authenticate`.

**File 3: `backend/src/middlewares/notFound.js` — unmatched routes join the same lane.**

```js
export function notFound(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}
```

Registered after all routes (Chapter 2.3), it converts "nothing matched" into a first-class `ApiError` and forwards it — so 404s get the same envelope, logging, and request-id treatment as every other error. Note `req.originalUrl` (the full path as the client sent it) rather than `req.path` (which is relative to the mount point).

**File 4: `backend/src/middlewares/errorHandler.js` — the terminus.** Two halves: normalize, then respond.

*Normalize* (`normalizeError`, lines 11-58): the handler receives errors from many sources — your own `ApiError`s, Mongoose, the JSON parser, plain bugs — and converts each into an `ApiError` so one response shape covers all:

```js
if (err instanceof ApiError) return err;                       // already ours

if (err instanceof mongoose.Error.ValidationError) { ... }     // schema validation → 422 + per-field details
if (err instanceof mongoose.Error.CastError) { ... }           // bad ObjectId → 400 "Invalid value for 'x'"
if (err && err.code === 11000) { ... }                         // duplicate unique key → 409 + which fields
if (err && err.type === "entity.parse.failed") { ... }         // broken JSON body → 400

// Fallback: unexpected/programmer error → masked 500
return new ApiError(err?.statusCode || 500, err?.message, { isOperational: false, cause: err });
```

Study the duplicate-key branch: Mongo error `11000` isn't a Mongoose class, just a numeric code, and `err.keyValue` holds the offending fields — the handler surfaces them (`"Duplicate value for: email"`). And crucially, the fallback marks unknown errors `isOperational: false` — an error nobody classified is *assumed to be a bug*.

*Respond* (`errorHandler`, lines 65-101):

```js
export function errorHandler(err, req, res, next) {
  const apiError = normalizeError(err);

  const logMeta = { method: req.method, path: req.originalUrl, status: apiError.statusCode, requestId: req.id };
  if (apiError.isOperational && apiError.statusCode < 500) {
    logger.warn(`${apiError.statusCode} ${apiError.message}`, logMeta);
  } else {
    logger.error(apiError.stack || apiError.message, logMeta);
  }
```

Logging policy in two lines: expected 4xx → `warn`, terse (no stack — a 404 isn't an incident); everything else → `error`, with a full stack. Every entry carries the request id from Chapter 2.3, so you can join the error to its Morgan access line and any service logs.

```js
  const body = {
    success: false,
    error: {
      code: apiError.code,
      message: apiError.statusCode >= 500 && env.isProduction ? "Internal server error" : apiError.message,
      ...(apiError.details ? { details: apiError.details } : {}),
      ...(apiError.fields ? { fields: apiError.fields } : {}),
    },
  };
  if (!env.isProduction && apiError.stack) body.error.stack = apiError.stack;
  if (req.id) body.requestId = req.id;

  res.status(apiError.statusCode).json(body);
```

The response contract: `{ success: false, error: { code, message, details?, fields?, stack? }, requestId }`. Two production maskings: 5xx messages become the generic `"Internal server error"` (real messages can leak table names, file paths, internals), and stack traces are dev-only. The client always gets the `requestId` — so a bug report can say "requestId abc-123" and you can grep the exact log lines.

### The full journey of one error

`PATCH /api/tasks/000000000000000000000000` (well-formed ObjectId, no such task):

1. Chain runs: requestId → … → `tasksRouter` → `authenticate` sets `req.user` → `patchTask` controller (wrapped in `asyncHandler`).
2. `tasks.service.js:26`: `findOneAndUpdate` returns `null` → `throw ApiError.notFound("Task not found")` → the async function's promise **rejects**.
3. `asyncHandler`'s `.catch(next)` fires → `next(err)` → Express jumps over every remaining 3-arg middleware (including `notFound`) to `errorHandler`.
4. `normalizeError`: already an `ApiError` — pass-through. Operational, 404 < 500 → `logger.warn("404 Task not found", { method, path, status, requestId })`.
5. Client receives `404` with:
   ```json
   { "success": false, "error": { "code": "NOT_FOUND", "message": "Task not found" }, "requestId": "..." }
   ```
   (+ `stack` in development.)

Now the same request with id `"abc"` (not a valid ObjectId): Mongoose throws a `CastError` inside the same service call — nobody wrote a throw — and the identical machinery delivers `400 "Invalid value for '_id'"`. That's the payoff of centralization: *services just throw; the edge decides presentation.*

## Pitfalls & gotchas

- **`Object.freeze` is shallow.** `env.app.port = 1` still "works" (the nested object isn't frozen). The freeze is a tripwire for the common case, not full immutability.
- **`console.log` in request code** bypasses levels, formats, files, and test-silencing. The only sanctioned `console.*` calls in the backend are in `env.js`/`logger.js` boot code, *before/around* the logger's existence — each with a comment saying so.
- **Throwing strings** (`throw "not found"`) breaks `instanceof` checks and has no stack. Always throw `Error` (here: `ApiError`) instances.
- **Catching errors too early.** A `try/catch` inside a service that swallows and returns `null` hides the failure from the entire pipeline. Catch only where you can *add* something (like `validate.js` converting `ZodError` → `ApiError`), otherwise let it fly to the edge.
- **Forgetting that the fallback masks messages in prod.** If you throw a plain `Error("Card declined")` from a service, production users see "Internal server error" — because unclassified errors are treated as bugs. If the client should see the message, it must be an `ApiError` (operational).
- **Logging the error twice.** Services shouldn't `logger.error(...)` *and* rethrow — the error handler already logs. Double logging turns one incident into two alerts.
- **Level filters interact.** `logger.debug(...)` in production is dropped by the logger's `info` level *before* reaching any transport; and the error-file transport additionally drops anything below `error`. Both gates must pass.

## Exercises

Answers in [SOLUTIONS.md](./SOLUTIONS.md).

1. **(Prediction)** `.env` contains `PORT=abc`, `SWAGGER_ENABLED=false`, `CORS_ORIGIN=https://a.com,https://b.com`. What exact values do `env.app.port`, `env.swagger.enabled`, and `env.cors.origin` get? Cite the helper responsible for each.
2. **(Comprehension)** Why does `env.js` use `console.error` instead of `logger.error`, and why does `logger.js` use `console.warn` in its catch block? What would happen if you "fixed" the first one to use the logger?
3. **(Prediction)** In production with default `LOG_LEVEL`: which destinations (console / error-file / combined-file) receive (a) `logger.debug("x")`, (b) a Morgan access line (`logger.http`), (c) `logger.warn("404 ...")`, (d) `logger.error(stack)`?
4. **(Code reading)** In `errorHandler.js`, find the branch that handles MongoDB duplicate-key errors. What triggers `code === 11000` in practice (give a concrete example from a users collection), and what status/code/details does the client receive?
5. **(Prediction)** A controller (properly wrapped in `asyncHandler`) contains a typo: `req.usr.id`. In production, what gets logged (level? stack?) and what does the client see, byte for byte (shape-wise)? Which line of `normalizeError` decided that?
6. **(Comprehension)** Explain `durationMs("15m", 900000)` step by step through the regex, and what `durationMs("soon", 900000)` returns and why that's the right behavior for config parsing.
7. **(Code reading)** `validate.js` catches `ZodError` and builds both `fields` and `details`. Read `backend/src/middlewares/validate.js:35-52`: why does it keep only the *first* message per field in `fields`, and how does that connect to `ApiError`'s JSDoc for `fields`?
8. **(Thought experiment)** You need a new config value `MAX_UPLOAD_MB` (number, default 10, must be positive in production). Describe exactly what you'd add to `env.js` and where, following the file's existing patterns — including which section of the frozen object it belongs in.

---

Next: [Module 2.5 — Server Lifecycle](./05-server-lifecycle.md)
