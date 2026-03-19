# Phase 14: UI/UX Redesign - Research

**Researched:** 2026-03-19
**Domain:** Next.js 15 App Router UI — design tokens, dark mode, interactive list, error boundaries, onboarding
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Blue primary color palette with semantic tokens — professional, trustworthy for education
- next-themes with `class` strategy + CSS variables for dark mode
- Tailwind v4 `@theme` with semantic names (--color-primary, --color-surface, --color-on-surface, etc.)
- Font fix: add `font-family: var(--font-be-vietnam)` to the font-sans token in Tailwind config
- Up/down buttons as primary reorder interaction + optional drag via motion's Reorder component
- State persistence via nuqs URL params (already used in project) — shareable, no login needed
- "+" button on each result card → appends to nguyện vọng list
- Visual tier grouping headers dividing 1-5 (dream), 6-10 (practical), 11-15 (safe) with explanation text
- Dismissible banner at top of page explaining what UniSelect does + what info needed (first-time visitors)
- Empty state before submission: guidance text with icon: "Enter your score above to see matching universities"
- Error boundary (error.tsx, not-found.tsx): full-page Vietnamese/English error with retry button and home link
- Tier badge hover/tap: tooltip showing concrete score margin (e.g., "Điểm bạn cao hơn 2.3 so với điểm chuẩn")

### Claude's Discretion
- Specific color hex values within the blue palette
- Animation/transition timing
- Icon choices
- Responsive breakpoints
- Tooltip positioning strategy

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UI-01 | Design token system established in Tailwind v4 @theme (semantic colors, spacing, typography scale) | @theme and @theme inline syntax documented; @custom-variant dark pattern confirmed |
| UI-02 | Be Vietnam Pro font correctly applied via --font-sans token (fix broken font-sans reference) | @theme inline --font-sans: var(--font-be-vietnam) pattern confirmed from official source |
| UI-03 | Error boundaries added (error.tsx, not-found.tsx) with Vietnamese/English messaging and retry | Next.js 15 error boundary conventions + next-intl error file pattern confirmed |
| UI-04 | Nguyện vọng list is editable: user can reorder (up/down buttons + optional drag), add from results, and remove items | nuqs parseAsJson confirmed; motion Reorder confirmed available but touch issues documented |
| UI-05 | Nguyện vọng list shows tier grouping headers (practical 1-5, dream 6-10, safe 11-15) with 5+5+5 strategy explanation | Pure rendering concern; no external library needed |
| UI-06 | First-time users see an onboarding banner explaining what UniSelect does and what information they need | localStorage + useState dismissal pattern; i18n messages needed |
| UI-07 | Tier badges show concrete score margins on hover/tap (e.g., "Your score is 2.3 above cutoff") | CSS tooltip or Radix tooltip pattern; computeDelta() already exists |
| UI-08 | Dark mode toggle with next-themes, persisted to localStorage, using semantic token variants | next-themes 0.4.6 + Tailwind v4 @custom-variant dark confirmed |
| UI-09 | Empty state before first submission shows guidance text instead of "No matching results" | ResultsList already has empty branch; extend with pre-submission guard |
</phase_requirements>

---

## Summary

Phase 14 implements the complete UI/UX redesign for UniSelect across nine requirements. The primary technical challenges are: (1) establishing a Tailwind v4 design token system with semantic CSS variables that work under both light and dark themes, (2) making NguyenVongList fully editable with nuqs URL persistence, and (3) integrating next-themes in a way that avoids white flash on initial load.

The stack is well-established and all required libraries are either already installed (tailwindcss 4.2.1, nuqs 2.8.9, next-themes 0.4.6) or need only one new install (motion 12.38.0 for optional drag reorder). The font fix is the simplest task: a single `@theme inline` block in globals.css maps the existing `--font-be-vietnam` CSS variable to `--font-sans`, which Tailwind's `font-sans` utility will then resolve correctly.

The biggest known risk is motion's `Reorder` component having confirmed touch/scroll conflicts on iOS and Android (multiple open GitHub issues, unresolved as of 2026). The REQUIREMENTS.md explicitly notes this and mandates up/down buttons as the primary interaction — the drag feature is optional and should be implemented last, guarded by a careful UX review on real devices.

**Primary recommendation:** Implement in this order: (1) UI-01 tokens + UI-02 font fix first (everything else depends on the design system), (2) UI-08 dark mode (depends on tokens), (3) UI-03 error boundaries, (4) UI-04/05 editable list, (5) UI-06 onboarding, (6) UI-07 tooltips, (7) UI-09 empty state.

---

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tailwindcss | 4.2.1 | Utility CSS + design tokens via @theme | Already in project |
| nuqs | 2.8.9 | URL query state for nguyện vọng list | Already in project; NuqsAdapter already in layout |
| next-themes | 0.4.6 | Dark mode toggle + localStorage persistence | Already installed; confirmed working with Next.js 15 App Router |
| next-intl | ^4.8.3 | i18n for all error/onboarding messages | Already in project |

### Needs Installation
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| motion | 12.38.0 | Optional drag-to-reorder (Reorder component) | Only for optional drag feature in UI-04 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| motion Reorder | dnd-kit | REQUIREMENTS.md explicitly forbids dnd-kit as sole interaction due to iOS scroll conflict; up/down buttons must be primary |
| next-themes | Manual localStorage + useEffect | next-themes handles SSR flash suppression automatically; manual solution requires complex script injection |
| CSS-only tooltip | @radix-ui/react-tooltip | Radix tooltip handles accessibility (ARIA, keyboard) better; CSS-only is faster to implement; choose based on time |

**Installation:**
```bash
npm install motion
```

**Version verification (confirmed 2026-03-19):**
- tailwindcss: 4.2.1 (installed)
- nuqs: 2.8.9 (installed)
- next-themes: 0.4.6 (installed)
- motion: 12.38.0 (latest on npm)

---

## Architecture Patterns

### Recommended Project Structure
```
app/
├── error.tsx              # UI-03: error boundary (client component)
├── not-found.tsx          # UI-03: 404 page with home link
├── globals.css            # UI-01, UI-02, UI-08: @theme tokens + @custom-variant dark
├── layout.tsx             # UI-08: ThemeProvider + suppressHydrationWarning
components/
├── NguyenVongList.tsx     # UI-04, UI-05: rewrite to editable + tier grouping
├── TierBadge.tsx          # UI-07: add tooltip wrapper
├── OnboardingBanner.tsx   # UI-06: new dismissible banner
├── DarkModeToggle.tsx     # UI-08: new useTheme toggle button
messages/
├── vi.json                # Add keys: onboarding, tierExplanation, notFound, error, darkMode
├── en.json                # Same keys in English
```

### Pattern 1: Tailwind v4 @theme Design Tokens + Dark Mode

**What:** Define semantic CSS custom properties in globals.css. Two separate concerns: (a) `@theme` block for token generation, (b) `@custom-variant dark` for switching.

**When to use:** Always — must come before any dark mode CSS.

**Example:**
```css
/* Source: https://tailwindcss.com/docs/theme + https://www.sujalvanjare.com/blog/dark-mode-nextjs15-tailwind-v4 */
@import "tailwindcss";

/* 1. Dark mode variant: targets .dark class on <html> (set by next-themes attribute="class") */
@custom-variant dark (&:where(.dark, .dark *));

/* 2. Font fix: map Next.js font variable to Tailwind's font-sans */
@theme inline {
  --font-sans: var(--font-be-vietnam);
}

/* 3. Semantic color tokens that change per theme */
@layer base {
  :root {
    --color-primary: oklch(0.55 0.18 240);       /* blue-600 equivalent */
    --color-primary-hover: oklch(0.48 0.18 240);  /* blue-700 equivalent */
    --color-surface: oklch(1.0 0 0);              /* white */
    --color-surface-subtle: oklch(0.97 0 0);      /* gray-50 */
    --color-on-surface: oklch(0.11 0 0);          /* gray-900 */
    --color-on-surface-muted: oklch(0.45 0 0);    /* gray-600 */
    --color-border: oklch(0.92 0 0);              /* gray-200 */
  }
  .dark {
    --color-primary: oklch(0.68 0.18 240);        /* lighter blue in dark */
    --color-primary-hover: oklch(0.62 0.18 240);
    --color-surface: oklch(0.13 0 0);             /* dark background */
    --color-surface-subtle: oklch(0.18 0 0);      /* slightly lighter dark */
    --color-on-surface: oklch(0.95 0 0);          /* near-white text */
    --color-on-surface-muted: oklch(0.65 0 0);    /* muted text in dark */
    --color-border: oklch(0.27 0 0);              /* dark border */
  }
}

/* 4. Generate Tailwind utilities from semantic tokens */
@theme inline {
  --color-primary: var(--color-primary);
  --color-surface: var(--color-surface);
  --color-surface-subtle: var(--color-surface-subtle);
  --color-on-surface: var(--color-on-surface);
  --color-on-surface-muted: var(--color-on-surface-muted);
  --color-border: var(--color-border);
}
```

**Key insight:** `@theme inline` (not bare `@theme`) is used when referencing CSS variables, so Tailwind resolves the variable reference at runtime rather than embedding a static value. Bare `@theme` embeds the value into a global CSS variable that CAN be overridden via `:root`/`.dark` — both patterns work, but `@theme inline` + separate `:root`/`.dark` layers is the pattern confirmed by official Tailwind docs and multiple 2025 guides.

### Pattern 2: next-themes ThemeProvider Integration

**What:** Wrap layout body in ThemeProvider; add `suppressHydrationWarning` to `<html>`.

**When to use:** Required for no-flash dark mode.

```tsx
// Source: https://github.com/pacocoursey/next-themes
// app/layout.tsx — add ThemeProvider and suppressHydrationWarning
import { ThemeProvider } from 'next-themes';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className={font.variable} suppressHydrationWarning>
      <body className="bg-surface text-on-surface antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <NuqsAdapter>
            <NextIntlClientProvider messages={messages}>
              <OfflineBanner />
              {children}
            </NextIntlClientProvider>
          </NuqsAdapter>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

**Critical:** `suppressHydrationWarning` on `<html>` is REQUIRED. next-themes updates the `class` attribute on `<html>` on the client — without this, React throws hydration mismatch warnings in development.

### Pattern 3: Editable NguyenVongList with nuqs

**What:** The nguyện vọng list must be user-controlled: add from results, reorder, remove. State persists in URL via nuqs.

**Current state:** NguyenVongList auto-syncs from results on every `results` change (line 35 in current component). This must change — the list becomes user-owned and only populates on explicit "+" action.

**nuqs v2 parseAsJson approach (already used in project):**
```typescript
// Source: https://nuqs.dev/docs/parsers/built-in
// Keep the existing NvItem[] + parseAsJson pattern
// Remove the auto-sync useEffect that overwrites user choices
const [nguyenVong, setNguyenVong] = useQueryState(
  'nv',
  parseAsJson<NvItem[]>((value): NvItem[] | null => {
    if (!Array.isArray(value)) return null;
    return value as NvItem[];
  }).withDefault([])
);

// Move up: move item at index i to index i-1
function moveUp(index: number) {
  if (index === 0) return;
  const next = [...nguyenVong];
  [next[index - 1], next[index]] = [next[index], next[index - 1]];
  setNguyenVong(next);
}

// Move down: move item at index i to index i+1
function moveDown(index: number) {
  if (index === nguyenVong.length - 1) return;
  const next = [...nguyenVong];
  [next[index], next[index + 1]] = [next[index + 1], next[index]];
  setNguyenVong(next);
}

// Add from results card
function addToList(result: RecommendResult) {
  const item = { u: result.university_id, m: result.major_id };
  const already = nguyenVong.some(x => x.u === item.u && x.m === item.m);
  if (!already && nguyenVong.length < 15) {
    setNguyenVong([...nguyenVong, item]);
  }
}

// Remove
function removeFromList(index: number) {
  setNguyenVong(nguyenVong.filter((_, i) => i !== index));
}
```

### Pattern 4: Tier Grouping Headers (UI-05)

**What:** Group nguyện vọng items by tier band with section headers explaining the 5+5+5 strategy.

```
Positions 1–5:   "Ước mơ" / "Dream" — aim high; at least 1 dream school
Positions 6–10:  "Khả thi" / "Practical" — your realistic range
Positions 11–15: "An toàn" / "Safety" — schools where you are comfortably above cutoff
```

**Implementation:** Loop over positions 1-15, inject a header element before position 1, 6, 11. The tier band depends on position index, NOT on the `result.tier` property — user can put any school anywhere.

### Pattern 5: Onboarding Banner (UI-06)

**What:** Dismissible banner on first visit. Use `localStorage` key `'onboarding-dismissed'`.

```typescript
// app/page.tsx or OnboardingBanner.tsx (client component)
const [dismissed, setDismissed] = useState(() => {
  if (typeof window === 'undefined') return true; // SSR: don't flash banner
  return localStorage.getItem('onboarding-dismissed') === '1';
});

function dismiss() {
  localStorage.setItem('onboarding-dismissed', '1');
  setDismissed(true);
}
```

**SSR note:** Initialize from localStorage in `useState` initializer (lazy init). Use `typeof window === 'undefined'` guard. The initial server render will always return `true` (banner hidden), then client hydration may show it — this is acceptable and avoids hydration mismatch.

### Pattern 6: next-intl Error Files (UI-03)

**What:** `error.tsx` must be a Client Component. `not-found.tsx` can be a Server Component. Both need translation access.

```tsx
// Source: https://next-intl.dev/docs/environments/error-files
// app/error.tsx — Client Component
'use client';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('ErrorPage');
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-xl font-bold text-on-surface">{t('title')}</h1>
      <p className="text-on-surface-muted text-sm">{t('description')}</p>
      <div className="flex gap-3">
        <button onClick={reset} className="...">{t('retry')}</button>
        <Link href="/" className="...">{t('home')}</Link>
      </div>
    </main>
  );
}
```

**Critical for next-intl + error.tsx:** The `NextIntlClientProvider` in `layout.tsx` must pass down the error messages namespace. The current layout already passes all messages — this will work without changes. If a namespace-filtered approach is wanted, use `pick(messages, 'ErrorPage')`.

```tsx
// app/not-found.tsx — Server Component (can use async/await)
import { useTranslations } from 'next-intl';
import Link from 'next/link';

export default function NotFound() {
  const t = useTranslations('NotFoundPage');
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-xl font-bold">{t('title')}</h1>
      <p className="text-sm text-on-surface-muted">{t('description')}</p>
      <Link href="/">{t('backHome')}</Link>
    </main>
  );
}
```

### Pattern 7: motion Reorder (optional drag, UI-04)

**What:** Optional drag-to-reorder using `motion`'s `Reorder` components. Up/down buttons are PRIMARY.

```tsx
// Source: https://motion.dev/docs/react-reorder
import { Reorder } from 'motion/react';

<Reorder.Group axis="y" values={items} onReorder={setItems}>
  {items.map((item) => (
    <Reorder.Item key={item.id} value={item}>
      {/* item content */}
    </Reorder.Item>
  ))}
</Reorder.Group>
```

**Touch conflict mitigation:** Use `useDragControls` to restrict drag to a dedicated handle icon, NOT the whole card. This prevents accidental drag when scrolling.

```tsx
import { useDragControls } from 'motion/react';

function NvItem({ item, onReorder }) {
  const controls = useDragControls();
  return (
    <Reorder.Item value={item} dragListener={false} dragControls={controls}>
      {/* drag handle — touch here to drag */}
      <span onPointerDown={e => controls.start(e)} className="cursor-grab touch-none">⠿</span>
      {/* rest of card — scroll-safe */}
    </Reorder.Item>
  );
}
```

`touch-none` (`touch-action: none`) on the drag handle prevents the browser from claiming touch events for scroll, which is the root cause of the iOS conflict.

### Anti-Patterns to Avoid
- **Auto-sync nguyện vọng list from results:** The current `useEffect` in NguyenVongList overwrites any user edits whenever `results` changes. Remove it and let users own the list.
- **`dark:text-gray-100` scattered across components:** Requires visiting every file to change dark mode colors. Semantic tokens + CSS variable override is the maintainable alternative.
- **`readFileSync` in the localStorage init:** Not applicable to browser code, but: never call `localStorage` outside a browser guard.
- **`ThemeProvider` outside `<html>` tag:** next-themes modifies the `<html>` element; wrapping in `<body>` is correct.
- **Skipping `suppressHydrationWarning`:** The `<html>` tag gets a `class` attribute added/removed by next-themes on the client — this will generate React hydration warnings in dev without the suppress flag.
- **Using `@theme` (not `@theme inline`) for font-sans:** Bare `@theme` embeds the literal value `var(--font-be-vietnam)` as a CSS string in the generated variable, which does NOT resolve at runtime. Use `@theme inline` so Tailwind uses the variable reference directly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dark mode persistence + no-flash | Custom localStorage + script injection | next-themes 0.4.6 | next-themes injects an inline script before first paint to prevent flash; hand-rolling this is error-prone |
| Drag-to-reorder | Custom mouse/touch event handlers | motion Reorder + useDragControls | Inertia physics, layout animation, accessibility all built in |
| CSS-only tooltip accessible to keyboard/screen reader | `title` attribute | Radix Tooltip or motion whileHover | `title` has no touch support, poor accessibility |

**Key insight:** The most complex part of this phase is NOT the design tokens — it's the NguyenVongList refactor, because the current component auto-syncs from API results and must be converted into user-owned state without breaking existing test coverage.

---

## Common Pitfalls

### Pitfall 1: White Flash on Dark Mode Load
**What goes wrong:** Page loads in light mode for one frame before JS applies the `dark` class.
**Why it happens:** Theme is stored in localStorage (client-only); server renders without theme class.
**How to avoid:** `suppressHydrationWarning` on `<html>` + `ThemeProvider` from next-themes. next-themes injects an inline script in `<head>` that reads localStorage and sets the class before React hydrates.
**Warning signs:** Short white flash visible on page refresh when system is in dark mode.

### Pitfall 2: nuqs URL State Overwritten By Auto-Sync
**What goes wrong:** User reorders their list; API refetch (on score change) triggers the `useEffect` that sets `nguyenVong` back to the API's top-15 order.
**Why it happens:** Current NguyenVongList has `useEffect` that calls `setNguyenVong(top15.map(...))` on every `results` change.
**How to avoid:** Remove that useEffect. The "add to list" action must be the only way items enter the URL state.
**Warning signs:** Reordering works but resets to original order after any form interaction.

### Pitfall 3: font-sans Not Resolving to Be Vietnam Pro
**What goes wrong:** Body text renders in system sans-serif; DevTools shows `font-family: ui-sans-serif, system-ui, ...` not `Be Vietnam Pro`.
**Why it happens:** `font.variable` injects `--font-be-vietnam` as a CSS custom property on `<html>`, but the Tailwind `font-sans` utility resolves to its own built-in stack, not to `--font-be-vietnam`.
**How to avoid:** Add `@theme inline { --font-sans: var(--font-be-vietnam); }` in globals.css. This tells Tailwind's `font-sans` utility to resolve via the CSS variable at runtime.
**Warning signs:** Computed `font-family` in DevTools does NOT show "Be Vietnam Pro" as the first entry.

### Pitfall 4: motion Reorder Touch Conflict
**What goes wrong:** On iOS/Android, touching a list item initiates drag instead of letting the parent page scroll.
**Why it happens:** Reorder.Item sets `touch-action: none` on the whole card by default.
**How to avoid:** Set `dragListener={false}` on Reorder.Item and use `useDragControls` with a dedicated drag handle. Apply `touch-none` class only to the drag handle element.
**Warning signs:** Users cannot scroll the page when their finger starts on a list item.

### Pitfall 5: error.tsx Not Catching Layout Errors
**What goes wrong:** Error thrown in layout.tsx is not caught by error.tsx at the same level.
**Why it happens:** Next.js error boundaries cannot catch errors in their parent layout segment.
**How to avoid:** `app/error.tsx` catches errors in route segments (page.tsx). Use `app/global-error.tsx` (with its own `<html>/<body>`) for root layout errors if needed. For this phase, `app/error.tsx` is sufficient.
**Warning signs:** Layout-level crash shows default Next.js error page, not your custom error.tsx.

### Pitfall 6: i18n Messages Missing New Keys
**What goes wrong:** `useTranslations('ErrorPage')` throws at runtime because the namespace does not exist in vi.json/en.json.
**Why it happens:** New i18n keys must be added to BOTH message files; next-intl throws on missing keys in development.
**How to avoid:** Add all new message keys before writing the components that consume them. New namespaces needed: `ErrorPage`, `NotFoundPage`, `OnboardingBanner`.
**Warning signs:** TypeScript error from next-intl types, or runtime "Missing message" error.

---

## Code Examples

### UI-02: Font Fix (globals.css)
```css
/* Source: https://www.owolf.com/blog/how-to-use-custom-fonts-in-a-nextjs-15-tailwind-4-app */
@import "tailwindcss";

@theme inline {
  --font-sans: var(--font-be-vietnam);
}
```
No changes needed in layout.tsx — `font.variable` already adds `--font-be-vietnam` to `<html>` className.

### UI-08: Dark Mode Toggle Component
```tsx
'use client';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';

export function DarkModeToggle() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations('common');

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label={t('toggleDarkMode')}
      className="p-2 rounded-lg border border-border hover:bg-surface-subtle transition-colors"
    >
      {/* icon: sun or moon */}
    </button>
  );
}
```

### UI-07: Tier Badge Tooltip
```tsx
// Simplest approach: CSS tooltip via group/peer pattern — no library needed
export function TierBadge({ tier, delta }: { tier: Tier; delta?: string }) {
  const t = useTranslations('common');
  return (
    <span className="relative group">
      <span className={`inline-block px-2 py-0.5 text-xs font-medium border rounded-full cursor-help ${TIER_STYLES[tier]}`}>
        {t(tier)}
      </span>
      {delta && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1
                         bg-on-surface text-surface text-xs rounded whitespace-nowrap
                         opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
          {delta}
        </span>
      )}
    </span>
  );
}
```
For touch (tap) support: add `onClick` toggle of a `shown` state since CSS hover does not trigger on touch devices.

### UI-03: not-found.tsx (App Router)
```tsx
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/not-found
// app/not-found.tsx
import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function NotFound() {
  const t = useTranslations('NotFoundPage');
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
      <p className="text-6xl">404</p>
      <h1 className="text-xl font-bold">{t('title')}</h1>
      <p className="text-sm text-on-surface-muted text-center">{t('description')}</p>
      <Link href="/" className="text-primary underline">{t('backHome')}</Link>
    </main>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.ts` darkMode: 'class' | `@custom-variant dark (&:where(.dark, .dark *))` in CSS | Tailwind v4 (2025) | No JS config file; CSS-first dark mode |
| `tailwind.config.ts` theme.extend.fontFamily | `@theme inline { --font-sans: var(...) }` in CSS | Tailwind v4 (2025) | Font config moves to globals.css |
| Framer Motion as separate package | `motion` (unified package) | 2024 rename | Import from `motion/react`, not `framer-motion` |
| nuqs v1 `parseAsJson` without validator | nuqs v2 `parseAsJson` requires validator function | nuqs v2 (2024) | Existing project already uses v2 pattern with validator |

**Deprecated/outdated:**
- `tailwind.config.js/ts` for theme customization: Tailwind v4 is fully CSS-first. The project has no `tailwind.config.ts` and this is correct for v4.
- `import { motion } from 'framer-motion'`: Use `import { motion } from 'motion/react'` — both resolve to the same package but `motion/react` is the canonical name post-rename.

---

## Open Questions

1. **Tooltip on touch devices**
   - What we know: CSS `:hover` does not fire on mobile touch; tap must toggle visibility
   - What's unclear: Whether to use a simple boolean state toggle (accessible, simple) or a floating-ui/popover library (full positioning, keyboard support)
   - Recommendation: Start with boolean state toggle in TierBadge (within Claude's discretion scope); escalate to floating-ui only if positioning is problematic on small screens

2. **motion Reorder Android touch validation**
   - What we know: Confirmed iOS scroll conflict; STATE.md flags this for validation before committing
   - What's unclear: Whether the `useDragControls + touch-none` mitigation resolves the issue on Android Chrome specifically
   - Recommendation: Implement drag as a last task, test on real device or BrowserStack before merging; up/down buttons are the primary interaction and ship first

3. **Onboarding banner SSR behavior**
   - What we know: localStorage is not available on server; `useState(() => localStorage.get(...))` will throw during SSR
   - What's unclear: Whether the `typeof window === 'undefined'` guard in the lazy initializer is sufficient or if a `useEffect` + mount flag is needed
   - Recommendation: Use `useEffect` pattern (set state after mount) to be safe; lazy initializer with the window guard also works but is less conventional

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | vitest.config.mts |
| Quick run command | `npx vitest run tests/components/NguyenVongList.test.tsx tests/components/ScoreForm.test.tsx` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | Design tokens apply in globals.css | manual | DevTools visual check | ❌ manual |
| UI-02 | Be Vietnam Pro is computed font-family on body | manual | DevTools computed font-family | ❌ manual |
| UI-03 | error.tsx renders on uncaught error | unit | `npx vitest run tests/components/ErrorPage.test.tsx` | ❌ Wave 0 |
| UI-03 | not-found.tsx renders with home link | unit | `npx vitest run tests/components/NotFoundPage.test.tsx` | ❌ Wave 0 |
| UI-04 | Add item to nguyện vọng list updates URL nv param | unit | `npx vitest run tests/components/NguyenVongList.test.tsx` | ✅ (extend) |
| UI-04 | Move up/down reorders items | unit | `npx vitest run tests/components/NguyenVongList.test.tsx` | ✅ (extend) |
| UI-04 | Remove item from list | unit | `npx vitest run tests/components/NguyenVongList.test.tsx` | ✅ (extend) |
| UI-05 | Tier group headers render at positions 1, 6, 11 | unit | `npx vitest run tests/components/NguyenVongList.test.tsx` | ✅ (extend) |
| UI-06 | Onboarding banner appears when not dismissed | unit | `npx vitest run tests/components/OnboardingBanner.test.tsx` | ❌ Wave 0 |
| UI-06 | Dismissal stores flag and hides banner | unit | `npx vitest run tests/components/OnboardingBanner.test.tsx` | ❌ Wave 0 |
| UI-07 | Tier badge tooltip shows score margin | unit | `npx vitest run tests/components/TierBadge.test.tsx` | ❌ Wave 0 |
| UI-08 | Dark mode toggle calls setTheme | unit | `npx vitest run tests/components/DarkModeToggle.test.tsx` | ❌ Wave 0 |
| UI-09 | Empty state shows before any submission (results=[]) | unit | `npx vitest run tests/components/ResultsList.test.tsx` | ❌ Wave 0 |

**Note:** vitest.config.mts has `environment: 'node'`. Component tests use `// @vitest-environment jsdom` pragma (as seen in NguyenVongList.test.tsx) to opt in to jsdom per-file. All new component test files must include this pragma.

### Sampling Rate
- **Per task commit:** `npx vitest run tests/components/NguyenVongList.test.tsx`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/components/ErrorPage.test.tsx` — covers UI-03 error boundary rendering
- [ ] `tests/components/NotFoundPage.test.tsx` — covers UI-03 not-found rendering + home link
- [ ] `tests/components/OnboardingBanner.test.tsx` — covers UI-06 show/dismiss behavior
- [ ] `tests/components/TierBadge.test.tsx` — covers UI-07 tooltip with score margin
- [ ] `tests/components/DarkModeToggle.test.tsx` — covers UI-08 toggle interaction
- [ ] `tests/components/ResultsList.test.tsx` — covers UI-09 pre-submission empty state (file may partially exist; check before creating)

---

## Sources

### Primary (HIGH confidence)
- [https://tailwindcss.com/docs/theme](https://tailwindcss.com/docs/theme) — @theme syntax, @theme inline vs bare @theme, dark mode @custom-variant
- [https://tailwindcss.com/docs/dark-mode](https://tailwindcss.com/docs/dark-mode) — @custom-variant dark syntax confirmed: `(&:where(.dark, .dark *))`
- [https://github.com/pacocoursey/next-themes](https://github.com/pacocoursey/next-themes) — ThemeProvider API, suppressHydrationWarning requirement, attribute="class"
- [https://nuqs.dev/docs/parsers/built-in](https://nuqs.dev/docs/parsers/built-in) — parseAsJson, parseAsArrayOf API in v2
- [https://next-intl.dev/docs/environments/error-files](https://next-intl.dev/docs/environments/error-files) — error.tsx + not-found.tsx with next-intl translations
- [https://nextjs.org/docs/app/api-reference/file-conventions/not-found](https://nextjs.org/docs/app/api-reference/file-conventions/not-found) — not-found.tsx convention

### Secondary (MEDIUM confidence)
- [https://www.sujalvanjare.com/blog/dark-mode-nextjs15-tailwind-v4](https://www.sujalvanjare.com/blog/dark-mode-nextjs15-tailwind-v4) — Verified globals.css @custom-variant + :root/.dark pattern, ThemeProvider structure (2025 article)
- [https://www.owolf.com/blog/how-to-use-custom-fonts-in-a-nextjs-15-tailwind-4-app](https://www.owolf.com/blog/how-to-use-custom-fonts-in-a-nextjs-15-tailwind-4-app) — Confirmed `@theme inline { --font-sans: var(--font-be-vietnam) }` pattern (2025)
- [https://motion.dev/docs/react-reorder](https://motion.dev/docs/react-reorder) — Reorder.Group/Item API, useDragControls

### Tertiary (LOW confidence — flag for validation)
- Multiple GitHub issues on motion Reorder touch conflict (issues #1506, #1341, #1339) — confirms problem is real, but `useDragControls + touch-none` mitigation needs device validation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed or on npm registry; versions confirmed
- Architecture: HIGH — official docs confirm all patterns; Tailwind v4 @theme and next-themes integration confirmed by multiple 2025 sources
- Pitfalls: HIGH for font fix, dark mode flash, nuqs auto-sync; MEDIUM for motion touch (confirmed issue, mitigation needs device testing)

**Research date:** 2026-03-19
**Valid until:** 2026-04-18 (30 days — stable libraries)
