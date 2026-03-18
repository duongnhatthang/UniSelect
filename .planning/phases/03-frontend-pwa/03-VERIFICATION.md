---
phase: 03-frontend-pwa
verified: 2026-03-18T12:10:00Z
status: human_needed
score: 7/7 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 6/7
  gaps_closed:
    - "User can filter search results by tohop code dropdown (SRCH-02)"
    - "NguyenVongList share hint uses t('shareLink') translation key (i18n warning)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Quick mode end-to-end"
    expected: "Select A00 tohop, enter score 25.0, submit — color-coded results appear with tier badges (blue=dream, green=practical, amber=safe)"
    why_human: "Requires live API with seeded database; cannot verify without running the app"
  - test: "Detailed mode score calculation"
    expected: "Select A00 tohop, enter Toan=9.5, Ly=8.0, Hoa=7.5 — total shows 25.0 and results auto-load"
    why_human: "Auto-submit on calculated total needs UI interaction to verify"
  - test: "Language toggle"
    expected: "Click EN button — all text switches to English including tier labels (Dream/Practical/Safe); click VI — switches back"
    why_human: "UI rendering with real next-intl provider required"
  - test: "Tohop filter in UniversitySearch"
    expected: "Select A00 from the tohop dropdown — list narrows to universities offering A00 majors only"
    why_human: "Requires live API with seeded university+cutoff data to populate tohop_codes arrays"
  - test: "PWA installability"
    expected: "Chrome address bar shows install icon; app opens standalone after install"
    why_human: "Browser PWA detection requires service worker active (disabled in dev mode)"
  - test: "Offline mode"
    expected: "DevTools > Network > Offline, reload — amber offline banner appears, previously fetched data displays from cache"
    why_human: "Service worker caching requires production build and runtime interaction"
---

# Phase 3: Frontend PWA Verification Report (Re-verification)

**Phase Goal:** Every user-facing feature works end-to-end: score entry, recommendations, nguyện vọng list builder, search, data staleness display, and both Vietnamese and English languages
**Verified:** 2026-03-18T12:10:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure

## Re-verification Summary

| Item | Previous | Now | Change |
|------|----------|-----|--------|
| SRCH-02 tohop filter predicate | FAILED | VERIFIED | Gap closed |
| NguyenVongList shareLink string | Warning (hardcoded) | Clean | Warning resolved |
| All other 6 truths | VERIFIED | VERIFIED | No regressions |

Both gaps identified in the initial verification have been closed. All 7 observable truths now pass automated checks. Status is `human_needed` rather than `passed` because the human verification items from the initial run still apply — they require a live runtime.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can select a tohop and enter a total score to see a ranked, color-coded list (quick mode) | VERIFIED | ScoreForm.tsx: useQueryStates binds tohop+score; fetch /api/recommend on submit; ResultsList renders TierBadge with color classes |
| 2 | User can enter individual subject scores and see calculated tohop totals and matched universities (detailed mode) | VERIFIED | ScoreForm.tsx: detailed mode renders per-subject inputs; calculateTotal called; auto-submit via useEffect when total >= 10 |
| 3 | User can view a 15-choice nguyen vong list tiered as dream/practical/safe and encoded in URL | VERIFIED | NguyenVongList.tsx: filters suggested_top_15; useQueryState with parseAsJson encodes as ?nv=[...]; renders 1-15 numbered list |
| 4 | User can search universities by Vietnamese name with diacritics stripped for matching | VERIFIED | UniversitySearch.tsx: fetches /api/universities on mount; filter calls normalizeVi() for both query and university name |
| 5 | User can filter search results by tohop code dropdown | VERIFIED | Lines 68-72: filter predicate evaluates matchesTohop = !selectedTohop \|\| u.tohop_codes.includes(selectedTohop); University interface includes tohop_codes: string[]; /api/universities returns tohop_codes via array_agg subquery |
| 6 | Every displayed cutoff score shows relative age and source link, with amber badge for data older than 90 days | VERIFIED | StalenessIndicator.tsx: formatStaleness + isStale; amber badge when stale; source link as anchor; ResultsList renders StalenessIndicator per result card |
| 7 | App defaults to Vietnamese, toggles to English with no untranslated strings | VERIFIED | i18n/request.ts: resolveLocale defaults to 'vi'; vi.json and en.json have identical key structure; t('shareLink') now used in NguyenVongList.tsx line 89 instead of hardcoded English string |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/layout.tsx` | Root layout with NuqsAdapter + NextIntlClientProvider + font | VERIFIED | No change from initial — all three providers present |
| `app/sw.ts` | Serwist service worker with /api/recommend NetworkOnly rule | VERIFIED | No change from initial |
| `i18n/request.ts` | Cookie-based locale resolution defaulting to vi | VERIFIED | No change from initial |
| `messages/vi.json` | Complete Vietnamese with proper diacritics | VERIFIED | shareLink key present: "Chia sẻ liên kết" |
| `messages/en.json` | Complete English translations with matching key structure | VERIFIED | shareLink key present: "Share link" |
| `components/ScoreForm.tsx` | Quick + detailed mode tabs with score input | VERIFIED | No change from initial |
| `components/ResultsList.tsx` | Tier-colored recommendation result cards | VERIFIED | No change from initial |
| `components/NguyenVongList.tsx` | Numbered 15-choice list with tier badges and URL encoding | VERIFIED | Line 89: t('shareLink') replaces hardcoded "— URL encoded for sharing" |
| `lib/utils/calculate-total.ts` | calculateTotal export | VERIFIED | No change from initial |
| `components/UniversitySearch.tsx` | Diacritic-aware search with tohop filter | VERIFIED | Lines 68-72: matchesTohop predicate now fully wired; University interface declares tohop_codes: string[] |
| `components/StalenessIndicator.tsx` | Relative time + source link + 90-day warning | VERIFIED | No change from initial |
| `lib/utils/normalize-vi.ts` | normalizeVi export | VERIFIED | No change from initial |
| `lib/utils/staleness.ts` | formatStaleness + isStale exports | VERIFIED | No change from initial |
| `tests/i18n/translations.test.ts` | Key parity test | VERIFIED | No change from initial |
| `tests/i18n/request.test.ts` | Cookie locale defaulting test | VERIFIED | No change from initial |
| `public/icons/icon-192.png` | PWA icon 192x192 | VERIFIED | No change from initial |
| `public/icons/icon-512.png` | PWA icon 512x512 | VERIFIED | No change from initial |
| `public/sw.js` | Generated service worker | VERIFIED | No change from initial |
| `app/manifest.ts` | PWA manifest with icon entries | VERIFIED | No change from initial |
| `app/~offline/page.tsx` | Offline fallback page with translations | VERIFIED | No change from initial |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `next.config.ts` | `app/sw.ts` | withSerwistInit({ swSrc }) | WIRED | No change from initial |
| `next.config.ts` | `i18n/request.ts` | createNextIntlPlugin | WIRED | No change from initial |
| `app/layout.tsx` | nuqs | NuqsAdapter wrap | WIRED | No change from initial |
| `components/ScoreForm.tsx` | `/api/recommend` | fetch on form submit | WIRED | No change from initial |
| `components/ScoreForm.tsx` | nuqs | useQueryStates for URL state | WIRED | No change from initial |
| `components/NguyenVongList.tsx` | nuqs | parseAsJson for URL-encoded list | WIRED | No change from initial |
| `app/page.tsx` | `components/ScoreForm.tsx` | import and render | WIRED | No change from initial |
| `components/UniversitySearch.tsx` | `/api/universities` | fetch on mount with tohop_codes in response | WIRED | API returns tohop_codes via array_agg subquery; University interface typed accordingly |
| `components/UniversitySearch.tsx` | `lib/utils/normalize-vi.ts` | normalizeVi for diacritic matching | WIRED | No change from initial |
| `components/UniversitySearch.tsx` | tohop filter | selectedTohop applied in filter predicate | WIRED | matchesTohop = !selectedTohop \|\| u.tohop_codes.includes(selectedTohop) — now fully functional |
| `components/StalenessIndicator.tsx` | `lib/utils/staleness.ts` | formatStaleness + isStale | WIRED | No change from initial |
| `components/ResultsList.tsx` | `components/StalenessIndicator.tsx` | render per result | WIRED | No change from initial |
| `components/LocaleToggle.tsx` | `i18n/request.ts` | NEXT_LOCALE cookie + router.refresh | WIRED | No change from initial |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SRCH-01 | 03-03 | User can search universities by name (Vietnamese diacritic-aware) | SATISFIED | UniversitySearch fetches /api/universities; filter uses normalizeVi; no change from initial |
| SRCH-02 | 03-03 | User can filter by tổ hợp code | SATISFIED | Filter predicate now evaluates matchesTohop; tohop_codes returned by /api/universities via array_agg; wiring fully closed |
| SCOR-01 | 03-02 | User can select tổ hợp + total score to see ranked list (quick mode) | SATISFIED | No change from initial |
| SCOR-02 | 03-02 | User can enter individual subject scores; app calculates totals per tổ hợp | SATISFIED | No change from initial |
| NGVG-01 | 03-02 | 15-choice tiered nguyện vọng list | SATISFIED | No change from initial |
| I18N-01 | 03-04 | App defaults to Vietnamese | SATISFIED | No change from initial |
| I18N-02 | 03-04 | User can toggle to English | SATISFIED | shareLink now translated — no remaining hardcoded English strings found in components |
| PIPE-05 | 03-01 | Data staleness (age and source) shown for every cutoff score | SATISFIED | No change from initial |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None detected | — | Previous blocker (UniversitySearch tohop filter) resolved; previous warning (NguyenVongList hardcoded string) resolved |

### Human Verification Required

#### 1. Quick Mode End-to-End

**Test:** Start dev server (`npm run dev`), open http://localhost:3000, select A00 from tohop dropdown, enter 25.0 as total score, click "Xem kết quả"
**Expected:** Color-coded result cards appear — blue cards labeled "Ước mơ", green "Khả thi", amber "An toàn"; each card shows university name, major, score, staleness time and source link icon
**Why human:** Requires live database with seeded cutoff data; component tests mock the API

#### 2. Detailed Mode Score Calculation

**Test:** Switch to "Nhập chi tiết" tab, select A00, enter Toán=9.5, Lý=8.0, Hóa=7.5 — verify total shows 25.0 and results auto-load without pressing submit
**Expected:** Tổng điểm: 25.0 displayed; results list populates automatically
**Why human:** Auto-submit useEffect behavior requires full runtime

#### 3. Language Toggle

**Test:** Click the "EN" button in header — verify all UI text switches to English including tier labels (Dream/Practical/Safe instead of Ước mơ/Khả thi/An toàn); click "VI" to switch back
**Expected:** Full language switch with no untranslated strings visible
**Why human:** Requires next-intl provider with real cookie handling

#### 4. Tohop Filter in University Search

**Test:** Open the university search panel, select "A00" from the tohop dropdown — verify the university list narrows to only institutions that offer A00 combination majors
**Expected:** List shrinks from all universities to A00-offering subset; selecting a different code further changes the list; clearing the dropdown restores all results
**Why human:** Requires live database with seeded tohop_codes on university records (filter logic is now wired; correctness of runtime data cannot be verified statically)

#### 5. PWA Installability

**Test:** Open Chrome at localhost:3000 (or deployed HTTPS URL), check for "Install app" icon in address bar; install; verify standalone window opens
**Expected:** App is installable and runs without browser chrome
**Why human:** Browser PWA detection requires service worker active (disabled in dev mode per config)

#### 6. Offline Mode

**Test:** Run `npm run build && npm start` to serve production build with service worker active; open app and load results; then in DevTools > Network check "Offline"; reload page
**Expected:** Amber offline banner ("Ngoại tuyến — đang hiển thị dữ liệu đã lưu") appears; previously fetched recommendation data still renders
**Why human:** Service worker caching requires production build and runtime interaction

### Gaps Summary

No automated gaps remain. Both previously identified issues are resolved:

1. **SRCH-02 — Tohop filter now fully wired.** `UniversitySearch.tsx` lines 68-72 now evaluate `matchesTohop = !selectedTohop || u.tohop_codes.includes(selectedTohop)` in the filter predicate. The `University` interface declares `tohop_codes: string[]` and `lib/api/universities.ts` populates it via an `array_agg(distinct ...)` subquery, so the data flows end-to-end.

2. **NguyenVongList shareLink translated.** Line 89 now calls `t('shareLink')` — both `vi.json` ("Chia sẻ liên kết") and `en.json` ("Share link") contain the key. No hardcoded English strings remain in the share hint block.

All 8 requirements (SRCH-01, SRCH-02, SCOR-01, SCOR-02, NGVG-01, I18N-01, I18N-02, PIPE-05) are satisfied by the code. Remaining verification items require a live runtime and are documented above for human testing.

---

_Verified: 2026-03-18T12:10:00Z_
_Verifier: Claude (gsd-verifier)_
