# Module 7.4 — Mastery Roadmap

> **Goal:** Turn "I finished a course" into "I keep getting better without a course." This chapter gives you a self-assessment to find your gaps, a revision schedule so the knowledge sticks, the debugging and code-reading methods professionals actually use, a git workflow for the capstones, rules for using Claude Code without outsourcing your brain, and a 6-month path toward employability.

---

## 1. Self-assessment: can you explain it without looking?

The test of understanding is **explaining from memory, out loud or on paper** — not recognizing something when you re-read it. For each lesson of the concept track (`study-material/01-*.md` … `09-*.md`), here's the bar. Score each item: ✅ can explain cold / 🟡 need a peek / ❌ no idea. Revisit every 🟡/❌ lesson before moving on.

**Lesson 1 — How the Web Works**
- [ ] Explain what happens between typing a URL and seeing a page (DNS → TCP → HTTP request → response → render).
- [ ] Explain the difference between GET, POST, PATCH, DELETE and pick the right one for "toggle a task done".
- [ ] Read `{"success":false,"error":{"code":"NOT_FOUND"}}` with status 404 and say who's at fault: client or server. What about a 500? A 422?

**Lesson 2 — JavaScript Basics**
- [ ] Explain `const day = date || todayStr()` — and why it failed on the string `"today"` (you *fixed* this bug in Module 7.2; explaining it is the exam).
- [ ] Explain what `async`/`await` does and why `tasksService.listTasks(...)` needs `await`.
- [ ] Explain `.map()`, `.filter()`, and template literals using real lines from `backend/src/services/dashboard.service.js`.

**Lesson 3 — Project Tour**
- [ ] From memory, sketch the folder tree of `backend/src/` (routes, controllers, services, models, middlewares, config, utils) and one sentence on what belongs in each.
- [ ] Say where a *new* file goes for: a new endpoint's logic; a new database shape; a new page in the app.

**Lesson 4 — Life of a Request**
- [ ] Trace `PATCH /api/tasks/:id` end to end, naming every file it touches, without opening any of them. (Check yourself afterward.)
- [ ] Explain what a middleware is and the order in `backend/src/app.js` — why must `errorHandler` be last? Why is `authenticate` per-router instead of global?

**Lesson 5 — Databases & MongoDB**
- [ ] Explain document vs. table, and what a Mongoose model adds on top of raw MongoDB (validation, defaults, `toJSON` transforms — you used all three in Module 7.2 exercise 4).
- [ ] Explain what an index is and why `studyTask.model.js` has `{ user: 1, date: 1 }`.
- [ ] Explain why old documents don't gain new schema fields, and how you handled that in the priority exercise.

**Lesson 6 — Authentication**
- [ ] Explain hash vs. encrypt, and why `user.model.js` stores `passwordHash` — never the password.
- [ ] Explain access token vs. refresh token and walk through the silent-refresh in `backend/src/middlewares/authenticate.js`.
- [ ] Explain httpOnly cookies and why the Vite proxy setup means the frontend never touches the token.

**Lesson 7 — Frontend (React)**
- [ ] Explain component, props, and state using `StatCard.tsx`.
- [ ] Explain what React Query adds over plain `fetch` (caching, invalidation — you used `invalidateQueries` in the capstones).
- [ ] Explain the conditional-render pattern `{t.priority === "high" && <Badge/>}` you shipped in Module 7.2.

**Lesson 8 — Tools of the Trade**
- [ ] Explain what `npm install`, `package.json`, and `node_modules` are to a friend who's never coded.
- [ ] Explain what `.env` is for and why it must never be committed to git.

**Lesson 9 — Running & Deploying**
- [ ] Explain the difference between `npm run dev` (nodemon/Vite) and how the app would run in production (`npm start`, built frontend, real env vars).
- [ ] List which env vars would *have* to change for production (env.js enforces two of them — which, and why?).

**The practice track itself**
- [ ] Rebuild the `/tasks/stats` endpoint from a blank screen, no notes, in under 30 minutes.
- [ ] Explain your capstone A architecture to someone (or to Claude, asking it to poke holes).

---

## 2. Spaced-repetition revision plan

You forget most of what you learn within days *unless you retrieve it on a schedule*. Retrieval — not re-reading — is what sticks.

- **Day 1 (today):** finish a lesson/exercise. Close everything and write a 5-line summary from memory.
- **Day 3:** redo one exercise from it *from scratch* (e.g. re-add a field to the health endpoint — different field, same muscle).
- **Day 7:** do the self-assessment items for it, out loud.
- **Day 21:** teach it — write a short explanation as if for another beginner, or have Claude play the confused student ("I'll explain middleware; ask me dumb questions until I break").
- **Monthly, forever:** one "cold rebuild" — pick any small thing the app does and rebuild it in a scratch folder without looking.

Keep a single `revision-log.md` with dates and scores. Ten minutes a day beats four hours on Sunday.

---

## 3. Debugging methodology (the loop that never changes)

You practiced pieces of this in Module 7.2, exercises 8–9. Here's the full loop — every bug, forever:

1. **Reproduce.** Find the exact steps that trigger it, reliably. A bug you can't reproduce is a bug you can't verify fixing. (Planner bug: open Today tab → always empty. Reliable.)
2. **Isolate.** Cut the search space in half repeatedly. Frontend or backend? → curl the endpoint directly; if curl is wrong, frontend is innocent. Which layer? → add a `logger.debug` in the controller, then the service. This is binary search over your own code.
3. **Read the error. Actually read it.** First line = what. Top stack frame *in your code* = where. Status code = whose fault. Beginners skip this step and guess; professionals read.
4. **Form a hypothesis.** One sentence: "The backend receives the literal string `today` and matches it against ISO dates." If you can't state it in a sentence, keep isolating.
5. **Test the hypothesis** with the *smallest possible experiment* — a curl, a log line, a one-line change. Not a rewrite.
6. **Fix, verify the reproduction is gone, and check you didn't break neighbors** (`npm test`). Then ask: does this bug exist anywhere else? (It did — your stats endpoint had the same `||` flaw.)

Anti-patterns to catch yourself doing: changing three things at once (now you can't tell which mattered), pasting errors into a chat before reading them, and "it works now" without knowing *why* (the bug will be back).

---

## 4. How to read unfamiliar code

You'll spend far more of your career reading code than writing it. The method:

1. **Start at the entry point, not the interesting part.** For any backend feature: `routes/index.js` → the feature's routes file → controller → service → model. For the frontend: the route file in `src/routes/` → the services it imports.
2. **Read the folder names before the files.** Architecture first, details second.
3. **Follow one concrete scenario**, not the general case: "user checks off a task" beats "how do tasks work".
4. **Read tests** — `backend/src/tests/integration.test.js` documents the app's real behavior more honestly than any README, because it *fails* when it lies.
5. **Rename-in-your-head test:** if you can't give a variable a better name, you don't understand it yet.
6. **Write the summary you wish existed** — three sentences per file you studied. (You saw this pay off in capstone B's audit.)
7. **Beware stale docs.** You experienced this: the memory note said auth was unbuilt; the code said otherwise. Code is the truth; docs are a rumor about the truth.

---

## 5. Git for the capstones (branch per feature)

As of this writing, `~/Desktop/myapp` is **not** a git repository — fix that before capstone A:

```bash
cd ~/Desktop/myapp
git init
git add .
git commit -m "Baseline: RankOS backend + frontend + course material"
```

(Check first that `backend/.env` is ignored: `git status` must NOT list it. If it does, the project needs a root `.gitignore` — at minimum `node_modules/`, `.env`, `*.log`, `backend/logs/`, `backend/uploads/` — before that first `git add .`.)

**The workflow, per capstone:**

```bash
git switch -c feature/bookmarks     # branch = a parallel universe for this feature
# ... work ...
git add -A && git commit -m "Add bookmark model and service"   # commit early, commit often
# ... more small commits ...
git switch main && git merge feature/bookmarks                 # land it when done
```

Rules that make git *useful* instead of ceremonial:

- **Commit at every working checkpoint** — "model boots", "curl create works", "tests pass". Each commit is a save point you can retreat to (`git diff` to see what you changed since; `git restore <file>` to undo uncommitted damage).
- **Message = what and why**, present tense: "Scope bookmark deletes to owner (404 otherwise)".
- **One feature per branch.** Mid-capstone urgent fix? `git stash`, switch, fix, switch back, `git stash pop`.
- Read your own history weekly: `git log --oneline`. It's your learning diary.
- When you deploy (section 7), push to GitHub: a `main` with merge commits from feature branches *is* the portfolio signal reviewers look for.

---

## 6. Claude Code as a learning partner (not a replacement brain)

The uncomfortable truth: the tool that built much of this app can also prevent you from learning anything. The difference is entirely in how you prompt it. Principle: **Claude explains, reviews, and quizzes; *you* type the code that matters.**

Prompts that grow you:

- *"Review my bookmarks service — point out problems and ask me questions, but do NOT write corrected code."*
- *"I think this bug is X. Don't confirm or fix it — tell me what experiment would prove or disprove my hypothesis."*
- *"Explain backend/src/middlewares/authenticate.js line by line, then quiz me on it in 10 minutes."*
- *"Here's my plan for the presence feature: [plan]. Critique the plan only."*
- *"Give me a hint that's one notch more specific than 'read the token utils', but not the answer."*
- *"I fixed it. Here's my diff — did I fix the cause or the symptom?"*

Habits that hollow you out: "build the feature for me" during learning; pasting an error before reading it yourself; accepting generated code you couldn't rewrite from memory tomorrow. A good self-honesty rule: **if Claude wrote it, you must be able to delete it and re-type it yourself** — if you can't, stop and study what it wrote until you can. Struggling for 30–60 focused minutes before asking is not wasted time; it's the workout.

Where full-power Claude *is* appropriate, even while learning: generating test data, explaining cryptic errors after you've read them, writing the boilerplate you've already written five times, and reviewing finished work like a senior colleague.

---

## 7. The 6-month roadmap to employable

Assumes ~10 focused hours/week. Adjust proportionally; sequence matters more than speed.

**Months 1–2 — Consolidate on this project.**
- Finish all four capstones with tests. Redo the self-assessment; kill every ❌.
- **TypeScript depth** (your frontend is TS; your backend isn't — that asymmetry is a lesson): work through the TypeScript Handbook, then as the milestone project convert `backend/src/services/tasks.service.js` and its controller to TypeScript on a branch, or at minimum add JSDoc types until `// @ts-check` passes. Generics, unions, `unknown` vs `any`.
- Git fluency: interactive staging, resolving a merge conflict on purpose, `git bisect` a bug you plant.

**Month 3 — SQL and data modeling.**
- MongoDB taught you documents; jobs will demand SQL. Learn PostgreSQL: SELECT/JOIN/GROUP BY, indexes, transactions, normalization (SQLBolt then pgexercises are excellent and free).
- Milestone: design the RankOS schema *relationally* — users, tests, attempts, mistakes as tables with foreign keys. Write the 5 gnarliest queries (e.g. "each student's percentile trend over their last 6 attempts"). Explain when you'd pick Mongo vs. Postgres and why RankOS could be either.

**Month 4 — CS fundamentals + deploy for real.**
- Data structures you'll actually be asked about: arrays/strings, hash maps, stacks/queues, trees, big-O reasoning. ~30–40 easy/medium problems total, in JavaScript. (You already used a hash map: the presence `Map` in capstone D.)
- **Deploy RankOS:** MongoDB Atlas (you know it from Module 7.1) + backend on Render/Railway/Fly.io + frontend on the same host or a static/edge platform, real `JWT_*` secrets (`openssl rand -base64 48`), `CORS_ORIGIN` locked to the real domain, `COOKIE_SECURE=true`. The backend's env validation will *fail your first attempt* on purpose — reread `config/env.js`'s production block; it was written to save you here. A live URL transforms every future conversation about this project.

**Month 5 — System design basics + polish.**
- Learn to answer "what happens when this has 100k users?": load balancers, caching (you have Redis!), CDNs, horizontal scaling, and why capstone D's in-memory presence Map breaks with two servers (you wrote that answer down — expand it).
- Write the project README that tells the story: architecture diagram, decisions, trade-offs, screenshots, the live URL, "what I'd do differently."
- CI: a GitHub Action that runs `npm test` on every push. One page of YAML, outsized signal.

**Month 6 — Portfolio and the market.**
- Portfolio = deployed RankOS + its README + your git history + one *small second project* built solo from scratch (a weekend-scale idea of your own) to prove RankOS wasn't a one-off.
- Write 3–5 short posts (or long READMEs): "A bug where the frontend said 'today' and the backend believed it", "Adding realtime presence to an Express app". Explaining in public is both study and marketing.
- Interview prep: rehearse walking through RankOS's architecture in 5 minutes; practice the debugging loop out loud on a planted bug; do mock behavioral answers about *how you learned* — a self-taught developer's learning story is a feature, not an apology.
- Apply: junior/associate roles, internships, apprenticeships, freelance fixes. Expect silence and rejections as the *default* and keep shipping meanwhile — the person still improving in month 6 is the one who gets hired in month 8.

**Throughout, weekly:** one revision-log entry (section 2), one `git log` review, one thing explained out loud to nobody.

---

## The last word

Six months ago the sentence `router.get("/stats", tasksController.getStats)` would have been hieroglyphics. Now you can write it, test it, document it, debug it, and explain why it lives in that file and not another. Nothing about the next six months is different in kind — only in scope. Keep the loop: build → break → read → fix → explain. That loop *is* the job.

**Solutions and sketches:** [SOLUTIONS.md](SOLUTIONS.md)
