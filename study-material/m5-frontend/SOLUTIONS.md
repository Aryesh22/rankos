# Module 5 — Solutions

> **Goal:** Full worked answers for every exercise in Modules 5.1–5.5. Attempt each exercise honestly before reading — the struggle is the learning.

---

## Module 5.1

### 1. The mobile overlay

```tsx
{open && (
  <div className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} />
)}
```

(a) It exists in the DOM **only while `open` is `true`** — the `open &&` conditional removes it entirely otherwise (it's not hidden; it's absent).
(b) `fixed inset-0` — position fixed, stretched to all four edges (`top/right/bottom/left: 0`), covering the viewport. `z-40` — above page content, *below* the sidebar's `z-50`, so the drawer stays clickable above its own backdrop. `bg-background/70` — theme background color at 70% opacity. `backdrop-blur-sm` — blurs whatever is behind it (frosted glass). The `onClick` closes the drawer — tap-outside-to-dismiss.
(c) `lg:hidden` — at ≥1024px the sidebar is permanently visible (`lg:translate-x-0`), so a backdrop would be wrong; even if `open` were somehow true on desktop, the overlay hides itself.

### 2. `hover-lift`

Defined in `rankos-ai-mentor/src/styles.css` as a custom `@utility`:

```css
@utility hover-lift {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ..., border-color 0.25s ease;
  &:hover { transform: translateY(-3px); box-shadow: var(--shadow-soft); }
}
```

On hover the card rises 3px and gains the soft shadow, both animated over 250ms with an ease-out curve; on mouse-leave it settles back (the transition is declared on the base state, so it animates both directions).

### 3. `bg-warning/12` in the streak chip

`bg-warning/12` = background of the `--warning` token at **12% opacity**; `text-warning` = the same color at full opacity for the flame icon and number. This is the standard "tinted pill" recipe: faint wash of a color behind fully saturated text of the same color — visible in the codebase as `bg-success/12 text-success`, `bg-destructive/12 text-destructive` (StatCard deltas, priority pills). One hue, two opacities, guaranteed harmony.

### 4. `rounded-full` beating `rounded-md`

The Button renders `cn(buttonVariants({ variant, size, className }))`. Your `className="w-full rounded-full"` is passed into cva as the last layer, and `cn`'s `tailwind-merge` sees two classes in the same "border-radius" group — `rounded-md` (from the base string) and `rounded-full` (yours, later) — and drops the earlier one. Without `twMerge`, both classes would be emitted and plain CSS specificity/source-order (not string order) would decide — unpredictably.

### 5. Changing `--primary`

Changes (at least): the primary Buttons (login submit, "Apply mentor's plan", "Start today's test"), the login/signup link accents and "Forgot?" link, the sidebar active-item icon (`text-primary`), focus rings (`--ring` is defined as the same value), the learning-graph area stroke/gradient (`var(--color-primary)` in recharts), the heatmap levels (`bg-primary/20…`), selected test options (`border-primary bg-primary/10`), `--chart-1`, part of `--gradient-brand` (logo tile, avatar fallback). Lesson: a design token is a single point of control — components never knew the color, only the role.

### 6. Icon-only a11y

Corrected icon-only bookmark:

```tsx
<Button variant="outline" size="icon" className="rounded-full" aria-label="Bookmark question">
  <Bookmark className="h-3.5 w-3.5" />
</Button>
```

Real examples already in `test.$testId.tsx`: the calculator toggle (`aria-label="Calculator"`), fullscreen (`aria-label="Fullscreen"`), exit (`aria-label="Exit test"`), close-calculator button (`aria-label="Close calculator"`).

### 7. Card with a title row

```tsx
<div className="surface p-5">
  <div className="flex items-baseline justify-between">
    <h2 className="text-[15px] font-semibold">Learning graph</h2>
    <span className="text-[12px] text-muted-foreground">Score vs topper · last 6 mocks</span>
  </div>
  <p className="mt-2 text-sm text-muted-foreground">…content…</p>
</div>
```

This matches the real card in `app.index.tsx` almost exactly (it uses `items-baseline` so differently sized texts align on their baselines).

### 8. `lg:grid-cols-[1fr_268px]`

An arbitrary two-column grid: the question area takes all remaining space (`1fr`), the palette sidebar is fixed at 268px. Below `lg` there is no `grid-cols` at all, so the grid defaults to a single column — question on top, palette stacked below. Mobile-first again: the "small" layout is the unprefixed default.

---

## Module 5.2

### 1. Resend countdown, render by render

`resend.mutate()` → request succeeds → `onSuccess` runs `setSeconds(28)` → re-render: footer shows "Resend code in 00:28"; the countdown effect re-runs because `seconds` changed (28), schedules **one** `setTimeout` for 1s. Timeout fires → `setSeconds(s => s - 1)` → 27 → re-render → cleanup clears the (already fired) timeout, effect re-runs, schedules the next. This repeats until `seconds === 0`, where the effect's `if (seconds === 0) return;` schedules nothing and the footer ternary flips to the "Resend code" button. **At most one timeout exists at any moment** — each render's cleanup clears the previous one before the next is set.

### 2. Pressing "3" in the test screen

The window keydown handler runs `pick(2)` (key − 1). `pick` does three things: `setAnswers(a => ({ ...a, [q.id]: 2 }))`, `setStatus(s => ({ ...s, [q.id]: "answered" }))`, and `autosave({ questionId: q.id, selectedIndex: 2, status: "answered", marked: ... })` — a fire-and-forget `PATCH /attempts/:id/response`. React batches the two state updates into one re-render. Visual consequences: option C gets `border-primary bg-primary/10`; the palette button for this question turns `bg-success/80 text-success-foreground` (via `paletteTone`); the header's `answered` count (`Object.keys(answers).length`) increases if this question wasn't answered before; the top `<Progress>` bar advances.

### 3. Derived values

`doneCount`, `planPct`, `firstName` are pure functions of existing state/props (`tasks`, `user`), recomputed each render for free. If `planPct` were state set inside `onToggle`, you'd have (a) duplication — two sources that must be kept in sync manually, (b) bugs — the effect that overwrites `tasks` from `data` would *not* update `planPct`, leaving a stale percentage, and (c) an extra render per update. Rule: **state is only for what cannot be computed.**

### 4. Keys

- `key={section.group}` — group names ("Prepare", "Perform"…) are unique and static: safe.
- `key={item.to}` — routes are unique per item: safe, and better than index because role filtering (`items.filter(canSee)`) *changes the indexes* per role while `to` stays stable.
- `key={i}` for recommendation bullets — safe only while items are replaced wholesale (new API response ⇒ new array rendered top-to-bottom). It would misbehave if items could be *reordered, inserted, or removed individually* — e.g. dismissing bullet #1: React would match old #2 to new key 0 and mutate text in place; with stateful children (inputs, animations) state would stick to the wrong row.

### 5. `title.toUpperCase()`

Every route that renders `<PageHeader>` shows an uppercased h1 (Dashboard, Planner, Tests, …). What re-rendered on hot reload is just the module being replaced; at runtime, `PageHeader` renders whenever its *parent route component* renders — the change itself doesn't add renders, it changes output. The point: one shared component, N pages affected — the component tiers are real.

### 6. RESEND_SECONDS = 5 and the guard

With `RESEND_SECONDS = 5`, the footer counts 00:05 → 00:00 then swaps to the resend button. Visiting `/verify-otp` with no `userId` redirects because the route's `beforeLoad` runs:

```tsx
beforeLoad: async (args) => {
  await redirectIfAuthenticated(args);
  if (!args.search.userId) throw redirect({ to: "/signup" });
},
```

`validateSearch` made `userId` optional precisely so a direct visit reaches `beforeLoad` (rather than failing search validation) and gets a *graceful* redirect to `/signup`.

### 7. `<PasswordInput>` refactor

```tsx
import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";

export const PasswordInput = forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => {
    const [show, setShow] = useState(false);
    return (
      <div className="relative">
        <Input ref={ref} type={show ? "text" : "password"} className={cn("pr-10", className)} {...props} />
        <button type="button" onClick={() => setShow(s => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);
```

For `{...register("password")}` to work it must forward **`ref`** (RHF tracks the input by ref — hence `forwardRef`) and spread the rest (`name`, `onChange`, `onBlur`, plus `id`, `aria-invalid`, `autoComplete`). Usage: `<PasswordInput id="password" aria-invalid={...} {...register("password")} />`. The `show` state stays fully private — a textbook "push state down" refactor.

### 8. Adding `[]` to the keydown effect

The listener would be created once, closing over the **first render's** `q` (`questions[0]`… actually `undefined` initially, then never updated), `answers`, `marked`, `status`. Concretely: since `questions` is `[]` on mount, `q` is `undefined` and `pick` returns early — **keyboard answering would never work at all**; even if questions existed at mount, pressing "1–4" on question 5 would answer with question 1's `q.id` forever. Arrow keys would *appear* to work because their callbacks only use the setter function forms. Fixes: (1) keep an effect with a proper dependency list `[questions.length, q, marked, status]` (or restructure so handlers read from refs); (2) React's `useEffectEvent` for an always-fresh handler subscribed once; (3) the codebase's pragmatic choice — no dep array, re-subscribe every render (correct, slightly wasteful).

---

## Module 5.3

### 1. Type of `envelope`

`payload as ApiErrorBody | null` makes the object `ApiErrorBody | null`; applying `?.error` yields `ApiErrorBody["error"] | undefined`, i.e. `{ code: string; message: string; fields?: Record<string, string> } | undefined`. You need `?.` because calling `.message` on `undefined` (body wasn't the envelope / was empty) would crash; you need `??` because even when the envelope exists TypeScript sees `envelope?.message` as `string | undefined`, and at runtime a malformed envelope could omit `message` — `?? response.statusText ?? "Request failed"` provides two fallback layers.

### 2. Narrowing in `fetchSession`

Inside `catch`, `error` is **`unknown`**. `isApiError(error, 401)` is declared `error is ApiError`, so in the branch where it returns true, TypeScript treats `error` as `ApiError` (you could read `.status`). The actual code uses the *negation*: `if (!isApiError(error, 401)) console.warn(...)` — "if this is anything other than a 401, log it" — then returns `null` either way, because both "not logged in" (401) and "backend down" should route to `/login` rather than crash the shell.

### 3. Bookmark feature

```ts
// src/services/bookmarks.ts
import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type BookmarkSource = "test" | "mistake-bank" | "manual";

export interface Bookmark {
  id: string;
  questionId: number;
  note?: string;
  createdAt: string;
  source: BookmarkSource;
}

export interface BookmarkListResponse {
  data: Bookmark[];
}

export function getBookmarks(signal?: AbortSignal): Promise<BookmarkListResponse> {
  return apiFetch<BookmarkListResponse>("/bookmarks", { signal });
}

export function bookmarksQueryOptions() {
  return queryOptions({
    queryKey: ["bookmarks"] as const,
    queryFn: ({ signal }) => getBookmarks(signal),
    staleTime: 30_000,
    retry: 1,
  });
}
```

Mirrors `tasks.ts` exactly: list envelope interface, fetcher threading `signal`, queryOptions with key/staleTime/retry. (`type` for the union, `interface` for the shapes — house style.)

### 4. Discriminated `TestSummary`

```ts
interface TestBase {
  id: string; title: string; exam: ExamTrack; subjects: string[];
  questions: number; durationMin: number; difficulty: Difficulty; maxScore: number;
}
export interface UpcomingTest extends TestBase {
  status: "upcoming";
  scheduledFor: string;                       // now REQUIRED
}
export interface AttemptedTest extends TestBase {
  status: "attempted";
  attemptedOn: string; score: number; percentile: number; accuracy: number;
}
export type TestSummary = UpcomingTest | AttemptedTest;
```

Now `t.score` errors until narrowed: `if (t.status === "attempted") { t.score /* number */ }`. What breaks: any code reading an optional field without narrowing — e.g. the dashboard's upcoming list prints `{t.scheduledFor}`; with the union you'd need the list typed as `UpcomingTest[]` (best fix: `upcomingTests: UpcomingTest[]` in `DashboardResponse`) or a narrowing check. Also `services/mockData.ts` literals would need `status` fields added. Trade-off: more upfront rigor, no more "is `score` here?" doubt.

### 5. Tracing the generic

`T = { otpExpiresInSec: number }`. Return type: `Promise<{ otpExpiresInSec: number }>`. The conversion happens at the last line of `apiFetch`: `return payload as T;` — `payload` is `unknown` from `safeParse`, asserted (not verified) to be `T`.

### 6. Adding `level: number` to `User`

Compiler errors appear wherever a `User` object is *constructed or asserted* without `level` — notably nowhere in components (they only *read* `user.name` etc.), and `apiFetch<User>` won't error (assertions don't check!). What errors in practice: `queryClient.setQueryData(SESSION_QUERY_KEY, data.user)` stays fine (server type is also `User`), but any test fixture / mock literal of `User`, and code like `mockData.ts` if it typed a `User`, would fail. The real lesson is the *asymmetry*: readers of `user.level` now typecheck happily even though the (future) server never sends it — types reach far, but only assertions guard the boundary, so spec and types must move together.

### 7. `Role` — type vs runtime array

The nav must decide *at runtime* whether `user.role` is in `item.roles` — types are erased, so a runtime array of strings is unavoidable. What keeps them in sync: `roles?: Role[]` in the `NavItem` interface means every literal in the config (`roles: ["teacher", "admin"]`) is checked against the `Role` union — a typo `"techer"` fails to compile. So: the *values* must be written out at runtime, but the *type* still polices them. (The reverse failure mode — adding a new role to `Role` and forgetting to update nav arrays — compiles fine; that's a human review problem.)

---

## Module 5.4

### 1. Logged out, typing `/app/planner`

1. Server render: route matches `app.tsx` → `app.planner.tsx`; `requireAuth` runs but `isServer()` → returns `{}` (no decision yet). Shell HTML streams.
2. Client hydration: router re-runs `beforeLoad` for `/app` → `requireAuth` (`src/lib/auth.ts`).
3. `context.queryClient.ensureQueryData(sessionQueryOptions())` — no cache entry → calls `fetchSession` → `authApi.me()` → `apiFetch<User>("/auth/me")` (`src/services/auth.ts`, `src/lib/api.ts`).
4. No backend/no cookie → 401 (or network error) → `fetchSession` returns `null`, cached under `["auth","session"]`.
5. `requireAuth` throws `redirect({ to: "/login", search: { redirect: location.href } })`.
6. `login.tsx` loads; its own `beforeLoad` (`redirectIfAuthenticated`) reads the *cached* `null` — no second request. Final URL: **`/login?redirect=%2Fapp%2Fplanner`**. After a successful login, `sanitizeRedirect(redirect)` sends you to `/app/planner`.

### 2. staleTime arithmetic

`dashboardQueryOptions` sets `staleTime: 30_000`. Returning after 10s: the `["dashboard"]` entry is still *fresh* → rendered from cache, **no refetch**. After 45s: entry is *stale* → cached data renders instantly (no skeleton flash) **and** a background refetch fires, updating in place when it lands. That two-phase behavior — show stale, revalidate behind — is React Query's core UX win.

### 3. New routes

(a) `src/routes/app.streaks.tsx` → `/app/streaks`, automatically inside the sidebar layout and behind `requireAuth` (both live on `app.tsx`).
(b) `src/routes/app.tests.archive.tsx` → `/app/tests/archive` (each dot = one URL segment).
(c) `src/routes/report.$attemptId.tsx` → `/report/:attemptId`, **outside** the `app` prefix so no sidebar renders. The existing proof is `test.$testId.tsx` — fullscreen, no `AppLayout`, but with its own `beforeLoad: requireAuth`, which your report route needs too (guards come from the `app` layout only for `app.*` children; standalone routes must guard themselves).

### 4. Cache entries for test meta

Keys are `["test-meta", "pt-07"]` and `["test-meta", "ft-12"]` — **two entries**, because the code is in the key. `attemptResultQueryOptions(undefined)` fetches nothing because of `enabled: Boolean(attemptId)` (in `src/services/tests.ts`) — with `undefined` it's `enabled: false`; the query mounts idle until a real attempt id arrives (e.g. from `/app/results?attempt=...`).

### 5. `staleTime: 0`

Every return to the dashboard now marks the data instantly stale, so each visit triggers a background `GET /api/dashboard` (visible in the Network tab on every toggle between pages; with no backend, visible as a repeating failed request + one retry). Before, requests within 30s were suppressed. UI still doesn't flash — cached data renders while revalidating — but network chatter multiplies. `staleTime` is the "how fresh is fresh enough" dial.

### 6. Real optimistic toggle

```tsx
// in Dashboard() — replaces the tasks useState + useEffect entirely
const queryClient = useQueryClient();
const { data, isLoading } = useQuery(dashboardQueryOptions());
const tasks = data?.todayPlan ?? [];                      // read straight from cache

const toggleTask = useMutation({
  mutationFn: (task: StudyTask) => updateTask(task.id, { done: !task.done }),
  onMutate: async (task) => {
    await queryClient.cancelQueries({ queryKey: ["dashboard"] });
    const previous = queryClient.getQueryData<DashboardResponse>(["dashboard"]);
    queryClient.setQueryData<DashboardResponse>(["dashboard"], (old) =>
      old && {
        ...old,
        todayPlan: old.todayPlan.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)),
      },
    );
    return { previous };
  },
  onError: (_err, _task, ctx) => {
    if (ctx?.previous) queryClient.setQueryData(["dashboard"], ctx.previous);
    toast.error("Couldn't update the task.");
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
});

const onToggle = (task: StudyTask) => toggleTask.mutate(task);
```

One source of truth (the cache), instant UI, rollback on failure, reconciliation on settle. `cancelQueries` prevents an in-flight background refetch from stomping the optimistic write.

### 7. Leaderboard audit

`app.leaderboard.tsx` imports `leaderboardQueryOptions` (via `@/services/leaderboard`, re-exported from `src/services/queries.ts`) — **not** `mockData`. Nothing in `src/` imports `mockData.ts`; `grep -rn "mockData" src/` returns no import sites. With no backend, `apiFetch("/leaderboard?...")` fails, `retry: 1` retries once, and the page renders its loading-then-empty/error branch instead of rankings. The rich fake `leaderboard` array in `mockData.ts` sits unused — seed-data material for the backend, not app behavior.

### 8. `sanitizeRedirect`

Without it, login would navigate to whatever `?redirect=` says. Malicious URL: `https://yourapp.com/login?redirect=https://evil.example/phish` (or the sneakier protocol-relative `//evil.example`) — a user logs in on your *real* site, then lands on an attacker's clone: a classic **open redirect** used for phishing. The function only accepts targets that start with `/` but not `//` (same-origin absolute paths) and falls back to `/app` for anything else:

```ts
if (target && target.startsWith("/") && !target.startsWith("//")) return target;
return "/app";
```

---

## Module 5.5

### 1. `asChild` Button around a Link

DOM result: a single **`<a>`** element (rendered by TanStack's `Link`) with `href="/app/results"` — no `<button>` exists. `Slot` merged the Button's props onto the Link. Approximate final classes: cva base (`inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium cursor-pointer transition-colors focus-visible:... disabled:... [&_svg]:size-4 ...`) + `variant="outline"` (`border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground`) + `size="sm"` (`h-8 px-3 text-xs` — note sm's own `rounded-md`) + your `rounded-full`. `rounded-full` survives because it's the *last* radius class through `cn`/`twMerge`, which removes the earlier `rounded-md` from both base and size strings.

### 2. Tracing `cn`

- `isActive` truthy: `clsx` → `"h-9 px-4 rounded-md bg-sidebar-accent rounded-full"`; `twMerge` then drops `rounded-md` (same radius group, earlier) → **`"h-9 px-4 bg-sidebar-accent rounded-full"`**.
- `isActive` falsy: `clsx` drops the `false` (that's clsx's job — falsy filtering) → `twMerge` drops `rounded-md` → **`"h-9 px-4 rounded-full"`**.
So: falsy filtering = clsx; conflict resolution = tailwind-merge.

### 3. `success` Button variant

```tsx
variant: {
  ...,
  success: "bg-success text-success-foreground shadow hover:bg-success/90",
},
```

`<Button variant="success">` typechecks immediately because `ButtonProps extends VariantProps<typeof buttonVariants>` — the `VariantProps` generic *reads the union of variant names off the cva object's type*, so extending the runtime object extends the type. (Module 5.3 concept: types derived from values — `typeof` + generic inference — the same trick as `z.infer`.)

### 4. Reading `checkbox.tsx`

- Radix import: `import * as CheckboxPrimitive from "@radix-ui/react-checkbox"`.
- `className` merge: `cn("peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow ...", className)` on `CheckboxPrimitive.Root`.
- The check icon: a `CheckboxPrimitive.Indicator` (renders only when checked) containing a lucide `Check` icon.
- No `useState` because **Radix owns the state**: uncontrolled internally, or controlled by the parent — exactly how `login.tsx` uses it (`checked={rememberMe} onCheckedChange={...}` makes it controlled). The shadcn file is styling + forwarding; behavior lives in the primitive.

### 5. Exam picker design

UX reason: all seven options visible at once with one-tap selection — no open/scan/close cycle of a `<select>`, ideal for a short, well-known list on mobile. Code reason: the chips are pure Tailwind + `watch`/`setValue` — trivially styleable per-state (`exam === e ? "border-primary bg-primary/12 text-primary" : ...`) with no Radix wiring or hidden-input adapters needed. `type="button"` is load-bearing because a `<button>` inside a `<form>` defaults to `type="submit"` — without it, tapping "NEET" would attempt to submit (and trigger validation) instead of just selecting.

### 6. Referral code field

`src/lib/auth-schemas.ts`:

```ts
export const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  mobile: mobileSchema,
  password: passwordSchema,
  exam: z.enum(EXAM_OPTIONS),
  referralCode: z.string().trim().max(24, "That code looks too long").optional(),
});
```

`src/routes/signup.tsx` (after the password block; also add `referralCode: ""`? No — it's optional, but RHF prefers a default: add `referralCode: undefined` or `""` to `defaultValues`):

```tsx
<div className="space-y-2">
  <Label htmlFor="referral">Referral code (optional)</Label>
  <Input id="referral" placeholder="RANK-XXXX" aria-invalid={Boolean(errors.referralCode)} {...register("referralCode")} />
  {errors.referralCode && <p className="text-[12px] text-destructive">{errors.referralCode.message}</p>}
</div>
```

`SignupValues` updates **automatically** — it's `z.infer<typeof signupSchema>`, so the new optional field flows into `useForm<SignupValues>`, `authApi.signup(values)`, and the request body with zero further edits. (The backend contract in API_SPEC.md would also need the field, eventually.)

### 7. Server field-error path

1. `apiFetch` (`src/lib/api.ts`): response not ok → parses body, `envelope = payload.error` → `throw new ApiError("Invalid", 422, "VALIDATION", { mobile: "Already registered" })`.
2. The mutation's promise rejects; React Query invokes `onError(error)` in `signup.tsx`.
3. `error instanceof ApiError` → true; `applyFieldErrors(setError, error.fields)` (`src/lib/form-errors.ts`) loops the fields object and calls `setError("mobile", { type: "server", message: "Already registered" })`, returns `true` → the generic toast is skipped.
4. RHF updates `formState.errors.mobile`; the component re-renders.
5. JSX: `aria-invalid={Boolean(errors.mobile)}` flips to true and `{errors.mobile && <p className="text-[12px] text-destructive">{errors.mobile.message}</p>}` renders **"Already registered"** directly beneath the mobile input.

### 8. `useCountdown`

`src/hooks/use-countdown.ts` (kebab-case, matching `use-mobile.tsx`):

```tsx
import { useEffect, useState } from "react";

export function useCountdown(initialSeconds: number) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    if (seconds === 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  return { seconds, restart: () => setSeconds(initialSeconds) };
}
```

Usage in `verify-otp.tsx`:

```tsx
const { seconds, restart } = useCountdown(RESEND_SECONDS);
...
const resend = useMutation({
  mutationFn: () => authApi.resendOtp({ userId }),
  onSuccess: () => { restart(); toast.success("A new code is on the way."); },
  ...
});
```

The countdown effect and its state disappear from the component; the JSX (`seconds > 0 ? ... : ...`) is unchanged. Note the hook is exactly the original logic, relocated — custom hooks are extraction, not magic. (Purists may `useCallback` the `restart`; unnecessary here since nothing memoizes on it.)

---

*End of Module 5 solutions. If any answer surprised you, reread the relevant "In your codebase" section — every solution is anchored in a file you can open.*
