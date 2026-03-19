---
phase: 14-ui-ux-redesign
verified: 2026-03-19T14:10:00Z
status: human_needed
score: 12/12 automated must-haves verified
re_verification: false
human_verification:
  - test: "Open the app in a browser with DevTools open, select Computed tab, inspect font-family on any body text element"
    expected: "First font listed is 'Be Vietnam Pro' (UI-02)"
    why_human: "CSS computed font-family requires browser rendering — cannot be verified by file inspection alone"
  - test: "Open in an incognito/private window, confirm the onboarding banner appears before submitting any score, then click dismiss and reload"
    expected: "Banner is visible on first visit, disappears after dismiss, and does not reappear on reload (UI-06)"
    why_human: "localStorage behavior requires browser interaction; SSR renders null and client hydrates — cannot verify visually from code"
  - test: "Click the dark mode toggle in the header, then reload the page"
    expected: "Theme switches to dark on click, page reloads into dark mode with no white flash (UI-08)"
    why_human: "No-white-flash behavior depends on next-themes script injection into <head> at runtime — unverifiable from static code"
  - test: "Navigate to http://localhost:3000/some-nonexistent-route"
    expected: "A 404 page renders with Vietnamese text and a home link, not the Next.js default (UI-03)"
    why_human: "not-found.tsx rendering depends on Next.js routing — needs live server"
  - test: "Submit a score (e.g. A00, 22.0), add 3 results to the nguyen vong list, use up/down arrows to reorder, then reload the page"
    expected: "Items appear in the list with tier headers, reorder works, and the exact list order persists after page reload via the URL 'nv' param (UI-04, UI-05)"
    why_human: "URL persistence and list rehydration from nuqs require browser navigation to confirm"
  - test: "Hover (desktop) and tap (mobile or DevTools touch emulation) a tier badge in the results list or nguyen vong list"
    expected: "A tooltip showing the score margin (e.g. '+2.3') appears above the badge (UI-07)"
    why_human: "Tooltip CSS opacity transition and tap-toggle behavior require browser interaction"
---

# Phase 14: UI/UX Redesign Verification Report

**Phase Goal:** The UI communicates trust through correct data presentation, students can edit their nguyện vọng list directly, and first-time users understand what the app does and how to use it
**Verified:** 2026-03-19T14:10:00Z
**Status:** human_needed — all automated checks passed; 6 behaviors require browser verification
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Be Vietnam Pro font applied via --font-sans token | ? NEEDS HUMAN | `@theme inline { --font-sans: var(--font-be-vietnam); }` is present in globals.css; `Be_Vietnam_Pro` loaded with `variable: '--font-be-vietnam'` in layout.tsx — actual computed font-family requires browser |
| 2 | Student can reorder, add, remove nguyen vong items; persists in URL | ✓ VERIFIED (automated) + ? NEEDS HUMAN (persistence) | `moveUp`, `moveDown`, `removeFromList` in NguyenVongList.tsx; `addToList` in ScoreForm.tsx; `useQueryState('nv', parseAsJson(...))` in ScoreForm.tsx; "+" button in ResultsList.tsx — URL persistence needs browser |
| 3 | First-time visitor sees onboarding banner explaining UniSelect | ? NEEDS HUMAN | OnboardingBanner.tsx exists with localStorage `onboarding-dismissed` guard, rendered in app/page.tsx above ScoreForm — SSR-safety and dismiss persistence need browser |
| 4 | Dark mode persists across reloads with no white flash | ? NEEDS HUMAN | ThemeProvider with `attribute="class"` in layout.tsx, `suppressHydrationWarning` on `<html>`, `@custom-variant dark` in globals.css — no-flash guarantee requires browser |
| 5 | Non-existent route shows Vietnamese/English 404 with home link | ? NEEDS HUMAN | app/not-found.tsx exists with `useTranslations('NotFoundPage')`, large "404" text, and `<Link href="/">` — routing activation needs browser |

### Additional Truths (derived from plan must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 6 | Tailwind v4 @theme tokens define semantic color utilities | ✓ VERIFIED | globals.css contains `@custom-variant dark`, two `@theme inline` blocks, `:root` and `.dark` CSS variable blocks with oklch values |
| 7 | Body uses semantic token classes, not hardcoded colors | ✓ VERIFIED | layout.tsx: `<body className="font-sans antialiased bg-surface text-on-surface">` |
| 8 | Error boundary app/error.tsx is a 'use client' with retry | ✓ VERIFIED | `'use client'` on line 1, `reset` prop called in `onClick`, `useTranslations('ErrorPage')` wired |
| 9 | OnboardingBanner does not reappear after dismiss | ✓ VERIFIED (code path) | localStorage.setItem('onboarding-dismissed', '1') on handleDismiss; useEffect reads it on mount |
| 10 | Pre-submission empty state shows guidance text | ✓ VERIFIED | ResultsList.tsx line 42: `if (!hasSubmitted && results.length === 0)` renders `emptyStateBeforeSubmission` translation |
| 11 | Auto-sync useEffect removed from NguyenVongList | ✓ VERIFIED | No `useEffect` exists anywhere in NguyenVongList.tsx; no `setNguyenVong(top15` pattern found |
| 12 | TierBadge tooltip shows score margin on hover/tap | ✓ VERIFIED (code) + ? NEEDS HUMAN (behavior) | `delta?: string` prop in TierBadge.tsx, tooltip span with `group-hover:opacity-100`, tap toggle via `useState` |

**Score:** 12/12 automated checks pass. 6 items require human browser verification.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/globals.css` | @theme tokens, @custom-variant dark, :root/.dark CSS variables | ✓ VERIFIED | 43 lines, contains all required patterns |
| `app/layout.tsx` | ThemeProvider wrapping, suppressHydrationWarning | ✓ VERIFIED | ThemeProvider on line 29, suppressHydrationWarning on line 26 |
| `components/DarkModeToggle.tsx` | Dark mode toggle using next-themes useTheme | ✓ VERIFIED | useTheme on line 7, mounted guard, inline SVG sun/moon icons |
| `app/error.tsx` | Client Component error boundary with retry and home link | ✓ VERIFIED | 'use client', reset() called, useTranslations('ErrorPage') |
| `app/not-found.tsx` | 404 page with Vietnamese/English text and home link | ✓ VERIFIED | Large "404", useTranslations('NotFoundPage'), Link href="/" |
| `components/OnboardingBanner.tsx` | Dismissible banner using localStorage | ✓ VERIFIED | 'use client', 'onboarding-dismissed' key, mounted guard pattern |
| `components/ResultsList.tsx` | Pre-submission empty state with guidance text | ✓ VERIFIED | hasSubmitted prop, emptyStateBeforeSubmission translation key |
| `components/NguyenVongList.tsx` | Editable list with add/remove/reorder and tier grouping headers | ✓ VERIFIED | moveUp, moveDown, removeFromList; TIER_HEADERS at indices 0/5/10 |
| `components/TierBadge.tsx` | Tier badge with score margin tooltip | ✓ VERIFIED | delta?: string prop, tooltip with group-hover + tap toggle |
| `components/ScoreForm.tsx` | Passes addToList callback to ResultsList; owns nuqs nv state | ✓ VERIFIED | addToList function, useQueryState('nv', parseAsJson(...)), props passed to both ResultsList and NguyenVongList |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/globals.css` | `app/layout.tsx` | `@theme inline --font-sans: var(--font-be-vietnam)` | ✓ WIRED | globals.css line 8; layout.tsx line 14 sets `variable: '--font-be-vietnam'` |
| `components/DarkModeToggle.tsx` | `app/layout.tsx` | ThemeProvider provides theme context | ✓ WIRED | ThemeProvider in layout.tsx wraps all children; DarkModeToggle imported and rendered in app/page.tsx |
| `app/error.tsx` | `messages/vi.json` | useTranslations('ErrorPage') | ✓ WIRED | ErrorPage namespace confirmed in vi.json line 62 |
| `app/not-found.tsx` | `messages/vi.json` | useTranslations('NotFoundPage') | ✓ WIRED | NotFoundPage namespace confirmed in vi.json line 68 |
| `components/OnboardingBanner.tsx` | `app/page.tsx` | Imported and rendered above ScoreForm | ✓ WIRED | line 6 import, line 32 render |
| `components/ScoreForm.tsx` | `components/NguyenVongList.tsx` | Lifts addToList from NguyenVongList and passes to ResultsList | ✓ WIRED | addToList in ScoreForm.tsx line 108; passed to ResultsList as onAddToList; nguyenVong/setNguyenVong passed to NguyenVongList |
| `components/NguyenVongList.tsx` | nuqs | useQueryState('nv', parseAsJson) for URL persistence | ✓ WIRED | State lifted to ScoreForm.tsx (line 23); NguyenVongList is now pure presentational — state owned in ScoreForm |
| `components/TierBadge.tsx` | `components/ResultsList.tsx` | TierBadge receives delta prop for tooltip | ✓ WIRED | ResultsList.tsx line 73: `<TierBadge tier={result.tier} delta={deltaStr} />` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| UI-01 | 14-01, 14-04 | Design token system in Tailwind v4 @theme (semantic colors) | ✓ SATISFIED | globals.css: @theme inline with --color-primary, --color-surface, --color-on-surface, --color-border tokens |
| UI-02 | 14-01 | Be Vietnam Pro font applied via --font-sans token | ✓ SATISFIED (code) / ? NEEDS HUMAN (visual) | @theme inline { --font-sans: var(--font-be-vietnam) } in globals.css |
| UI-03 | 14-02 | Error boundaries (error.tsx, not-found.tsx) with Vietnamese/English messaging | ✓ SATISFIED (code) / ? NEEDS HUMAN (routing) | Both files exist with i18n, retry, and home links |
| UI-04 | 14-03 | Nguyen vong list is editable: reorder, add from results, remove items | ✓ SATISFIED (code) / ? NEEDS HUMAN (e2e flow) | moveUp, moveDown, removeFromList, addToList, "+" button all present and wired |
| UI-05 | 14-03 | Nguyen vong list shows tier grouping headers with 5+5+5 strategy explanation | ✓ SATISFIED | TIER_HEADERS at indices 0/5/10; tierDreamDesc/tierPracticalDesc/tierSafeDesc rendered |
| UI-06 | 14-02 | First-time users see onboarding banner explaining UniSelect | ✓ SATISFIED (code) / ? NEEDS HUMAN (UX) | OnboardingBanner.tsx + rendered in page.tsx + localStorage persistence |
| UI-07 | 14-03 | Tier badges show concrete score margins on hover/tap | ✓ SATISFIED (code) / ? NEEDS HUMAN (interaction) | TierBadge delta prop, computeDelta passed from ResultsList and NguyenVongList |
| UI-08 | 14-01 | Dark mode toggle with next-themes, persisted to localStorage | ✓ SATISFIED (code) / ? NEEDS HUMAN (no-flash) | ThemeProvider + suppressHydrationWarning + DarkModeToggle all present |
| UI-09 | 14-02 | Empty state before first submission shows guidance text | ✓ SATISFIED | hasSubmitted guard in ResultsList.tsx; emptyStateBeforeSubmission i18n key wired |

All 9 requirement IDs (UI-01 through UI-09) are claimed across plans 14-01, 14-02, 14-03, 14-04 and are accounted for. No orphaned requirements found.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `components/TierBadge.tsx` | 35 | `bg-gray-900` hardcoded in tooltip span | ℹ️ Info | Tooltip background does not adapt to dark mode — will be dark gray on both light and dark themes. Not a functional blocker (tooltip still appears) but inconsistent with the semantic token migration. |
| `components/UniversitySearch.tsx` | 83, 89, 101, 103, 114 | `border-gray-300`, `text-gray-400`, `text-gray-500`, `text-blue-500`, `hover:text-blue-700` | ⚠️ Warning | UniversitySearch was not in Plan 14-04's explicit scope (plan listed ScoreForm, NguyenVongList, OfflineBanner, page.tsx). These hardcoded colors will not adapt in dark mode. Out of phase scope — deferred. |
| `components/StalenessIndicator.tsx` | 20, 27 | `text-gray-500`, `text-blue-500`, `hover:text-blue-700` | ⚠️ Warning | Not in Phase 14 scope. Same issue as UniversitySearch — dark mode will show stale hardcoded colors. |
| `components/LocaleToggle.tsx` | 17 | `hover:bg-gray-100` | ℹ️ Info | Minor hover state issue in dark mode. Not in Phase 14 scope. |
| `components/ResultsList.tsx` | 22 | `text-gray-400` for stable trend | ℹ️ Info | Explicitly noted as an acceptable exception in Plan 14-04 ("stable trend icon"). Low impact. |

**Note on out-of-scope files:** UniversitySearch.tsx, StalenessIndicator.tsx, and LocaleToggle.tsx were not listed in any Phase 14 plan's `files_modified`. Their hardcoded colors are pre-existing issues, not Phase 14 regressions. The TierBadge tooltip `bg-gray-900` is within scope and is the only in-scope gap.

---

## Human Verification Required

### 1. Font Application (UI-02)

**Test:** Open http://localhost:3000, open DevTools > Elements, select any body text, open Computed tab, scroll to font-family.
**Expected:** First listed font is `Be Vietnam Pro`.
**Why human:** CSS computed values require browser rendering. The wire is correctly established in code (`@theme inline { --font-sans: var(--font-be-vietnam); }`) but the actual resolved font-family depends on runtime font loading.

### 2. Onboarding Banner Dismiss Persistence (UI-06)

**Test:** Open in an incognito window. Confirm banner appears. Click the dismiss button. Close and reopen the same URL (not incognito again). Confirm banner does not show.
**Expected:** Banner visible on first visit, hidden after dismiss, hidden on subsequent visits.
**Why human:** localStorage behavior and the `useEffect + mounted` SSR pattern require a live browser to verify the hide/show timing is correct and doesn't cause a flash.

### 3. Dark Mode No-Flash Persistence (UI-08)

**Test:** Enable dark mode via the toggle. Hard-reload the page (Ctrl+Shift+R).
**Expected:** Page loads directly in dark mode with no brief white flash before the dark theme applies.
**Why human:** The no-flash guarantee depends on next-themes injecting a blocking script into `<head>` at runtime — this cannot be verified from static file analysis.

### 4. 404 Page Routing (UI-03)

**Test:** With `npm run dev` running, navigate to http://localhost:3000/nonexistent-page.
**Expected:** A custom 404 page renders with large "404" text, Vietnamese title/description, and a "Về trang chủ" link back to home.
**Why human:** Next.js `not-found.tsx` activation depends on the routing layer — requires live server.

### 5. Nguyen Vong List URL Persistence (UI-04)

**Test:** Submit a score, add 3 results to the list, reorder them, then copy the URL and open it in a new tab.
**Expected:** The new tab shows the same 3 items in the same order. List survives page reload.
**Why human:** nuqs `useQueryState` URL serialization and deserialization requires browser navigation to confirm round-trip fidelity.

### 6. Tier Badge Tooltip on Hover and Tap (UI-07)

**Test:** Submit a score. In the results list, hover over a tier badge on desktop. On mobile (or DevTools touch emulation), tap a tier badge.
**Expected:** A tooltip showing the score margin (e.g., "+2.3" or "-1.0") appears above the badge in both interaction modes.
**Why human:** CSS opacity transitions and the React `useState` tap-toggle require a live browser to test the visual transition and mobile touch behavior.

---

## Gaps Summary

No automated gaps found. All code-verifiable must-haves are satisfied:

- Design token system: complete with oklch semantic tokens in globals.css
- Font fix: @theme inline wires --font-sans to --font-be-vietnam
- Dark mode: ThemeProvider, DarkModeToggle, suppressHydrationWarning all present and wired
- Error boundaries: error.tsx and not-found.tsx both exist, are substantive, and use i18n
- Onboarding banner: localStorage persistence pattern correctly implemented
- Pre-submission empty state: hasSubmitted guard wired through ScoreForm -> ResultsList
- Editable nguyen vong list: moveUp/moveDown/removeFromList present; auto-sync useEffect removed; state lifted to ScoreForm
- Tier grouping headers: TIER_HEADERS at positions 0/5/10 with tier descriptions
- TierBadge tooltip: delta prop, group-hover CSS, tap useState — note: tooltip uses `bg-gray-900` (not semantic token) but this is a cosmetic issue, not a functional blocker
- Token migration: ScoreForm.tsx, NguyenVongList.tsx, app/page.tsx have zero hardcoded gray/white/blue color classes

The only automated finding worth noting is:
1. `TierBadge.tsx` tooltip uses `bg-gray-900 text-white` (hardcoded) instead of `bg-on-surface text-surface` (semantic). The plan specified the semantic version. This means in light mode the tooltip looks correct, but the tooltip background is not token-driven. This is a cosmetic deviation — the feature works.
2. `UniversitySearch.tsx`, `StalenessIndicator.tsx`, `LocaleToggle.tsx` retain hardcoded colors but were explicitly outside Phase 14's scope.

---

_Verified: 2026-03-19T14:10:00Z_
_Verifier: Claude (gsd-verifier)_
