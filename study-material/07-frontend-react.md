# Lesson 7 — The Frontend (React)

> **Goal:** understand how `rankos-ai-mentor/` turns backend data into screens,
> and how the two halves of your app actually connect.

## What the browser natively understands

- **HTML** — the *structure* of a page (headings, buttons, lists)
- **CSS** — the *appearance* (colors, spacing, layout)
- **JavaScript** — the *behavior* (what happens on click)

You could build an app with just those… but keeping the screen in sync with
changing data by hand becomes a nightmare. Enter React.

## React in one idea: UI = f(data)

**React** (the library your frontend uses) lets you declare: *"given this data,
the screen looks like this."* When data changes, React re-renders the affected
parts automatically. You never manually say "now update that checkbox" — you
change the data, the UI follows.

You write **components** — reusable UI pieces defined as functions returning
HTML-like markup (this hybrid syntax is called **JSX**, hence `.tsx` files):

```tsx
function TaskCard({ task }) {
  return (
    <div className="task-card">
      <input type="checkbox" checked={task.done} />
      <span>{task.title}</span>          {/* curly braces = insert JS value */}
      <span>{task.minutes} min</span>
    </div>
  );
}

// Used like a custom HTML tag, once per task:
<TaskCard task={someTask} />
```

Components receive data through **props** (the `task` above) and hold their own
changing data in **state**. When state changes, React re-renders. That's the
whole engine.

Your `src/components/` folder is full of these — including a `ui/` set of
polished building blocks (buttons, dialogs, tabs) from **Radix UI + shadcn**,
styled with **Tailwind CSS** (utility classes like `className="flex gap-2 p-4"`
instead of separate CSS files).

## Pages: `src/routes/`

Your frontend uses **TanStack Router**, where *files = pages*:

| File | URL | Screen |
|---|---|---|
| `routes/login.tsx` | `/login` | login page |
| `routes/app.planner.tsx` | `/app/planner` | study planner |
| `routes/app.leaderboard.tsx` | `/app/leaderboard` | leaderboard |
| `routes/test.$testId.tsx` | `/test/42` | taking test #42 — `$testId` is a URL parameter |

`app.tsx` is the shared frame (sidebar/header) that all `app.*` pages render
inside. This is called **client-side routing**: switching pages swaps components
in place — no full page reload, which is why modern apps feel instant.

## Talking to the backend: `src/services/`

Here's the frontend end of the phone call from Lesson 4 — real code from
`src/services/tasks.ts`:

```ts
/** List tasks for a given day. */
export function getTasks(date = "today"): Promise<TaskListResponse> {
  return apiFetch<TaskListResponse>(`/tasks?date=${date}`);
}

/** Toggle a single task — backs the checkbox. */
export function updateTask(taskId: string, patch: { done: boolean }) {
  return apiFetch(`/tasks/${taskId}`, { method: "PATCH", body: patch });
}
```

`apiFetch` (in `src/lib/api.ts`) is a small wrapper around the browser's `fetch`
that prepends the backend URL, sends the session cookie along, and parses JSON.
(Your app keeps the login token in an **httpOnly cookie** the browser attaches
automatically — the frontend never touches the token itself. Module m4 ch.2
explains why that's the safer design.)
Compare `updateTask` here with `patchTask` in
`backend/src/controllers/tasks.controller.js` — **same URL, same verb, same
body shape.** Two ends, one contract (`API_SPEC.md`).

## React Query: the data manager

Notice `queryOptions` in that file — that's **TanStack React Query**, which
manages *server data* for you: it caches responses, shows stale data instantly
while re-fetching in the background, dedupes identical requests, and handles
loading/error states. A page uses it like:

```tsx
const { data, isLoading } = useQuery(tasksQueryOptions("today"));
if (isLoading) return <Spinner />;
return data.data.map((task) => <TaskCard key={task.id} task={task} />);
```

The `queryKey: ["tasks", date]` is the cache label — ask for the same key twice,
get the cache instead of a second network trip.

## One heads-up: `mockData.ts`

`src/services/mockData.ts` contains **fake data** the frontend was developed
against before the backend existed. Good news (verified in Module m5): all the
service files now call real API endpoints, and `mockData.ts` is **dead code** —
nothing imports it anymore. It's still worth opening once: it shows you exactly
what shape of data every screen was designed around.

## The full journey, both lessons combined

```
User ticks a checkbox on /app/planner
  → component calls updateTask("123", { done: true })         (frontend service)
  → PATCH /api/tasks/123 with auth token                      (HTTP)
  → backend: middleware → route → controller → service → DB   (Lesson 4)
  ← { "id": "123", "done": true }
  → React Query updates its cache → React re-renders → ✓ appears
```

You now understand every arrow in that diagram. That's the entire trade in one
picture — everything else is refinement.

---

## ✏️ Exercises

1. Open `src/routes/app.planner.tsx`. Don't try to understand every line — just
   find: one component being rendered, one hook (a function starting with
   `use...`), and where task data enters.
2. Open `src/lib/api.ts`. Where does the backend's base URL come from? Where is
   the auth token attached?
3. In `src/services/`, find the function the login page calls, then find the
   matching backend route in `backend/src/routes/auth.routes.js`. Do the two
   ends agree? (Recall the known mismatch from Lesson 6…)
4. **See it live** (after Lesson 9): run the frontend, open the browser's
   DevTools → Network tab, click around, and watch the actual HTTP requests fly.
   This is the single most instructive thing you can do.

**Next:** [Lesson 8 — Tools of the Trade](08-tools-of-the-trade.md)
