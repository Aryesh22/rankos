# 📚 Learn Development with Your Own App (RankOS)

A complete course that teaches software development **using the real code in this
project**. No abstract examples — every lesson dissects actual files in
`backend/` and `rankos-ai-mentor/`.

The course has two tracks:

- **Foundation Track** (lessons 1–9): short lessons that give you the map.
  Read these first — one a day is a great pace.
- **Mastery Track** (modules m1–m7): deep, detailed modules with line-by-line
  code walkthroughs, pitfalls, and exercises **with full solutions**. This is
  where mastery happens.

## 🥾 Foundation Track — the map (start here)

| # | Lesson | What you'll learn |
|---|--------|-------------------|
| 1 | [How the Web Works](01-how-the-web-works.md) | Clients, servers, HTTP, APIs, JSON |
| 2 | [JavaScript Basics](02-javascript-basics.md) | The language of your whole app |
| 3 | [Tour of Your Project](03-project-tour.md) | What every folder is for |
| 4 | [Life of a Request](04-backend-request-lifecycle.md) | routes → controllers → services → models |
| 5 | [Databases & MongoDB](05-database-mongodb.md) | Where data lives |
| 6 | [Authentication](06-authentication.md) | How login works |
| 7 | [The Frontend (React)](07-frontend-react.md) | How screens are built |
| 8 | [Tools of the Trade](08-tools-of-the-trade.md) | Terminal, npm, git, .env |
| 9 | [Running & Deploying](09-running-and-deploying.md) | Laptop → internet |

Plus [GLOSSARY.md](GLOSSARY.md) — every jargon term in one table. Keep it open.

🎤 **Interview tomorrow?** Start with [ONE-NIGHT-PLAN.md](ONE-NIGHT-PLAN.md) (hour-by-hour schedule + JS/Node/HTTP/DB/React fundamentals, coding warm-ups, behavioural answers), then [INTERVIEW-PREP.md](INTERVIEW-PREP.md) — pitch,
architecture story, likely questions with answers, demo script, known bugs to cite, and a night-before checklist.

## 🎓 Mastery Track — the depth

Do a module after its matching foundation lesson(s), or binge the foundation
first and then work through modules in order. Every module ends with a
`SOLUTIONS.md` containing fully worked answers to all its exercises.

### m1 — JavaScript Mastery *(after lesson 2)*
[Values & types](m1-javascript/01-values-variables-types.md) ·
[Functions, scope & closures](m1-javascript/02-functions-scope-closures.md) ·
[Objects & arrays](m1-javascript/03-objects-arrays-methods.md) ·
[Async mastery](m1-javascript/04-async-mastery.md) ·
[Modules, classes & modern JS](m1-javascript/05-modules-classes-modern-js.md) ·
[Solutions](m1-javascript/SOLUTIONS.md)

### m2 — Node & Express Mastery *(after lesson 4)*
[The Node runtime](m2-node-express/01-node-runtime.md) ·
[Express fundamentals](m2-node-express/02-express-fundamentals.md) ·
[Middleware deep-dive](m2-node-express/03-middleware-deep-dive.md) (line-by-line `app.js`) ·
[Config, logging & errors](m2-node-express/04-config-logging-errors.md) ·
[Server lifecycle](m2-node-express/05-server-lifecycle.md) (line-by-line `index.js`) ·
[API design](m2-node-express/06-api-design.md) ·
[Solutions](m2-node-express/SOLUTIONS.md)

### m3 — MongoDB Mastery *(after lesson 5)*
[Database fundamentals](m3-mongodb/01-database-fundamentals.md) ·
[Schemas & models](m3-mongodb/02-mongoose-schemas-models.md) ·
[Queries mastery](m3-mongodb/03-queries-mastery.md) ·
[Modeling & performance](m3-mongodb/04-modeling-and-performance.md) (relationship map of all 25 models) ·
[Solutions](m3-mongodb/SOLUTIONS.md)

### m4 — Auth & Security Mastery *(after lesson 6)*
[Passwords & hashing](m4-auth-security/01-password-and-hashing.md) ·
[JWT & sessions](m4-auth-security/02-jwt-and-sessions.md) ·
[OTP, verification & reset](m4-auth-security/03-otp-verification-reset.md) (incl. the frontend↔backend contract table) ·
[Security mastery](m4-auth-security/04-security-mastery.md) (attacker's-eye tour + OWASP map) ·
[Solutions](m4-auth-security/SOLUTIONS.md)

### m5 — Frontend Mastery *(after lesson 7)*
[HTML, CSS & Tailwind](m5-frontend/01-html-css-tailwind.md) ·
[React fundamentals](m5-frontend/02-react-fundamentals.md) ·
[TypeScript for React](m5-frontend/03-typescript-for-react.md) ·
[Routing & data](m5-frontend/04-routing-and-data.md) (TanStack Router + React Query) ·
[Components & forms](m5-frontend/05-components-and-forms.md) ·
[Solutions](m5-frontend/SOLUTIONS.md)

### m6 — Advanced Backend *(after m2 + m3)*
[Realtime sockets](m6-advanced-backend/01-realtime-sockets.md) ·
[Background jobs & Redis](m6-advanced-backend/02-background-jobs-redis.md) ·
[Email, uploads & external services](m6-advanced-backend/03-email-uploads-external-services.md) ·
[Testing mastery](m6-advanced-backend/04-testing-mastery.md) ·
[Solutions](m6-advanced-backend/SOLUTIONS.md)

### m7 — Practice Track 🔨 *(the whole point — start its ch.1 early!)*
[Setup & first run](m7-practice-track/01-setup-and-first-run.md) — get everything running on your Mac ·
[Guided changes](m7-practice-track/02-guided-changes.md) — 10 graduated real code changes (incl. fixing a real bug) ·
[Feature capstones](m7-practice-track/03-feature-capstones.md) — 4 build-it-yourself projects ·
[Mastery roadmap](m7-practice-track/04-mastery-roadmap.md) — self-assessment + 6-month plan ·
[Solutions](m7-practice-track/SOLUTIONS.md)

## 🗺️ Suggested 8-week path

| Week | Do |
|---|---|
| 1 | Foundation lessons 1–9 (they're short) + m7 ch.1: get the app **running** |
| 2 | m1 JavaScript (all chapters, do every exercise) |
| 3 | m2 Node & Express + m7 guided changes 1–3 |
| 4 | m3 MongoDB + m7 guided changes 4–5 |
| 5 | m4 Auth & Security |
| 6 | m5 Frontend + m7 guided changes 6–10 |
| 7 | m6 Advanced Backend |
| 8+ | m7 capstones, one at a time, then the mastery roadmap |

## 📌 Honest notes about YOUR codebase (worth knowing early)

The deep-dive modules verified everything against the real code and surfaced
these truths (each explained fully in the module noted):

- **Auth is largely wired end-to-end now** — signup→OTP→login→me→logout all
  exist and match `API_SPEC.md`. The real gaps: SMS is a dev stub (OTP codes
  appear in the **server logs**, not your phone), signup collects no email so
  forgot-password is unreachable, and the OAuth stub has a real security hole.
  → m4 ch.3, m7 capstone (b)
- **The frontend calls real endpoints; `mockData.ts` is dead code.** Sessions
  use httpOnly **cookies**, not a token the frontend stores. → m5 ch.4
- **Known real bugs to fix as exercises:** the planner "Today" tab is always
  empty (`date=today` handled literally) → m7 guided change 9; the Redis
  rate-limit store is unreachable due to import order → m6 ch.2; CORS defaults
  are a prod footgun → m4 ch.4.
- Sockets, queues, email templates, and OCR are **scaffolding** awaiting
  features. → m6

## 🤝 How to use Claude Code while studying

- *"Quiz me on m2 chapter 3"* — active recall beats rereading
- *"Check my answer to exercise 4 in m3 chapter 2"*
- *"Explain <file> line by line"* — any file, any time
- *"Review my capstone code but don't fix it — ask me questions instead"*
- *"Run the app"* / *"help me debug this error"*

Rule of thumb: let Claude **explain and review**, but type the code yourself.
Typing is where learning happens.
