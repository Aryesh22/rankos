# Module 5.3 — TypeScript for React

> **Goal:** Read and write the TypeScript that holds this app together: the domain types in `src/types/index.ts`, prop typing, `interface` vs `type`, unions, optional fields, narrowing — and a full line-by-line walkthrough of the generic `apiFetch<T>` client in `src/lib/api.ts`, the single most important file in the frontend.

---

## Concepts

### 1. Why TypeScript

JavaScript happily lets you write `user.nmae` and only tells you at runtime (`undefined`). TypeScript adds a *compile-time* type layer: you declare the shape of data once, and the editor/compiler checks every use. In React this pays off doubly — props are function parameters, so typing props means the compiler checks every `<StatCard ...>` call site in the app. TypeScript is erased at build time; it has **zero** runtime cost and zero runtime power (it cannot validate a server response — remember that for later).

### 2. The basic vocabulary

```ts
let n: number = 5;
let s: string;
let ok: boolean;
let ids: string[];                  // array of strings
let pair: [number, string];        // tuple
function f(x: number): string {...} // param + return types
```

Most of the time you don't annotate — TypeScript **infers**: `const c = 2 * Math.PI * r` is a `number` without saying so. Annotate at *boundaries*: function parameters, API responses, empty containers (`useState<StudyTask[]>([])` — without the annotation an empty array is `never[]`).

### 3. `interface` vs `type`

Both describe object shapes and are interchangeable 95% of the time:

```ts
interface StudyTask { id: string; ... }     // extendable, mergeable
type Difficulty = "Easy" | "Medium" | "Hard"; // aliases anything: unions, primitives, functions
```

Rules of thumb (which this codebase follows): **`interface` for object shapes** (`StudyTask`, `User`, `ButtonProps`), **`type` for unions and aliases** (`ExamTrack`, `Role`, `Json`). Only `type` can name a union; only `interface` can be `extends`-ed and declaration-merged.

### 4. Union types & literal types

```ts
export type Difficulty = "Easy" | "Medium" | "Hard";
```

A value of this type may be *only* those three exact strings. This is TypeScript's superpower for domain modeling — invalid states become unrepresentable. Pass `difficulty="hard"` (lowercase) anywhere and the compiler rejects it.

### 5. Optional fields & `undefined`

```ts
scheduledFor?: string;   // may be absent
```

`?` means "string or undefined". The compiler then *forces* you to handle absence: `t.scheduledFor.length` is an error until you check. Tools for that: optional chaining `student?.streak`, nullish coalescing `?? 0`, and plain `if` checks.

### 6. Narrowing

TypeScript tracks control flow. Inside `if (typeof x === "string")`, `x` *is* a string. Ways to narrow, all used in this project:

- `typeof window === "undefined"` (server check in `lib/auth.ts`)
- `error instanceof ApiError` (class check in `login.tsx`)
- truthiness: `if (!q) return ...` — after this, `q` is defined
- discriminated unions & custom **type guards** (below)

### 7. Generics

A generic is a type-level function parameter. `Promise<User>` = "a promise that resolves to a User". You write one when a function's *output type depends on the caller's intent* — exactly what an HTTP client needs: `apiFetch<User>("/auth/me")` returns `Promise<User>`; `apiFetch<TaskListResponse>("/tasks?...")` returns `Promise<TaskListResponse>`. One implementation, per-call-site types.

---

## In your codebase

### The domain types — `rankos-ai-mentor/src/types/index.ts` (121 lines, read it all)

The file opens with two **union types**:

```ts
export type ExamTrack = "JEE" | "NEET" | "UPSC" | "GATE" | "CAT" | "SSC" | "Banking";
export type Difficulty = "Easy" | "Medium" | "Hard";
```

Note how `ExamTrack` reappears in `src/lib/auth-schemas.ts` as a *runtime* array — `EXAM_OPTIONS = ["JEE", "NEET", ...] as const` — because TypeScript types don't exist at runtime; when you need both (render buttons *and* type-check), you define the array once and derive from it.

Then the core entity:

```ts
export interface StudyTask {
  id: string;
  title: string;
  subject: string;
  minutes: number;
  type: "Concept" | "Practice" | "Revision" | "Mock" | "Analysis";
  done: boolean;
  time: string;
}
```

- An **inline union** for `type` — the five planner categories. The dashboard renders it straight into a badge (`{t.type}` in `app.index.tsx`); the compiler guarantees it's one of five known strings.
- Every field required — a task always has all of these.

Contrast with `TestSummary`, which models a test that may be upcoming *or* completed:

```ts
export interface TestSummary {
  id: string;
  title: string;
  exam: ExamTrack;          // composition: one type built from another
  subjects: string[];
  questions: number;
  durationMin: number;
  difficulty: Difficulty;
  scheduledFor?: string;    // only for upcoming
  attemptedOn?: string;     // only for history
  score?: number;
  maxScore: number;
  percentile?: number;
  accuracy?: number;
}
```

The optional fields encode the lifecycle: an upcoming test has `scheduledFor` but no `score`. (A stricter design would be a discriminated union — `{ status: "upcoming"; scheduledFor: string } | { status: "attempted"; score: number; ... }` — this codebase chose the simpler optional-fields style; worth knowing both.)

`Mistake` shows how far literal unions go in this app: a seven-way `category` union (`"Concept Error" | "Formula Error" | ... | "Careless Mistake"`), `priority: "High" | "Medium" | "Low"`, `status: "Pending" | "Revised" | "Mastered"`. Every filter tab and color mapping in `app.mistakes.tsx` keys off these.

The auth section mirrors the API contract *explicitly* — read the doc comments:

```ts
export type Role = "student" | "parent" | "teacher" | "admin";

/** The authenticated user, mirroring `GET /api/auth/me` (see API_SPEC.md). ... */
export interface User {
  id: string;
  role: Role;
  name: string;
  initials: string;   // "Two-letter monogram used in the avatar chip"
  email: string;
  exam: ExamTrack;
  examLabel: string;
  institute?: string;
  state?: string;
  streak: number;
}

/** Shared response for `login` and `verify-otp` — JWT + the resolved user. */
export interface AuthSession { token: string; user: User; }

/** Normalised error envelope: `{ error: { code, message, fields? } }`. */
export interface ApiErrorBody {
  error: { code: string; message: string; fields?: Record<string, string>; };
}
```

**How types mirror the specs:** `API_SPEC.md` states "Field names mirror `src/types/index.ts` so the client can drop in with minimal mapping," and `DATABASE_SCHEMA.md` derives its MongoDB collections from these same types (`studyTasks` "(from `StudyTask` / `todayPlan`)", `tests` "(from `TestSummary`...)"). The chain is: **DB schema → API response JSON → `src/types` → component props.** One vocabulary end-to-end. When `User.role` is `Role`, the sidebar's role filtering in `AppLayout.tsx` (`item.roles.includes(user.role)`) is checked against the exact same four strings the spec's auth section defines.

`Record<string, string>` is worth pausing on: a built-in **utility type** meaning "object with any string keys, string values" — used for the per-field validation errors. Other utility types you'll meet: `Partial<T>`, `Pick<T, K>`, `Omit<T, K>`.

Per-service response types live next to their fetchers, not in `types/index.ts` — e.g. `DashboardResponse`, `WeeklyGoal`, `ScoreTrendPoint` in `src/services/dashboard.ts`, and `AttemptQuestion`, `StartAttemptResponse`, `AttemptResult` in `src/services/tests.ts`. Shared domain nouns are central; endpoint envelopes are local. Good architecture to imitate.

### Line-by-line: `rankos-ai-mentor/src/lib/api.ts` (the whole file)

```ts
import type { ApiErrorBody } from "@/types";
```
`import type` — erased at compile time, guaranteed to add zero runtime code. `@/` is the path alias for `src/` (configured in `tsconfig.json` + `vite-tsconfig-paths`).

```ts
const API_BASE = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/+$/, "");
```
Environment variable with a fallback: use `VITE_API_URL` if set, else same-origin `/api`; strip trailing slashes. Inferred type: `string`.

```ts
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string>;

  constructor(message: string, status: number, code = "ERROR", fields?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    ...
  }
}
```
A custom error class carrying *structured* failure data. `readonly` = can't be reassigned after construction. `code = "ERROR"` is a default parameter; `fields?` an optional one. Because it's a class (runtime construct), you can use `instanceof` on it — which is exactly what the next function does:

```ts
export function isApiError(error: unknown, status?: number): error is ApiError {
  return error instanceof ApiError && (status === undefined || error.status === status);
}
```
Two big ideas in one line of signature:
- **`unknown`** — the type of "I have no idea". In `catch` blocks, errors are `unknown` (anything can be thrown). Unlike `any`, `unknown` forbids all use until you narrow it. Always prefer it.
- **`error is ApiError`** — a **type-guard return type**. When this returns `true`, TypeScript *narrows* the argument at the call site. See it working in `src/lib/auth.ts`: `if (!isApiError(error, 401)) { console.warn(...) }` — a 401 is treated as "logged out", everything else logged.

```ts
type Json = Record<string, unknown> | unknown[];

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: Json;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}
```
The `method` union means a typo like `"PSOT"` fails to compile. Every field optional → a bare `apiFetch("/auth/me")` works. `AbortSignal` lets callers cancel in-flight requests — React Query passes one so abandoned pages don't waste bandwidth (Module 5.4).

```ts
function safeParse(text: string): unknown {
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}
```
Defensive parse returning `unknown` — "some JSON, shape unverified."

Now the star:

```ts
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
```
- `<T>` — the caller names the expected response type.
- `async` → the return is always a `Promise`; declared as `Promise<T>`.
- `options = {}` — default so `signal`/`method` destructure cleanly.

```ts
  const { method = "GET", body, signal, headers } = options;
```
Destructuring with a per-field default.

```ts
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: "include",
      signal,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0, "NETWORK_ERROR");
  }
```
- `credentials: "include"` — send the **httpOnly session cookie** on every request. This is how auth travels (Module 5.4 covers the implications).
- Conditional spread `...(cond ? {...} : {})` — only set `Content-Type` when there *is* a body.
- The catch narrows with `instanceof DOMException` to re-throw cancellations untouched (React Query must see aborts as aborts) and converts every other network failure into a *uniform, user-readable* `ApiError` with status `0`.

```ts
  if (response.status === 204) return undefined as T;
```
204 No Content (e.g. `POST /auth/logout`). `undefined as T` is an honest little **type assertion** — the caller declared `apiFetch<void>`, so `T` is `void` and `undefined` is correct; the compiler just can't prove it, so we assert.

```ts
  const payload = safeParse(await response.text());

  if (!response.ok) {
    const envelope = (payload as ApiErrorBody | null)?.error;
    throw new ApiError(
      envelope?.message ?? response.statusText ?? "Request failed",
      response.status,
      envelope?.code ?? "ERROR",
      envelope?.fields,
    );
  }

  return payload as T;
```
- On failure, the body is *asserted* as the standard envelope from API_SPEC.md ("Standard error body: `{ "error": { "code", "message", "fields"? } }`"), then unpacked with optional chaining + `??` fallbacks at every level — resilient even to an empty body.
- On success: `payload as T`. **This is the load-bearing assertion of the whole app.** TypeScript cannot check network data; `apiFetch<User>` *trusts* the server to return a `User`. If the backend sends the wrong shape, the compiler won't save you — runtime validation (e.g. Zod parsing responses) would, but this codebase uses Zod only for form input (`auth-schemas.ts`), a common and pragmatic trade-off. Know where your guarantees end.

### Generics at the call sites

From `src/services/auth.ts` and `src/services/tasks.ts`:

```ts
me(signal?: AbortSignal): Promise<User> {
  return apiFetch<User>("/auth/me", { signal });
}

export function updateTask(taskId: string, patch: { done: boolean }): Promise<TaskToggleResult> {
  return apiFetch<TaskToggleResult>(`/tasks/${taskId}`, { method: "PATCH", body: patch });
}
```

Each wrapper pins `T` once, so components never touch `apiFetch` directly and get full autocomplete on results. Inline object types (`patch: { done: boolean }`) are fine for one-off shapes.

### Typing React props

Three real styles in this codebase, from simplest to most advanced:

```tsx
// 1. Inline object type (PageHeader.tsx, StatCard.tsx, RingProgress.tsx)
export function StatCard({ label, value, tone = "default", ... }: {
  label: string;
  value: number;
  tone?: "default" | "primary" | "success" | "warning" | "danger";
  icon?: LucideIcon;                 // a *component type* as a prop
  ...
}) { ... }

// 2. children and component types (AppLayout.tsx)
export function AppLayout({ children }: { children: ReactNode }) { ... }
interface NavItem {
  to: string; label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  roles?: Role[];
}

// 3. Extending native element props (components/ui/button.tsx)
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}
```

Style 3 is the shadcn pattern: `ButtonProps` = *everything a real `<button>` accepts* (onClick, disabled, type, aria-…) **plus** the variant props *derived from the cva definition itself* (`VariantProps<typeof buttonVariants>` — a generic that extracts `variant?: "default" | "destructive" | ... ` from the runtime object; change the cva config and the types update automatically). More in Module 5.5.

Also note `useState` with generics wherever inference isn't enough — from `test.$testId.tsx`:

```tsx
const [attemptId, setAttemptId] = useState<string | null>(null);
const [status, setStatus] = useState<Record<number, Status>>({});
```

and a local union type doing real work: `type Status = "unseen" | "answered" | "review" | "skipped"` drives the palette color function.

---

## Pitfalls & gotchas

1. **`as` is a promise you make, not a check the compiler makes.** `payload as T` in `api.ts` is deliberate and documented; sprinkling `as` to silence errors elsewhere hides real bugs. If you reach for `as`, first ask if narrowing (`instanceof`, `typeof`, a type guard) can prove it instead.
2. **Types vanish at runtime.** You cannot `if (x instanceof StudyTask)` — interfaces aren't values. Runtime checks need real values: classes (`ApiError`), literal arrays (`EXAM_OPTIONS`), or Zod schemas.
3. **`any` is contagious; `unknown` is safe.** One `any` disables checking for everything it touches. This codebase contains essentially none — keep it that way.
4. **Optional (`?`) vs `| null` vs `| undefined`.** `fetchSession` returns `User | null` (deliberate "checked and absent"), while `scheduledFor?: string` is "maybe not present". Pick one convention per boundary; `null` for "known empty" is this project's style for the session.
5. **Empty `useState` needs a generic.** `useState([])` infers `never[]` — you can never push a task into it. Write `useState<StudyTask[]>([])` like the dashboard does.
6. **Literal widening.** `let x = "JEE"` infers `string`, not `"JEE"`. That's why `EXAM_OPTIONS` uses `as const` — it freezes the tuple to the literal types so `z.enum(EXAM_OPTIONS)` and `ExamTrack` line up.
7. **The compiler trusts your response types blindly.** If API_SPEC.md changes (`streak` renamed to `streakDays`) and the frontend types don't, everything still compiles and breaks at runtime as `undefined`. Types + spec must move together — that's why the type files cite the spec in comments.

---

## Exercises

Solutions in [SOLUTIONS.md](./SOLUTIONS.md#module-53).

1. **Predict:** What is the inferred type of `envelope` in `api.ts` (`const envelope = (payload as ApiErrorBody | null)?.error;`)? Why does `envelope?.message ?? response.statusText` need *both* the `?.` and the `??`?
2. **Predict:** In `lib/auth.ts`, `fetchSession` catches an error and calls `isApiError(error, 401)`. Explain what the type of `error` is before the call, and what the guard's `error is ApiError` signature changes inside the `if`.
3. **Write:** Define a `TopicNode`-style interface for a "Bookmark" feature: `id`, `questionId` (number), `note` (optional), `createdAt`, and a `source` that may only be `"test" | "mistake-bank" | "manual"`. Then write `bookmarksQueryOptions`-ready fetcher `getBookmarks(signal?)` using `apiFetch`, following the exact style of `src/services/tasks.ts`.
4. **Discriminate:** Redesign `TestSummary` as a discriminated union `UpcomingTest | AttemptedTest` with a `status` discriminant, such that `t.score` only typechecks after `if (t.status === "attempted")`. What breaks in `app.index.tsx`'s upcoming-tests list, and how would you fix it?
5. **Trace a generic:** For the call `apiFetch<{ otpExpiresInSec: number }>("/auth/resend-otp", { method: "POST", body: {...} })` in `services/auth.ts` — write out what `T` is, the full return type, and which line of `api.ts` performs the (unchecked) conversion to that type.
6. **Hands-on (safe):** In `src/types/index.ts`, temporarily add `level: number;` (non-optional) to `User`. Run `npx tsc --noEmit` (or just watch your editor) and list every file that errors and why. Revert. What does this tell you about how far one interface reaches?
7. **Spot the runtime/compile-time pair:** `Role` in `types/index.ts` vs the `roles?: Role[]` arrays in `AppLayout.tsx`'s nav config. Why does the nav need a runtime array at all, and what keeps the two in sync (or fails to)?

---

**Next:** [Module 5.4 — Routing & Data](./04-routing-and-data.md) — where these types travel: file-based routes, guards, and React Query.
