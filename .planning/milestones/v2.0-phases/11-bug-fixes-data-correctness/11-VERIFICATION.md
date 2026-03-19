---
phase: 11-bug-fixes-data-correctness
verified: 2026-03-19T07:00:00Z
status: passed
score: 13/13 must-haves verified
re_verification: false
---

# Phase 11: Bug Fixes & Data Correctness Verification Report

**Phase Goal:** All known data correctness bugs are fixed atomically — delta signs, trend colors, NaN scores, type mismatches, timer leak, async I/O, and error UI are all corrected in a single phase
**Verified:** 2026-03-19T07:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | A student above cutoff sees a positive delta in both ResultsList and NguyenVongList | VERIFIED | Both components call `computeDelta(userScore, result.weighted_cutoff)` where `diff = userScore - cutoff`; positive when above |
| 2  | A student below cutoff sees a negative delta in both ResultsList and NguyenVongList | VERIFIED | Same `computeDelta` formula; negative sign applied automatically when diff < 0 |
| 3  | Rising cutoff displays amber/warning color (text-amber-600), not green | VERIFIED | `ResultsList.tsx` line 16: `rising: { icon: '↑', color: 'text-amber-600' }` |
| 4  | Falling cutoff displays green/favorable color (text-green-600), not red | VERIFIED | `ResultsList.tsx` line 17: `falling: { icon: '↓', color: 'text-green-600' }` |
| 5  | A university with a null score is excluded from recommendation results — no NaN in output | VERIFIED | `engine.ts` lines 76–80: `validRows` filter guards `parseFloat(r.score ?? '')` before any arithmetic; `if (validRows.length === 0) continue` skips group entirely |
| 6  | A mix of valid + null scores uses only valid scores for weighted average (null years omitted, not zeroed) | VERIFIED | `validRows` filter removes null rows before weight/score arrays are built; `yearsCount = validRows.length` drives WEIGHTS lookup |
| 7  | CutoffDataRow.scraped_at is Date \| null (matches Drizzle timestamp return type) | VERIFIED | `lib/recommend/types.ts` lines 16 and 32: both `CutoffDataRow` and `RecommendResult` declare `scraped_at: Date \| null` |
| 8  | StalenessIndicator accepts Date \| null and renders correctly | VERIFIED | `StalenessIndicator.tsx` Props interface uses `scrapedAt: Date \| null`; renders `scrapedAt.toISOString()` in `<time>` element |
| 9  | withTimeout clears the setTimeout on promise resolution (no timer leak) | VERIFIED | `lib/db/timeout.ts` line 6: `.finally(() => clearTimeout(timerId!))` chained on `Promise.race` |
| 10 | When an API call fails, a visible error banner with a retry button appears in the UI | VERIFIED | `ScoreForm.tsx` line 217–233: `{apiError && <div role="alert" ...>}` with `<button>` calling `fetchRecommendations` |
| 11 | Clicking the retry button re-triggers the failed fetch | VERIFIED | Retry button `onClick` calls `fetchRecommendations(params.tohop, totalScore)` directly |
| 12 | No silent .catch(() => {}) patterns remain in ScoreForm.tsx | VERIFIED | Zero matches for `catch(() => {})` or `// ignore` in ScoreForm.tsx |
| 13 | No readFileSync calls remain in app/api/ routes | VERIFIED | Both routes import from `fs/promises` and use `await readFile(...)`; zero `readFileSync` matches in `app/api/` |

**Score:** 13/13 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/recommend/delta.ts` | Shared `computeDelta()` utility | VERIFIED | Exports `computeDelta`; 16 lines, pure function, correct formula `userScore - cutoff` |
| `components/ResultsList.tsx` | Corrected delta display and trend colors | VERIFIED | Imports `computeDelta`; TREND_DISPLAY uses `text-amber-600` for rising, `text-green-600` for falling |
| `components/NguyenVongList.tsx` | Corrected delta display using shared utility | VERIFIED | Imports `computeDelta`; uses `deltaStr` in render |
| `tests/recommend/delta.test.ts` | Unit tests for computeDelta | VERIFIED | 4 test cases: above cutoff, below cutoff, exactly at cutoff, rounding |
| `lib/recommend/engine.ts` | NaN-safe weighted average computation | VERIFIED | Contains `validRows` filter with `isNaN` guard; `if (validRows.length === 0) continue`; `representative` and `years_available` use `validRows` |
| `lib/recommend/types.ts` | Corrected CutoffDataRow and RecommendResult types | VERIFIED | `scraped_at: Date \| null` in both interfaces |
| `lib/db/timeout.ts` | Timer-leak-free withTimeout | VERIFIED | `clearTimeout(timerId!)` in `.finally()` |
| `lib/utils/staleness.ts` | Staleness utilities accepting Date | VERIFIED | `formatStaleness(scrapedAt: Date, ...)` and `isStale(scrapedAt: Date)` use `.getTime()` directly |
| `components/StalenessIndicator.tsx` | Updated prop type for Date \| null | VERIFIED | `Props.scrapedAt: Date \| null`; `scrapedAt.toISOString()` in `<time dateTime>` |
| `components/ScoreForm.tsx` | Error state, error banner with retry button, no silent catches | VERIFIED | `apiError` state; `role="alert"` div; `t('retry')` button; zero silent catches |
| `app/api/tohop/route.ts` | Async readFile for static fallback | VERIFIED | Imports `readFile` from `fs/promises`; uses `await readFile(...)` in catch block |
| `app/api/universities/route.ts` | Async readFile for static fallback | VERIFIED | Imports `readFile` from `fs/promises`; uses `await readFile(...)` in catch block |
| `messages/en.json` | English translations for error/retry UI strings | VERIFIED | `"apiError": "Something went wrong. Please try again."` and `"retry": "Retry"` in `common` object |
| `messages/vi.json` | Vietnamese translations for error/retry UI strings | VERIFIED | `"apiError": "Có lỗi xảy ra. Vui lòng thử lại."` and `"retry": "Thử lại"` in `common` object |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `components/ResultsList.tsx` | `lib/recommend/delta.ts` | `import computeDelta` | WIRED | Line 7: `import { computeDelta } from '../lib/recommend/delta'`; used at line 47 |
| `components/NguyenVongList.tsx` | `lib/recommend/delta.ts` | `import computeDelta` | WIRED | Line 8: `import { computeDelta } from '../lib/recommend/delta'`; used at line 53 |
| `lib/recommend/engine.ts` | `lib/recommend/types.ts` | `CutoffDataRow` import | WIRED | Line 1: `import type { CutoffDataRow, ... } from './types'`; used throughout |
| `components/StalenessIndicator.tsx` | `lib/utils/staleness.ts` | `formatStaleness` and `isStale` imports | WIRED | Line 3: `import { formatStaleness, isStale } from '../lib/utils/staleness'`; both used in render |
| `app/api/tohop/route.ts` | `fs/promises` | `import readFile` | WIRED | Line 2: `import { readFile } from 'fs/promises'`; used at line 28 with `await` |
| `components/ScoreForm.tsx` | `messages/*.json` | `useTranslations('common')` | WIRED | `t('apiError')` at lines 37 and 72; `t('retry')` at line 230 |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| FIX-01 | 11-01-PLAN | Delta sign convention: userScore - cutoff, positive = above cutoff | SATISFIED | `computeDelta` in `delta.ts`; both components use it |
| FIX-02 | 11-01-PLAN | Trend colors: rising=amber/warning, falling=green/favorable | SATISFIED | `TREND_DISPLAY` in `ResultsList.tsx` uses `text-amber-600` for rising |
| FIX-03 | 11-02-PLAN | Engine filters null/unparseable scores before weighted averages | SATISFIED | `validRows` filter in `engine.ts`; 3 NaN-filtering tests added |
| FIX-04 | 11-02-PLAN | CutoffDataRow.scraped_at is Date \| null | SATISFIED | `types.ts` corrected; type chain consistent through engine and StalenessIndicator |
| FIX-05 | 11-02-PLAN | withTimeout clears setTimeout on resolution | SATISFIED | `.finally(() => clearTimeout(timerId!))` in `timeout.ts`; spy test added |
| FIX-07 | 11-03-PLAN | Failed API calls show visible error banners with retry | SATISFIED | `role="alert"` banner + retry button in `ScoreForm.tsx` |
| FIX-08 | 11-03-PLAN | readFileSync in API fallback paths replaced with async readFile | SATISFIED | Both `tohop/route.ts` and `universities/route.ts` use `fs/promises` |

**Note on FIX-06:** REQUIREMENTS.md maps FIX-06 (/api/recommend static fallback) to Phase 8, not Phase 11. None of the three phase 11 plans claim FIX-06. This is correct — FIX-06 is out of scope for this phase and has its own traceability entry. No orphaned requirements.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `components/ScoreForm.tsx` | 157 | `placeholder={t('enterScore')}` | Info | HTML input `placeholder` attribute — legitimate usage, not a code placeholder |

No blockers or warnings found. The one info-level item is a standard HTML attribute, not an implementation anti-pattern.

---

### Human Verification Required

#### 1. Error Banner Visual Appearance

**Test:** Open the app, select a tohop combination, disable network (DevTools → Network → Offline), then submit the form
**Expected:** A red-bordered banner appears below the form with the error message and a "Retry" button; clicking Retry re-fires the API call (visible in Network tab once back online)
**Why human:** Visual rendering and button interactivity cannot be verified by static analysis

#### 2. Delta Sign Correctness in Browser

**Test:** Enter a score of 28.0 for a university with a cutoff around 25.0; verify the delta shown is "+3.0", not "-3.0"
**Expected:** Positive delta displayed for students above cutoff; negative for students below
**Why human:** Component rendering with real data requires a browser

#### 3. Trend Color Semantics in Browser

**Test:** Find a result where trend is "rising" (↑ icon); verify the icon color is amber/orange, not green
**Expected:** Rising cutoff shows amber warning color; falling cutoff shows green favorable color
**Why human:** Color rendering requires visual inspection

---

### Gaps Summary

No gaps. All 13 observable truths verified. All 14 artifacts exist, are substantive, and are wired. All 7 requirement IDs (FIX-01 through FIX-08 excluding FIX-06 which belongs to Phase 8) are satisfied. Zero blocker or warning anti-patterns found.

---

_Verified: 2026-03-19T07:00:00Z_
_Verifier: Claude (gsd-verifier)_
