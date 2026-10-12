# RankOS — AI study mentor for JEE/NEET aspirants

RankOS turns every mock test into structured feedback: automatic scoring, a
self-filling mistake notebook, weak-topic detection, a daily study plan, a
leaderboard, and an AI mentor grounded in the student's own data. Separate
views exist for students, parents and teachers.

| Part | Path | Stack |
|---|---|---|
| Backend API | [`backend/`](backend/) | Node 20 · Express · MongoDB/Mongoose · Zod · JWT in httpOnly cookies · Socket.IO · BullMQ · Swagger · Docker |
| Frontend | [`rankos-ai-mentor/`](rankos-ai-mentor/) | React 19 · TypeScript · TanStack Router/Start/Query · Tailwind 4 · Radix UI · Recharts |
| Course notes | [`study-material/`](study-material/) | A full beginner-to-mastery course written against this codebase |

## Highlights

- **Layered backend**: routes → controllers → services → repositories → models, with every query scoped to the logged-in user.
- **Sessions**: short-lived access token + rotating, revocable refresh token, both httpOnly cookies; silent refresh in the auth middleware; reuse detection revokes the whole token family.
- **Safety net**: Zod validation (422 with per-field errors), NoSQL-injection sanitiser, helmet, CORS, rate limiting (Redis-backed when available), centralised error envelope.
- **Mock tests**: one submit scores the attempt, files wrong answers into the mistake notebook, awards achievements, and stores an AI performance summary.
- **Provider-agnostic AI**: Anthropic, Gemini or OpenAI via env; a data-grounded local fallback means the app works with zero API keys.
- **Ops**: integration tests against in-memory MongoDB, GitHub Actions CI, multi-stage non-root Docker image with health check, graceful shutdown, Render blueprint.

## Run it locally

Three processes: MongoDB → backend (`:8080`) → frontend (`:8081`). Step-by-step
instructions are in [HOW_TO_RUN.md](HOW_TO_RUN.md); deployment notes in
[DEPLOYMENT.md](DEPLOYMENT.md).

```bash
cd backend && cp .env.example .env && npm install && npm run seed && npm start
cd rankos-ai-mentor && npm install && npm run dev      # second terminal
```

Demo login: `aarav@example.com` / `password123`. API docs at `http://localhost:8080/api/docs`.

## Tests

```bash
cd backend && npm test
```
