# Lesson 9 — Running & Deploying

> **Goal:** run your app on your own laptop, and understand how the same app
> makes it onto the real internet.

## Part A — Running locally ("development mode")

To see RankOS working you need **three programs running at once**: the database,
the backend, and the frontend. Each gets its own terminal tab.

### 1. The database (MongoDB)

The backend expects MongoDB reachable at the address in `backend/.env`
(`MONGODB_URI`). Two common options:

- **Local install:** run MongoDB on your Mac (e.g. via Homebrew:
  `brew services start mongodb-community`).
- **MongoDB Atlas:** a free cloud-hosted database — you just paste its URI into
  `.env`. (Your deployment config assumes Atlas.)

Remember from `index.js`: no MongoDB → backend refuses to start (by design).
Redis is optional — the app runs fine without it.

### 2. The backend

```bash
cd ~/Desktop/myapp/backend
npm install            # first time only
# make sure .env exists with at least MONGODB_URI and JWT secrets
npm run dev            # nodemon starts it, restarts on every save
```

Success looks like the log line from `index.js`:
`[server] rankos-backend listening on :8080 (development) — API at /api`.

Smoke-test it from another terminal:

```bash
curl http://localhost:8080/api/health/live
```

A **health check** endpoint exists precisely so humans *and* machines can ask
"are you alive?" (your deployment platform pings it too — see Part B).

### 3. The frontend

```bash
cd ~/Desktop/myapp/rankos-ai-mentor
npm install            # first time only
npm run dev            # Vite serves the app
```

Vite prints a URL like `http://localhost:3000` — open it in the browser. That's
your app. Edit a file, save, and watch the browser update itself (hot reload).

> 💡 Easiest path: just ask Claude Code — *"run the app for me"* — and it will
> handle the setup, tell you what's missing (like a `.env`), and fix issues.

## Part B — Deployment: putting it on the internet

"Deploying" = running the same programs on a computer that's always on and
reachable by everyone. Modern platforms rent you that computer and automate the
plumbing. Your project is set up for **Render.com** — read `render.yaml`, it's
short and real:

```yaml
services:
  - type: web
    name: rankos-backend
    runtime: docker                        # build the app using backend/Dockerfile
    healthCheckPath: /api/health/live      # Render pings this; no answer → restart/alert
    envVars:
      - key: NODE_ENV
        value: production
      - key: MONGODB_URI
        sync: false                        # secret → pasted in the dashboard, not in this file
      - key: JWT_ACCESS_SECRET
        generateValue: true                # Render invents a strong secret for you
      - key: CORS_ORIGIN
        sync: false                        # your frontend's real https:// address
```

Everything you've learned converges here:

- **Env vars** (Lesson 8) configure the production server — same code, different
  settings. Secrets live in the platform's dashboard, never in git.
- **Health checks** (Lesson 1's request/response!) let the platform babysit your
  server.
- **CORS** (Lesson 4's middleware) is locked to the frontend's exact domain in
  production — no wildcards.
- **Docker** wraps the backend so it runs identically on Render as on your laptop.
- The database isn't on Render at all — it's **MongoDB Atlas**, a managed cloud
  MongoDB. In production you rarely run your own database.
- The **frontend deploys separately** (typically to a static host — Vercel,
  Netlify, or Render static): `npm run build` compresses it into plain
  HTML/CSS/JS files that any web server can hand out.

### Dev vs prod, side by side

| | Your laptop (development) | The internet (production) |
|---|---|---|
| Backend | `npm run dev`, restarts on save | Docker container on Render, restarts on crash |
| Database | local MongoDB or Atlas | MongoDB Atlas |
| Secrets | `.env` file | platform dashboard |
| Frontend | Vite dev server, hot reload | pre-built static files on a CDN |
| Errors | full details, for you | generic messages (details stay in logs) |
| URL | `localhost` | `https://api.yourdomain.com` |

`DEPLOYMENT.md` at the project root walks through the specific steps for this app.

---

## ✏️ Exercises

1. Start the backend (with Claude's help if needed) and hit the health endpoint
   with `curl`. Then stop it with Ctrl+C and watch the graceful-shutdown log
   lines from `index.js` — you know exactly which code is producing them.
2. In `render.yaml`: why do `MONGODB_URI` and `CORS_ORIGIN` say `sync: false`
   while `NODE_ENV` has a plain value? (Two different reasons!)
3. Why does production generate JWT secrets (`generateValue: true`) instead of
   reusing the ones from your laptop's `.env`?
4. **Capstone 🎓:** with everything running, open the app in your browser,
   perform one action, and narrate the full journey out loud — component →
   service → HTTP → middleware → route → controller → service → model → MongoDB
   → and all the way back. If you can do that, you are no longer a beginner.

**You made it!** Check the [GLOSSARY](GLOSSARY.md) whenever a term slips, and
ask Claude to quiz you, review your exercise answers, or go deeper on any
lesson. A great next step: pick one tiny real change (add a field to tasks?)
and implement it across all layers.
