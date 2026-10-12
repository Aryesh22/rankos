# Module 5.2 — React Fundamentals

> **Goal:** Understand components, JSX, props, state, events, rendering, effects and controlled inputs — not from a toy counter app, but from the real components running in `rankos-ai-mentor/src/`. By the end you should be able to open `test.$testId.tsx` (a 314-line exam simulator) and explain every moving part.

---

## Concepts

### 1. A component is a function that returns UI

React's whole idea: UI = f(state). A component is a plain function that takes inputs (**props**) and returns a description of UI (**JSX**). React calls the function, gets the description, and syncs the real DOM to match. When inputs or state change, React calls the function again ("re-render") and updates only what differs.

The smallest real one in your app, `rankos-ai-mentor/src/components/app/PageHeader.tsx`, is *the whole file*:

```tsx
export function PageHeader({ eyebrow, title, description, actions }: {...}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4 animate-fade-up">
      <div>
        {eyebrow && <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
```

No state, no magic. Props in → JSX out. Every dashboard page renders one of these.

### 2. JSX rules

JSX looks like HTML but is JavaScript:

- **One root element** per return (or a fragment `<>...</>`).
- **`className`**, not `class`; **`htmlFor`**, not `for` (those are JS reserved words).
- **`{}` embeds any expression**: `{title}`, `{doneCount} of {tasks.length}`, `{seconds > 0 ? <a/> : <b/>}` — expressions, not statements (no `if`/`for` inside braces; use ternaries, `&&`, `.map()`).
- **Components must be Capitalized.** `<PageHeader />` is your component; `<pageheader />` would be treated as an unknown HTML tag.
- Attributes are camelCase: `onClick`, `strokeWidth`, `tabIndex`.

### 3. Props: read-only inputs

Props flow **down** the tree, parent → child, and a child must never mutate them. In `app.index.tsx`:

```tsx
<StatCard label="Current streak" value={student?.streak ?? 0} suffix=" days" icon={Flame} tone="warning" hint={...} />
```

Strings can be quoted; anything else goes in braces — numbers, objects, even *components* (`icon={Flame}` passes the Flame component itself as data; `StatCard` later renders it as `<Icon />`). `children` is just a special prop: whatever you nest between tags. `AppLayout` receives the entire page as `children`.

### 4. State: `useState`

Props come from outside; **state** is a component's own memory that survives re-renders. From `AppLayout.tsx`:

```tsx
const [open, setOpen] = useState(false);
```

- `open` — current value; `setOpen` — the only legal way to change it.
- Calling `setOpen(true)` does two things: stores the new value, and **schedules a re-render** of this component (and its children).
- Updating based on the previous value should use the function form. From `login.tsx`: `setShow((s) => !s)` — safe even if React batches multiple updates.
- State is **per component instance** and **local**: nothing outside knows `open` exists.

### 5. The rendering model

- Render = React calling your function again. All the `const`s inside are recomputed; the JSX is rebuilt; React *diffs* it against the previous output and patches the DOM minimally.
- A re-render of a parent re-renders its children by default (usually fine — rendering is cheap; DOM patching is what's expensive and React minimizes that).
- **Keys in lists**: when you render an array with `.map()`, each item needs a stable `key` so React can match old and new items across renders. From `app.index.tsx`:
  ```tsx
  {tasks.map((t) => (
    <li key={t.id}> ... </li>
  ))}
  ```
  `t.id` is stable per task — if the list reorders, React moves DOM nodes instead of destroying and recreating them (which would also wipe any DOM state like focus). Index-as-key is only acceptable for static lists that never reorder — your codebase does use `key={i}` for skeleton placeholders and the AI recommendation bullets, which is fine *because those lists never reorder in place*.

### 6. Events

Pass a function to `onClick` / `onChange` / `onSubmit` etc.:

```tsx
<button onClick={() => setOpen(false)} aria-label="Close navigation">
```

Note it's `onClick={() => setOpen(false)}`, **not** `onClick={setOpen(false)}` — the latter would *call* the function during render. You pass a function; React calls it later with the event object.

### 7. Conditional rendering

Three idioms, all used constantly in this codebase:

```tsx
{eyebrow && <p>...</p>}                       // render-if           (PageHeader.tsx)
{show ? <EyeOff .../> : <Eye .../>}           // either/or           (login.tsx)
if (!q) { return <LoadingScreen/>; }          // early return        (test.$testId.tsx)
```

And the three-way version, straight from the dashboard's mentor card (`app.index.tsx`):

```tsx
{recommendations.isLoading ? (
  <div className="mt-3 space-y-2"><Skeleton .../><Skeleton .../></div>
) : recommendations.isError || !recs || recs.items.length === 0 ? (
  <p>No focus recommendations yet — ...</p>
) : (
  <> ... the real list ... </>
)}
```

Loading → empty/error → data. Memorize this shape; every data-driven UI is a variant of it.

### 8. `useEffect`: escaping React

Effects run code *after* render, for things React doesn't manage: timers, event listeners on `window`, network kicks, DOM APIs. Signature:

```tsx
useEffect(() => { ...side effect...; return () => { ...cleanup... }; }, [deps]);
```

- `[]` — run once after mount, cleanup on unmount.
- `[a, b]` — run after mount *and* whenever `a` or `b` changes.
- omitted — run after **every** render.
- The returned cleanup runs before the next execution and on unmount.

### 9. Lifting state up

When two components need the same state, move it to their closest common parent and pass it down as props + callbacks. In `AppLayout.tsx`, `open` lives in the layout because *three* things use it: the sidebar (`translate-x`), the overlay (existence), and the hamburger button (setter).

### 10. Controlled inputs

An input is **controlled** when React state is the single source of truth: `value={code}` + `onChange={setCode}`. The DOM shows whatever state says; typing fires `onChange`, which updates state, which re-renders with the new value. `verify-otp.tsx` is a perfect controlled component (`InputOTP value={code} onChange={setCode}`). The alternative — *uncontrolled* inputs, where the DOM holds the value — is what `react-hook-form` uses under the hood in `login.tsx` for performance (Module 5.5).

---

## In your codebase

### Case study A: `RingProgress.tsx` — pure props, no state

`rankos-ai-mentor/src/components/ui-kit/RingProgress.tsx` renders the circular progress dial on the dashboard:

```tsx
export function RingProgress({ value, size = 96, stroke = 8, label, sublabel, className, tone = "primary" }: {...}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  ...
  <circle ... strokeDasharray={c} strokeDashoffset={c - (c * value) / 100} ... />
```

Everything is derived from props with plain math (circumference, dash offset) *during render*. No state, no effect. Notice **default values** in the destructuring (`size = 96`) — that's how optional props get defaults. When the dashboard re-renders with a new `value`, this function reruns, computes a new `strokeDashoffset`, and the CSS `transition-[stroke-dashoffset] duration-1000` animates the ring. Lesson: **if you can compute it from props/state, compute it in render — don't store it.**

### Case study B: `AppLayout.tsx` — one boolean, three consumers

```tsx
const [open, setOpen] = useState(false);
...
<aside className={cn("... lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
...
{open && <div className="fixed inset-0 z-40 ..." onClick={() => setOpen(false)} />}
...
<Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
```

Trace a tap on the hamburger: `setOpen(true)` → re-render → the ternary now yields `translate-x-0` (sidebar slides in, CSS animates it) *and* `open && ...` now renders the overlay. Tap the overlay → `setOpen(false)` → both revert. State drives everything; no imperative "show/hide" calls.

Also note nav items are **data, mapped to JSX** — the `nav` array of `{ group, items }` at the top of the file, rendered with nested `.map()`s and `key={section.group}` / `key={item.to}`. Adding a page to the sidebar = adding an object to an array.

### Case study C: `verify-otp.tsx` — controlled input + a countdown effect

```tsx
const [code, setCode] = useState("");
const [seconds, setSeconds] = useState(RESEND_SECONDS);

useEffect(() => {
  if (seconds === 0) return;
  const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
  return () => clearTimeout(t);
}, [seconds]);
```

This countdown is beautifully idiomatic: each render schedules **one** timeout; when it fires, `seconds` decreases, the effect re-runs (its dependency changed), schedules the next tick — and cleanup clears the pending timeout if the component unmounts mid-count. The render then *derives* UI from state:

```tsx
{seconds > 0 ? <span>Resend code in 00:{String(seconds).padStart(2, "0")}</span>
             : <button onClick={() => resend.mutate()} ...>Resend code</button>}
```

And the controlled OTP input: `value={code} onChange={setCode} onComplete={() => verify.mutate()}` — with the submit button *derived* as `disabled={code.length !== 6 || verify.isPending}`.

### Case study D: `test.$testId.tsx` — the heavyweight

The exam simulator holds seven pieces of state:

```tsx
const [questions, setQuestions] = useState<AttemptQuestion[]>([]);
const [attemptId, setAttemptId] = useState<string | null>(null);
const [idx, setIdx] = useState(0);
const [answers, setAnswers] = useState<Record<number, number>>({});
const [status, setStatus] = useState<Record<number, Status>>({});
const [marked, setMarked] = useState<Record<number, boolean>>({});
const [seconds, setSeconds] = useState(120 * 60);
```

Things to learn from it:

1. **Immutable updates.** State objects are never mutated — they're replaced:
   ```tsx
   setAnswers((a) => ({ ...a, [q.id]: opt }));
   ```
   Spread the old object, override one key. React detects change by reference (`old !== new`); mutating `a[q.id] = opt` in place would keep the same reference and React could skip the re-render.
2. **Run-once guard with a ref:**
   ```tsx
   const startedRef = useRef(false);
   useEffect(() => {
     if (startedRef.current) return;
     startedRef.current = true;
     startAttempt(testId).then((res) => { setAttemptId(res.attemptId); setQuestions(res.questions); ... });
   }, [testId]);
   ```
   `useRef` is a box whose `.current` you can mutate *without* causing re-renders. Here it stops `startAttempt` from firing twice (React 18+ StrictMode deliberately double-invokes effects in dev to expose exactly this class of bug).
3. **A ticking timer** — `useEffect(() => { const t = setInterval(...); return () => clearInterval(t); }, [])` — one interval for the whole life of the component, decrementing with the function form `setSeconds((s) => (s > 0 ? s - 1 : 0))`.
4. **A window listener with a deliberate quirk:**
   ```tsx
   useEffect(() => {
     const onKey = (e: KeyboardEvent) => { ... if (["1","2","3","4"].includes(e.key)) pick(Number(e.key) - 1); };
     window.addEventListener("keydown", onKey);
     return () => window.removeEventListener("keydown", onKey);
   });   // ← NO dependency array
   ```
   With no deps, this re-subscribes after *every* render — inefficient but *correct*, because `onKey` closes over `q`, `marked`, `status`; a `[]` array would freeze it over the first render's values (the notorious **stale closure** bug: pressing "1" would always answer question 1). The clean fixes are listing deps or `useEffectEvent`; the codebase chose the pragmatic "always fresh" version.
5. **Derived values, not state:** `const q = questions[idx]`, `const answered = Object.keys(answers).length`, the `hh:mm:ss` strings — all computed in render.
6. **Early return for loading:** `if (!q) return <skeletons/>` — the rest of the function can then assume `q` exists.

### Case study E: a genuine anti-pattern to recognize — `app.index.tsx`

```tsx
const [tasks, setTasks] = useState<StudyTask[]>([]);
useEffect(() => {
  if (data?.todayPlan) setTasks(data.todayPlan);
}, [data]);
```

The dashboard *copies server data into local state* so the checkbox toggle can flip `done` instantly:

```tsx
const onToggle = (task: StudyTask) => {
  setTasks((prev) => prev.map((p) => (p.id === task.id ? { ...p, done: !p.done } : p)));
  toggleTask.mutate(task);
};
```

This works (it's a hand-rolled optimistic update), but "mirror props/query-data into state with an effect" is a documented React anti-pattern: two sources of truth that can drift, plus an extra render per sync. Module 5.4 shows the canonical React Query alternative (`onMutate` + cache update + rollback). Recognizing *why* this is fragile is a mastery checkpoint.

---

## Pitfalls & gotchas

1. **Calling instead of passing:** `onClick={submit()}` runs during render (and every render). Write `onClick={submit}` or `onClick={() => submit(arg)}`.
2. **State updates are asynchronous-ish.** After `setIdx(3)`, `idx` is *still the old value* in the same function run; the new value appears on the next render. Need sequential updates? Use the function form.
3. **Mutating state silently breaks rendering.** `tasks[0].done = true; setTasks(tasks)` — same array reference, possibly no re-render, definitely stale-props bugs downstream. Always create new objects/arrays (`.map`, spread, `.filter`).
4. **Missing/wrong keys.** Symptoms: inputs losing focus, animations restarting, list items showing the wrong data after a sort. Rule: stable, unique, from the data (`t.id`), not `Math.random()` (that forces a full remount every render).
5. **`useEffect` for things that aren't effects.** Deriving data (`doneCount`), formatting, filtering — do it in render. Effects are for the outside world only. Case study E shows how effect-synced state creates subtle bugs.
6. **Stale closures in `[]` effects.** If an effect (or its listener) uses a state variable, that variable belongs in the dependency array — or you'll capture its mount-time value forever. `eslint-plugin-react-hooks` (installed in this project — see `package.json`) warns about this; don't silence it casually.
7. **Rules of Hooks:** call hooks only at the top level of a component/custom hook — never inside `if`, loops, or callbacks. That's why `test.$testId.tsx` declares all seven `useState`s unconditionally *before* the `if (!q) return` early-exit. Putting a hook after a conditional return is the same bug in disguise.
8. **Effects run twice in dev (StrictMode).** Not a bug — a test. If double-running an effect breaks your app (duplicate POST, double subscription), the effect lacks cleanup or a guard, like `startedRef` in the test screen.

---

## Exercises

Solutions in [SOLUTIONS.md](./SOLUTIONS.md#module-52).

1. **Predict:** In `verify-otp.tsx`, the resend button calls `resend.mutate()`, whose `onSuccess` calls `setSeconds(RESEND_SECONDS)`. Walk through what happens next, render by render, until the countdown reaches 0. How many timeouts exist at any moment?
2. **Predict:** In `test.$testId.tsx`, what exactly happens in the UI when you press the "3" key? List every piece of state that changes and every visual consequence (option highlight, palette color, header count).
3. **Spot the derivation:** `app.index.tsx` computes `doneCount`, `planPct`, and `firstName`. Why are these *not* `useState`? What would go wrong if `planPct` were state updated inside `onToggle`?
4. **Keys:** In `AppLayout.tsx`, the nav uses `key={section.group}` and `key={item.to}`. In `app.index.tsx`, the recommendation bullets use `key={i}`. Explain why each choice is (or isn't) safe, and describe a data change that would make `key={i}` misbehave.
5. **Hands-on (safe):** In `PageHeader.tsx`, temporarily change `{title}` to `{title.toUpperCase()}` and watch every page heading change via hot reload. Which components re-rendered? Revert.
6. **Hands-on (safe):** In `verify-otp.tsx`, change `const RESEND_SECONDS = 28` to `5`, load `/signup` → submit (it will fail without a backend — instead, visit `/verify-otp?userId=x` directly) and watch the countdown. Revert. Why does visiting without `userId` redirect you to `/signup`? (Read the route's `beforeLoad`.)
7. **Refactor on paper:** The password-visibility toggle in `login.tsx` (`show` / `setShow`) — rewrite it as a reusable `<PasswordInput>` component that owns its own state. What props must it forward for `react-hook-form`'s `{...register("password")}` to keep working?
8. **Bug hunt:** Suppose someone "optimizes" the keydown effect in `test.$testId.tsx` by adding `[]` as the dependency array. Describe precisely the bug that appears when answering question 5 with the keyboard, and two correct fixes.

---

**Next:** [Module 5.3 — TypeScript for React](./03-typescript-for-react.md) — the types that make all these props and states checkable before you even run the app.
