---
phase: 14-ui-ux-redesign
plan: 01
subsystem: ui
tags: [tailwindcss, dark-mode, next-themes, design-tokens, font, css-variables, oklch]

# Dependency graph
requires:
  - phase: 03-frontend-pwa
    provides: app/globals.css, app/layout.tsx, app/page.tsx base structure
provides:
  - Tailwind v4 @theme semantic design token system (primary, surface, on-surface, border)
  - Dark mode via next-themes with @custom-variant dark CSS selector strategy
  - Be Vietnam Pro font correctly wired to --font-sans via @theme inline
  - DarkModeToggle component with sun/moon icons in header
  - ThemeProvider wrapping with suppressHydrationWarning for no-flash dark mode
  - Semantic token classes on body (bg-surface, text-on-surface) replacing hardcoded colors
affects: [14-02, 14-03, 14-04, 14-05]

# Tech tracking
tech-stack:
  added: [next-themes@0.4.6]
  patterns:
    - Tailwind v4 @theme inline to register semantic CSS variables as utilities
    - @custom-variant dark (&:where(.dark, .dark *)) for class-based dark mode
    - @layer base :root/.dark blocks for light/dark CSS variable overrides
    - useTheme + mounted guard pattern for DarkModeToggle to avoid hydration mismatch

key-files:
  created:
    - components/DarkModeToggle.tsx
    - .planning/phases/14-ui-ux-redesign/deferred-items.md
  modified:
    - app/globals.css
    - app/layout.tsx
    - app/page.tsx
    - messages/vi.json
    - messages/en.json
    - package.json

key-decisions:
  - "next-themes was listed as installed in research but absent from package.json — installed at task time (Rule 3 auto-fix)"
  - "ThemeProvider wraps inside NuqsAdapter per research Pattern 2; both patterns (inside/outside) are valid but plan specified NuqsAdapter > ThemeProvider > NextIntlClientProvider"
  - "scripts/discover.ts cheerio type conflict is a pre-existing build failure unrelated to this plan — deferred to deferred-items.md, not auto-fixed"

patterns-established:
  - "Pattern: @theme inline (not bare @theme) for all CSS variable-backed Tailwind tokens"
  - "Pattern: DarkModeToggle uses mounted state guard (useEffect + useState) to prevent hydration mismatch on SSR icon"
  - "Pattern: All page-level background/text/border classes use semantic tokens (bg-surface, text-on-surface, border-border) not hardcoded Tailwind colors"

requirements-completed: [UI-01, UI-02, UI-08]

# Metrics
duration: 5min
completed: 2026-03-19
---

# Phase 14 Plan 01: Design Tokens, Font Fix, and Dark Mode Summary

**Tailwind v4 semantic design token system with oklch color palette, Be Vietnam Pro font fix via @theme inline, and next-themes dark mode toggle with localStorage persistence**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-19T13:23:37Z
- **Completed:** 2026-03-19T13:28:19Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Established full Tailwind v4 design token system in globals.css with @theme inline blocks and @layer base :root/.dark overrides using oklch color values
- Fixed the long-standing font-sans bug by mapping --font-sans to var(--font-be-vietnam) via @theme inline — Be Vietnam Pro now resolves as the computed font-family
- Implemented dark mode with next-themes: ThemeProvider in layout.tsx, @custom-variant dark in globals.css, DarkModeToggle component with sun/moon icons in header, no white flash on reload via suppressHydrationWarning

## Task Commits

Each task was committed atomically:

1. **Task 1: Design tokens, font fix, and dark mode CSS** - `f0f7ecd` (feat)
2. **Task 2: ThemeProvider integration and DarkModeToggle component** - `22bade5` (feat)

## Files Created/Modified

- `app/globals.css` - @custom-variant dark, @theme inline font-sans, @layer base :root/.dark tokens, second @theme inline for Tailwind utilities
- `app/layout.tsx` - ThemeProvider wrapping NuqsAdapter, suppressHydrationWarning on html, bg-surface text-on-surface on body
- `app/page.tsx` - DarkModeToggle in header, hardcoded colors replaced with semantic tokens
- `components/DarkModeToggle.tsx` - useTheme toggle with mounted guard, inline SVG sun/moon icons, aria-label via i18n
- `messages/vi.json` - toggleDarkMode key added to common namespace
- `messages/en.json` - toggleDarkMode key added to common namespace
- `package.json` - next-themes@0.4.6 added

## Decisions Made

- Used `NuqsAdapter > ThemeProvider > NextIntlClientProvider` nesting order as specified in the plan
- ThemeProvider uses `attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange` — standard next-themes config matching the research
- DarkModeToggle renders `null` until mounted to prevent hydration mismatch on the icon choice (server cannot know if dark/light)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing next-themes dependency**
- **Found during:** Task 2 (ThemeProvider integration)
- **Issue:** Research stated next-themes 0.4.6 was already installed, but it was absent from package.json. Build failed with `Module not found: Can't resolve 'next-themes'`
- **Fix:** Ran `npm install next-themes` which added next-themes@0.4.6 to package.json
- **Files modified:** package.json, package-lock.json
- **Verification:** Import resolves, TypeScript check passes on our files
- **Committed in:** 22bade5 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Missing package was essential for functionality. No scope creep.

## Issues Encountered

- **Pre-existing TypeScript error:** `scripts/discover.ts:195` has a cheerio version conflict from `@crawlee/utils` vendoring its own nested cheerio. This caused `npx next build` to fail with a TypeScript error. Verified it pre-existed before Plan 14-01 by running build on prior commit. Documented in `deferred-items.md`. Our files (app/globals.css, app/layout.tsx, app/page.tsx, components/DarkModeToggle.tsx) have zero TypeScript errors.

## User Setup Required

None - no external service configuration required. Dark mode works via localStorage, no additional environment variables needed.

## Next Phase Readiness

- Design token system is established — all subsequent UI plans (14-02 onward) can use `text-primary`, `bg-surface`, `text-on-surface-muted`, `border-border`, etc.
- Be Vietnam Pro font is correctly resolved — typography plans can proceed
- Dark mode works with localStorage persistence — components added in future plans will automatically support dark mode by using semantic token classes
- Remaining concern: pre-existing `scripts/discover.ts` TypeScript error blocks `npx next build` TypeScript check; should be fixed before CI merge

---
*Phase: 14-ui-ux-redesign*
*Completed: 2026-03-19*
