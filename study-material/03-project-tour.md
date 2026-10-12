# Lesson 3 — Tour of Your Project

> **Goal:** know what every folder in `myapp` is for, so no file ever feels like
> a mystery box again.

## The top level

```
myapp/
├── backend/            ← the server (Node.js + Express + MongoDB)
├── rankos-ai-mentor/   ← the frontend (React + TypeScript)
├── render.yaml         ← deployment config for Render.com (Lesson 9)
└── DEPLOYMENT.md       ← notes on deploying
```

Two separate apps living in one folder. They don't share code — they talk over
HTTP (Lesson 1).

## The backend: `backend/src/`

Your backend follows a **layered architecture** — each folder is one layer with
one job. A request passes through the layers top-to-bottom:

```
backend/src/
├── index.js        ← entry point: starts everything (you read this in Lesson 1!)
├── app.js          ← builds the Express app: security, parsing, logging, routes
│
├── routes/         ← 🚪 THE MENU: which URLs exist, and who handles each
├── middlewares/    ← 🛂 CHECKPOINTS: code that runs before handlers
│                       (is the user logged in? too many requests? clean the input)
├── controllers/    ← 🎯 TRAFFIC COPS: read the request, call a service, send the response
├── services/       ← 🧠 THE BRAINS: actual business logic ("create a task means...")
├── repositories/   ← 📦 DB ACCESS HELPERS: wrap common database queries
├── models/         ← 📋 DATA SHAPES: what a User, Task, Test looks like in MongoDB
├── validators/     ← ✅ RULES: "title is required, duration must be a number" (zod)
├── presenters/     ← 🎁 FORMATTERS: shape DB data into clean JSON for the frontend
│
├── config/         ← settings: env vars, database, redis, logger, swagger
├── constants/      ← fixed values used everywhere (roles, limits)
├── utils/          ← small general-purpose helpers
├── jobs/           ← background work queues (BullMQ) — email sending etc.
├── sockets/        ← realtime connections (Socket.IO) — live updates without refresh
├── seeds/          ← scripts that fill the DB with starter/demo data
├── docs/           ← API documentation bits (Swagger)
└── tests/          ← automated tests that verify the code works
```

**Why so many layers?** So each file stays small and each change stays local.
Want to change *what URL* something lives at? Touch `routes/`. Change *the rules*
of the feature? Touch `services/`. Change *how data is stored*? Touch `models/`.
Lesson 4 traces one request through all of these.

### What the app actually does (its features)

Skim the filenames in `backend/src/routes/` — they're a feature list in disguise:
auth (login), tasks (study planner), tests & attempts (mock tests), mistakes
(mistake notebook), leaderboard, analytics, mentor & ai (AI chat), pomodoro
(focus timer), parent & teacher (other roles), notifications, uploads, settings.

### Notable backend files

- `package.json` — the backend's ID card: its name, its **dependencies** (packages
  it uses, like `express`, `mongoose`, `jsonwebtoken`), and its **scripts**
  (`npm run dev` starts it in development).
- `.env` (not committed to git) — secret settings: database password, token keys.
  Read by `src/config/env.js`. Secrets never go in code!

## The frontend: `rankos-ai-mentor/`

```
rankos-ai-mentor/
├── src/
│   ├── routes/        ← the PAGES (screens) of the app — file = page
│   ├── components/    ← reusable UI pieces (buttons, cards, dialogs)
│   ├── layouts/       ← page frames (sidebar + header wrappers)
│   ├── hooks/         ← reusable bits of page logic
│   ├── services/      ← the code that CALLS YOUR BACKEND API
│   ├── lib/           ← helpers
│   ├── types/         ← TypeScript shapes for the data
│   ├── router.tsx     ← wires all pages together
│   └── styles.css     ← global styling (Tailwind CSS)
├── API_SPEC.md        ← 📜 the CONTRACT: exactly what API the frontend expects
├── PROJECT_ARCHITECTURE.md ← the frontend team's own architecture notes
├── package.json       ← dependencies: react, @tanstack/react-router, radix-ui...
└── vite.config.ts     ← config for Vite, the tool that builds/serves the frontend
```

Key idea: the frontend's `src/services/` folder and the backend's `src/routes/`
folder are **two ends of the same phone call**.

## One important thing to know about YOUR app ⚠️

The frontend was built against `API_SPEC.md`, which describes login by **mobile
number + OTP** (one-time password by SMS). The backend was later rebuilt to
match that contract, so signup→OTP→login→logout are wired end-to-end — but some
pieces are **dev stubs**: SMS isn't really sent (OTP codes appear in the server
logs instead), and OAuth (Google/Apple) is a placeholder. You'll see both auth
worlds in the models (e.g. `otp.model.js` *and* `passwordResetToken.model.js`).
This kind of spec-vs-implementation drift is completely normal in real
projects — Module m4 chapter 3 maps the exact state, endpoint by endpoint.

---

## ✏️ Exercises

1. Without looking back: which backend folder would you open to change…
   a) the URL of an endpoint? b) what fields a Test has? c) whether a request
   requires login?
2. Open `backend/src/routes/index.js` and `rankos-ai-mentor/src/services/`.
   Find one feature that appears on **both** sides (e.g. tasks). Two ends of the
   phone call!
3. Open `rankos-ai-mentor/API_SPEC.md` and read just its auth section. Then look
   at `backend/src/routes/auth.routes.js`. Can you spot the mobile-vs-email
   mismatch yourself?

**Next:** [Lesson 4 — Life of a Request](04-backend-request-lifecycle.md)
