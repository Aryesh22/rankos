# Module 4.4 — Security Mastery

> **Goal:** Take an attacker's-eye tour of every defense in this codebase — rate limiting, input sanitization (NoSQL injection & prototype pollution), Helmet headers, CORS, zod validation, IDOR/ownership scoping, and secrets management — then map the OWASP Top 10 onto where your app defends, where it doesn't, and where it stubs.

Prerequisites: Modules [4.1](01-password-and-hashing.md)–[4.3](03-otp-verification-reset.md). This is the capstone: less new theory, more "walk the perimeter and rattle every door."

---

## Concepts: defense in depth

No single control stops everything. Good security **layers** independent controls so that any one failing doesn't breach you. Trace a request through this app's layers, in the order `backend/src/app.js` applies them:

```js
app.set("trust proxy", 1);      // correct client IP behind a proxy
app.disable("x-powered-by");    // don't advertise "Express"
app.use(requestId);             // correlation id for logs
app.use(helmet());              // security response headers
app.use(cors({ ... }));         // who may call us from a browser
app.use(express.json({ limit: APP.JSON_BODY_LIMIT }));  // 1mb body cap
app.use(cookieParser());
app.use(sanitize);              // strip Mongo operators / proto-pollution keys
app.use(compression());
app.use(morgan(...));           // request logging
app.use(env.app.apiPrefix, globalRateLimiter);  // 300 req / 15 min / IP
// ... then routes, each with their own validate() + authenticate + limiters
```

A malicious request must survive *all* of these, and then the route's own `validate` + `authenticate` + ownership checks. Let's attack each.

---

## In your codebase

### 1. Rate limiting — `backend/src/middlewares/rateLimiter.js`

Rate limiting turns "infinite free guesses" into "a handful, then wait." It's the backstop behind every other auth defense in this module.

```js
export function createRateLimiter(overrides = {}) {
  return rateLimit({
    windowMs: env.rateLimit.windowMs,   // 15 min
    max: env.rateLimit.max,             // 300 requests / window / key
    standardHeaders: "draft-7",         // emit RateLimit-* headers
    legacyHeaders: false,
    store: buildStore(),                // Redis if available, else in-memory
    message: { success: false, error: { code: ERROR_CODES.RATE_LIMITED, message: "Too many requests..." } },
    statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,  // 429
    ...overrides,
  });
}
export const globalRateLimiter = createRateLimiter();
```

**Two tiers:**

- **Global** (`app.js`): `globalRateLimiter` on the whole `/api` surface — 300 requests / 15 min / IP. Blunt DoS protection.
- **Per-route** (`auth.routes.js`): a *stricter* limiter on the sensitive endpoints —

  ```js
  const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 30 });
  router.post("/signup", authLimiter, ...);
  router.post("/login", authLimiter, ...);
  router.post("/verify-otp", authLimiter, ...);
  // forgot-password, reset-password, resend-otp too
  ```

  30 attempts / 15 min / IP across all credential + OTP mutations. *This* is what makes OTP brute force (Module 4.3) and password spraying (Module 4.1) impractical from a single IP.

**The store matters at scale.** `buildStore()` uses **Redis** when configured so the limit is *shared across all server instances* — otherwise each of N instances allows the full quota and your real limit is N×. On a single node the in-memory fallback is fine; the code degrades gracefully (`env.redis.isConfigured && isRedisReady()`).

**The `trust proxy` dependency.** Rate limits key on `req.ip`. Behind nginx, `req.ip` is only correct because `app.set("trust proxy", 1)`. Get this wrong and either everyone shares one proxy IP (one user trips the limit for all) or attackers forge `X-Forwarded-For` to reset their bucket at will.

**Honest gaps:** limits are per-IP only — a botnet with many IPs sidesteps them (which is exactly why the OTP attempt-cap and high-entropy tokens exist as *independent* layers). There's no per-account lockout, and no slowdown/CAPTCHA escalation.

### 2. Input sanitization — `backend/src/middlewares/sanitize.js`

This dependency-free middleware defends two distinct attacks. Read it, then we'll attack it.

```js
const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function scrub(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 6) return;
  if (Array.isArray(value)) { for (const item of value) scrub(item, depth + 1); return; }
  for (const key of Object.keys(value)) {
    if (key.startsWith("$") || key.includes(".") || BLOCKED_KEYS.has(key)) {
      delete value[key];
      continue;
    }
    scrub(value[key], depth + 1);
  }
}
```

**Attack A — NoSQL operator injection.** MongoDB queries are *objects*, and JSON request bodies are *objects* — so if you drop a raw body straight into a query, an attacker can smuggle **query operators**. Concrete example from Module 4.1's login:

```jsonc
// POST /api/auth/login
{ "identifier": { "$gt": "" }, "password": { "$gt": "" } }
```

If this reached `User.findOne({ mobile: identifier })`, it'd become `findOne({ mobile: { $gt: "" } })` — "any user whose mobile is greater than empty string" = **the first user in the collection**, no password needed. Classic auth bypass. The `key.startsWith("$")` rule deletes `$gt`/`$ne`/`$where`/etc. from every object in the tree, so the operator never survives to the query. (In this codebase zod *also* catches it — `identifier` must be a string — but sanitize is the app-wide net for the routes that don't validate as tightly.)

The `key.includes(".")` rule blocks **dotted-path injection** like `{ "profile.role": "admin" }`, which Mongo would interpret as a nested-field write/query.

**Attack B — prototype pollution.** In JavaScript, every object's `__proto__` points to `Object.prototype`, shared by *all* objects. If an attacker gets you to assign into `__proto__`, `constructor`, or `prototype`, they can inject properties onto that shared parent — poisoning objects app-wide:

```jsonc
{ "__proto__": { "isAdmin": true } }
```

A naive deep-merge of that body could make `({}).isAdmin === true` **everywhere in the process** — every object suddenly "is admin," or a crafted key crashes the app (DoS) or, in the worst historical cases, enables RCE. `BLOCKED_KEYS` deletes these keys before any merge/query touches them.

**Two subtleties in this implementation:**

- **`depth > 6` bailout** — prevents a maliciously deep object from stack-overflowing the recursive `scrub` (a DoS vector in itself).
- **The `req.query` dance** —

  ```js
  const q = req.query;
  scrub(q);
  Object.defineProperty(req, "query", { value: q, writable: true, configurable: true });
  ```

  In Express, `req.query` is a *getter that re-parses on each access*, so mutating the returned object wouldn't stick. The code scrubs it once and pins the cleaned object. Miss this and query-string injection would sail through untouched.

**Deliberate non-goal:** string *values* are left intact. The header comment explains why — RankOS content carries math (`∫`, `θ`, `<`, `>`) that blanket HTML-stripping would corrupt. **XSS output-encoding is the frontend's job**; this middleware guards the *query layer* only. Know where the responsibility boundary sits.

### 3. Helmet headers — `app.use(helmet())`

Helmet sets a bundle of protective **response headers** with sane defaults. The important ones and the attacks they blunt:

- `X-Content-Type-Options: nosniff` — stops browsers "MIME-sniffing" a response into something executable.
- `X-Frame-Options` / frame-ancestors — **clickjacking**: prevents your pages being invisibly iframed over a decoy.
- `Strict-Transport-Security` (HSTS) — forces HTTPS on repeat visits (downgrade defense).
- Removes `X-Powered-By` (also explicitly `app.disable("x-powered-by")`) — don't hand attackers your stack.
- A default `Content-Security-Policy` limiting where scripts/styles may load — a real XSS mitigation.

**Honest note:** this app is a JSON API, so several Helmet headers (CSP, frame options) matter most for the *frontend's* HTML responses, not `/api` JSON. Helmet with defaults is applied globally and costs nothing; for an API you'd tune CSP where the HTML is actually served.

### 4. CORS — `app.use(cors({ origin: env.cors.origin, credentials: env.cors.credentials }))`

**What CORS actually is (and isn't).** The *Same-Origin Policy* is a browser rule: JavaScript on `evil.com` can read responses from `evil.com`, not from `your-api.com`. CORS is how a server *relaxes* that — it tells the browser "these specific other origins may read my responses." Two things people get wrong:

1. **CORS is enforced by the browser, not the server.** It protects *your users' browsers* from malicious sites reading your API with the user's cookies. It is **not** a firewall — `curl` and Postman ignore CORS entirely. Never rely on CORS for authorization.
2. **`credentials: true` + `origin: "*"` is forbidden by browsers** — you cannot send cookies to a wildcard origin. So a credentialed API *must* echo a specific allowed origin.

Your config, from `env.js`:

```js
cors: {
  origin: process.env.CORS_ORIGIN === "*" ? "*" : list(process.env.CORS_ORIGIN, ["*"]),
  credentials: bool(process.env.CORS_CREDENTIALS, true),
},
```

**This is the app's most important config-time footgun.** The default is `origin: "*"` **and** `credentials: true`. That combination is contradictory for cookie auth (browsers refuse it), and a wide-open `*` is exactly what you must *not* ship for a cookie-based API — any website could attempt credentialed calls. In production you must set `CORS_ORIGIN` to your real frontend origin(s), e.g. `https://app.rankos.example`. Unlike the JWT-secret and SameSite guards in `env.js`, **there is no startup check forcing this** — it's a documented gap. (Exercise 4.)

### 5. Validation — zod, `backend/src/validators/auth.validator.js`

Sanitize removes *dangerous* keys; validation asserts the *shape and rules* of what's left. `validate({ body: schema })` (Module 4.1/4.3) runs zod before any controller. From the auth validators:

```js
const mobile = z.string().trim().min(1, "Mobile number is required")
  .regex(/^\+?[0-9\s-]{10,15}$/, "Enter a valid mobile number");
const password = z.string().min(8, "Use at least 8 characters").max(72, "Password is too long");
const objectId = z.string().trim().regex(/^[a-fA-F0-9]{24}$/, "Invalid id");

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email or mobile"),
  password: z.string().min(1, "Enter your password"),
  rememberMe: z.boolean().optional().default(false),
});
```

Why this is a security control, not just UX:

- **Type coercion to strings** — `identifier` *must* be a string, so `{ "$gt": "" }` (an object) is rejected at 422 before it can become a query operator. Validation and sanitize independently kill the same NoSQL-injection attempt.
- **`objectId` regex** — `userId`/`code` must match strict patterns, so path/lookup values can't carry payloads.
- **`.max(72)` on password** — the bcrypt-truncation and DoS bound from Module 4.1, enforced at the edge.
- **`validate` replaces `req.body` with the parsed result** — downstream code sees only clean, typed, allow-listed fields; unknown extra fields are dropped by the object schema. An attacker can't smuggle a `role: "admin"` field into signup because `signupSchema` doesn't include it.

And `validate` funnels zod errors into a uniform **422** with a `fields` map the frontend forms consume directly — good security *and* good UX from one layer.

### 6. IDOR / ownership scoping

**IDOR** (Insecure Direct Object Reference) is the flaw where you can access *someone else's* object by changing an id in the URL. `authenticate` proves *who you are*; it does **not** prove an object is *yours*. Ownership must be checked in the query itself.

Your codebase does this consistently by scoping every query with `user: userId`. From `backend/src/services/tasks.service.js`:

```js
export async function setTaskDone(userId, taskId, done) {
  ... { _id: taskId, user: userId } ...
}
export async function deleteTask(userId, taskId) {
  const res = await StudyTask.deleteOne({ _id: taskId, user: userId });
  ...
}
export async function listTasks(userId, date) {
  const tasks = await StudyTask.find({ user: userId, date: day })...;
}
```

The critical detail: **`userId` comes from `req.user.id` (the verified token), never from the request body.** The spec states it outright — *"the frontend never sends its own id; «current user» is resolved from the token."* So even though `taskId` is attacker-controllable in the URL, `deleteOne({ _id: taskId, user: userId })` matches **zero documents** when the task belongs to someone else — the delete silently no-ops instead of nuking a stranger's data. Compare the naive `deleteOne({ _id: taskId })`, which would be a textbook IDOR.

Role-based authorization (`authorize(...roles)` from Module 4.2) is the coarse layer on top; per-row `user: userId` scoping is the fine layer. Both are needed.

### 7. Secrets management — `backend/src/config/env.js`

Secrets never belong in source. This app centralizes them in one validated loader:

- **`.env` via dotenv**, never committed; injected by the runtime in Docker/prod.
- **Fail-fast on missing requireds** — no `MONGODB_URI` → `process.exit(1)` at boot, not a confusing runtime crash later.
- **Production secret guards** (the block you should reread):

  ```js
  if (NODE_ENV === "production") {
    // JWT_ACCESS_SECRET / JWT_REFRESH_SECRET must be present...
    // ...and must NOT match /change-me|dev-/  → refuse to boot
    // COOKIE_SAME_SITE=none requires COOKIE_SECURE=true → refuse to boot
  }
  ```

  This is *failing safe*: a deploy with weak or default secrets never starts, instead of starting and silently accepting forged tokens.

- **One frozen `env` object** (`Object.freeze`) so config can't be mutated at runtime, and every module reads typed values instead of poking `process.env` directly.

**Honest gaps:** dev defaults for the JWT secrets exist in code (fine — they can't be used in prod thanks to the guard), and as noted there's **no** guard forcing a non-wildcard `CORS_ORIGIN`. Also, `.env` file hygiene (permissions, secret rotation, a real secrets manager like Vault/SSM) is out of scope for this foundation.

---

## OWASP Top 10 (2021) — mapped to this codebase

| # | Risk | Where this app defends (or doesn't) |
|---|---|---|
| A01 | **Broken Access Control** | ✅ `authenticate` + `authorize(role)` + per-row `user: userId` scoping (IDOR defense). Token-derived identity, never body-supplied. Watch: role staleness within an access-token lifetime (Module 4.2). |
| A02 | **Cryptographic Failures** | ✅ bcrypt (cost 12) for passwords; SHA-256 hash-at-rest for refresh/reset/OTP tokens; httpOnly+secure cookies; HS256 JWTs with enforced strong prod secrets. ⚠️ SMS/email delivery stubbed (secrets in transit not exercised). |
| A03 | **Injection** | ✅ `sanitize` (NoSQL operators, dotted paths, prototype-pollution keys) + zod type/shape validation + Mongoose parameterized queries. ⚠️ XSS output-encoding is explicitly delegated to the frontend. |
| A04 | **Insecure Design** | ✅ access+refresh with rotation & reuse-detection; enumeration-safe reset; attempt-limited OTPs; two-tier rate limiting; fail-fast config. ⚠️ Per-IP-only limits, no account lockout/CAPTCHA. |
| A05 | **Security Misconfiguration** | ✅ Helmet, `x-powered-by` off, prod secret & SameSite guards, masked 500s (`errorHandler`). 🚨 Default `CORS_ORIGIN: "*"` with `credentials: true` and **no startup guard** — the sharpest edge. |
| A06 | **Vulnerable/Outdated Components** | ⚠️ Not addressed in code — needs `npm audit`/Dependabot in CI. Out of scope for the app source. |
| A07 | **Identification & Auth Failures** | ✅ bcrypt, uniform login errors (no enumeration), attempt-limited OTPs, strict auth rate limiter, session rotation + revoke-all-on-reset, TTL-expired sessions. ⚠️ No breached-password check; login doesn't require `isMobileVerified`. |
| A08 | **Software & Data Integrity Failures** | ✅ JWT signature + `type` claim + `iss`/`aud` (tamper-evidence, token-confusion defense); refresh reuse detection. |
| A09 | **Security Logging & Monitoring** | ◐ Winston + morgan + `requestId` correlation; theft/reuse is `logger.warn`-ed. ⚠️ No alerting/SIEM; ensure bodies (passwords/OTPs) are never logged — dev-only OTP/reset log lines are a `NODE_ENV` slip away from prod exposure. |
| A10 | **SSRF** | ➖ Low surface — the app doesn't fetch attacker-supplied URLs server-side in the auth path. Revisit if OCR/AI/image features fetch remote URLs. |

**Reading the table honestly:** the *authentication core* is genuinely well-built — the crypto, session design, injection defenses, and access control are solid and layered. The real exposure is at the **edges**: the wide-open CORS default (A05), the stubbed delivery/OAuth paths (which are demo-grade and would be dangerous if shipped as-is — recall the OAuth query-string trust hole from Module 4.3), and operational concerns (dependency scanning, monitoring) that live outside the app source.

---

## Pitfalls & gotchas

1. **CORS is not authorization.** It only constrains *browsers*. Your API is still wide open to `curl`; every real access decision must be enforced server-side by `authenticate`/`authorize`/ownership scoping.
2. **Rate limits are per-IP.** They stop single-source brute force, not distributed. That's *why* the OTP attempt-cap and high-entropy tokens exist independently — never let one layer's weakness become the whole system's.
3. **Sanitize guards queries, not HTML.** It intentionally leaves string values alone. If anyone ever renders user content as raw HTML on the server, that's a *new* XSS surface this middleware won't cover.
4. **The `$`/`.` key rules can bite legitimate data.** A user who genuinely needs a key like `price.usd` in a JSON blob would have it silently stripped. For auth payloads this never happens; know the tradeoff before storing free-form documents.
5. **`errorHandler` masks 500s — keep it that way.** Unexpected errors become a generic 500 (see `normalizeError`), so stack traces and internal messages never reach attackers. Don't "helpfully" echo `err.message` to clients on unknown errors.
6. **Config guards are the cheapest security you'll ever write.** The prod JWT-secret and SameSite checks in `env.js` prevent whole classes of catastrophic misconfig at boot. The missing CORS guard is a reminder that the pattern is only as good as its coverage.

---

## Exercises

Answers in [SOLUTIONS.md](SOLUTIONS.md#module-44--security-mastery).

1. **Injection walkthrough.** POST `{ "identifier": { "$gt": "" }, "password": { "$gt": "" } }` to `/api/auth/login`. Name *every* layer that independently stops it (there are at least two) and, for each, describe what the request looks like the instant after that layer runs.

2. **Prototype pollution.** Explain, with the shared-prototype mechanism, why `{ "__proto__": { "isAdmin": true } }` is dangerous, what `sanitize` does to it, and one concrete app-wide symptom you'd see if the middleware were removed and a deep-merge existed downstream.

3. **Threat reasoning — rate limits.** You have 10,000 IPs and want to brute-force one user's 6-digit signup OTP. Combine the auth limiter (30/15 min/IP) and the OTP attempt-cap (5/code, 5-min TTL). Roughly how many valid guesses can you actually make against one issued code, and which control is the true bottleneck?

4. **Fix the CORS footgun.** Write the exact `.env` values for `CORS_ORIGIN` and `CORS_CREDENTIALS` for a production frontend at `https://app.rankos.example`. Then sketch the startup guard you'd add to `env.js` (mirroring the existing SameSite guard) that refuses to boot on `origin: "*" && credentials: true` in production.

5. **IDOR hunt.** Pick any per-user resource service (tasks, mistakes, notes...). Show the ownership-scoped query, then write the *vulnerable* version and the exact request that would exploit it. Explain why pulling `userId` from `req.body` instead of `req.user.id` reintroduces the flaw even with correct-looking query shape.

6. **Header audit.** For three Helmet headers of your choice, name the specific attack each blunts and argue whether it matters for this JSON API or mostly for the frontend's HTML. Which one would you *tune* rather than accept the default?

7. **OWASP self-assessment.** Pick the three rows from the table you consider this app's weakest. For each, write the one concrete change (a guard, a check, a config) that would move it from ⚠️/🚨 to ✅, and estimate the effort.

8. **Design a missing layer.** The app has no account-level lockout (only per-IP limits). Design one using only existing infrastructure (the User model, Redis if present): what do you count, where do you store it, when do you lock, how does a legitimate locked-out user recover, and what new abuse does your lockout *itself* enable (hint: targeted denial of service)?

---

You've reached the end of Module 4. Back to [Module 4.1](01-password-and-hashing.md) · Worked solutions in [SOLUTIONS.md](SOLUTIONS.md).
