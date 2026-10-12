# RankOS Backend

RankOS is an AI mentor for competitive-exam preparation (JEE / NEET). This repository is the **backend API** that powers it: authentication, the tests-and-attempts lifecycle, a mistake bank, Exam-DNA analytics, an AI study planner, leaderboards, file uploads with OCR, and an AI layer (mentor chat, recommendations, revision notes, attempt summaries, roadmaps).

The API speaks raw JSON over HTTP and is consumed by the RankOS frontend per its `API_SPEC`. All feature routes require an authenticated session except the auth, health, and a couple of intentionally-public endpoints noted below.

---

## Tech stack

- **Runtime:** Node.js ≥ 20, ES modules (`"type": "module"`)
- **Web framework:** Express 4
- **Database:** MongoDB with Mongoose 8
- **Auth:** JWT access + refresh tokens delivered as httpOnly cookies (with silent refresh); `bcrypt` password hashing
- **Validation:** Zod (request body/params/query)
- **Uploads & media:** `multer` + Cloudinary (with a local dev-stub)
- **OCR:** Google Vision (with a local dev-stub that returns a sample exam sheet)
- **AI layer:** provider abstraction over Anthropic / Gemini / OpenAI, with a grounded local fallback
- **Background jobs / caching:** BullMQ + Redis (`ioredis`) — optional
- **Realtime:** Socket.IO
- **Email / SMS:** Nodemailer (SMTP) and an SMS/OTP service (Twilio-ready, dev-stub logs the code)
- **Logging:** Winston (+ daily-rotate file transport), Morgan HTTP logs
- **Security:** Helmet, CORS, `express-rate-limit` (Redis-backed when available), input sanitizer, fail-fast env validation
- **API docs:** Swagger / OpenAPI 3 (`swagger-jsdoc` + `swagger-ui-express`)
- **Containerization:** Docker + docker-compose (API + MongoDB + Redis)

---

## Prerequisites

- **Node.js ≥ 20**
- **MongoDB** — a local instance or a MongoDB Atlas cluster (**required**)
- **Redis** — optional; enables shared rate-limiting, BullMQ jobs, and caching
- **Cloudinary** — optional; for real media uploads (otherwise a local dev-stub stores files)
- **SMTP credentials** — optional; for transactional email (otherwise reset links print to the server log)
- **An AI provider key** — optional; Anthropic, OpenAI, or Gemini (otherwise a grounded local fallback is used)

---

## Installation & quick start

```bash
git clone <repo-url>
cd backend
cp .env.example .env      # then edit .env — at minimum set MONGODB_URI
npm install
npm run seed              # populate the database with realistic demo data
npm run dev               # start with auto-reload (nodemon)
```

The server starts on `http://localhost:8080` with the API mounted at `/api`.

### Demo logins

`npm run seed` creates three demo accounts, all sharing the password **`password123`**:

| Role | Email | Mobile |
|------|-------|--------|
| Student | `aarav@example.com` | `+919800000001` |
| Teacher | `teacher@example.com` | `+919800000002` |
| Parent | `parent@example.com` | `+919800000003` |

Log in via `POST /api/auth/login` with `identifier` (the email **or** mobile) and `password`.

> **Dev without external services:** with no SMS or SMTP provider configured, signup/login **OTP codes and password-reset links are written to the server log** instead of being sent — so the full auth flow works locally with zero setup.

### Verify it's running

```bash
curl http://localhost:8080/api/health         # detailed health + dependency states
curl http://localhost:8080/api/health/live     # liveness  → 200 while the process is up
curl http://localhost:8080/api/health/ready     # readiness → 200 once MongoDB is connected
```

- **API root (service metadata):** `http://localhost:8080/api`
- **Swagger UI:** `http://localhost:8080/api/docs`
- **OpenAPI JSON:** `http://localhost:8080/api/docs.json`

---

## Environment variables

Every variable lives in **`.env.example`** with inline notes. Only `MONGODB_URI` is required to boot in development; in production the JWT secrets become required too (see [Deployment](#deployment)).

### Core

| Variable | Required | Default | Purpose |
|----------|:--------:|---------|---------|
| `NODE_ENV` | no | `development` | Runtime mode (`development` / `production` / `test`) |
| `PORT` | no | `8080` | HTTP port |
| `API_PREFIX` | no | `/api` | Base path for all routes |
| `APP_NAME` | no | `RankOS API` | Service name (used in logs and docs) |

### Database

| Variable | Required | Default | Purpose |
|----------|:--------:|---------|---------|
| `MONGODB_URI` | **yes** | — | MongoDB connection string (local or Atlas) |

### CORS

| Variable | Required | Default | Purpose |
|----------|:--------:|---------|---------|
| `CORS_ORIGIN` | no | `*` | Comma-separated allowed origins (`*` = all, dev only) |
| `CORS_CREDENTIALS` | no | `true` | Allow cookies across origins |

### Auth / JWT

| Variable | Required | Default | Purpose |
|----------|:--------:|---------|---------|
| `JWT_ACCESS_SECRET` | prod only | dev placeholder | Signs access tokens (**must be a strong value in production**) |
| `JWT_REFRESH_SECRET` | prod only | dev placeholder | Signs refresh tokens (**must be a strong value in production**) |
| `JWT_ACCESS_EXPIRES` | no | `15m` | Access-token lifetime |
| `JWT_REFRESH_EXPIRES` | no | `7d` | Refresh-token lifetime |
| `JWT_ISSUER` | no | `rankos.api` | JWT `iss` claim |
| `JWT_AUDIENCE` | no | `rankos.client` | JWT `aud` claim |
| `BCRYPT_SALT_ROUNDS` | no | `12` | bcrypt cost factor |
| `EMAIL_VERIFY_EXPIRES` | no | `24h` | Email-verification link lifetime |
| `PASSWORD_RESET_EXPIRES` | no | `30m` | Password-reset link lifetime |

### Auth cookies

| Variable | Required | Default | Purpose |
|----------|:--------:|---------|---------|
| `CLIENT_URL` | no | `http://localhost:5173` | Frontend URL (OAuth redirects + email links) |
| `COOKIE_DOMAIN` | no | host-only | Cookie domain (leave blank for host-only cookies) |
| `COOKIE_SECURE` | no | `false` | Send cookies only over HTTPS (`true` in production) |
| `COOKIE_SAME_SITE` | no | `lax` | `lax` / `strict` / `none` (`none` requires `COOKIE_SECURE=true`) |

### Rate limiting & logging

| Variable | Required | Default | Purpose |
|----------|:--------:|---------|---------|
| `RATE_LIMIT_WINDOW_MS` | no | `900000` | Rate-limit window (15 min) |
| `RATE_LIMIT_MAX` | no | `300` | Max requests per window per IP |
| `LOG_LEVEL` | no | `debug` (dev) / `info` (prod) | Winston log level |
| `LOG_DIR` | no | `logs` | Directory for rotated log files |

### Redis (optional — BullMQ & caching)

| Variable | Required | Default | Purpose |
|----------|:--------:|---------|---------|
| `REDIS_URL` | no | — | Redis connection URL; enables Redis features when set |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | no | — | Discrete host/port/password (alternative to `REDIS_URL`) |

### Cloudinary (optional — media uploads)

| Variable | Required | Default | Purpose |
|----------|:--------:|---------|---------|
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | no | — | Cloudinary credentials; when all three are set, uploads go to Cloudinary (otherwise a local dev-stub) |

### SMTP / Nodemailer (optional — transactional email)

| Variable | Required | Default | Purpose |
|----------|:--------:|---------|---------|
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASSWORD` | no | — | SMTP transport; without it, email links print to the log |
| `EMAIL_FROM` | no | `RankOS <no-reply@rankos.app>` | From address for outgoing email |

### SMS / OTP, OAuth, OCR (optional)

| Variable | Required | Default | Purpose |
|----------|:--------:|---------|---------|
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM` | no | — | Twilio SMS; without it, OTP codes print to the log |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | no | — | Google OAuth; without it, `/auth/oauth/google` uses a dev stub |
| `GOOGLE_APPLICATION_CREDENTIALS` | no | — | Path to a Vision service-account JSON |
| `GOOGLE_VISION_KEY_JSON` | no | — | Vision service-account JSON inline (alternative to the path); without either, OCR uses a dev-stub sample sheet |

### AI provider (optional — grounded local fallback when unset)

| Variable | Required | Default | Purpose |
|----------|:--------:|---------|---------|
| `AI_PROVIDER` | no | auto | Force a provider: `anthropic` / `gemini` / `openai` / `local` |
| `AI_MODEL` | no | provider default | Override the model id for the active remote provider |
| `ANTHROPIC_API_KEY` | no | — | Enables the Anthropic provider |
| `OPENAI_API_KEY` | no | — | Enables the OpenAI provider |
| `GEMINI_API_KEY` | no | — | Enables the Gemini provider |

> **The app runs with none of the AI keys set.** The AI layer auto-selects the first configured remote provider (Anthropic → Gemini → OpenAI); with none configured it uses a **data-grounded local fallback** synthesized from the student's actual RankOS data — never a dummy response. Switching providers is purely an env change.

### Swagger

| Variable | Required | Default | Purpose |
|----------|:--------:|---------|---------|
| `SWAGGER_ENABLED` | no | `true` | Toggle the `/api/docs` UI and `/api/docs.json` |

---

## Docker

A `docker-compose.yml` provisions the API together with MongoDB and Redis, and wires the API to them by service name — no local Mongo/Redis needed.

```bash
npm run docker:up      # docker compose up --build — starts api + mongo + redis
npm run docker:down    # docker compose down — stop the stack
npm run docker:build   # build just the API image
```

Services started by compose:

- **`api`** — the RankOS backend (built from the `Dockerfile`), exposed on `${PORT:-8080}`
- **`mongo`** — MongoDB 7 with a persistent `mongo_data` volume and a healthcheck
- **`redis`** — Redis 7 (alpine) with a persistent `redis_data` volume and a healthcheck

The image runs as the non-root `node` user under `dumb-init` for correct signal handling, and declares a container `HEALTHCHECK` that hits the liveness probe. For production you can drop the `mongo` service and point `MONGODB_URI` at Atlas.

---

## Project structure

```
backend/
├── src/
│   ├── config/          # env loader/validator, database, logger, redis, cloudinary, swagger
│   ├── constants/       # HTTP status codes, roles, token names, app constants
│   ├── controllers/     # HTTP handlers — one per feature (auth, tests, attempts, mistakes, …)
│   ├── docs/            # reusable OpenAPI components
│   ├── jobs/            # BullMQ queue factory + bootstrap (optional, Redis-backed)
│   ├── middlewares/     # authenticate/authorize, validate, sanitize, rate limiter, upload, requestId, 404, error handler
│   ├── models/          # Mongoose schemas (see list below)
│   ├── presenters/      # response shapers (e.g. user presenter — strips sensitive fields)
│   ├── repositories/    # data-access layer wrapping the models
│   ├── routes/          # Express routers, aggregated in routes/index.js
│   ├── seeds/           # demo-data seed runner (data.js + index.js)
│   ├── services/        # business logic per feature
│   │   └── ai/          # AI facade + providers/ (anthropic, gemini, openai, local)
│   ├── sockets/         # Socket.IO server bootstrap
│   ├── tests/           # node:test + supertest
│   ├── utils/           # ApiError, ApiResponse, asyncHandler, jwt/cookie/password/token/exam/transaction helpers
│   ├── validators/      # Zod request schemas
│   ├── app.js           # Express app assembly (exported for tests)
│   └── index.js         # server bootstrap + graceful shutdown
├── package.json
├── .env.example
├── Dockerfile
├── docker-compose.yml
└── README.md
```

**Mongoose models:** `User`, `RefreshToken`, `EmailVerificationToken`, `PasswordResetToken`, `Otp`, `Profile`, `Subject`, `Topic`, `Question`, `Test`, `TestAttempt`, `Mistake`, `ExamDNA`, `StudyTask`, `StudyPlan`, `Revision`, `StudyLog`, `WeeklyGoal`, `AIChat`, `Notification`, `Achievement`, `LeaderboardEntry`, `PomodoroSession`, `Upload`, `Note`.

**AI provider abstraction (`src/services/ai/`):** the facade in `ai/index.js` builds a real system+user prompt for every feature helper (mentor, recommendations, notes, summary, roadmap) and also supplies a deterministic grounded composer. `providers/index.js` resolves the active provider from env (explicit `AI_PROVIDER`, else the first configured remote, else `local`), so adding a provider or switching models is an env change with no code edits.

---

## API endpoints

All paths are relative to the API prefix (`/api`). The entire feature router is **also mounted under `/api/v1/*`** as an explicit version alias, so `/api/tests` and `/api/v1/tests` are equivalent. All request bodies are **raw JSON** (uploads use `multipart/form-data`), per `API_SPEC`.

The **Auth** column: `public` = no session required, `auth` = valid session required, `role` = session **and** an allowed role.

### Auth

| Method | Path | Auth | Purpose |
|--------|------|:----:|---------|
| POST | `/auth/signup` | public | Register (name, mobile, password, exam); triggers an OTP |
| POST | `/auth/verify-otp` | public | Verify a 6-digit OTP for a pending user |
| POST | `/auth/resend-otp` | public | Re-send the OTP |
| POST | `/auth/login` | public | Log in with `identifier` (email or mobile) + password |
| POST | `/auth/forgot-password` | public | Request a password-reset link (by email) |
| POST | `/auth/reset-password` | public | Reset the password using a token |
| GET | `/auth/me` | auth | Current session's user (used for silent-refresh persistence) |
| POST | `/auth/logout` | public | Clear the auth cookies |
| GET | `/auth/oauth/:provider` | public | Start OAuth (`google` / `apple`) |
| GET | `/auth/oauth/:provider/callback` | public | OAuth callback |

### Dashboard

| Method | Path | Auth | Purpose |
|--------|------|:----:|---------|
| GET | `/dashboard` | auth | Aggregated dashboard payload |

### Tests & Attempts

| Method | Path | Auth | Purpose |
|--------|------|:----:|---------|
| GET | `/tests/stats` | auth | Test-centre summary stats |
| POST | `/tests/custom` | auth | Create a custom test |
| GET | `/tests` | auth | List tests (upcoming + previous) |
| GET | `/tests/:code` | auth | Get a test by code |
| POST | `/tests/:code/attempts` | auth | Start an attempt on a test |
| PATCH | `/attempts/:attemptId/response` | auth | Save/update a per-question response |
| POST | `/attempts/:attemptId/submit` | auth | Submit an attempt for scoring |
| GET | `/attempts/:attemptId/result` | auth | Get the scored result |
| POST | `/attempts/:attemptId/to-mistake-bank` | auth | Push wrong answers into the Mistake Bank |
| POST | `/attempts/:attemptId/schedule-revision` | auth | Schedule spaced revision from the attempt |

### Mistakes

| Method | Path | Auth | Purpose |
|--------|------|:----:|---------|
| GET | `/mistakes` | auth | List mistake-bank entries |
| PATCH | `/mistakes/:id` | auth | Update a mistake (status/notes) |
| POST | `/mistakes/:id/practice` | auth | Log a practice pass on a mistake |

### Topics & Notes

| Method | Path | Auth | Purpose |
|--------|------|:----:|---------|
| GET | `/topics/graph` | auth | Topic mastery graph |
| GET | `/topics/:id/revisions` | auth | Revision history for a topic |
| POST | `/topics/:id/practice` | auth | Log a practice session on a topic |
| GET | `/topics/:id/notes` | auth | Fetch stored notes for a topic |
| POST | `/topics/:id/notes` | auth | Generate AI revision notes for a topic |

### Analytics

| Method | Path | Auth | Purpose |
|--------|------|:----:|---------|
| GET | `/analytics/exam-dna` | auth | Exam-DNA radar + behaviour profile |
| GET | `/analytics/score-trend` | auth | Score trend over time |
| GET | `/analytics/heatmap` | auth | Study-activity heatmap |
| GET | `/analytics/recommendations` | auth | AI-driven study recommendations |

### Plans / Tasks / Pomodoro

| Method | Path | Auth | Purpose |
|--------|------|:----:|---------|
| GET | `/plans` | auth | Get the current study plan(s) |
| POST | `/plans/generate` | auth | Generate an AI study plan/roadmap |
| GET | `/tasks` | auth | List study tasks |
| POST | `/tasks` | auth | Create a study task |
| PATCH | `/tasks/:id` | auth | Update a study task |
| DELETE | `/tasks/:id` | auth | Delete a study task |
| POST | `/pomodoro` | auth | Log a completed focus session |

### Leaderboard

| Method | Path | Auth | Purpose |
|--------|------|:----:|---------|
| GET | `/leaderboard` | auth | Ranked leaderboard (by range/scope) |

### Profile

| Method | Path | Auth | Purpose |
|--------|------|:----:|---------|
| GET | `/profile` | auth | Student profile |
| GET | `/profile/achievements` | auth | Earned + available achievements |

### Settings / Account

| Method | Path | Auth | Purpose |
|--------|------|:----:|---------|
| GET | `/settings` | auth | Get settings groups |
| PATCH | `/settings` | auth | Update settings |
| POST | `/settings/security/2fa` | auth | Enable/disable two-factor auth |
| DELETE | `/account` | auth | Delete the account |

### Notifications

| Method | Path | Auth | Purpose |
|--------|------|:----:|---------|
| GET | `/notifications` | auth | In-app notification feed |
| PATCH | `/notifications/read-all` | auth | Mark all notifications read |
| PATCH | `/notifications/:id/read` | auth | Mark one notification read |

### Mentor

| Method | Path | Auth | Purpose |
|--------|------|:----:|---------|
| GET | `/mentor/messages` | auth | AI mentor conversation history |
| POST | `/mentor/chat` | auth | Send a message to the AI mentor |

### AI

| Method | Path | Auth | Purpose |
|--------|------|:----:|---------|
| GET | `/ai/status` | auth | Active AI provider + model probe |

### Uploads

| Method | Path | Auth | Purpose |
|--------|------|:----:|---------|
| POST | `/uploads` | auth | Upload a file (multipart `file`); runs OCR |
| GET | `/uploads` | auth | List the user's uploads |
| GET | `/uploads/:id` | auth | Upload detail (incl. OCR result) |
| DELETE | `/uploads/:id` | auth | Delete an upload |
| GET | `/uploads/files/:name` | public | Serve dev-stub local files (intentionally unauthenticated so `<img src>` works) |

### Parent

| Method | Path | Auth | Purpose |
|--------|------|:----:|---------|
| GET | `/parent/children` | role: parent / admin / student | List linked children |
| GET | `/parent/report` | role: parent / admin / student | Parent-view progress report |

### Teacher

| Method | Path | Auth | Purpose |
|--------|------|:----:|---------|
| GET | `/teacher/overview` | role: teacher / admin | Teacher dashboard overview |
| GET | `/teacher/batches` | role: teacher / admin | List batches |
| GET | `/teacher/assignments` | role: teacher / admin | List assignments |
| POST | `/teacher/assignments` | role: teacher / admin | Create an assignment |
| GET | `/teacher/leaderboard` | role: teacher / admin | Batch leaderboard |

### Health & meta

| Method | Path | Auth | Purpose |
|--------|------|:----:|---------|
| GET | `/` | public | Service metadata (name, environment, versions, docs link) |
| GET | `/health` | public | Detailed health, dependency states, memory/uptime |
| GET | `/health/live` | public | Liveness probe (200 while the process is up) |
| GET | `/health/ready` | public | Readiness probe (200 once MongoDB is ready, else 503) |

---

## Architecture

### Request flow

```
Request
  → security & correlation middleware (requestId, helmet, cors, json/cookie parsing, sanitize, compression, morgan, rate limiter)
  → route (src/routes/*)
  → validate (Zod) + authenticate/authorize
  → controller (src/controllers/*)   — thin HTTP layer, wrapped in asyncHandler
  → service (src/services/*)          — business logic
  → repository / model (src/repositories, src/models) — data access
  → ApiResponse back to the client
```

Errors thrown anywhere bubble to the **central error handler** (`src/middlewares/errorHandler.js`), which normalizes `ApiError`, Mongoose validation/cast errors, duplicate-key errors, and JSON parse errors into a consistent JSON envelope. Handlers throw `ApiError` (`src/utils/ApiError.js`) rather than crafting responses by hand.

### AI provider abstraction

The AI facade (`src/services/ai/index.js`) exposes `mentorReply`, `recommendations`, `notes`, `summary`, and `roadmap`. Each builds a real prompt for a remote LLM **and** a deterministic, data-grounded fallback. `getProvider()` (`src/services/ai/providers/index.js`) resolves the active provider from env — explicit `AI_PROVIDER` if configured, else the first configured remote (Anthropic → Gemini → OpenAI), else the always-available `local` provider. **Switching or adding providers is an env change only.** `GET /api/ai/status` reports the active provider and model.

### Auth model

- **Access + refresh tokens** are JWTs (`src/utils/jwt.util.js`) delivered as **httpOnly cookies** (`src/utils/cookie.util.js`); refresh tokens are also persisted (`RefreshToken` model) so sessions can be rotated/revoked.
- **Silent refresh:** `authenticate` (`src/middlewares/authenticate.js`) first verifies the access token (Authorization header or access cookie); if it's missing/expired it transparently rotates the session using the refresh cookie and sets fresh cookies. The frontend only ever calls `GET /auth/me` and expiry is healed server-side.
- **Signup** is mobile + password with OTP verification; **login** accepts an `identifier` (email or mobile) + password. Passwords are bcrypt-hashed.
- **Authorization:** `authorize(...roles)` gates the parent/teacher routers by role.

### Error handling & security

- Central error handler + `ApiError` / `ApiResponse` / `asyncHandler` utilities for a uniform response envelope.
- **Helmet** security headers, **CORS** with credentials, global **rate limiter** (Redis-backed when Redis is configured, in-memory otherwise) plus stricter limiters on auth and upload routes.
- **Input sanitizer** middleware guards against NoSQL-injection / prototype-pollution.
- **Fail-fast env validation** (`src/config/env.js`) exits on a missing `MONGODB_URI`, and in production additionally requires strong JWT secrets and consistent cookie settings (see below).
- Requests carry a **request-ID** for log correlation; Winston handles structured logging with daily-rotated files.

---

## Testing

```bash
npm test          # node --test "src/tests/**/*.test.js"
```

The project uses Node's built-in test runner (`node --test`) with `supertest` for HTTP assertions. `src/tests/health.test.js` exercises the health endpoints against the exported Express app (`createApp()` in `app.js`), so no listening server is needed. End-to-end flows were validated against `mongodb-memory-server`, which lets the suite run the real Mongoose models with no external MongoDB.

---

## Deployment

Build and run for production:

```bash
NODE_ENV=production npm start        # node src/index.js
# or build & run the Docker image:
npm run docker:build
```

Production checklist (enforced by `src/config/env.js` — the app **refuses to boot** on violations):

- **`NODE_ENV=production`**
- **Real `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`** — required, and the app exits if they still contain the dev placeholders (`dev-` / `change-me`). Generate strong values, e.g. `openssl rand -base64 48`.
- **`COOKIE_SECURE=true`** (and required if `COOKIE_SAME_SITE=none`, or browsers drop the cookies).
- **`MONGODB_URI`** pointing at your production database (e.g. MongoDB Atlas).
- Set a real **`CORS_ORIGIN`** (not `*`) and appropriate **`CLIENT_URL`**.
- Optional but recommended: **Redis** (shared rate-limiting + jobs), **Cloudinary** (real uploads), **SMTP** (email), **Google Vision** (real OCR), and an **AI provider key**.

The server handles `SIGTERM`/`SIGINT` with a **graceful shutdown** (stops accepting connections, then closes sockets, queues, Redis, and MongoDB), and the Docker image ships a container-level health check against the liveness probe.
