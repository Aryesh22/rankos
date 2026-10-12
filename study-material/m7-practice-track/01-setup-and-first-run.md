# Module 7.1 — Setup and First Run

> **Goal:** Get the entire RankOS app — backend API, MongoDB database, and React frontend — running on your Mac, verify each piece is alive, and load it with demo data. By the end you'll be logged into your own app with a seeded student account.

This chapter assumes **nothing**. Every command you need to type is in a code block. Type them exactly (or copy-paste), press Enter, and compare what you see with the "expected output" notes.

**Why this chapter matters:** you cannot learn development by reading. Everything in Modules 7.2–7.4 requires a running app. This is the foundation — take your time, and if something breaks, jump to the [Troubleshooting](#troubleshooting-the-10-most-likely-failures) section at the bottom. Breaking and fixing your environment *is* part of the course.

---

## 0. Open the Terminal

Press `Cmd + Space`, type `Terminal`, press Enter. You'll see a window with a prompt ending in `%` or `$`. That's where you type commands.

First, go to your project folder:

```bash
cd ~/Desktop/myapp
```

`cd` means "change directory". Verify you're in the right place:

```bash
pwd
```

Expected output: `/Users/aryeshsingh/Desktop/myapp`

```bash
ls
```

Expected output includes: `backend`, `rankos-ai-mentor`, `study-material`. Those are the two halves of your app plus this course.

---

## 1. Install Homebrew (the Mac package manager)

Homebrew installs developer tools. Check whether you already have it:

```bash
brew --version
```

- If you see something like `Homebrew 4.x.x` — you have it, skip ahead.
- If you see `command not found: brew` — install it:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

It will ask for your Mac password (typing shows nothing — that's normal, just type it and press Enter). At the end it may print "Next steps" telling you to run one or two `echo ... >> ~/.zprofile` commands — **do run those**, then close and reopen Terminal.

---

## 2. Install Node.js 22

**Why:** the backend declares in `backend/package.json`:

```json
"engines": { "node": ">=20.0.0" }
```

…meaning it needs Node 20 *or newer*. Install the current LTS (22) — it satisfies that, and the backend's test command uses a glob pattern (`node --test "src/tests/**/*.test.js"`) that older Node versions can't expand:

```bash
brew install node@22
brew link --overwrite node@22
```

Verify:

```bash
node -v
npm -v
```

Expected: `v22.x.x` and `10.x.x` (or similar). If `node -v` prints a version below 20, see Troubleshooting #1.

`npm` (Node Package Manager) came bundled with Node — it downloads the libraries your app depends on.

---

## 3. Install MongoDB — pick ONE option

The backend stores everything in MongoDB. `backend/src/config/env.js` **requires** a `MONGODB_URI` — without it the server refuses to start (this is the *only* environment variable that's mandatory in development; everything else has a default).

You have two options. **Option A (local) is recommended for learning** — everything on your machine, works offline. Option B (Atlas) is a free cloud database — what you'd use when deploying for real.

### Option A — Local MongoDB via Homebrew

```bash
brew tap mongodb/brew
brew install mongodb-community
```

Start it as a background service (it restarts automatically after reboots):

```bash
brew services start mongodb-community
```

Verify it's running:

```bash
brew services list
```

Expected: a line like `mongodb-community started aryeshsingh ...`. Double-check by connecting with the Mongo shell:

```bash
mongosh --eval "db.runCommand({ ping: 1 })"
```

Expected output contains `{ ok: 1 }`. Your connection string (used in step 4) will be:

```
mongodb://localhost:27017/rankos
```

`localhost:27017` = "this machine, MongoDB's default port". `rankos` = the database name (MongoDB creates it automatically the first time data is written).

### Option B — Free MongoDB Atlas cluster (cloud)

1. Go to <https://www.mongodb.com/cloud/atlas/register> and create a free account.
2. Create a cluster: choose the **M0 Free** tier, any provider/region near you, and click **Create Deployment**.
3. **Create a database user:** Atlas prompts you — pick a username (e.g. `rankos`) and let it generate a password. **Copy the password somewhere safe now.**
4. **Allow your IP:** under *Network Access* → *Add IP Address* → *Add Current IP Address*. (For learning you can use "Allow access from anywhere" `0.0.0.0/0`, but that's sloppy for anything real.)
5. Click **Connect** → **Drivers** and copy the connection string. It looks like:

```
mongodb+srv://rankos:<password>@cluster0.abc12.mongodb.net/?retryWrites=true&w=majority
```

6. Replace `<password>` with your real password, and add the database name `rankos` after the host, like:

```
mongodb+srv://rankos:YOURPASSWORD@cluster0.abc12.mongodb.net/rankos?retryWrites=true&w=majority
```

That whole string is your `MONGODB_URI` for step 4.

---

## 4. Create `backend/.env`

**Why:** the backend reads its configuration from environment variables — secrets and machine-specific settings that never get written into code. In development they live in a file called `.env` which git should never track.

```bash
cd ~/Desktop/myapp/backend
ls -a
```

If `.env` already appears in the listing, you (or a previous session) already created it — open it and just check `MONGODB_URI` matches your choice from step 3. Otherwise copy the provided template:

```bash
cp .env.example .env
```

Open it in a text editor (`open -e .env` opens TextEdit) and make sure the Mongo line matches your setup:

- Local: `MONGODB_URI=mongodb://localhost:27017/rankos` (the template's default — nothing to change)
- Atlas: paste your `mongodb+srv://...` string instead

### Every variable the backend actually reads

This table is compiled directly from `backend/src/config/env.js` — the single file that reads `process.env`. **Required** means the server exits immediately without it.

| Variable | Required? | Default if unset | What it does |
|---|---|---|---|
| `MONGODB_URI` | **YES (always)** | — (server exits with `[env] Missing required environment variable(s): MONGODB_URI`) | Database connection string |
| `NODE_ENV` | no | `development` | `development` / `production` / `test` — switches log level, cookie security, error detail |
| `APP_NAME` | no | `RankOS API` | Display name in logs/docs |
| `PORT` | no | `8080` | Port the API listens on |
| `API_PREFIX` | no | `/api` | Path prefix for every route |
| `CLIENT_URL` | no | `http://localhost:5173` | Frontend URL, used for OAuth redirects and password-reset email links |
| `CORS_ORIGIN` | no | `*` (any origin) | Comma-separated list of allowed browser origins |
| `CORS_CREDENTIALS` | no | `true` | Allow cookies on cross-origin requests |
| `RATE_LIMIT_WINDOW_MS` | no | `900000` (15 min) | Rate-limit window |
| `RATE_LIMIT_MAX` | no | `300` | Max requests per IP per window |
| `LOG_LEVEL` | no | `debug` in dev, `info` in prod | Winston log verbosity |
| `LOG_DIR` | no | `logs` | Where log files are written |
| `REDIS_URL` / `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | no | not configured | Optional Redis for jobs/rate limiting. **Unset is fine** — the app logs a warning and runs without it |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | no | not configured | Optional media hosting. Unset = uploads stay local |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | no | not configured | Optional email. Unset = emails are logged instead of sent |
| `SWAGGER_ENABLED` | no | `true` | API docs page on/off |
| `BCRYPT_SALT_ROUNDS` | no | `12` | Password hashing cost |
| `JWT_ACCESS_SECRET` | **only in production** | `dev-access-secret-change-me` | Signs login tokens. In production the server *exits* if missing or still a `dev-`/`change-me` value |
| `JWT_REFRESH_SECRET` | **only in production** | `dev-refresh-secret-change-me` | Signs refresh tokens (same production rule) |
| `JWT_ACCESS_EXPIRES` / `JWT_REFRESH_EXPIRES` | no | `15m` / `7d` | Token lifetimes (accepts `30s`, `15m`, `7d` formats) |
| `JWT_ISSUER` / `JWT_AUDIENCE` | no | `rankos.api` / `rankos.client` | Token metadata |
| `EMAIL_VERIFY_EXPIRES` / `PASSWORD_RESET_EXPIRES` | no | `24h` / `30m` | Link lifetimes |
| `COOKIE_DOMAIN` | no | unset (host-only) | Cookie scope |
| `COOKIE_SECURE` | no | `false` in dev, `true` in prod | HTTPS-only cookies |
| `COOKIE_SAME_SITE` | no | `lax` | Cookie cross-site policy (`none` requires `COOKIE_SECURE=true` in production — env.js enforces this) |

A handful of *other* files read extra optional variables directly: `TWILIO_*` (real SMS in `services/sms.service.js` — without them OTP codes print to the server log), `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (real Google OAuth in `controllers/auth.controller.js` — without them a dev stub signs in a demo user), and `AI_PROVIDER`/`ANTHROPIC_API_KEY`/`OPENAI_API_KEY`/`GEMINI_API_KEY` (AI providers in `services/ai/` — without them a grounded local fallback answers). **All optional. For development, the defaults in `.env.example` are sensible — only `MONGODB_URI` must be correct.**

---

## 5. Install backend dependencies and start it

```bash
cd ~/Desktop/myapp/backend
npm install
```

This reads `package.json` and downloads every library (Express, Mongoose, etc.) into `node_modules/`. Takes a minute or two. Warnings about "deprecated" packages are normal; errors that stop the install are not (see Troubleshooting #7).

Now start the development server:

```bash
npm run dev
```

`dev` maps to `nodemon src/index.js` (see the `scripts` block in `package.json`) — nodemon watches your files and **restarts the server automatically whenever you save a change**. That loop is how you'll work in Module 7.2.

Expected log lines (order may vary slightly):

```
[db] MongoDB connected → mongodb://localhost:27017/rankos
[email] SMTP not configured — emails will be skipped
[jobs] disabled — no Redis configured
[socket] Socket.IO initialised
[swagger] docs mounted at /api/docs
[server] RankOS API listening on :8080 (development) — API at /api
[server] docs → http://localhost:8080/api/docs
```

**Those warnings are normal and expected.** Redis, SMTP, and Cloudinary are optional — the code checks `isConfigured` and degrades gracefully. If instead you see `[db] Connection attempt 1/5 failed` repeating, MongoDB isn't reachable — Troubleshooting #3.

Leave this terminal window running. Open a **new** terminal tab (`Cmd + T`) for the next steps.

---

## 6. Verify the backend is alive

The backend ships three health endpoints (`backend/src/routes/health.routes.js`). Hit the detailed one with `curl` (a command-line web browser):

```bash
curl http://localhost:8080/api/health
```

Expected: a JSON blob like

```json
{"success":true,"message":"Health OK","data":{"service":"RankOS API","status":"ok","environment":"development","uptimeSeconds":42,"dependencies":{"mongodb":"connected","redis":"not-configured"},"memory":{"rssMb":95.3,"heapUsedMb":34.1},"node":"v22.x.x"}}
```

The important part: `"mongodb":"connected"`. Also try the readiness probe, which returns HTTP 503 unless the database is truly connected:

```bash
curl -i http://localhost:8080/api/health/ready
```

Expected first line: `HTTP/1.1 200 OK`.

### Swagger — the interactive API docs

`backend/src/config/swagger.js` mounts a documentation UI at `${API_PREFIX}/docs` whenever `SWAGGER_ENABLED` isn't set to `false`. Open in your browser:

```
http://localhost:8080/api/docs
```

You'll see a page titled "RankOS API — API" listing the Health endpoints (only infrastructure routes are documented so far — you'll add your own doc block in Module 7.2, exercise 10). The raw machine-readable spec lives at `http://localhost:8080/api/docs.json`.

---

## 7. Seed the database with demo data

An empty database makes for a boring app. The seed script (`backend/src/seeds/index.js`) fills it with a realistic demo dataset that mirrors what the UI was designed around. In your second terminal tab:

```bash
cd ~/Desktop/myapp/backend
npm run seed
```

**What it creates** (read the seed file yourself — it's a great tour of every model):

- **3 users** — a student (Aarav Mehta), a teacher (Priya Sharma), a parent (Rajesh Mehta)
- The student's **profile** (XP, streak, target rank) and **Exam DNA** (the radar-chart analysis)
- **Subjects, topics, questions, tests** (3 upcoming + 4 previous), and **submitted test attempts** with scores/percentiles
- **Mistakes**, **today's study tasks**, a **week study plan**, **revisions**, **study logs** (the heatmap), **weekly goals**, an **AI chat**, **notifications**, **achievements**, and **leaderboard entries**

**Warning it's important you understand:** the script **deletes everything in those collections first**, then re-inserts (`clearAll()` at the top). That makes it safe to run repeatedly — but it also means any data you created by hand is wiped each run.

Expected final output — it prints the demo credentials:

```
[seed] done ✔
[seed] demo login → email: aarav@example.com  mobile: +919800000001  password: password123
[seed] teacher@example.com / parent@example.com share the same password
```

Write those down. `aarav@example.com` / `password123` is your login for everything.

---

## 8. Start the frontend

New terminal tab:

```bash
cd ~/Desktop/myapp/rankos-ai-mentor
npm install
npm run dev
```

`dev` maps to `vite dev` — Vite is the frontend's development server with instant hot-reload.

**About the port — read this, it will confuse you otherwise.** The frontend's build config (`@lovable.dev/vite-tanstack-config`, used in `vite.config.ts`) defaults the dev server to port **8080** — the same port the backend uses. Since your backend already holds 8080, Vite prints something like:

```
Port 8080 is in use, trying another one...
➜  Local:   http://localhost:8081/
```

That's fine — **use whatever URL Vite prints** (usually `http://localhost:8081`). This also means **always start the backend first**; if the frontend grabs 8080 first, the backend will crash with `EADDRINUSE` (Troubleshooting #2).

### How the frontend finds the backend (exact mechanics)

Two files control this — worth reading because you'll debug this someday:

1. **`rankos-ai-mentor/src/lib/api.ts`** — every API call goes through `apiFetch`, whose base URL is:

   ```ts
   const API_BASE = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/+$/, "");
   ```

   If the `VITE_API_URL` environment variable is set, it's used as an absolute URL. Otherwise the app calls the **relative** path `/api` — i.e. the same host/port the page itself came from.

2. **`rankos-ai-mentor/vite.config.ts`** — in dev, Vite *proxies* those relative `/api` calls to the backend:

   ```ts
   proxy: {
     "/api": {
       target: process.env.BACKEND_URL ?? "http://localhost:8080",
       changeOrigin: true,
     },
   },
   ```

   So the browser talks only to Vite (e.g. `:8081`), and Vite forwards `/api/*` to `http://localhost:8080` behind the scenes. **Why this design?** The login session lives in an httpOnly cookie; keeping everything same-origin means the cookie flows automatically and there are no CORS headaches.

**Bottom line: with the backend on its default port 8080, you need *no* frontend env file at all.** Only if your backend runs elsewhere would you either set `BACKEND_URL` when starting Vite, or copy `rankos-ai-mentor/.env.example` to `.env` and set `VITE_API_URL` (which bypasses the proxy entirely — then the backend's `CORS_ORIGIN` must include your frontend origin).

### Log in

Open the URL Vite printed (e.g. `http://localhost:8081`), click through to the login page, and sign in with:

- **Email or mobile:** `aarav@example.com`
- **Password:** `password123`

You should land on a dashboard full of the seeded data — streak 46, predicted rank 1240, today's plan, score trend. **That data traveled: MongoDB → Mongoose models → services → controllers → JSON over HTTP → the Vite proxy → React Query → React components.** You now have the whole pipeline running on your machine.

---

## 9. Optional: run the backend tests

```bash
cd ~/Desktop/myapp/backend
npm test
```

Two test files run (`src/tests/`): `health.test.js` (fast, no real DB needed) and `integration.test.js`, which **downloads a private MongoDB binary on first run** (via `mongodb-memory-server`) — that first run can take a couple of minutes and needs internet. Expect a summary like `# pass 17`. You'll write your own test in Module 7.2, exercise 7.

---

## Troubleshooting: the 10 most likely failures

**1. `command not found: node` (or `node -v` shows an old version).**
Node isn't installed or isn't on your PATH. Re-run `brew install node@22` then `brew link --overwrite node@22`, close the terminal, reopen, and check `node -v` again. If an old Node still wins, `which node` shows which one is being used.

**2. Backend crashes on start: `Error: listen EADDRINUSE: address already in use :::8080`.**
Something else already owns port 8080 — usually the *frontend* dev server (it defaults to 8080 too) or a forgotten backend from earlier. Find and stop it:
```bash
lsof -i :8080
```
Note the PID column, then `kill <PID>`. Rule of thumb: **start backend first, then frontend.** Alternatively change `PORT=8081` in `backend/.env` — but then also start the frontend with `BACKEND_URL=http://localhost:8081 npm run dev` so the proxy follows.

**3. Backend logs `[db] Connection attempt 1/5 failed: ...` five times, then exits.**
MongoDB isn't reachable. `backend/src/config/database.js` retries 5 times with a 3-second pause, then gives up. Local install: `brew services list` — if mongodb-community says `stopped` or `error`, run `brew services restart mongodb-community`. Atlas: see #5.

**4. Backend exits instantly with `[env] Missing required environment variable(s): MONGODB_URI`.**
Your `.env` file is missing, in the wrong folder (it must be `backend/.env`, not the project root), or the `MONGODB_URI` line is blank/commented out. This is by design: `env.js` checks a `REQUIRED` list and calls `process.exit(1)` — every *other* variable just falls back to a default, which is why this is the only "missing var" crash you'll see in development.

**5. Atlas: connection fails with `bad auth` or hangs then fails with a server-selection timeout.**
`bad auth` = wrong username/password in the URI (re-check you replaced `<password>`, and that the password has no unescaped special characters). A long hang then timeout = your IP isn't on the Atlas Network Access allowlist — add it (your IP changes when you switch networks!).

**6. Browser console shows CORS errors (`blocked by CORS policy`).**
In normal dev setup this shouldn't happen, because the Vite proxy makes everything same-origin. If you see it, you've probably set `VITE_API_URL` to an absolute URL (bypassing the proxy). Either remove it from `rankos-ai-mentor/.env`, or add your frontend origin to `backend/.env`, e.g. `CORS_ORIGIN=http://localhost:8081`, and restart the backend.

**7. `npm install` fails partway (often mentioning `bcrypt`, `node-gyp`, or `EBADENGINE`).**
`EBADENGINE` warnings mean your Node is older than the `engines` requirement — fix Node first (#1). For native build errors (bcrypt compiles C++ code): `xcode-select --install` to get Apple's build tools, then delete and retry:
```bash
rm -rf node_modules package-lock.json && npm install
```

**8. nodemon says `[nodemon] app crashed - waiting for file changes before starting...`.**
The server threw an error on startup. Scroll **up** — the real cause is printed above that line (bad `.env` value, syntax error you just typed, port in use). Fix the cause and save any file; nodemon retries automatically. If nodemon *doesn't* restart when you save, make sure you edited a file inside `backend/src/` and saved it (`Cmd + S`).

**9. Login fails with "Incorrect email/mobile or password" even with the demo credentials.**
Almost always: the seed never ran, or ran against a *different database* than the server is using (compare the db name at the end of `MONGODB_URI` — `rankos` vs something else — the seed and the server both read the same `.env`, so this happens when you edited `.env` between running them). Re-run `npm run seed` and watch for `[seed] done ✔`. Remember the credentials exactly: `aarav@example.com` / `password123`.

**10. Frontend loads but every page is empty/erroring; DevTools Network tab shows `/api/...` requests failing (504 or `ECONNREFUSED` in the Vite terminal).**
The proxy has nowhere to forward to — your backend isn't running, or runs on a non-default port. Check the backend terminal is still alive (`curl http://localhost:8080/api/health`). Open your browser's DevTools (`Cmd + Option + I` → Network tab) and click a red request: the URL and status code tell you exactly which half of the app to blame. This habit — *look at the actual failing request* — is 80% of frontend debugging.

---

## You're running. What now?

Keep both terminals running and move on — in the next chapter you'll change real code and watch the app react, ten times in a row, from a one-line log tweak to fixing a genuine bug that ships in this codebase today.

**Next:** [Module 7.2 — Guided Changes](02-guided-changes.md)
