# RankOS — Deployment Guide

RankOS is two deployables:

| Part | Path | Runtime | Build target |
|------|------|---------|--------------|
| **Backend API** | `backend/` | Node ≥20 (Express) | Docker image / any Node host |
| **Frontend** | `rankos-ai-mentor/` | TanStack Start (SSR) | Nitro → Cloudflare (default) or Node |

---

## 0. Pre-deploy checklist

- [ ] Provision a **MongoDB Atlas** cluster; get the `mongodb+srv://…` URI.
- [ ] Generate two strong JWT secrets: `openssl rand -base64 48` (once each).
- [ ] Decide the **cookie/CORS topology** (see §3 — this is the #1 thing people get wrong).
- [ ] Set backend env from `backend/.env.production.example`.
- [ ] Set `VITE_API_URL` for the frontend build (or use a same-origin proxy).
- [ ] (Optional) Add keys for AI, Cloudinary, SMTP, OAuth, Twilio, Google Vision — the app runs without them (features degrade to grounded/dev-stub behaviour).
- [ ] CI green (`.github/workflows/ci.yml` runs backend tests + frontend build + Docker build).

---

## 1. Backend

### Environment
Copy `backend/.env.production.example` → set real values. **The server refuses to boot in production** if:
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` are missing or still the dev defaults, or
- `COOKIE_SAME_SITE=none` without `COOKIE_SECURE=true`.

Only `MONGODB_URI` (+ the JWT secrets in prod) are strictly required; everything else has safe defaults or graceful fallbacks.

### Option A — Docker (works on Render, Railway, Fly.io, a VPS, ECS, …)
```bash
cd backend
docker build -t rankos-backend .
docker run -p 8080:8080 --env-file .env rankos-backend
```
The image is multi-stage, runs as a **non-root** user, has a container `HEALTHCHECK` on `/api/health/live`, and handles SIGTERM for graceful shutdown.

### Option B — Managed Node host (no Docker)
Build command: `npm ci` · Start command: `npm start` · Health check path: `/api/health/live`.

### Seeding
Demo data is optional in production. To load it once:
```bash
npm run seed        # uses MONGODB_URI
```
Skip this for a clean production database.

### Platform notes
- **Render / Railway:** deploy from `backend/` using the Dockerfile (or Node preset). Add the env vars in the dashboard. Set the health check to `/api/health/live`.
- **Fly.io:** `fly launch` in `backend/` (detects the Dockerfile); set secrets with `fly secrets set`.
- Put a real **Redis** URL (`REDIS_URL`) if you run more than one instance, so rate-limiting is shared.

---

## 2. Frontend

The Vite build inlines `VITE_*` at **build time**, so set it before `npm run build`.

```bash
cd rankos-ai-mentor
# either set VITE_API_URL (cross-origin) …
VITE_API_URL=https://api.yourdomain.com/api npm run build
# … or leave it unset and serve /api same-origin (see §3, recommended)
npm run build
```

The default Nitro build targets **Cloudflare** (`.output/`, `wrangler.json`). Deploy with `npx wrangler deploy` (or connect the repo in the Cloudflare dashboard). To target a Node server instead, build with a Node Nitro preset and run the generated server.

---

## 3. Cookie & CORS topology (read this)

The session is an **httpOnly cookie** sent with `credentials: "include"`. How you host the two parts decides the cookie settings:

### Same-origin (recommended, simplest)
Serve the API under the **same domain** as the app at `/api` (via an edge proxy/route, e.g. a Cloudflare route `/api/*` → the backend origin). Then:
- Backend: `COOKIE_SAME_SITE=lax`, `COOKIE_SECURE=true`, CORS not needed.
- Frontend: leave `VITE_API_URL` unset (defaults to same-origin `/api`).

### Cross-origin (app and API on different domains)
- Backend: `COOKIE_SAME_SITE=none`, `COOKIE_SECURE=true`, `CORS_ORIGIN=https://app.yourdomain.com` (exact, **never `*`**), `CORS_CREDENTIALS=true`.
- Frontend: `VITE_API_URL=https://api.yourdomain.com/api`.
- Both must be HTTPS (SameSite=None cookies require Secure).

If cookies "don't stick" after login, it's almost always this section.

---

## 4. CI / CD

`.github/workflows/ci.yml` runs on push/PR:
- **backend** — `npm ci && npm test` (integration tests boot the app against an in-memory MongoDB; no external services needed).
- **frontend** — `npm ci && npx tsc --noEmit && npm run build`.
- **docker** — builds the backend image.

Wire your platform's deploy step to run **after** these pass.

---

## 5. Post-deploy smoke test

```bash
curl -f https://api.yourdomain.com/api/health          # dependency status
curl -f https://api.yourdomain.com/api/health/live      # liveness
```
Then in the app: sign up / log in, open the dashboard, send an AI-mentor message, and generate AI notes on the revision graph. Confirm `GET /api/ai/status` shows your provider (`local` until you add an AI key).
