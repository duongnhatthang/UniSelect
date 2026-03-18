---
phase: 03-frontend-pwa
plan: "01"
subsystem: ui
tags: [next-intl, nuqs, serwist, pwa, service-worker, i18n, typescript]

# Dependency graph
requires:
  - phase: 02-core-api-and-algorithm
    provides: RecommendResult type, /api/recommend endpoint, cutoff_scores schema with scraped_at/source_url
provides:
  - next-intl 4.8.3 + nuqs 2.8.9 + @serwist/next 9.5.7 installed and configured
  - Root layout with NuqsAdapter + NextIntlClientProvider + Be_Vietnam_Pro font
  - Cookie-based i18n locale resolution defaulting to Vietnamese
  - Serwist service worker with NetworkOnly rule for /api/recommend
  - PWA manifest with 192x192 and 512x512 icon entries
  - Offline fallback page at /~offline
  - OfflineBanner component using navigator.onLine
  - LocaleToggle component with cookie set + router.refresh
  - scraped_at and source_url fields on RecommendResult and CutoffDataRow
  - vi.json and en.json translation string skeletons with matching key structure
affects: [03-frontend-pwa plans 02-07, any component using translations or URL state]

# Tech tracking
tech-stack:
  added: [next-intl@4.8.3, nuqs@2.8.9, "@serwist/next@9.5.7", serwist@9.5.7, "@testing-library/react@16.3.2", "@testing-library/dom@10.4.1", jsdom@29.0.0]
  patterns: [cookie-based i18n without URL routing, NuqsAdapter root wrap, NetworkOnly SW rule before defaultCache, relative imports (no @/ alias), split dev=turbopack/build=webpack scripts]

key-files:
  created:
    - app/layout.tsx
    - app/page.tsx
    - app/sw.ts
    - app/manifest.ts
    - app/~offline/page.tsx
    - app/globals.css
    - i18n/request.ts
    - messages/vi.json
    - messages/en.json
    - components/OfflineBanner.tsx
    - components/LocaleToggle.tsx
    - public/icons/icon-192.png
    - public/icons/icon-512.png
    - public/sw.js
  modified:
    - lib/recommend/types.ts
    - lib/recommend/engine.ts
    - app/api/recommend/route.ts
    - tests/api/recommend.test.ts
    - tests/api/recommend-engine.test.ts
    - next.config.ts
    - tsconfig.json
    - package.json

key-decisions:
  - "sw.ts uses matcher property (not urlPattern) and NetworkOnly class instance — Serwist 9.5.7 RuntimeCaching interface uses matcher not urlPattern"
  - "Split dev/build scripts: dev=next dev --turbopack, build=next build --webpack — Serwist requires webpack for service worker bundling"
  - "next-intl without i18n routing: cookie-based locale with NEXT_LOCALE key, router.refresh() on toggle"
  - "webworker added to tsconfig lib alongside dom — no conflicts detected in this project (Pitfall 5 did not materialize)"

patterns-established:
  - "Pattern: All relative imports (no @/ alias) — tsconfig paths maps @/* to ./src/* which does not exist"
  - "Pattern: NuqsAdapter wraps NextIntlClientProvider in root layout"
  - "Pattern: OfflineBanner uses useEffect + navigator.onLine with online/offline event listeners"

requirements-completed: [PIPE-05]

# Metrics
duration: 7min
completed: 2026-03-18
---

# Phase 3 Plan 01: PWA Infrastructure Setup Summary

**Next.js 16 PWA foundation with Serwist service worker, next-intl cookie-based i18n, nuqs URL state adapter, and /api/recommend extended with scraped_at + source_url**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-18T10:56:49Z
- **Completed:** 2026-03-18T11:04:16Z
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments

- Extended RecommendResult and CutoffDataRow types with scraped_at and source_url; /api/recommend SELECT now returns these fields; all 109 tests pass
- Installed and configured all Phase 3 libraries (next-intl 4.8.3, nuqs 2.8.9, @serwist/next 9.5.7, serwist 9.5.7, testing-library)
- Root layout with NuqsAdapter + NextIntlClientProvider + Be_Vietnam_Pro font; cookie-based i18n defaulting to Vietnamese
- Serwist service worker builds successfully (public/sw.js at 43KB); PWA manifest valid with icon entries; offline fallback page at /~offline

## Task Commits

1. **Task 1: Extend /api/recommend with scraped_at+source_url, install libraries, configure Next.js** - `922f6ae` (feat)
2. **Task 2: Create root layout, i18n config, PWA manifest, service worker, offline page** - `a78c514` (feat)

## Files Created/Modified

- `lib/recommend/types.ts` — Added scraped_at/source_url to CutoffDataRow and RecommendResult
- `lib/recommend/engine.ts` — Passes scraped_at/source_url from most recent year row to results
- `app/api/recommend/route.ts` — SELECT now includes scraped_at and source_url columns
- `tests/api/recommend.test.ts` — Updated mock factory; added scraped_at/source_url test
- `tests/api/recommend-engine.test.ts` — Updated makeRow to include new required fields
- `next.config.ts` — Configured with withSerwistInit + createNextIntlPlugin
- `tsconfig.json` — Added @serwist/next/typings, webworker lib, excluded public/sw.js
- `package.json` — Split dev/build scripts; added all Phase 3 dependencies
- `app/layout.tsx` — Root layout with NuqsAdapter + NextIntlClientProvider + Be_Vietnam_Pro
- `app/page.tsx` — Minimal placeholder home page
- `app/sw.ts` — Serwist service worker with NetworkOnly for /api/recommend
- `app/manifest.ts` — PWA manifest with 192x192 and 512x512 icons
- `app/~offline/page.tsx` — Offline fallback page
- `app/globals.css` — Tailwind v4 import
- `i18n/request.ts` — Cookie-based locale resolution, defaults to vi
- `messages/vi.json` — Vietnamese translation string skeleton (ASCII-safe, diacritics in Plan 04)
- `messages/en.json` — English translation string skeleton with matching key structure
- `components/OfflineBanner.tsx` — Client component using navigator.onLine
- `components/LocaleToggle.tsx` — Cookie toggle + router.refresh locale switch
- `public/icons/icon-192.png` — Blue placeholder PNG (192x192)
- `public/icons/icon-512.png` — Blue placeholder PNG (512x512)
- `public/sw.js` — Generated Serwist service worker (43KB)

## Decisions Made

- **sw.ts uses `matcher` not `urlPattern`:** Serwist 9.5.7 `RuntimeCaching` interface uses `matcher` property; plan used string `"NetworkOnly"` for handler but API requires class instance. Both fixed during Task 2.
- **next-intl `i18n/request.ts` import path:** Uses `../messages/${locale}.json` (relative to i18n/); confirmed correct at build time.
- **webworker in tsconfig lib:** Pitfall 5 from RESEARCH.md (webworker + dom conflict) did not materialize with this codebase — TypeScript found no conflicts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed sw.ts handler: string "NetworkOnly" → NetworkOnly class instance**
- **Found during:** Task 2 verification (`next build --webpack`)
- **Issue:** Plan specified `handler: "NetworkOnly"` (string) but Serwist `RouteHandler` type requires a class instance
- **Fix:** Changed to `handler: new NetworkOnly()` with `import { NetworkOnly, Serwist } from "serwist"`
- **Files modified:** `app/sw.ts`
- **Verification:** `next build --webpack` exits 0
- **Committed in:** a78c514 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed sw.ts urlPattern → matcher property**
- **Found during:** Task 2 second build attempt
- **Issue:** Serwist `RuntimeCaching` interface uses `matcher` not `urlPattern`
- **Fix:** Renamed property from `urlPattern` to `matcher`
- **Files modified:** `app/sw.ts`
- **Verification:** `next build --webpack` exits 0
- **Committed in:** a78c514 (Task 2 commit)

**3. [Rule 1 - Bug] Fixed recommend-engine.test.ts: makeRow missing required scraped_at/source_url**
- **Found during:** Task 1 `tsc --noEmit` check
- **Issue:** After adding scraped_at/source_url as required fields on CutoffDataRow, existing makeRow helper in test file didn't include them
- **Fix:** Added `scraped_at: null, source_url: null` defaults to makeRow
- **Files modified:** `tests/api/recommend-engine.test.ts`
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** 922f6ae (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (3 Rule 1 - bugs/type errors)
**Impact on plan:** All fixes necessary for build and type correctness. No scope creep.

## Issues Encountered

- Serwist documentation in RESEARCH.md referenced `urlPattern` and string handler values, but the actual TypeScript API uses `matcher` and class instances. This is a common Serwist v8→v9 API change. Fixed inline per Rule 1.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All Phase 3 infrastructure in place: i18n provider, URL state provider, PWA service worker, font, offline handling
- Translation string skeletons ready (vi.json + en.json); proper Vietnamese diacritics to be added in Plan 04
- /api/recommend now returns scraped_at and source_url per result (PIPE-05 complete)
- Ready for Plan 02: score entry form (SCOR-01, SCOR-02) and recommendations list (NGVG-01)

---
*Phase: 03-frontend-pwa*
*Completed: 2026-03-18*
