# Lesson 1 — How the Web Works

> **Goal:** learn the 8 words that unlock everything else: client, server, HTTP,
> request, response, API, JSON, database.

## The restaurant model

Every web app — Instagram, Google, your RankOS — is a restaurant:

| Restaurant | Web app | In your project |
|---|---|---|
| Dining room | **Frontend / client** — what users see | `rankos-ai-mentor/` |
| Waiter carrying orders | **HTTP requests** over the internet | — |
| Kitchen | **Backend / server** — does the real work | `backend/` |
| Pantry | **Database** — where everything is stored | MongoDB |

A "client" is any program that *asks* for things: a web browser, a phone app.
A "server" is a program that *answers*. Your backend is a server.

## What actually happens when you use an app

Say a student opens their task list in RankOS:

1. The browser (client) sends a **request**: *"GET me the tasks for this user."*
2. The request travels over the internet using **HTTP** — a simple, universal
   format for requests, like a standardized order slip.
3. Your backend receives it, checks who's asking, fetches tasks from **MongoDB**.
4. The backend sends back a **response** containing the data.
5. The browser turns that data into pretty pixels on screen.

This request→response loop is *the* fundamental cycle. Everything else is detail.

## HTTP requests have a verb and a path

Every request says **what to do** (the verb/method) and **to what** (the path/URL):

| Verb | Means | Real example from your app (`backend/src/routes/tasks.routes.js`) |
|---|---|---|
| `GET` | read something | `GET /tasks` → list my study tasks |
| `POST` | create something | `POST /tasks` → create a new task |
| `PATCH` | update part of something | `PATCH /tasks/123` → mark task 123 done |
| `DELETE` | delete something | `DELETE /tasks/123` → remove task 123 |

Responses come back with a **status code** — a 3-digit result summary:

- `200` OK — worked
- `201` Created — worked, and something new was made
- `400` Bad Request — you (the client) sent something invalid
- `401` Unauthorized — you're not logged in
- `404` Not Found — that thing doesn't exist
- `500` Server Error — the *backend* broke (a bug!)

Memory trick: **4xx = the Asker messed up, 5xx = the Server messed up.**

## What's an API?

An **API** (Application Programming Interface) is the *menu* of requests a server
accepts. Your backend's menu includes `/auth`, `/tasks`, `/tests`, `/leaderboard`,
`/mentor`, etc. — you can see the whole menu in `backend/src/routes/index.js`.

Your frontend even has a written contract describing that menu:
`rankos-ai-mentor/API_SPEC.md`. Frontend and backend teams agree on the menu first,
then build their halves independently.

## What's JSON?

Requests and responses need to carry data in a format both sides understand.
That format is **JSON** (JavaScript Object Notation). It's just labeled values:

```json
{
  "title": "Revise thermodynamics",
  "subject": "Physics",
  "done": false,
  "durationMinutes": 45
}
```

Curly braces `{}` group a thing, `"label": value` pairs describe it, square
brackets `[]` hold lists. That's 95% of JSON. You'll see it *everywhere*.

## Where do these programs run?

- The frontend runs **on the user's device** (in the browser).
- The backend runs on **a computer that's always on** — during development, that's
  your laptop; in production, a rented computer in a data center (a "cloud server").
  Your `render.yaml` file configures one such service (Render.com).
- "localhost" means "this same computer" — when you develop, your backend runs at
  an address like `http://localhost:8080` (8080 is your app's default **port** —
  a numbered door on the computer, set in `backend/src/config/env.js`).

---

## ✏️ Exercises

1. Open `backend/src/routes/index.js`. Count how many different "menu sections"
   (routers) your API has. Which three sound most interesting to you?
2. In plain English, what's the difference between a `401` and a `404` response?
3. Write (on paper or in a scratch file) the JSON you'd imagine the frontend sends
   when a student creates a study task called "Solve 20 algebra problems" for
   60 minutes. Don't worry about being "right" — worry about valid JSON shape.
4. **Try it for real:** with the backend running (Lesson 9 shows how), open a
   terminal and run:
   ```bash
   curl http://localhost:8080/api/health/live
   ```
   `curl` is a client — you just made an HTTP request by hand!

**Next:** [Lesson 2 — JavaScript Basics](02-javascript-basics.md)
