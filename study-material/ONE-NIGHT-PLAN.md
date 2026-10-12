# 🌙 One-Night Interview Plan — everything, in order

> You have one evening. This file is the **schedule** plus the **fundamentals**
> an interviewer asks a fresher full-stack candidate *besides* the project.
> The project itself is covered in [INTERVIEW-PREP.md](INTERVIEW-PREP.md) — this
> plan tells you when to read which part.
>
> Rule for tonight: **speak answers out loud**. Reading feels like knowing; it isn't.

---

## The schedule (6 hours, with breaks)

| Time | Block | What to do |
|---|---|---|
| 0:00–0:20 | Pitch | Read INTERVIEW-PREP **Part 1** and **Part 2**. Say the pitch out loud 5 times. |
| 0:20–0:50 | Architecture | INTERVIEW-PREP **Part 3**. Draw the request diagram on paper from memory once. |
| 0:50–1:50 | Deep flows | INTERVIEW-PREP **Part 4**, flows 1 and 2 only, with the files open: `backend/src/middlewares/authenticate.js`, `backend/src/services/session.service.js`, `backend/src/services/attempts.service.js`. |
| 1:50–2:05 | **Break** | Walk. Water. No phone. |
| 2:05–2:50 | Fundamentals A | This file, **Sections 1–3** (JavaScript, Node, HTTP). |
| 2:50–3:30 | Fundamentals B | This file, **Sections 4–6** (Database, React, Git/Security). |
| 3:30–3:45 | **Break** | |
| 3:45–4:15 | Run the demo | Start the app, click through INTERVIEW-PREP **Part 6** once. Run `npm test` in `backend/`. |
| 4:15–4:45 | Q&A drill | INTERVIEW-PREP **Part 5**: cover the answers, answer each question aloud, uncover, compare. |
| 4:45–5:10 | Weak spots + bugs | Flows 3–5 skim, then **Part 7**: pick your three improvements and rehearse them. |
| 5:10–5:30 | Coding warm-up | This file, **Section 7**: write the 6 small programs yourself before looking. |
| 5:30–5:50 | Behavioural | This file, **Section 8**: write your three stories in 3 lines each. |
| 5:50–6:00 | Flash cards | INTERVIEW-PREP **Part 8** + this file's **Section 9**. Then stop. Sleep is part of the plan. |

**Morning (30 min):** flash cards again, say the pitch twice, re-read your three bugs and three stories. Done.

---

## Section 1 — JavaScript (the language of your whole app)

Answer each in one or two sentences. Example from your code where possible.

**`var` vs `let` vs `const`?**
`var` is function-scoped and hoisted (usable before its line, as `undefined`). `let` and `const` are block-scoped. `const` can't be reassigned. Modern code uses `const` by default, `let` when reassigning, `var` never. Your backend uses only `const`/`let`.

**`==` vs `===`?**
`==` converts types before comparing (`"1" == 1` is true). `===` compares type and value. Always use `===`.

**What is a closure?**
A function that remembers variables from where it was created, even after that scope ended. In `authenticate.js`, `authorize(...roles)` returns a middleware function that still "remembers" `roles` every time a request comes in. That is a closure.

**What is hoisting?**
Declarations are moved to the top of their scope before the code runs. Function declarations are fully hoisted; `let`/`const` are hoisted but unusable until their line (the "temporal dead zone").

**Arrow functions vs normal functions?**
Arrow functions are shorter and do not have their own `this`; they take `this` from the surrounding code. Normal functions get `this` from how they're called. Use arrows for callbacks, normal functions for methods needing `this`.

**What is `this`?**
The object a function is called on. `obj.method()` → `this` is `obj`. A plain call → `undefined` in strict mode. Arrow functions ignore this rule.

**Synchronous vs asynchronous?**
Sync code runs line by line and waits. Async code starts a slow job (DB query, network) and continues; the result comes back later through a callback, a promise, or `await`.

**What is a Promise?**
An object representing a value that will arrive later. It is pending, then fulfilled or rejected. `.then()` handles success, `.catch()` failure.

**What does `async/await` do?**
Syntax sugar over promises. `await` pauses *that function* until the promise settles, without blocking the rest of the program. Every service in your backend is `async` and `await`s Mongoose queries.

**What is the event loop?**
Node runs JavaScript on one thread. Slow work (I/O, timers) is handed to the system; when it finishes, its callback waits in a queue. The event loop takes callbacks from the queue and runs them when the main thread is free. That is why one Node process serves many users: it never sits idle waiting.

**Microtasks vs macrotasks?**
Promise callbacks (`.then`, `await`) are microtasks and run before timers/I/O callbacks (macrotasks). So `Promise.resolve().then(log)` prints before `setTimeout(log, 0)`.

**`map` / `filter` / `reduce`?**
`map` transforms each item into a new array. `filter` keeps items that pass a test. `reduce` folds an array into one value. In `leaderboard.service.js`, `entries.map(...)` builds ranked rows, and `submitAttempt` uses `filter` to find weak topics.

**Spread and destructuring?**
`{ ...a, b: 1 }` copies an object and adds a field. `const { name, mobile } = body` pulls fields out. Both are everywhere in your controllers.

**`null` vs `undefined`?**
`undefined` = never given a value. `null` = deliberately empty. Your models default optional fields to `null`.

**Optional chaining and nullish coalescing?**
`a?.b` returns `undefined` instead of crashing if `a` is null. `x ?? y` uses `y` only when `x` is null/undefined (unlike `||`, which also replaces `0` and `""`). `req?.ip ?? null` in `session.service.js`.

**What is JSON?**
A text format for data: objects, arrays, strings, numbers, booleans, null. `JSON.stringify` object → text, `JSON.parse` text → object. Every API response in your app is JSON.

**ES modules vs CommonJS?**
`import/export` (ESM) vs `require/module.exports` (CJS). Your backend has `"type": "module"` so it uses `import`.

**What is the difference between a shallow copy and a deep copy?**
Shallow (`{...obj}`) copies the top level only; nested objects are still shared. Deep copy (`structuredClone(obj)`) copies everything.

**Error handling in async code?**
`try/catch` around `await`. Unhandled rejections crash or get logged; your `index.js` registers `process.on("unhandledRejection")` as a safety net, and `asyncHandler` forwards controller errors to Express.

---

## Section 2 — Node.js and Express

**What is Node.js?**
A runtime that runs JavaScript outside the browser, built on Chrome's V8 engine, with an event-driven, non-blocking I/O model.

**Why is Node good for APIs?**
Most API time is spent waiting on databases and networks. Node doesn't block during waits, so one process handles many concurrent requests cheaply.

**When is Node a bad fit?**
CPU-heavy work (video encoding, big maths) blocks the single thread. You'd use worker threads or another language for that.

**What is npm and `package.json`?**
npm installs packages. `package.json` lists dependencies, scripts (`npm start`, `npm test`), and metadata. `package-lock.json` pins exact versions so every install is identical; `npm ci` uses it in CI/Docker.

**What is middleware in Express?**
A function `(req, res, next)` that runs for every request before the handler. It can modify the request, end the response, or call `next()`. Your `app.js` chains about ten of them: request ID, helmet, CORS, body parsing, cookies, sanitize, compression, logging, rate limiting.

**Why does middleware order matter?**
Each one sees the request after the previous. `sanitize` must come after `express.json()` (needs the parsed body); the error handler must be last so it catches everything.

**How does Express handle errors?**
Call `next(err)` or throw inside a wrapped async handler. Express skips to the middleware with four arguments `(err, req, res, next)`. That is `errorHandler.js`.

**What are environment variables and why?**
Settings that change per machine (DB URL, secrets, ports) read from `process.env`. Kept in `.env` locally, never committed. `config/env.js` loads and validates them once.

**`process.env.NODE_ENV`?**
Tells code if it's `development`, `test`, or `production`. Your server refuses to boot in production with default JWT secrets.

**What is `nodemon`?**
Dev tool that restarts the server when files change. `npm run dev`.

**What is a REST API?**
An API where URLs are resources (`/tasks`, `/tasks/42`) and HTTP methods are actions: GET read, POST create, PATCH/PUT update, DELETE remove. Stateless: each request carries what it needs (your cookie).

**PUT vs PATCH?**
PUT replaces the whole resource; PATCH changes some fields. Your tasks route uses PATCH to flip `done`.

---

## Section 3 — HTTP, the browser, and security basics

**What happens when you type a URL and press Enter?**
DNS turns the name into an IP → TCP connection → TLS handshake (HTTPS) → browser sends an HTTP request → server responds with HTML → browser parses it, fetches CSS/JS, runs JS → your React app then calls the API with `fetch`.

**Common status codes?**
200 OK · 201 Created · 204 No Content · 301/302 Redirect · 400 Bad Request · 401 Unauthenticated · 403 Forbidden (logged in but not allowed) · 404 Not Found · 409 Conflict (duplicate mobile) · 422 Validation failed · 429 Too Many Requests · 500 Server error. Your `errorHandler` maps errors to exactly these.

**401 vs 403?**
401: we don't know who you are. 403: we know, and you're not allowed. Your `authenticate` throws 401; `authorize` throws 403.

**What are headers?**
Key-value metadata on requests/responses: `Content-Type`, `Authorization`, `Cookie`, `Set-Cookie`, `Cache-Control`.

**Cookies vs localStorage for tokens?**
localStorage is readable by any JavaScript on the page, so an XSS bug can steal the token. httpOnly cookies are invisible to JavaScript. Cookies need CSRF care (`SameSite`). Your app chose httpOnly cookies.

**What is CORS?**
Browsers block a page on one origin from reading responses from another origin unless the server allows it with `Access-Control-Allow-Origin`. Origin = scheme + host + port. In dev your Vite proxy makes API calls same-origin, so CORS doesn't apply.

**What is HTTPS / TLS?**
Encrypts traffic so nobody between browser and server can read or alter it. Required for `Secure` cookies.

**What is a JWT?**
A signed token: `header.payload.signature`, base64. The server verifies the signature with its secret; it does not need to store sessions. Anyone can *read* the payload, so never put secrets in it. Yours carries `sub` (user id) and `role`.

**Hashing vs encryption?**
Hashing is one-way (bcrypt for passwords, SHA-256 for your OTP codes and refresh tokens). Encryption is two-way with a key. Passwords are hashed, never encrypted.

**Why bcrypt and not SHA-256 for passwords?**
bcrypt is deliberately slow and salted, making brute force expensive. SHA-256 is fast, which helps attackers.

**XSS, CSRF, SQL/NoSQL injection — one line each?**
XSS: attacker's script runs in a victim's page → escape output, httpOnly cookies. CSRF: a victim's browser is tricked into sending a request with their cookies → `SameSite` cookies, tokens. Injection: user input becomes part of a query → validate and parameterise; your `sanitize` strips `$` keys.

**What is rate limiting?**
Capping requests per client per time window to stop brute force and abuse. Yours: 300 per 15 minutes per IP, with Redis for multi-instance.

---

## Section 4 — Databases and MongoDB

**SQL vs NoSQL?**
SQL (Postgres, MySQL): tables, rows, fixed schema, joins, strong transactions. NoSQL document DBs (MongoDB): JSON-like documents, flexible schema, nested data, scale out easily. Pick by data shape and query needs.

**Why MongoDB here?**
A test attempt naturally holds its responses; a profile holds nested stats. Fewer joins, faster iteration. Mongoose adds schemas and validation on top.

**Collection, document, field?**
Collection = table. Document = row (a JSON object). Field = column.

**What is Mongoose?**
An ODM (object document mapper): defines schemas with types, defaults, enums, indexes, and gives models with methods like `find`, `create`, `findOneAndUpdate`.

**What is an index and why?**
A sorted lookup structure so queries don't scan every document. Index fields you filter or sort by often. Trade-off: slower writes, more disk. Your User model has unique partial indexes on email/mobile.

**What is a unique partial index?**
Uniqueness enforced only on documents matching a filter. Lets many users have "no mobile" without colliding.

**`findOne` vs `find`?**
One document or null, vs an array.

**What is `populate`?**
Mongoose's join: replaces an ObjectId reference with the actual document. `Test.findById(id).populate("questions")` in `submitAttempt`.

**ACID / transactions?**
Atomic, Consistent, Isolated, Durable. A transaction makes several writes all-or-nothing. MongoDB supports multi-document transactions on replica sets; your `withTransaction` falls back on standalone dev Mongo.

**Embedding vs referencing?**
Embed when data is always read together and bounded (responses inside an attempt). Reference when shared or unbounded (user ↔ tasks).

**What is an ObjectId?**
MongoDB's 12-byte unique id, includes a timestamp. Mongoose throws a CastError for an invalid one, which your error handler turns into a 400.

**N+1 problem?**
Fetching a list, then one query per item. Fix with `populate`, `$in`, or aggregation. Your `getLeaderboard` avoids it by loading entries in one query.

**Aggregation pipeline?**
A sequence of stages (`$match`, `$group`, `$sort`, `$project`) for analytics-style queries, like computing a score trend.

---

## Section 5 — React, TypeScript, and the frontend

**What is React?**
A library for building UIs from components. You describe what the UI should look like for a given state; React updates the DOM efficiently when state changes.

**Component, props, state?**
Component = a function returning JSX. Props = inputs from the parent (read-only). State = data the component owns and can change, causing a re-render.

**What is JSX?**
HTML-like syntax inside JavaScript, compiled to function calls. `<StatCard value={xp} />`.

**Virtual DOM?**
React keeps a lightweight tree in memory, diffs it against the previous one, and applies only the changes to the real DOM.

**`useState`?**
Hook that gives a value and a setter; calling the setter re-renders. `const [open, setOpen] = useState(false)`.

**`useEffect`?**
Run side effects after render (subscriptions, manual fetches). Dependency array controls when. Your app rarely needs it because React Query handles fetching.

**Why keys in lists?**
So React can match items between renders. Use a stable id, not the array index.

**Controlled vs uncontrolled inputs?**
Controlled: value lives in React state. Uncontrolled: DOM holds it, read with a ref. react-hook-form uses refs for performance, then validates with Zod.

**Lifting state up?**
Moving shared state to the nearest common parent and passing it down as props.

**What does React Query give you?**
Server state management: caching by key, de-duplication, background refetch, loading/error flags, mutations with invalidation. `useQuery(tasksQueryOptions(date))`.

**What is SSR and why?**
Server-side rendering: the server sends real HTML, so first paint is fast and crawlable; React then "hydrates" it. TanStack Start / Nitro does this for you.

**Client-side routing?**
Changing the page without a full reload. TanStack Router maps files in `src/routes/` to URLs; `beforeLoad` guards redirect unauthenticated users.

**What is TypeScript and why?**
JavaScript with types. Catches mistakes at build time, documents data shapes, enables autocomplete. `src/types/index.ts` mirrors the API contract; `tsc --noEmit` runs in CI.

**`interface` vs `type`?**
Both describe shapes. `interface` can be extended/merged; `type` can do unions. Mostly interchangeable.

**Tailwind CSS?**
Utility classes (`flex`, `p-4`, `text-sm`) instead of writing CSS files. Fast to build, consistent spacing/colours.

**What is Vite?**
Dev server + bundler. Instant startup, hot module reload, builds optimised output for production.

**Accessibility (a11y)?**
Radix UI primitives give keyboard navigation and ARIA attributes for dialogs, menus, tabs out of the box.

---

## Section 6 — Git, tooling, and deployment

**What is Git vs GitHub?**
Git: version control on your machine. GitHub: a hosting service for Git repos plus PRs, issues, CI.

**Basic commands?**
`git status`, `git add .`, `git commit -m "msg"`, `git push`, `git pull`, `git branch`, `git checkout -b feature`, `git merge`, `git log`.

**What is a branch and a pull request?**
A branch is an independent line of work. A PR asks to merge it, with review and CI checks.

**Merge vs rebase?**
Merge keeps both histories with a merge commit. Rebase replays your commits on top of the other branch for a straight line. Never rebase shared branches.

**`.gitignore`?**
Files Git should not track: `node_modules`, `.env`, logs, build output. Yours ignores `.env` but keeps `.env.example`.

**What is CI/CD?**
Continuous Integration: every push runs tests/build automatically. Continuous Deployment: passing builds deploy automatically. `.github/workflows/ci.yml`.

**What is Docker?**
Packages the app with its runtime into an image that runs the same anywhere. Dockerfile = recipe; container = running instance. Yours is multi-stage and non-root.

**What is a health check?**
An endpoint the platform polls to know if the app is alive. `/api/health/live`.

**Horizontal vs vertical scaling?**
More machines vs a bigger machine. Your rate limiter uses Redis so limits stay correct across many instances; JWTs are stateless so any instance can verify them.

**What is a reverse proxy / load balancer?**
Sits in front of servers, terminates HTTPS, routes `/api` to the backend, spreads load. Why you set `trust proxy`.

**What is caching?**
Storing a computed result to serve again fast. Browser cache, React Query cache, Redis cache. Trade-off: staleness.

---

## Section 7 — Coding warm-up (write these yourself first)

Freshers often get a 10-minute live coding question. Write each in a scratch file, then compare.

**1. Reverse a string**
```js
const reverse = (s) => s.split("").reverse().join("");
// or a loop:
function reverse2(s) { let out = ""; for (let i = s.length - 1; i >= 0; i--) out += s[i]; return out; }
```

**2. FizzBuzz**
```js
for (let i = 1; i <= 100; i++) {
  console.log(i % 15 === 0 ? "FizzBuzz" : i % 3 === 0 ? "Fizz" : i % 5 === 0 ? "Buzz" : i);
}
```

**3. Count word frequency**
```js
function wordCount(text) {
  return text.toLowerCase().split(/\W+/).filter(Boolean)
    .reduce((acc, w) => { acc[w] = (acc[w] ?? 0) + 1; return acc; }, {});
}
```

**4. Remove duplicates from an array**
```js
const unique = (arr) => [...new Set(arr)];
```

**5. Check palindrome (ignore case and spaces)**
```js
function isPalindrome(s) {
  const clean = s.toLowerCase().replace(/[^a-z0-9]/g, "");
  return clean === [...clean].reverse().join("");
}
```

**6. Debounce (common frontend question)**
```js
function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}
```

**7. Group tasks by subject (your own domain)**
```js
function groupBySubject(tasks) {
  const groups = {};
  for (const t of tasks) (groups[t.subject] ??= []).push(t);
  return groups;
}
```

**8. Write an Express route that returns today's tasks for the logged-in user** (say it, don't just write it)
```js
router.get("/tasks", authenticate, asyncHandler(async (req, res) => {
  const date = req.query.date ?? new Date().toISOString().slice(0, 10);
  const tasks = await StudyTask.find({ user: req.user.id, date }).sort({ time: 1 });
  res.json({ success: true, data: tasks });
}));
```

**Big-O in one breath:** O(1) constant, O(log n) binary search, O(n) one loop, O(n log n) good sorting, O(n²) nested loops. `Set` lookup is O(1); `Array.includes` is O(n).

---

## Section 8 — Behavioural questions (prepare three stories)

Use the shape **Situation → what I did → result → what I learned**. Three lines each. Write yours tonight.

**"Tell me about yourself."** (60 seconds)
Who you are → how you got into development → RankOS in one sentence → what you want next. End on the role.

**"Walk me through your project."** → INTERVIEW-PREP Part 1, then offer: "I can go deeper on auth, test scoring, or the AI layer, whichever you prefer."

**"What was the hardest bug / challenge?"**
Story: the auth contract mismatch (frontend spec said mobile + OTP, backend did email + password). What you did: rebuilt the backend auth to the spec, kept password login. Learned: the API spec is the real contract between teams; read it first.

**"Tell me about a mistake you made."**
Story: Redis URL set in `.env` while Redis wasn't running, and the server hung on startup forever with no error. Learned: optional dependencies must time out, and silent hangs are worse than crashes. Fix: a connect timeout.

**"How do you learn new things?"**
Honest: build with AI pair-programming, then read the generated code file by file, write notes (your `study-material/` folder is proof), and verify by running tests and breaking things on purpose.

**"How do you use AI tools?"**
As a pair programmer, not an oracle. You ask for a design, review the code, run it, and ask "why" until you can explain it yourself. Mention you found real bugs in AI-written code (Part 7 list).

**"Why should we hire you?"**
Fast learner with proof (a full-stack app with auth, tests, Docker), honest about gaps, comfortable reading unfamiliar code, communicates clearly.

**"Where do you see yourself?"**
Strong full-stack engineer who owns features end to end; interested in backend reliability and security.

**"Any questions for us?"** Ask two:
- "What does the first month look like for someone in this role?"
- "How does the team review code and ship — PRs, CI, release cadence?"

---

## Section 9 — Extra flash cards (fundamentals)

| Prompt | Answer |
|---|---|
| Event loop in one line | Single thread; slow work offloaded; callbacks queued; loop runs them when free |
| Promise states | pending → fulfilled / rejected |
| `==` vs `===` | coerces / strict |
| Closure | function + the variables it was created with |
| Middleware signature | `(req, res, next)`; error version has 4 args |
| 401 vs 403 | who are you? / you can't |
| 422 | validation failed |
| CORS | server tells browser which origins may read responses |
| JWT parts | header.payload.signature |
| bcrypt vs SHA-256 | slow+salted for passwords / fast hash for tokens |
| httpOnly | JS can't read the cookie |
| SameSite=lax | cookie not sent on cross-site POSTs → CSRF defence |
| Index | sorted structure to avoid full scans |
| populate | Mongoose join by reference |
| useState / useEffect | local state / side effects after render |
| React Query key | identifies cached data, e.g. `["auth","session"]` |
| SSR | server sends HTML, client hydrates |
| `npm ci` | exact install from lock file |
| Multi-stage Docker | build deps in one stage, copy only what's needed |
| CI | tests run on every push |
| Big-O of nested loop | O(n²) |

---

## Day-of rules

1. Answer the question asked, then stop. Offer to go deeper.
2. If you don't know: "I haven't worked with that yet; here's how I'd reason about it."
3. When explaining code, name the file. It proves you've been inside it.
4. Have the app running and the repo open before the call starts.
5. Breathe. You know this project better than most candidates know theirs.
