# Lesson 2 — JavaScript Basics

> **Goal:** read a JavaScript file without panicking. Both your backend and
> frontend are written in JavaScript (the frontend in **TypeScript**, which is
> JavaScript + type labels — same language underneath).

JavaScript ("JS") started as the browser's language; **Node.js** later let it run
on servers too. That's why one language powers your whole app.

## 1. Variables — named boxes for values

```js
const name = "Aryesh";     // const = can't be reassigned (use this by default)
let score = 10;            // let = can be reassigned later
score = 12;                // fine
```

Values come in a few types: strings (`"text"`), numbers (`42`), booleans
(`true`/`false`), and two special "nothing" values (`null`, `undefined`).

## 2. Objects and arrays — how data is grouped

```js
// An object: labeled fields describing one thing (just like JSON!)
const task = {
  title: "Revise thermodynamics",
  subject: "Physics",
  done: false,
};

// Reading a field:
task.title            // "Revise thermodynamics"

// An array: an ordered list
const subjects = ["Physics", "Chemistry", "Maths"];
subjects[0]           // "Physics"  (counting starts at 0!)
subjects.length       // 3
```

## 3. Functions — reusable recipes

```js
// A function takes inputs, does work, returns an output.
function minutesToHours(minutes) {
  return minutes / 60;
}
minutesToHours(90);   // 1.5

// Modern "arrow" shorthand — same idea, you'll see this constantly:
const minutesToHours = (minutes) => minutes / 60;
```

## 4. If / loops — making decisions and repeating

```js
if (score >= 90) {
  console.log("Top rank!");     // console.log prints to the terminal
} else {
  console.log("Keep going");
}

// Loop over an array:
for (const subject of subjects) {
  console.log(subject);
}

// The functional style you'll see more often in this codebase:
const upper = subjects.map((s) => s.toUpperCase());   // transform each item
const done  = tasks.filter((t) => t.done);            // keep items that pass a test
```

## 5. `async` / `await` — the big one ⭐

Some operations take time: reading a database, calling another server. JavaScript
doesn't freeze while waiting — it marks such functions `async` and you `await`
their results:

```js
async function getTasks(userId) {
  const tasks = await StudyTask.find({ user: userId });  // "pause here until DB answers"
  return tasks;
}
```

Look at `backend/src/index.js` lines 16–24 — `bootstrap()` is `async` and
`await`s the database connection before opening the doors. Every controller and
service in your backend uses this pattern. If you learn one thing deeply from
this lesson, make it this one.

## 6. Modules — files sharing code with each other

Each file can **export** things and **import** things from other files:

```js
// config/logger.js
export const logger = ...;

// index.js
import { logger } from "./config/logger.js";
```

Open `backend/src/index.js` — lines 1–11 are all imports. That's how a big app
stays organized: many small files, each with one job, wired together by imports.

Packages from the internet (installed via `npm`, Lesson 8) are imported by name
instead of path: `import express from "express"`.

## 7. Reading real code: annotated example

From your actual `backend/src/routes/tasks.routes.js`:

```js
import { Router } from "express";                    // import a tool from the express package
import { authenticate } from "../middlewares/authenticate.js";
import * as tasksController from "../controllers/tasks.controller.js";  // import EVERYTHING as one object

const router = Router();                             // create a router object

router.use(authenticate);                            // "every route below requires login"
router.get("/", tasksController.listTasks);          // GET /tasks    → run listTasks
router.post("/", tasksController.createTask);        // POST /tasks   → run createTask

export default router;                               // share it with routes/index.js
```

You can now genuinely read that file. That's progress!

## A note on TypeScript (your frontend)

Files ending `.ts`/`.tsx` are TypeScript: JavaScript plus **type annotations** —
labels saying what kind of value something is:

```ts
function minutesToHours(minutes: number): string {
  return (minutes / 60) + "h";
}
```

The `: number` and `: string` parts are erased when the code runs; they exist so
your editor can catch mistakes early (like passing text where a number belongs).
Read TypeScript as "JavaScript with helpful labels."

---

## ✏️ Exercises

1. In `backend/src/index.js`, find one `const`, one `async function`, one `await`,
   and one arrow function. (All four are there.)
2. What does this return? `["a","b","c"].map((x) => x.toUpperCase())`
3. Write a function `overdueTasks(tasks)` that takes an array of task objects
   (each with a `done` boolean) and returns only the unfinished ones.
   Hint: `.filter`.
4. **Run real JavaScript:** in a terminal type `node`, press Enter, and try:
   ```js
   const me = { name: "you", learning: true };
   me.name
   [1,2,3].map(n => n * 10)
   ```
   (Type `.exit` to leave.) You just used Node.js directly.

**Next:** [Lesson 3 — Tour of Your Project](03-project-tour.md)
