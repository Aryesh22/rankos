# Module 5.4 — Routing & Data: TanStack Router + React Query

> **Goal:** Master the two libraries that turn your pile of components into an application: TanStack Router (which URL shows which component, with guards and params) and TanStack React Query (how server data is fetched, cached, and mutated). Plus a fully honest audit of what's real and what's mock in RankOS today.

---

## Concepts

### 1. Client-side routing

A traditional website loads a new HTML page per URL. A single-page app (SPA) loads once; a **router** watches the URL and swaps React components in and out — instant navigation, preserved state. TanStack Router adds two things over older routers: **file-based routes** (the file tree *is* the route tree) and **end-to-end type safety** (`<Link to="/app/planer">` is a compile error — typo caught before runtime).

### 2. File-based routing conventions

In `src/routes/`:

| File | URL | Meaning |
|---|---|---|
| `__root.tsx` | (every page) | the root layout wrapping everything |
| `index.tsx` | `/` | the landing page (`index` = "this exact path") |
| `login.tsx` | `/login` | plain route |
| `app.tsx` | `/app` (layout) | **layout route** for everything starting `/app` |
| `app.index.tsx` | `/app` | the dashboard, rendered *inside* `app.tsx` |
| `app.planner.tsx` | `/app/planner` | child of the `app` layout |
| `test.$testId.tsx` | `/test/:testId` | **dynamic param** — `$` marks a variable segment |

The **`app.*` dot naming** is TanStack's "flat routes" style: dots express nesting without needing folders (`app.planner.tsx` ≡ `app/planner.tsx`). Every `app.*` page renders inside `app.tsx`'s `<Outlet />` — which is why all thirteen dashboard pages share one sidebar without repeating it. Note that `test.$testId.tsx` is deliberately **outside** the `app` prefix: the exam simulator is fullscreen, no sidebar — placement in the file tree is a UI decision here.

A generated file, `src/routeTree.gen.ts`, stitches these together — never edit it; the Vite plugin (`@tanstack/router-plugin`, wired in `vite.config.ts`) regenerates it as you add files.

### 3. Server state is not client state

`useState` is for *client* state (is the sidebar open?). Data from the server is different: it's shared, it goes stale, it needs caching, retries, deduplication, background refresh. React Query manages this with a **cache keyed by `queryKey`**:

- `useQuery({ queryKey, queryFn, ... })` — read. Returns `{ data, isLoading, isError, ... }` and re-renders you when they change.
- `useMutation({ mutationFn, onSuccess, ... })` — write (POST/PATCH/DELETE).
- Two queries with the same key share one cache entry and one in-flight request.
- `staleTime` — how long cached data is considered fresh (no refetch on remount/refocus during this window).
- `retry` — automatic retries on failure.
- **Invalidation** — `queryClient.invalidateQueries({ queryKey: ["tasks"] })` marks matching entries stale so they refetch; the standard move after a mutation.

### 4. The `queryOptions` pattern

Instead of scattering `{ queryKey: ..., queryFn: ... }` objects through components, you define them once per endpoint in a service file:

```ts
export function tasksQueryOptions(date = "today") {
  return queryOptions({ queryKey: ["tasks", date] as const, queryFn: ..., staleTime: 30_000, retry: 1 });
}
```

Any consumer — a component's `useQuery(...)`, a route guard's `ensureQueryData(...)`, an invalidation — uses the *same* definition, so keys can never drift apart. This is the single most copied pattern in this codebase.

---

## In your codebase

### The router — `rankos-ai-mentor/src/router.tsx` (all 16 lines)

```tsx
export const getRouter = () => {
  const queryClient = new QueryClient();
  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });
  return router;
};
```

- One `QueryClient` (the React Query cache) is created *here* and handed to the router as **context** — that's how `beforeLoad` guards get cache access without hooks (guards aren't components).
- `getRouter` is a factory because this is a **TanStack Start** app (SSR): the server needs a fresh router+cache per request; sharing one would leak one user's data to another.
- `scrollRestoration` — remember scroll positions across navigation.

### The root — `src/routes/__root.tsx`

```tsx
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({ meta: [ { title: "RankOS — The Operating System for Exam Preparation" }, ...], links: [ { rel: "stylesheet", href: appCss }, ...] }),
  shellComponent: RootShell,     // renders <html><head><HeadContent/></head><body>{children}<Scripts/></body>
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
```

Everything app-wide lives here: the document shell (Start renders real `<html>`), meta tags and the stylesheet link (`head()`), the React Query provider (components' `useQuery` finds the cache via this), the global toast portal, plus the 404 and error screens. `<Outlet />` = "render whichever child route matches" — the root's is mandatory; remove it and every page goes blank (the comment in the file says exactly this).

Per-route `head()` overrides exist too — `app.index.tsx` sets `{ title: "Dashboard · RankOS" }`, `login.tsx` sets its own. That's how each page gets its own browser-tab title in an SPA.

### The layout route — `src/routes/app.tsx` (all 16 lines)

```tsx
export const Route = createFileRoute("/app")({
  beforeLoad: requireAuth,
  component: AppShell,
});

function AppShell() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
```

Sixteen lines doing two jobs: (1) **guard** — `beforeLoad: requireAuth` runs before any `/app/*` page loads; (2) **layout** — wrap every child page in the sidebar shell, injecting the page via `<Outlet />` passed as `children`. Add `app.streaks.tsx` tomorrow and it's automatically guarded and chrome-wrapped.

### Route guards — `src/lib/auth.ts`

```ts
export async function requireAuth({ context, location }: GuardArgs): Promise<{ user?: User }> {
  if (isServer()) return {};
  const user = await context.queryClient.ensureQueryData(sessionQueryOptions());
  if (!user) {
    throw redirect({ to: "/login", search: { redirect: location.href } });
  }
  return { user };
}
```

Dissect:

- `context.queryClient` — the cache the router carries. `ensureQueryData(sessionQueryOptions())` = "return cached session if fresh, else fetch `GET /auth/me`". Because guard and components share `["auth","session"]`, the guard's fetch is *reused* by `useAuth()` in `AppLayout` — one request, not two.
- `throw redirect(...)` — guards abort navigation by throwing. The current URL rides along as `?redirect=...`, and `login.tsx` sends you back after login via `sanitizeRedirect(redirect)` (which rejects anything not starting with a single `/` — an open-redirect defense; read it, it's 5 lines).
- The SSR dodge: on the server the httpOnly cookie can't be read through a relative fetch, so guards no-op and re-run on the client after hydration.

The mirror-image guard, `redirectIfAuthenticated`, bounces signed-in users *away* from `/login`, `/signup`, `/verify-otp` into `/app`. And `verify-otp.tsx` shows guard *composition* plus **typed search params**:

```tsx
validateSearch: z.object({ userId: z.string().optional(), mobile: z.string().optional() }),
beforeLoad: async (args) => {
  await redirectIfAuthenticated(args);
  if (!args.search.userId) throw redirect({ to: "/signup" });
},
```

`validateSearch` (a Zod schema) parses `?userId=...&mobile=...` into typed values available as `Route.useSearch()` — URL query strings, type-checked.

### Dynamic params — `src/routes/test.$testId.tsx`

```tsx
export const Route = createFileRoute("/test/$testId")({ beforeLoad: requireAuth, ... });

function TestInterface() {
  const { testId } = Route.useParams();
  const meta = useQuery(testMetaQueryOptions(testId));
```

`$testId` in the filename becomes a typed param. Navigating there is also typed — from `app.index.tsx`:

```tsx
<Link to="/test/$testId" params={{ testId: t.id }}>Start</Link>
```

Omit `params` or misspell the path and it's a compile error. The other navigation tools in use: `useNavigate()` for imperative jumps after async work (`navigate({ to: "/app/results", search: { attempt: res.attemptId } })` after submitting a test), and `useRouterState({ select: (s) => s.location.pathname })` in `AppLayout` to highlight the active nav item.

### React Query: the read path

Service layer (`src/services/tasks.ts`, and the same shape in a dozen sibling files):

```ts
export function getTasks(date = "today", signal?: AbortSignal): Promise<TaskListResponse> {
  const query = new URLSearchParams({ date }).toString();
  return apiFetch<TaskListResponse>(`/tasks?${query}`, { signal });
}

export function tasksQueryOptions(date = "today") {
  return queryOptions({
    queryKey: ["tasks", date] as const,
    queryFn: ({ signal }) => getTasks(date, signal),
    staleTime: 30_000,
    retry: 1,
  });
}
```

- **`queryKey: ["tasks", date]`** — the cache identity. The parameter is *in the key*, so "today" and "2026-08-12" are separate cache entries. Rule: everything the queryFn depends on belongs in the key.
- **`{ signal }`** — React Query hands the queryFn an `AbortSignal`; it's threaded into `fetch` so navigating away cancels the request (remember `api.ts` re-throws AbortError untouched — this is why).
- **`staleTime: 30_000`** — for 30s, revisiting the dashboard renders instantly from cache with no network chatter.
- **`retry: 1`** — one retry on failure (the session query uses `retry: false` — you don't retry a 401).
- `src/services/queries.ts` is a **barrel** re-exporting every domain's queryOptions from one place, "so cache keys and fetchers stay consistent across pages" (its own comment).

Consumption in `app.index.tsx`:

```tsx
const { data, isLoading } = useQuery(dashboardQueryOptions());
const heatmap = useQuery(heatmapQueryOptions());
const recommendations = useQuery(recommendationsQueryOptions());
```

Three independent queries, each with its own loading/error state, rendered with the skeleton → empty → data pattern from Module 5.2. `testMetaQueryOptions` and `attemptResultQueryOptions` (in `services/tests.ts`) also demonstrate **`enabled: Boolean(attemptId)`** — a query that won't run until its input exists.

### React Query: the write path

`login.tsx` is the canonical mutation:

```tsx
const mutation = useMutation({
  mutationFn: authApi.login,
  onSuccess: (data) => {
    queryClient.setQueryData(SESSION_QUERY_KEY, data.user);   // seed the cache directly
    toast.success(`Welcome back, ${data.user.name.split(" ")[0]}.`);
    navigate({ to: sanitizeRedirect(redirect) });
  },
  onError: (error) => {
    if (error instanceof ApiError && applyFieldErrors(setError, error.fields)) return;
    toast.error(error instanceof Error ? error.message : "Couldn't sign you in.");
  },
});
```

`setQueryData` **writes the server's response straight into the cache** — no second `GET /auth/me` needed; when `/app` mounts, `requireAuth`'s `ensureQueryData` finds a fresh session already there. Logout (`useLogout` in `lib/auth.ts`) shows the other cache verbs: `setQueryData(SESSION_QUERY_KEY, null)` then `queryClient.clear()` — wipe *everything*, because every cached query belongs to the signed-out user. It runs in `onSettled` (success *or* failure) so a network error can't leave you half signed-in.

**Optimistic updates.** The dashboard checkbox does a *hand-rolled* optimistic update (local `useState` flip + fire-and-forget `toggleTask.mutate(task)` — see Module 5.2, case study E). The canonical React Query version — **not currently used in this codebase**, but the upgrade path — is:

```ts
useMutation({
  mutationFn: (task) => updateTask(task.id, { done: !task.done }),
  onMutate: async (task) => {
    await queryClient.cancelQueries({ queryKey: ["dashboard"] });
    const previous = queryClient.getQueryData(["dashboard"]);
    queryClient.setQueryData(["dashboard"], (old) => /* flip task.done immutably */);
    return { previous };                                   // rollback context
  },
  onError: (_e, _t, ctx) => queryClient.setQueryData(["dashboard"], ctx.previous),
  onSettled: () => queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
});
```

Cache is the single source of truth, UI updates instantly, errors roll back, and a final invalidation reconciles with the server. Also note: `invalidateQueries` appears nowhere in the app yet — mutations either seed the cache (`login`), clear it (`logout`), or fire-and-forget (task toggle, test autosave). Knowing that gap is knowing the codebase.

### How auth actually travels

Read the header comment of `src/lib/api.ts`: *"Session is carried by an httpOnly cookie, so every request opts into `credentials: "include"`."*

- The **frontend never stores or attaches a token**. No `localStorage`, no `Authorization` header (grep for `localStorage` in `src/` — zero hits). The browser attaches the cookie automatically; JavaScript can't even read it (httpOnly), which is XSS protection.
- The `AuthSession` type *does* have a `token: string` field, mirroring API_SPEC.md (which allows `Authorization: Bearer <JWT>` **or** the cookie) — but look at `login.tsx`'s `onSuccess`: it uses `data.user` and ignores `data.token`. The cookie set by the server (`Set-Cookie` in the spec) does the work.
- Client-side "auth state" is therefore just the cached `["auth","session"]` query resolving to `User | null` — `useAuth()` is a thin wrapper over `useQuery(sessionQueryOptions())`.

### The honest audit: real vs mock

Time to be precise, because it's easy to be fooled by how finished the UI looks.

1. **Every service call is real.** All of `src/services/*.ts` hit real REST paths through `apiFetch` — `/dashboard`, `/tasks`, `/tests/:code/attempts`, `/auth/*` — exactly matching `API_SPEC.md`.
2. **But the backend does not exist yet.** API_SPEC.md's own header says: *"No backend code written (by request)."* So today, every query fails (network error or 404), `retry: 1` retries once, and the UI falls into its skeleton/empty/error branches — which is why the dashboard shows "No tasks planned yet…" and zeros. The auth flow can't succeed either: `fetchSession` maps failures to `null`, so `/app` always redirects to `/login`. (There is also a deeper unresolved mismatch noted in the project docs: this frontend implements the spec's mobile+OTP auth, while the backend foundation drafted so far is email/JWT.)
3. **`src/services/mockData.ts` (620 lines) is dead code.** It defines rich fake data — `student` (Aarav Mehta, streak 46), `todayPlan`, `upcomingTests` (`pt-07`, `ft-12`…), mistakes, leaderboard — fully typed against `src/types`. But grep the codebase: **nothing imports it anymore.** It's the fossil of an earlier phase when pages rendered mock data directly; the services were since rewritten against the real API. `DATABASE_SCHEMA.md` still references it ("from `StudyTask` / `todayPlan`") because the schema was *derived from* the mock shapes. It's now reference material / seed-data candidate, not app behavior.
4. **Some copy is still hardcoded in components** — mock in spirit if not in imports: the dashboard's eyebrow `"Tuesday, 28 July"`, the AI-mentor paragraph and the three topic bars (`Definite Integration 55%`…), `"rebuilt at 05:40 by your mentor"`, `"1,284 hours logged"`; `AppLayout`'s `"AI mentor synced 2 min ago"` and the header button hardcoding `testId: "pt-07"`; the calculator in `test.$testId.tsx` which renders buttons but computes nothing. These are the places to replace with API data as the backend lands.

---

## Pitfalls & gotchas

1. **Key drift.** If one file queries `["tasks"]` and another invalidates `["task"]`, nothing refetches and nobody errors. The whole point of `queryOptions` + the `queries.ts` barrel is making this structurally impossible — never inline a queryKey in a component.
2. **Forgetting the param in the key.** `queryKey: ["tasks"]` with `queryFn: () => getTasks(date)` caches Monday's tasks under the same key as Tuesday's. The codebase gets this right (`["tasks", date]`, `["test-meta", code]`) — copy it.
3. **`isLoading` vs `isFetching`.** `isLoading` = first load, no data yet (show skeletons). `isFetching` = any in-flight fetch, including background refresh (show nothing, or a subtle spinner). `useAuth()` exposes both for a reason.
4. **Editing `routeTree.gen.ts`.** It's generated; your edits will be overwritten. Routes change by adding/renaming files in `src/routes/`.
5. **Guards run on both server and client.** That's why `requireAuth` starts with `if (isServer()) return {}` — cookie-dependent logic must defer to the client in this setup. Forgetting this class of check is the classic SSR footgun ("window is not defined").
6. **Mutations don't auto-refresh reads.** After `updateTask`, the `["dashboard"]` cache still holds the old `done` value; only the local state copy makes the UI look right, and it drifts from cache until `staleTime` lapses. This exact subtlety is why the canonical `onMutate`/`invalidateQueries` pattern exists.
7. **Cache is per-user session.** Any "log out" path must `queryClient.clear()` like `useLogout` does — miss it and user B sees user A's cached dashboard for up to `staleTime`.

---

## Exercises

Solutions in [SOLUTIONS.md](./SOLUTIONS.md#module-54).

1. **Predict:** You are logged out and type `/app/planner` in the address bar. List, in order, every file and function that runs until you see a page, and what URL you end on (including the search string).
2. **Predict:** With a working backend, you visit `/app` (dashboard loads), go to `/app/tests`, and come back to `/app` 10 seconds later. Does `GET /api/dashboard` fire again? What if you come back after 45 seconds? Cite the exact numbers from `services/dashboard.ts`.
3. **Routes:** What files would you create for (a) a page `/app/streaks`, (b) a page `/app/tests/archive`, (c) a printable report at `/report/$attemptId` with **no** sidebar? For (c), which existing route proves your placement works, and what guard should it have?
4. **Trace the key:** `testMetaQueryOptions(testId)` is used in `test.$testId.tsx`. Two students open `/test/pt-07` and `/test/ft-12`. How many cache entries exist for test meta, and why does `attemptResultQueryOptions(undefined)` fetch nothing? Quote the option responsible.
5. **Hands-on (safe):** In `services/dashboard.ts`, change `staleTime: 30_000` to `0`, run the app, and (watching the browser dev-tools Network tab) click between Dashboard and Tests a few times. What changes vs before? Revert.
6. **Write the real optimistic update:** Rewrite the dashboard's task toggle using `onMutate`/`onError`/`onSettled` against the `["dashboard"]` cache, removing the `useState`+`useEffect` mirror entirely. (Sketch in markdown; full solution in SOLUTIONS.md.)
7. **Audit:** Open `src/services/mockData.ts` and `app.leaderboard.tsx`. Does the leaderboard page use mockData's `leaderboard` array, or `leaderboardQueryOptions`? Prove it with import statements, then explain what the page shows today with no backend.
8. **Security question:** Why is `sanitizeRedirect` needed in `login.tsx`? Construct a malicious URL that would be dangerous without it, and explain what the function does with it.

---

**Next:** [Module 5.5 — Components & Forms](./05-components-and-forms.md) — the architecture layer: shadcn/ui, cva, composition, and react-hook-form + Zod.
