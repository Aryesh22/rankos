# How to run RankOS on your Mac (beginner guide)

RankOS is three programs that must run at the same time:

| Program | What it is | Where it lives | Address |
|---------|-----------|----------------|---------|
| MongoDB | The database that stores all data | Installed on the Mac (Step 1) | localhost:27017 |
| Backend | The server that answers the app's requests | `backend/` | http://localhost:8080 |
| Frontend | The website you click on | `rankos-ai-mentor/` | http://localhost:8081 |

Start them in that order: database → backend → frontend.

---

## Before you start: the Terminal app

Terminal is where you type commands.

- Open it: press **Cmd + Space**, type `Terminal`, press **Enter**.
- Every step below means: paste the line into Terminal and press **Enter**.
- You need **two Terminal windows** open at the same time (one for the backend, one for the frontend). Open a new window with **Cmd + N**.

---

## Step 1. Install the database (one time only)

Your Mac does not have MongoDB yet. Paste this and press Enter:

```bash
brew tap mongodb/brew && brew install mongodb-community && brew services start mongodb-community
```

- Takes a few minutes and prints a lot of text.
- When it ends with a line containing `Successfully started`, you are done.
- MongoDB now starts by itself every time you turn on the Mac. **You never repeat this step.**

Check it is running (optional):

```bash
brew services list
```

`mongodb-community` should say `started`.

---

## Step 2. Put demo data into the database

This fills the database with a sample student, tests, plans and mistakes so the app has something to show.

```bash
cd ~/Desktop/myapp/backend && npm run seed
```

You should see:

```
[seed] done ✔
[seed] demo login → email: aarav@example.com  mobile: +919800000001  password: password123
```

Do this the first time, and again whenever you want to **reset** the data to fresh demo data.

---

## Step 3. Start the backend (Terminal window 1)

```bash
cd ~/Desktop/myapp/backend && npm start
```

Wait until you see:

```
[server] RankOS API listening on :8080 (development) — API at /api
```

**Leave this window open.** Closing it stops the backend.

---

## Step 4. Start the frontend (Terminal window 2)

Press **Cmd + N** for a new Terminal window, then:

```bash
cd ~/Desktop/myapp/rankos-ai-mentor && npm run dev
```

The first start can take about a minute. You will see:

```
Port 8080 is in use, trying another one...
  ➜  Local:   http://localhost:8081/
```

The "port in use" message is **normal**: the backend already took 8080, so the website moves to 8081.

**Leave this window open too.**

---

## Step 5. Open the app in your browser

Open Chrome or Safari and go to:

```
http://localhost:8081/login
```

Log in with the demo student account:

| Field | Value |
|-------|-------|
| Email | `aarav@example.com` |
| Password | `password123` |

You should land on the dashboard showing a streak, predicted rank and today's plan.

Other demo accounts (same password `password123`):

- `teacher@example.com` — teacher view
- `parent@example.com` — parent view

Useful extra pages:

- API documentation: http://localhost:8080/api/docs
- Backend health check: http://localhost:8080/api/health

---

## Step 6. Stopping the app

Click into a Terminal window and press **Ctrl + C**. Do this in both windows.

MongoDB keeps running quietly in the background. That is fine and uses almost no resources. If you ever want to stop it:

```bash
brew services stop mongodb-community
```

---

## Every day after the first time

Once Step 1 has been done once, a normal day is just:

1. Terminal window 1: `cd ~/Desktop/myapp/backend && npm start`
2. Terminal window 2: `cd ~/Desktop/myapp/rankos-ai-mentor && npm run dev`
3. Browser: http://localhost:8081/login

---

## If something goes wrong

| What you see | What it means | What to do |
|--------------|---------------|------------|
| Backend prints MongoDB connection errors and exits | The database is not running | Run `brew services start mongodb-community`, then redo Step 3 |
| Backend prints `MongoDB connected` but never says `listening` | It is stuck waiting for Redis | Open `backend/.env` and make sure the `REDIS_URL` line starts with `#` (it was fixed on 2026-09-20) |
| Browser says "site cannot be reached" | The frontend is not running or still starting | Look at Terminal window 2 for the `Local:` line; if the window is closed, redo Step 4 |
| Login button does nothing or shows a network error | The backend is not running | Look at Terminal window 1; if it is closed, redo Step 3 |
| `command not found: brew` | Homebrew is missing | Install it from https://brew.sh, then redo Step 1 |
| `command not found: npm` | Node.js is missing | Install Node.js from https://nodejs.org (version 20 or newer), then retry |
| Frontend takes forever the first time | Normal; it is compiling | Wait up to 2 minutes |

---

## Optional: turning on real AI, SMS, email

The app runs fully without any keys. Without them:

- The AI mentor uses a built-in "local" answer engine based on your data.
- Sign-up OTP codes are printed in the backend Terminal window instead of sent by SMS.
- "Continue with Google" signs in a demo user.

To enable the real services, add the keys to `backend/.env` (see `backend/.env.example` for every option) and restart the backend.
