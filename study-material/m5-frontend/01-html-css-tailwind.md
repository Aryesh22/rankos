# Module 5.1 — HTML, CSS & Tailwind: The Visual Layer

> **Goal:** Understand just enough HTML and CSS to be dangerous, then master Tailwind v4 utility-first styling by dissecting the *actual* class strings used in your RankOS frontend — so that when you open any component in `rankos-ai-mentor/src/`, the `className` soup reads like plain English.

---

## Concepts

### 1. HTML is structure, not looks

Every page in your app ultimately becomes HTML: a tree of *elements* (tags) that the browser renders. React (Module 5.2) just generates this HTML for you. The tags matter:

- `<div>` / `<span>` — generic boxes with **no meaning**. `div` is block-level (stacks vertically), `span` is inline (flows with text).
- **Semantic elements** — same visual default as a `div`, but they *tell the browser and screen readers what the content is*:
  - `<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>` — page regions
  - `<h1>`–`<h6>` — headings, in order of importance (one `<h1>` per page)
  - `<ul>`/`<li>` — lists, `<p>` — paragraphs, `<button>` — things you click, `<a>` — links to places
- **Forms**: `<form>` wraps inputs; `<input>` collects text; `<label>` names an input. Crucially, a label's `htmlFor` (HTML: `for`) attribute must match the input's `id` — clicking the label then focuses the input, and screen readers announce it.

Your codebase takes this seriously. From `rankos-ai-mentor/src/layouts/AppLayout.tsx`:

```tsx
<aside className="fixed inset-y-0 left-0 z-50 flex w-[248px] ...">   {/* sidebar */}
  <nav className="mt-4 flex-1 space-y-6 overflow-y-auto px-3 pb-4"> {/* navigation */}
...
<header className="glass sticky top-0 z-30 flex h-16 ...">           {/* top bar */}
<main className="px-4 pb-24 pt-6 sm:px-6 lg:px-8">{children}</main>  {/* page content */}
```

`aside`, `nav`, `header`, `main` — not four `div`s. That is semantic HTML.

### 2. Accessibility basics (a11y)

Three rules that cover 80% of cases:

1. **Buttons do things, links go places.** Use `<button>` for actions, `<a>`/`<Link>` for navigation. Your app does this: the sidebar close "X" is a `<button>`, the nav items are `<Link>`s.
2. **Icon-only controls need `aria-label`** — a screen reader can't read a picture. Real example from `AppLayout.tsx`:
   ```tsx
   <button className="lg:hidden text-muted-foreground" onClick={() => setOpen(false)} aria-label="Close navigation">
     <X className="h-4 w-4" />
   </button>
   ```
3. **Inputs need labels, and errors need signalling.** From `rankos-ai-mentor/src/routes/login.tsx`:
   ```tsx
   <Label htmlFor="identifier">Email or mobile</Label>
   <Input id="identifier" ... aria-invalid={Boolean(errors.identifier)} {...register("identifier")} />
   ```
   `aria-invalid` tells assistive tech (and Tailwind, via `aria-invalid:` variants) that the field is in an error state.

### 3. CSS: the box model

Every element is a rectangular box with four layers, inside → out:

```
content → padding → border → margin
```

- **padding** = space *inside* the border (pushes content in)
- **margin** = space *outside* the border (pushes neighbours away)
- Modern CSS (and Tailwind) uses `box-sizing: border-box`, meaning `width` includes padding and border — much less surprising.

### 4. Flexbox — 1-dimensional layout

`display: flex` on a parent lays children out in a row (or column). The properties you'll use daily:

| CSS | What it does |
|---|---|
| `flex-direction: row / column` | main axis direction |
| `justify-content` | spacing along the main axis (start/center/between…) |
| `align-items` | alignment on the cross axis |
| `gap` | space between children (use this, not margins) |
| `flex: 1` on a child | "take all remaining space" |

### 5. Grid — 2-dimensional layout

`display: grid` + `grid-template-columns` defines columns; children fill cells automatically. Perfect for card grids and page-level "sidebar + content" splits.

### 6. Responsive units & media queries

- `px` = fixed; `rem` = relative to root font size (16px default) — `1.5rem` = 24px; `%` and `fr` = relative to the container.
- **Media queries** apply styles only above/below a screen width. Tailwind is **mobile-first**: bare utilities apply everywhere; `sm:` / `md:` / `lg:` prefixes apply *from that width up* (640 / 768 / 1024 px).

### 7. Tailwind: utility-first CSS

Instead of writing a CSS class like `.sidebar-link { display:flex; gap:0.625rem; ... }` and inventing names for everything, Tailwind gives you thousands of tiny single-purpose classes (`flex`, `gap-2.5`, `rounded-lg`) that you compose directly in the markup. Why people love it once it clicks:

- **No naming** — the hardest problem in CSS disappears.
- **No dead CSS** — delete the component, the styles go with it.
- **Constraints** — spacing comes from a scale (`p-4` = 1rem, `p-5` = 1.25rem), so designs stay consistent.
- **Co-location** — you see structure and style in one place.

Key vocabulary:

- **Spacing scale**: number × 0.25rem. `p-5` = padding 1.25rem, `mt-4` = margin-top 1rem, `gap-3` = 0.75rem gap. `px-` = left+right, `py-` = top+bottom.
- **Arbitrary values** in square brackets when the scale doesn't have what you need: `w-[248px]`, `text-[13px]`, `tracking-[0.14em]`.
- **Variants** (prefixes with `:`): `hover:bg-accent`, `focus-visible:ring-1`, `lg:hidden`, `disabled:opacity-50`. They chain: `sm:hover:underline`.
- **Opacity modifier** with `/`: `bg-primary/10` = primary color at 10% opacity.

---

## In your codebase

### The Tailwind v4 setup — `rankos-ai-mentor/src/styles.css`

Tailwind v4 has **no `tailwind.config.js`** — everything lives in CSS. Your file opens:

```css
@import "tailwindcss" source(none);
@source "../src";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));
```

Line by line:

1. `@import "tailwindcss" source(none)` — load Tailwind, but don't auto-scan; then
2. `@source "../src"` — scan everything under `src/` for class names. Tailwind reads your `.tsx` files as *text*, finds strings like `rounded-xl`, and generates only that CSS. **This is why you must never build class names dynamically** (`"text-" + color` produces no CSS — Tailwind never saw `text-red-500` as a whole string).
3. `tw-animate-css` adds animation utilities (`animate-spin` friends).
4. `@custom-variant dark` — defines what the `dark:` prefix means: "an ancestor has the class `.dark`".

Next, the **design tokens**. The `@theme inline` block maps Tailwind color utilities to CSS variables:

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-muted-foreground: var(--muted-foreground);
  ...
}
```

This is what makes classes like `bg-background`, `text-muted-foreground`, `bg-primary` exist at all — they are *not* built into Tailwind; your theme defines them. Then `:root` assigns actual values in `oklch()` (a modern, perceptually-uniform color space):

```css
:root {
  --radius: 0.875rem;
  /* Dark-first: the default theme IS the dark theme */
  --background: oklch(0.145 0.004 285.9);
  --foreground: oklch(0.985 0 0);
  --primary: oklch(0.556 0.212 273.5);
  ...
}
.light { --background: oklch(0.99 0.002 285.9); ... }
```

**Dark mode in this app is inverted from most tutorials**: the default theme *is* dark, and a `.light` class on an ancestor would flip the variables to light values. Because components only ever say `bg-background` / `text-foreground` (never `bg-zinc-900`), the entire theme switches by swapping variables — no `dark:` prefixes needed on 99% of components. (Note the comment in the file: *"Never hardcode colors in components."* Search the routes — you won't find `bg-blue-500` anywhere.) Also honest note: as of now nothing in the code toggles `.light` onto `<html>` — the settings page has appearance toggles but no wiring — so the app always renders dark.

The file ends with **custom utilities** — app-specific classes registered via `@utility` so they compose with variants like real Tailwind classes:

```css
@utility surface {
  background-image: var(--gradient-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
}
@utility glass { background-color: color-mix(in oklab, var(--card) 62%, transparent); backdrop-filter: blur(18px) saturate(150%); ... }
@utility hover-lift { ... &:hover { transform: translateY(-3px); ... } }
```

So when you see `className="surface hover-lift p-5"` on a dashboard card — that's two *project-defined* utilities plus one stock one. `styles.css` is loaded in `src/routes/__root.tsx` via `import appCss from "../styles.css?url"` and a `<link rel="stylesheet">` in the route's `head()` (a TanStack Start pattern — more in Module 5.4).

### Dissection 1: the sidebar shell — `AppLayout.tsx`

```tsx
<aside className={cn(
  "fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-border bg-sidebar transition-transform duration-300 lg:translate-x-0",
  open ? "translate-x-0" : "-translate-x-full",
)}>
```

Read it word by word:

- `fixed inset-y-0 left-0` — position: fixed, pinned to top+bottom (`inset-y-0` = `top:0; bottom:0`) and left edge → a full-height sidebar that doesn't scroll with the page.
- `z-50` — stacking order, above the content.
- `flex flex-col` — its children (logo row, search, nav, user chip) stack vertically.
- `w-[248px]` — arbitrary exact width.
- `border-r border-border` — 1px right border, colored with the theme's `--border` token.
- `bg-sidebar` — theme token again (`--sidebar`).
- `transition-transform duration-300` — animate any transform change over 300ms.
- `lg:translate-x-0` + the ternary — **the mobile drawer trick**: below `lg` (1024px) the sidebar sits off-screen at `-translate-x-full` (shifted left by its own width) unless React state `open` is true; at `lg` and up, `lg:translate-x-0` wins and it is always visible. One element, two behaviors, zero JavaScript media queries.

The main area compensates for the sidebar: `<div className="lg:pl-[248px]">` — padding-left equal to the sidebar width, only on large screens.

### Dissection 2: a stat card grid — `app.index.tsx`

```tsx
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
  <StatCard ... /><StatCard ... /><StatCard ... /><StatCard ... />
</div>
```

Mobile-first responsive grid: 1 column by default (phones), 2 from 640px, 4 from 1024px. Below it, the classic dashboard split:

```tsx
<div className="mt-4 grid gap-4 lg:grid-cols-3">
  <Reveal className="lg:col-span-2"> ... </Reveal>  {/* plan takes 2/3 */}
  <Reveal delay={0.06}> ... </Reveal>               {/* mentor card 1/3 */}
</div>
```

### Dissection 3: a task row — `app.index.tsx`

```tsx
<button
  onClick={() => onToggle(t)}
  className={cn(
    "flex w-full items-center gap-3 rounded-xl border border-border px-3.5 py-3 text-left transition-colors hover:border-primary/40",
    t.done && "opacity-55",
  )}
>
```

- `flex items-center gap-3` — icon, text, badge in a row, vertically centered, 12px apart.
- `rounded-xl` — border-radius from the theme's radius scale (`--radius-xl` = `--radius + 4px`).
- `hover:border-primary/40` — on hover the border becomes primary at 40% opacity. Subtle affordance.
- `t.done && "opacity-55"` — a *conditional* class merged in by `cn()` (see Module 5.5 for `cn`). Done tasks fade.

And the title inside: `cn("truncate text-[13.5px] font-medium", t.done && "line-through")` — `truncate` is the one-line ellipsis utility (`overflow:hidden; text-overflow:ellipsis; white-space:nowrap`), which only works because the parent has `min-w-0 flex-1` (a famous flexbox gotcha: flex children refuse to shrink below content size unless you set `min-width: 0`).

### Dissection 4: the divider in the login form — `login.tsx`

```tsx
<div className="flex items-center gap-3 py-1">
  <span className="h-px flex-1 bg-border" />
  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">or</span>
  <span className="h-px flex-1 bg-border" />
</div>
```

Two `h-px flex-1` spans (1px tall, greedy width) with "or" between — the "———— or ————" divider with no images and no absolute positioning. This is what fluent Tailwind looks like: layout expressed as composition.

### Dissection 5: the split auth screen — `AuthLayout.tsx`

```tsx
<div className="grid min-h-screen lg:grid-cols-2">
  <div className="relative hidden flex-col justify-between overflow-hidden border-r border-border p-12 lg:flex">
    <div className="grid-bg pointer-events-none absolute inset-0 opacity-50" />
    <div className="pointer-events-none absolute -left-20 top-1/3 h-[420px] w-[420px] rounded-full opacity-25 blur-[120px]"
         style={{ backgroundImage: "var(--gradient-brand)" }} />
```

- Full-height grid, two columns only on `lg`.
- Left panel is `hidden lg:flex` — completely absent on mobile.
- The glow: an absolutely-positioned 420px circle, blurred by 120px, brand-gradient background, `pointer-events-none` so it never blocks clicks. Decoration layers in this app are always `absolute` + `pointer-events-none`.
- `grid-bg` is the custom `@utility` from `styles.css` that draws the faint grid lines with two `linear-gradient`s.

---

## Pitfalls & gotchas

1. **Dynamic class names don't work.** `className={"text-" + tone}` generates nothing. Do what `StatCard.tsx` does — a lookup table of *complete* strings:
   ```tsx
   const toneRing = { default: "text-muted-foreground", primary: "text-primary", success: "text-success", ... }[tone];
   ```
2. **`margin` vs `gap`.** Prefer `gap` on the flex/grid parent over margins on children — no "last child has extra margin" bugs. Your codebase does this everywhere; also uses `space-y-2` (adds margin-top to all children except the first, e.g. the login form's `className="space-y-4"`).
3. **`truncate` needs `min-w-0`** on the flex child, or the text pushes the row wider instead of ellipsizing. See the user chip in `AppLayout.tsx`: `<div className="min-w-0 flex-1"><p className="truncate ...">`.
4. **Mobile-first means bare = smallest.** `hidden lg:flex` = hidden on phones, flex on desktop. Reading it backwards ("hidden on large"?) is the #1 beginner misreading.
5. **Class order in the string doesn't matter; CSS specificity does.** `"p-2 p-4"` doesn't mean p-4 wins — that's why the project routes every className through `cn()`/`tailwind-merge` (Module 5.5), which correctly resolves conflicts so `<Button className="rounded-full">` can override the default `rounded-md`.
6. **Don't hardcode colors.** The design system comment in `styles.css` is law: use `bg-primary`, `text-destructive`, `border-border`. A raw `bg-indigo-600` would ignore theming and break the future light mode.
7. **`z-index` is a system here, not a random number**: sidebar `z-50` > overlay `z-40` > sticky header `z-30`. Keep new layers consistent with that ladder.

---

## Exercises

Solutions in [SOLUTIONS.md](./SOLUTIONS.md#module-51).

1. **Predict:** Open `rankos-ai-mentor/src/layouts/AppLayout.tsx` and find the mobile overlay `<div className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm lg:hidden" ...>`. Without running the app: (a) when does this element exist in the DOM? (b) what does each class do? (c) why `lg:hidden`?
2. **Predict:** In `app.index.tsx`, quick actions use `className="hover-lift flex flex-col gap-2 rounded-xl border border-border p-4 text-[12.5px] font-medium"`. Where is `hover-lift` defined, and exactly what happens visually on hover?
3. **Decode:** In `AppLayout.tsx` the streak chip is `className="flex items-center gap-1 rounded-full bg-warning/12 px-1.5 py-0.5 text-[11px] font-medium text-warning"`. Explain `bg-warning/12` and why the same color appears twice with different opacity.
4. **Hands-on (safe):** Run the dev server (`npm run dev` or `bun dev`) and open the login page. In `login.tsx`, change the submit button's `className="w-full rounded-xl"` to `className="w-full rounded-full"` and watch hot reload. Then revert. Why did `rounded-full` beat the Button's built-in `rounded-md`?
5. **Hands-on (safe):** In `styles.css`, change `--primary: oklch(0.556 0.212 273.5)` to `oklch(0.65 0.2 150)` (a green). List five places in the UI that change color, then revert. What does this teach you about design tokens?
6. **Fix the a11y bug:** In `test.$testId.tsx`, the "Bookmark" button has visible text, but imagine it were icon-only. Write the corrected JSX. Then find one *real* icon-only button in the same file and confirm it has `aria-label`.
7. **Build:** Using only classes that already appear in this project, write the JSX for a "card with a title row": a `surface p-5` container, a flex row with a `text-[15px] font-semibold` heading on the left and a `text-[12px] text-muted-foreground` hint on the right, then a paragraph. Compare against the "Learning graph" card in `app.index.tsx`.
8. **Grid reasoning:** `test.$testId.tsx` uses `className="grid flex-1 gap-6 p-4 sm:p-6 lg:grid-cols-[1fr_268px]"`. What layout does `lg:grid-cols-[1fr_268px]` produce, and what happens below `lg`?

---

**Next:** [Module 5.2 — React Fundamentals](./02-react-fundamentals.md), where the `className` strings get attached to living, stateful components.
