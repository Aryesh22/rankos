# Module 5.5 — Component Architecture & Forms

> **Goal:** Understand how this app's components are organized and why: the shadcn/Radix copy-paste philosophy in `components/ui/`, the `cva`/`clsx`/`tailwind-merge` toolchain, composition via `children` and `asChild`, the hooks folder, real forms with react-hook-form + Zod, and recharts. After this module the whole `src/` tree should feel navigable.

---

## Concepts

### 1. The four component tiers

Look at `rankos-ai-mentor/src/` and you'll see a deliberate hierarchy:

```
src/
├── components/
│   ├── ui/        ← 40+ shadcn/Radix primitives (Button, Input, Dialog, …) — generic, app-agnostic
│   ├── ui-kit/    ← project design-system pieces (StatCard, RingProgress, StudyHeatmap, Motion)
│   ├── app/       ← app-specific composites (PageHeader, AiChatDock)
│   └── brand/     ← Logo
├── layouts/       ← AppLayout (sidebar shell), AuthLayout (split screen)
├── routes/        ← pages; compose everything above
├── hooks/         ← reusable stateful logic (use-mobile)
├── services/      ← data fetching (Module 5.4)
├── lib/           ← utilities: api, auth, utils(cn), auth-schemas, form-errors
└── types/         ← shared domain types (Module 5.3)
```

The dependency direction is one-way: routes → layouts/components → ui → lib. `components/ui/` never imports from `routes/`. Keep it that way.

### 2. shadcn/ui: components you own, not install

Radix UI publishes **headless** primitives — dropdowns, dialogs, checkboxes with all the hard parts done (keyboard navigation, focus trapping, ARIA, portals) and *zero styling*. shadcn/ui is a set of recipes that wrap Radix primitives with Tailwind classes — and instead of being an npm dependency, **the code is copy-pasted into your repo**. That's what the 40+ files in `src/components/ui/` are.

Why copy-paste instead of a library?

- **You own the code.** Want the Button to have a `brand` variant? Edit `button.tsx`. No fork, no patch, no waiting on a maintainer.
- **No breaking upgrades.** The component can't change under you.
- **Perfect theme integration.** Every class references *your* tokens (`bg-primary`, `border-input`) from `styles.css`.

`components.json` at the repo root is the shadcn CLI's config — it records the conventions used when generating these files:

```json
{
  "style": "new-york",
  "tailwind": { "css": "src/styles.css", "cssVariables": true },
  "iconLibrary": "lucide",
  "aliases": { "components": "@/components", "utils": "@/lib/utils", "ui": "@/components/ui", ... }
}
```

Running `npx shadcn@latest add carousel` would read this file and drop a themed `carousel.tsx` into `src/components/ui/`.

### 3. The class-name toolchain: `clsx` + `tailwind-merge` + `cva`

**`cn()`** — `src/lib/utils.ts`, six lines, imported by nearly every component:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- `clsx` assembles strings from mixed inputs and drops falsy ones: `clsx("a", cond && "b", { c: flag })` → `"a b"` or `"a b c"`. This powers every conditional class you saw in Module 5.1 (`t.done && "opacity-55"`).
- `twMerge` resolves **Tailwind conflicts by meaning**, last one wins: `twMerge("rounded-md h-9", "rounded-full")` → `"rounded-md" is removed`. This is what lets a caller override a component's defaults via `className`.

**`cva`** (class-variance-authority) declares *variants* declaratively — a base string plus named option groups. See the walkthrough of `button.tsx` below.

### 4. Composition: `children`, slots, `asChild`

React composition = building big things by nesting small things, passed through `children` or named props ("slots"). The most advanced form here is Radix's **`asChild`/Slot** pattern: instead of rendering its own tag, a component *merges its props onto the child you provide* — so a Button can *be* a router Link without nesting `<a>` inside `<button>` (invalid HTML).

### 5. Forms: react-hook-form + Zod

Hand-rolling forms (one `useState` per field, manual validation, error juggling) collapses past ~3 fields. The stack used here:

- **Zod** — schema library: declare shape + rules once, get validation *and* the TypeScript type (`z.infer`).
- **react-hook-form (RHF)** — form state manager using *uncontrolled* inputs under the hood (refs, not state) so typing doesn't re-render the whole form. You get `register`, `handleSubmit`, `formState.errors`, `setValue`, `watch`, `setError`.
- **`@hookform/resolvers/zod`** — the adapter: `resolver: zodResolver(schema)` makes RHF validate with your Zod schema.

---

## In your codebase

### Walkthrough: `src/components/ui/button.tsx` — the archetype

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
```

- The **base string** carries everything shared: layout (`inline-flex items-center gap-2`), focus ring (`focus-visible:ring-1 ring-ring` — keyboard-only focus styling, an a11y win), disabled treatment, and `[&_svg]:size-4` — an *arbitrary variant* that styles any nested SVG, which is why every `lucide-react` icon dropped inside a Button is automatically sized.
- Two variant axes × defaults. `buttonVariants({ variant: "outline", size: "sm" })` returns the merged string.

```tsx
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
```

- `VariantProps<typeof buttonVariants>` *derives* the prop types from the cva object (Module 5.3) — add a variant, the type updates itself.
- `...props` + `React.ButtonHTMLAttributes` — every native button prop passes through untouched.
- `cn(buttonVariants({ variant, size, className }))` — cva accepts `className` as a final layer and `cn` merges conflicts, so `<Button className="rounded-full w-full">` overrides `rounded-md` cleanly. (This resolves the Module 5.1 exercise 4 mystery.)
- **`asChild` + `Slot`**: when true, render the child element and merge all these props into it. Used constantly:

  ```tsx
  // AppLayout.tsx — a Button that IS a Link
  <Button asChild size="sm" className="rounded-full">
    <Link to="/test/$testId" params={{ testId: "pt-07" }}>Start today's test</Link>
  </Button>

  // also with menu items:
  <DropdownMenuItem asChild>
    <Link to="/app/profile"><User className="mr-2 h-4 w-4" />Profile</Link>
  </DropdownMenuItem>
  ```

- `forwardRef` lets parents reach the underlying DOM node — required by Radix triggers (`DropdownMenuTrigger asChild` needs a ref on its child). Aside: React 19 can pass `ref` as a normal prop, but shadcn components still ship the `forwardRef` style; both work.

Compare the two simplest siblings to see the spectrum: `input.tsx` is a single styled `<input>` with `React.ComponentProps<"input">` (no variants, just `cn`), while `card.tsx` is *six* tiny components (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`) — the **slot-by-composition** style where you assemble the pieces you need in order. Note: most dashboard pages don't even use `Card` — they use the `surface` utility class directly (`<div className="surface p-5">`), an app-level choice layered on the same theme.

### The ui-kit tier: `StatCard.tsx`

`src/components/ui-kit/StatCard.tsx` shows an app-flavored component built *on* the system: a tone lookup table (complete class strings, per Module 5.1's rule), an optional `icon: LucideIcon` prop rendered as `<Icon />`, optional `delta` rendering an up/down pill with `delta >= 0 ? "bg-success/12 text-success" : "bg-destructive/12 text-destructive"`, and it delegates number animation to `AnimatedNumber` from `Motion.tsx`. Meanwhile `Motion.tsx` wraps the `motion/react` library: `Reveal` gives every dashboard card its scroll-into-view fade (`initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }}`), and `AnimatedNumber` combines `useMotionValue` + `useSpring` + a ref to animate digits *without React re-renders* (it writes `ref.current.textContent` directly — a rare, legitimate DOM escape hatch).

### The hooks folder: `src/hooks/use-mobile.tsx`

The entire folder is one custom hook:

```tsx
const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => { setIsMobile(window.innerWidth < MOBILE_BREAKPOINT); };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
```

A **custom hook** is just a function that calls hooks — naming it `useX` lets the lint rules check it. This one packages the "am I on mobile?" question: state + a `matchMedia` listener + cleanup, returning a live boolean. Two details worth savoring: initial state is `undefined` (not `false`) because on the server there's no `window` — the effect fills it in on the client; and it's consumed by `components/ui/sidebar.tsx` (a shadcn component). Also notice the layered *strategy*: CSS handles most responsiveness (`lg:hidden` etc., Module 5.1); JS `useIsMobile` exists only for behavior that must branch in logic, not just looks.

### Forms, for real: `signup.tsx` + `auth-schemas.ts` + `form-errors.ts`

**Step 1 — schema** (`src/lib/auth-schemas.ts`):

```ts
export const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  mobile: mobileSchema,        // regex-validated Indian mobile
  password: passwordSchema,    // .min(8).max(72)
  exam: z.enum(EXAM_OPTIONS),
});
export type SignupValues = z.infer<typeof signupSchema>;
```

Each rule carries its user-facing message. `z.infer` derives the TS type — schema and type can never drift. The same file holds `loginSchema`, `otpSchema`, `forgotPasswordSchema`, and `resetPasswordSchema` — the last one showing **cross-field validation**: `.refine((data) => data.password === data.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" })`.

**Step 2 — wire the form** (`src/routes/signup.tsx`):

```tsx
const { register, handleSubmit, setValue, watch, setError, formState: { errors, isSubmitting } } =
  useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", mobile: "", password: "", exam: "JEE" },
  });
```

- `register("name")` returns `{ name, ref, onChange, onBlur }` which is spread onto the input: `<Input ... {...register("name")} />` — that's the whole binding. This works because shadcn's `Input` forwards refs and spreads props (see how the tiers cooperate?).
- `errors.name` appears after failed validation; rendered inline:
  ```tsx
  <Input id="name" placeholder="Aarav Mehta" autoComplete="name" aria-invalid={Boolean(errors.name)} {...register("name")} />
  {errors.name && <p className="text-[12px] text-destructive">{errors.name.message}</p>}
  ```
- **Custom widgets can't be `register`ed** (no native `onChange`), so the exam picker uses the escape hatches: `watch("exam")` to read the live value and `setValue("exam", e, { shouldValidate: true })` in the chip's onClick. `login.tsx` does the same for the Radix `Checkbox` (`onCheckedChange={(v) => setValue("rememberMe", v === true)}`).

**Step 3 — submit through a mutation:**

```tsx
const mutation = useMutation({
  mutationFn: authApi.signup,
  onSuccess: (result, values) => {
    toast.success("Verification code sent.");
    navigate({ to: "/verify-otp", search: { userId: result.userId, mobile: values.mobile } });
  },
  onError: (error) => {
    if (error instanceof ApiError && applyFieldErrors(setError, error.fields)) return;
    toast.error(error instanceof Error ? error.message : "Couldn't create your account.");
  },
});
const onSubmit = handleSubmit((values) => mutation.mutateAsync(values).catch(() => {}));
```

`handleSubmit(fn)` validates first — `fn` only runs with clean, typed `values`. The `onError` line is the elegant bit: `src/lib/form-errors.ts` maps the API's per-field errors (`ApiError.fields`, e.g. `{ mobile: "Already registered" }`) back onto the form via `setError(name, { type: "server", message })` — server-side validation surfaces *on the exact field*, and only unfielded errors become a toast. Client Zod + server envelope, one error UI.

Note the deliberate contrast: `verify-otp.tsx` skips RHF entirely — one field, controlled `useState` (Module 5.2). Right tool per size.

### Recharts: `app.index.tsx`'s learning graph

Recharts builds charts from JSX components — same composition idea:

```tsx
<ResponsiveContainer width="100%" height="100%">
  <AreaChart data={scoreTrend} margin={{ left: -18, right: 6, top: 6 }}>
    <defs>
      <linearGradient id="gScore" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.45} />
        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
      </linearGradient>
    </defs>
    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
    <XAxis dataKey="test" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
    ...
    <Area type="monotone" dataKey="topper" stroke="var(--color-muted-foreground)" strokeDasharray="4 4" fill="none" strokeWidth={1.5} />
    <Area type="monotone" dataKey="score" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#gScore)" />
  </AreaChart>
</ResponsiveContainer>
```

Learn three things from it: `data` is just the `scoreTrend` array from the dashboard query, with `dataKey` naming which field each element plots (`score` vs `topper` — two Areas, one dataset); **every color is a CSS variable** (`var(--color-primary)`) so charts obey the theme like everything else; and `ResponsiveContainer` needs a parent with a real height — hence the wrapper `<div className="mt-5 h-[240px]">`. The same pattern (with `RadarChart`, `PieChart`, `BarChart`) repeats in `app.results.tsx`, `app.exam-dna.tsx`, and `app.parent.tsx`.

---

## Pitfalls & gotchas

1. **Editing `components/ui/` is allowed — but stay generic.** Fixing Button for everyone: yes. Adding a `dashboardTaskRow` variant to Button: no — that belongs in `ui-kit/` or the route. Tier discipline is what keeps 40 files reusable.
2. **`cn` everywhere a `className` prop exists.** If your component accepts `className`, merge it *last*: `cn("defaults...", className)`. Concatenating with template strings (`` `${base} ${className}` ``) breaks override behavior because conflicting utilities both remain.
3. **`asChild` needs exactly one child element.** `<Button asChild><Link .../><span/></Button>` throws. And the child must accept the merged props (DOM element or prop-spreading component).
4. **Don't `register` non-native inputs.** RHF's `register` requires a real input under the hood. Radix Checkbox, Select, the exam chips → `setValue`/`watch`/`Controller`. Spot the pattern in `login.tsx` before you fight this bug yourself.
5. **Zod validates *inputs* here, not *outputs*.** Forms are parsed; API responses are trusted (`payload as T`, Module 5.3). Don't assume a schema exists just because Zod is installed.
6. **`watch()` re-renders.** `watch("exam")` subscribes the whole component to that field. Fine here; on huge forms prefer `useWatch` on a subcomponent.
7. **Charts need explicit height.** `ResponsiveContainer` inside a plain flex/grid cell with no height collapses to 0px and renders nothing — the `h-[240px]` wrapper is not decoration.
8. **`defaultValues` matter for typed forms.** `signupSchema` has no optional fields; the RHF generic `useForm<SignupValues>` typechecks because `defaultValues` supplies all of them (see the comment on `rememberMe` in `auth-schemas.ts` about resolver type friction — that comment is a scar from a real fight).

---

## Exercises

Solutions in [SOLUTIONS.md](./SOLUTIONS.md#module-55).

1. **Predict:** `<Button asChild variant="outline" size="sm" className="rounded-full"><Link to="/app/results">View</Link></Button>` (from `app.index.tsx`, lightly trimmed). What HTML element ends up in the DOM? Write out (approximately) its final class list and explain which classes came from where, and why `rounded-full` survives.
2. **Trace `cn`:** Evaluate `cn("h-9 px-4 rounded-md", isActive && "bg-sidebar-accent", "rounded-full")` for both truthy and falsy `isActive`. Which utility gets dropped, and by which of the two libraries inside `cn`?
3. **Add a variant (hands-on, safe):** Add a `success` variant to `buttonVariants` in `button.tsx` (`bg-success text-success-foreground hover:bg-success/90`), then use it somewhere visible (e.g. swap a dashboard button) and confirm via hot reload that `<Button variant="success">` typechecks with zero changes to `ButtonProps`. Revert. Which Module 5.3 concept made the type update automatic?
4. **Read a primitive:** Open `src/components/ui/checkbox.tsx` (18 lines-ish). Identify: the Radix import, where `cn` merges `className`, how the check icon is rendered, and why there's no `useState` anywhere despite it being interactive.
5. **Design decision:** The exam picker in `signup.tsx` is seven `<button type="button">` chips, not a `<select>` or Radix `RadioGroup`. Give one UX reason and one code reason for the choice — and explain why `type="button"` is load-bearing inside a `<form>`.
6. **Forms:** Add a "Referral code (optional)" field to the signup flow: schema change in `auth-schemas.ts`, JSX in `signup.tsx` with error display, and state which type updates automatically. (Sketch; full diff in SOLUTIONS.md.)
7. **Server errors:** Simulate the backend returning `422 { error: { code: "VALIDATION", message: "Invalid", fields: { mobile: "Already registered" } } }` for signup. Trace the exact path of that message from `apiFetch` to pixels under the mobile input — file by file, function by function.
8. **Custom hook (hands-on):** Write `useCountdown(seconds: number)` extracting the resend-timer logic from `verify-otp.tsx` — returning `{ seconds, restart }` — and show `verify-otp.tsx` using it. Where should the file live, given this project's conventions?

---

**You've completed the chapters.** Check yourself against [SOLUTIONS.md](./SOLUTIONS.md) — then the real graduation exercise: pick one hardcoded string from Module 5.4's "real vs mock" audit (say, the dashboard's `"Tuesday, 28 July"` eyebrow) and replace it with live data, touching every layer you've now studied: a type, a service, a queryOption, a component.
