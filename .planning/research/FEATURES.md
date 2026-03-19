# Feature Research

**Domain:** Vietnamese university admissions PWA — v2.0 new capability areas
**Researched:** 2026-03-18
**Confidence:** HIGH (existing codebase examined + current ecosystem docs verified via web search)

---

## Context: Subsequent Milestone Scope

This research covers only the five new capability areas for v2.0. v1.0 features (score input, recommendation engine, university search, i18n, PWA) are shipped and excluded from this analysis.

Existing code that new features build on:

- `lib/scraper/` — `ScraperAdapter` interface, `registry.ts` (scrapers.json → loadRegistry), cheerio/Playwright/PaddleOCR strategies
- `lib/recommend/engine.ts` — pure function `recommend(input, rows)`, already has 12 vitest tests
- `components/NguyenVongList.tsx` — renders read-only `<ol>` from `suggested_top_15`; `useEffect` auto-syncs to nuqs URL state on every `results` change (line 33–37)
- `nuqs` — URL query-state library already in use for list persistence
- Tailwind CSS v4 — already in use via `@tailwindcss/postcss ^4`; supports `@theme` and `@custom-variant` directives
- `tests/scraper/adapters/` — established test pattern: vi.mock `fetchHTML`, inject fixture HTML, assert `RawRow[]`

---

## Feature Landscape

### Table Stakes (Users Expect These)

For v2.0, table stakes means: these features are required to fulfill the stated milestone goals. Missing any one leaves the milestone's stated goals unmet.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Scraper resilience tests with fake local servers | 72/78 adapters are unverified dormant. Without regression tests against controlled HTML, any layout change breaks silently. Stated v2 P1 goal. | MEDIUM | Node `http.createServer` or Express + vitest `globalSetup`; serve static HTML fixtures per university; Playwright adapters require real HTTP endpoint (vi.mock is insufficient for headless browser) |
| Auto-discovery crawler (homepage scan → cutoff URL candidates) | 78 adapters require manually maintained URLs. Ministry portal URL changes yearly. Without discovery, expanding coverage requires per-university manual audits. Stated v2 P1 goal. | HIGH | Shallow crawl homepage HTML, score candidate links with keyword heuristics, output ranked candidates to a review file. Human gate before scrapers.json update. |
| Recommendation engine edge-case tests | NaN propagation, null score, and delta sign inversion bugs are all in the recommend path. Fixing bugs without regression tests means they can recur silently. Stated v2 P2 goal. | LOW | Pure function already tested with `makeRow()` factory. Gaps: NaN input, null score, all tier boundaries, comma-decimal score strings, 0-practical pool. |
| Editable nguyện vọng list (reorder, add, remove) | v1.0 list is read-only. The Ministry system requires students to manually enter their ranked list; the app must support curation beyond the algorithm's suggestion. Stated v2 P3 goal. | HIGH | Must fix `useEffect` auto-overwrite in `NguyenVongList.tsx` first. State management already exists via nuqs. |
| Design token system + dark mode | Brand identity and dark mode are stated v2 P3 goals. The font application bug (Be Vietnam Pro not applied) and the trend color inversion bug both require token-level fixes anyway — they cannot be fixed correctly with ad-hoc utility class patches. | MEDIUM | Tailwind v4 `@theme` directive is the right mechanism. Three-layer token architecture. |

### Differentiators (Competitive Advantage)

Features that make the v2.0 execution meaningfully better than the minimum viable approach.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Auto-discovery with candidate scoring, not full automation | Other tools require manual URL audits or break silently when URLs change. UniSelect's crawler returns ranked candidates for human approval — avoids the failure mode of auto-committing bad URLs that push wrong-year or wrong-method data into production. | MEDIUM | Score each link: URL path keywords (tuyensinh, diem-chuan, +2 pts), current year in URL (+1 pt), anchor text match (+2 pts), deprioritize noise (tin-tuc, news). Output top 3 per university to `discovery-candidates.json`. |
| Per-format HTML fixture library mirroring Vietnamese university site quirks | Scraper resilience testing that actually reflects domain-specific edge cases: comma-decimal scores ("27,50"), multi-method tables (THPT column vs generic "Điểm chuẩn"), image-based tables, missing-table error case. No generic test library covers this. | MEDIUM | `tests/fixtures/` per university, plus `tests/fixtures/irregular/` for edge-case formats. Shared fixture server available to all adapter tests. |
| Up/down button reorder as mobile-first primary interaction | Drag-to-reorder is desktop-optimized. iOS Safari has a known scroll-conflict issue during touch drag. Up/down buttons are universally reliable on mobile, screen-reader friendly, and match the familiar Vietnamese government form UX pattern students already know. | LOW | Up/down buttons as primary. Drag-to-reorder via dnd-kit as progressive enhancement with `delay: 250ms` activation constraint to prevent iOS scroll conflict. |
| Tier-aware semantic color tokens that fix the trend color inversion | Existing code uses `green` for rising cutoff scores — which is bad for the student (harder to get in). Fixing this correctly requires semantic tokens so `--color-trend-rising` can be defined as warning amber at the token level, not as scattered `dark:text-amber-500` patches. | LOW | Token names: `--color-trend-rising` (amber, means harder), `--color-trend-falling` (green, means easier). Fixes bug and prevents regression in a single change. |
| Synthetic test data factory covering all engine boundaries | The `makeRow()` factory in `tests/api/recommend-engine.test.ts` is already established. Extending it to cover all 8 missing scenarios (NaN input, null score, all 5 tier boundary values, comma decimal, 0-practical pool) gives comprehensive regression protection for the engine's most critical logic. | LOW | Pure function: no mocks needed. All gaps identified by reading existing tests against known bug list. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Fully automatic URL updates from auto-discovery | Appealing — no manual maintenance after discovery | A bad URL auto-committed to scrapers.json breaks all data for that university silently. Vietnamese university sites frequently have similar-looking pages at different URLs (e.g., different years, different admission methods). Wrong URL → scraped data from wrong year. | Crawler outputs ranked candidates to a review file or GitHub-opened PR. Human approves before scrapers.json is updated. The safety gate stays. |
| LLM-based scraping for non-standard pages | Handles any layout, no adapter needed | Cost-prohibitive for a charity project (explicitly out-of-scope in PROJECT.md). Adds API key dependency, rate limits during July spike, and hallucination risk on numeric data. | Extend PaddleOCR for image tables. For JS-rendered pages, Playwright adapter is the right tool. |
| dnd-kit drag-to-reorder as the only interaction | Modern, smooth, expected on desktop | iOS Safari scroll conflict during touch drag is a known dnd-kit issue. Adds ~7 KB bundle. Touch target complexity increases. Without a `delay` activation constraint, dragging and scrolling are indistinguishable on mobile. | Up/down buttons as primary + drag as progressive enhancement. Long-press activation constraint (`delay: 250ms`) mitigates the iOS issue if drag is added. |
| Parallel async auto-discovery (all 78 universities simultaneously) | Faster discovery across the full registry | 78 concurrent Playwright or cheerio crawls would exhaust GitHub Actions free-tier minutes and memory. Rate-limiting and politeness delays make it as slow as sequential anyway. Vietnamese university servers are often slow. | Shard discovery like scraping: use the existing 6-shard GitHub Actions matrix. Or run discovery on-demand for specific universities rather than the full registry. |
| Real-time cutoff score tracking | Would make the app feel live | Cutoff scores are published once per year in July. "Real-time" is meaningless for annual data. Adds WebSocket complexity and cost. | Staleness monitoring is already built in v1.0. Show last-scraped date and a staleness warning when data is old. |
| Score scenario comparison mode ("what if I scored 24 vs 25") | Genuinely useful for pre-exam planning | Requires holding multiple result sets in memory, doubles API calls, complexifies URL state. Out-of-scope per PROJECT.md for v2. | Defer to v3+. The recommendation engine is a pure function — implementing this is straightforward when scope allows. |
| Account/user profiles to save the nguyện vọng list | Familiar pattern, students might want persistence | Requires auth, database writes, email flows — all cost-incurring and out-of-scope. No login = zero barrier for students in the July rush. | URL-serialized list via nuqs is already implemented in v1.0. Students can bookmark or share the URL. |

---

## Feature Dependencies

```
[Auto-discovery crawler]
    └──produces──> [discovery-candidates.json]
                       └──human-approved──> [scrapers.json update]
                                                └──enables──> [more verified adapters]

[Fake server fixtures]
    └──requires──> [static HTML fixtures per university format]
    └──enables──> [adapter regression tests (cheerio)]
    └──required-for──> [Playwright adapter tests] (real headless browser needs real HTTP)

[Generic adapter factory]
    └──required-before──> [expanding verified adapter count]
    └──required-before──> [fake server fixture coverage is manageable]

[Editable nguyện vọng list]
    └──requires──> [fix useEffect auto-overwrite in NguyenVongList.tsx]
    └──requires──> [nuqs list state] (already exists)
    └──requires──> [up/down reorder logic OR dnd-kit]
    └──enhances──> [URL-shareable list] (already exists via nuqs)

[Design token system]
    └──required-by──> [dark mode] (cannot do dark mode without semantic tokens)
    └──required-by──> [fix trend color inversion] (green=rising=bad needs semantic rename)
    └──required-by──> [fix font application] (Be Vietnam Pro not applied in v1.0)
    └──enhances──> [TierBadge.tsx] (can reference semantic color tokens)

[Recommendation engine edge-case tests]
    └──requires──> [fix NaN propagation bug] (must fix before tests assert correct behavior)
    └──requires──> [fix delta sign inversion bug]
    └──enables──> [CI workflow on PRs] (tests must pass before CI can gate)

[CI workflow]
    └──requires──> [recommendation engine tests passing]
    └──requires──> [adapter tests passing]
```

### Dependency Notes

- **Editable list requires fixing the useEffect first.** The `useEffect` in `NguyenVongList.tsx` lines 33–37 auto-overwrites the `nv` URL state on every `results` change. Any user edit made before `results` re-renders is silently discarded. The fix: only seed from `top15` when `nv` URL param is empty (one-time initialization); after that, writes come from user interaction only.

- **Design tokens are required before dark mode.** Implementing dark mode with scattered `dark:text-gray-100` utility classes across 8 components creates a maintenance trap. The correct approach is: define semantic tokens (`--color-bg-surface`, `--color-text-primary`) in `@theme`, then toggle the `.dark` class on `<html>`. One place to change, not 40.

- **Bug fixes must precede edge-case tests.** Writing tests for the recommend engine before fixing NaN propagation and delta sign inversion means the tests document broken behavior. Fix first, then add tests that assert the corrected behavior and prevent regression.

- **Generic adapter factory is a prerequisite for expanding verified adapter count.** Trying to verify 72 more copy-pasted adapters is impractical. Extract the factory first (reducing 70+ files to ~2), then verify adapters against the factory pattern.

- **Fake servers are additive to existing mocks, not a replacement.** Current adapter tests vi.mock `fetchHTML`. Fake HTTP servers are required specifically for Playwright adapters (headless browser navigates to real URLs). Cheerio adapters can keep vi.mock or migrate to fake servers — both patterns work and can coexist.

---

## MVP Definition for v2.0

### P1 — Scraper pipeline (must ship)

- [ ] **Generic adapter factory** — Extract from 70+ copy-pasted cheerio adapters. Required for maintainability before expanding coverage.
- [ ] **Auto-discovery crawler** — Scores candidate URLs heuristically, outputs to review file. Does not auto-commit. Unblocks coverage expansion.
- [ ] **Fake server fixtures** — At minimum for the 6 verified adapters (BVH, HTC, DCN, GHA) + the generic factory. Makes adapter regressions detectable.

### P2 — Quality and correctness (should ship)

- [ ] **Fix NaN propagation, delta sign inversion, trend color bugs** — Prerequisites for trustworthy test assertions.
- [ ] **Recommendation engine edge-case tests** — After fixing the bugs above. Covers all 8 identified gaps.
- [ ] **CI workflow** — GitHub Actions `on: pull_request` running `npm test` and `npm run build`. Depends on tests passing cleanly.
- [ ] **Static fallback for /api/recommend** — Already missing; listed in PROJECT.md.

### P3 — UX (ship if bandwidth allows)

- [ ] **Design token system** — `@theme` in globals.css, three-layer tokens, Be Vietnam Pro properly applied.
- [ ] **Fix trend color semantics** — Depends on token system.
- [ ] **Editable nguyện vọng list** — Fix useEffect first, then up/down buttons, then optional drag.
- [ ] **Dark mode** — Requires tokens. CSS `@custom-variant dark` + localStorage toggle.
- [ ] **Onboarding copy and tier label explanations** — Low-code, high student value.
- [ ] **Error boundaries (error.tsx, not-found.tsx)** — Also listed in PROJECT.md P2/P3.

### Defer to v3+

- Score scenario comparison mode ("what if I scored X vs Y")
- Share card generation for Zalo/Facebook
- Client-side offline recommendation engine
- Học bạ and aptitude test pathways

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Generic adapter factory | HIGH (unblocks 72 dormant adapters) | MEDIUM (extract pattern from 70+ files) | P1 |
| Auto-discovery crawler | HIGH (unblocks data coverage at scale) | HIGH (multi-heuristic crawl + scoring + output format) | P1 |
| Fake server fixtures | MEDIUM (developer quality, not user-facing) | MEDIUM (Express globalSetup + HTML fixture authoring) | P1 |
| Fix NaN/delta/trend bugs | HIGH (data correctness = student trust) | LOW (targeted patches, scope is small) | P2 |
| Recommend engine edge-case tests | MEDIUM (regression prevention) | LOW (pure function + synthetic data factory) | P2 |
| CI workflow on PRs | MEDIUM (prevents silent regressions) | LOW (GitHub Actions yml) | P2 |
| Static fallback for /api/recommend | MEDIUM (reliability during Supabase outage) | LOW (same pattern as universities fallback) | P2 |
| Design token system | MEDIUM (foundation for visual correctness) | MEDIUM (three-layer architecture, CSS-first) | P3 |
| Editable nguyện vọng list | HIGH (student-facing core feature) | HIGH (state management + interaction model + useEffect fix) | P3 |
| Dark mode | LOW-MEDIUM (nice-to-have) | LOW (once tokens exist) | P3 |
| Onboarding + tier explanations | HIGH (reduces student confusion) | LOW (copy + small UI additions) | P3 |
| Error boundaries | MEDIUM (trust and polish) | LOW (error.tsx + not-found.tsx Next.js conventions) | P3 |

---

## Implementation Notes by Feature

### Auto-Discovery Crawler

The crawl strategy for Vietnamese university sites follows focused-crawl principles (keyword-guided URL scoring, not breadth-first full-site crawl):

1. **Seed URL**: university homepage from `scrapers.json`
2. **Shallow crawl**: fetch homepage HTML via cheerio, extract all `<a href>` links on the same domain
3. **Score each link** (heuristic, not LLM):
   - URL path keyword match: `tuyensinh`, `tuyen-sinh`, `diem-chuan`, `diem-trung-tuyen`, `thong-bao-tuyen-sinh` (+2 pts each)
   - URL contains current year (e.g., `2025`, `2026`) (+1 pt)
   - Anchor text keyword match (Vietnamese): `điểm chuẩn`, `điểm trung tuyển`, `tuyển sinh` (+2 pts)
   - Deprioritize noise: `tin-tuc`, `news`, `thong-bao` without score keywords (-1 pt)
4. **Output**: top 3 scored candidates per university written to `discovery-candidates.json`
5. **Human gate**: maintainer reviews candidates and manually updates `scrapers.json`; no auto-commit

Confidence: MEDIUM — heuristic scoring pattern is standard focused-crawl technique; Vietnamese keyword list derived from verified adapter URLs already in scrapers.json; output format is an assumption until implementation.

### Fake Server for Scraper Testing

Standard Node.js integration test pattern, confirmed by ScrapeOps Playwright testing guide:

```
tests/fixtures/
  bvh/cutoff-2024.html       ← mirrors real PTIT tuyensinh page structure
  htc/cutoff-2024.html
  dcn/cutoff-2024.html
  irregular/comma-decimal.html    ← edge case: "27,50" instead of "27.50"
  irregular/missing-table.html    ← error case: no cutoff table on page

tests/helpers/fixture-server.ts
  ← vitest globalSetup: http.createServer serving tests/fixtures/
  ← exposes BASE_URL = 'http://localhost:{PORT}'
  ← vitest globalTeardown: server.close()
```

For cheerio adapters: vi.mock on `fetchHTML` OR point adapter at `${BASE_URL}/bvh/cutoff-2024.html` — both work. The fake server is strictly required for Playwright adapters, where the headless browser navigates to a real URL.

Confidence: HIGH — pattern confirmed by scrapeops.io Playwright testing docs and standard Node.js test patterns.

### Editable Nguyện Vọng List

The critical bug to fix first: `useEffect` in `NguyenVongList.tsx` lines 33–37 auto-overwrites URL state on every `results` change. Any user edit made before results re-renders is silently discarded.

**Corrected initialization logic:**
- On mount: if `nv` URL param is empty, seed from `top15` (one-time)
- After initial seed: user edits write to `nv` URL state directly; `useEffect` does not run again

**Interaction model (mobile-first):**
- Up/down buttons as primary reorder interaction (splice in `nv` array)
- Remove button per item (splice from `nv` array)
- Add item picker from `results` not already in list
- Optional: dnd-kit `@dnd-kit/sortable` with `delay: 250ms` activation constraint (prevents iOS scroll conflict); adds ~7 KB
- Maximum 15 items enforced
- Su pham placement warning: if a su pham program is at position 6–15, show an inline warning (2026 rule: only considered within top 5)

State: keep `nuqs` `useQueryState('nv', parseAsJson<NvItem[]>())` — already the right pattern, no change needed.

Confidence: HIGH — existing code examined; nuqs pattern confirmed; dnd-kit mobile activation constraint confirmed in dnd-kit GitHub issues and official docs.

### Design Token System

Tailwind v4 `@theme` directive is available now (project uses `@tailwindcss/postcss ^4`). No library additions needed.

Three-layer architecture in `app/globals.css`:

```css
@theme {
  /* Layer 1: Base tokens (raw values) */
  --color-brand-600: oklch(50% 0.18 250);
  --color-neutral-900: oklch(15% 0.01 250);

  /* Layer 2: Semantic tokens (intent, not value) */
  --color-bg-surface: var(--color-neutral-50);
  --color-text-primary: var(--color-neutral-900);
  --color-tier-dream: var(--color-purple-600);
  --color-tier-practical: var(--color-brand-600);
  --color-tier-safe: var(--color-emerald-600);
  --color-trend-rising: var(--color-amber-500);    /* rising = harder = warning */
  --color-trend-falling: var(--color-emerald-500); /* falling = easier = positive */
  --font-sans: 'Be Vietnam Pro', system-ui, sans-serif; /* fixes broken font */
}

@custom-variant dark (&:where(.dark, .dark *));
```

Dark mode toggle: `document.documentElement.classList.toggle('dark')` + `localStorage.setItem('theme', ...)`. No `next-themes` needed for this scope.

Confidence: HIGH — Tailwind v4 docs + maviklabs.com 2026 article confirm `@theme` approach; semantic color naming confirmed by Tailwind v4 discussions; `@custom-variant dark` syntax confirmed by thingsaboutweb.dev implementation guide.

### Recommendation Engine Testing Gaps

Existing 12 tests cover: weighted averages (1/2/3 year), tier classification boundaries, su pham deprioritization, trend calculation, `suggested_top_15` flag, empty input.

**Missing test scenarios identified from bug list in PROJECT.md:**

| Gap | Bug Risk | Test Approach |
|-----|----------|---------------|
| `total_score: NaN` (null form input propagates to engine) | HIGH — known bug | `makeInput({ total_score: NaN })` → assert graceful empty return, no NaN in output |
| `total_score: null as unknown as number` | HIGH — known bug | Same pattern; defensive guard in engine |
| Score string `"24,50"` (comma decimal from Vietnamese sites) | MEDIUM | `makeRow({ score: '24,50' })` → assert correct parse or explicit documented failure |
| Boundary: exactly `cutoff - 5` (safe lower bound, inclusive) | MEDIUM — off-by-one risk | `total_score: cutoff - 5` → assert tier `'safe'` |
| Boundary: exactly `cutoff - 2` (safe upper bound, inclusive) | MEDIUM | `total_score: cutoff - 2` → assert tier `'safe'` |
| Boundary: exactly `cutoff - 1` (practical lower bound) | MEDIUM | `total_score: cutoff - 1` → assert tier `'practical'` |
| Boundary: exactly `cutoff + 2` (practical upper bound) | MEDIUM | `total_score: cutoff + 2` → assert tier `'practical'` |
| Boundary: exactly `cutoff + 3` (dream lower bound) | MEDIUM | `total_score: cutoff + 3` → assert tier `'dream'` |
| Pool with 0 practical results (all dream or all safe) | LOW | Assert `suggested_top_15` still marks up to 15 from available tiers |
| Pool with exactly 15 entries | LOW | Assert all 15 are `suggested_top_15: true` |

Note: boundary tests for `cutoff - 5`, `cutoff - 2`, `cutoff - 1`, `cutoff + 2`, `cutoff + 3` already exist partially in existing tests but not as a systematic parameterized set. Consolidating them into a single `describe` block with a table-driven approach makes the boundaries explicit and readable.

Confidence: HIGH — gaps identified by reading existing test file line-by-line against the known bug list in PROJECT.md.

---

## Competitor Context

No direct competitors offer automated scraping + algorithmic nguyện vọng ordering + offline PWA in a single product. Context for relative positioning:

| Feature | diemthi.vn / tuyensinh247.com | Manual Ministry spreadsheets | UniSelect v2.0 |
|---------|-------------------------------|------------------------------|----------------|
| Auto-ranked 15-choice list | No (manual lookup only) | No | Yes (v1.0) |
| Editable ranked list with persistence | No | Spreadsheet only | Yes (v2.0) |
| Offline support | No | Yes (downloaded file) | Yes (PWA, v1.0) |
| Scraper auto-discovery | N/A | N/A | Candidate output (v2.0) |
| Scraper regression testing | N/A | N/A | Yes (v2.0) |
| Dark mode | Some | N/A | v2.0 |

---

## Sources

- Codebase: `/Users/thangduong/Desktop/UniSelect/lib/recommend/engine.ts` — engine implementation examined
- Codebase: `/Users/thangduong/Desktop/UniSelect/components/NguyenVongList.tsx` — useEffect auto-sync issue identified at line 33–37
- Codebase: `/Users/thangduong/Desktop/UniSelect/tests/api/recommend-engine.test.ts` — 12 existing tests analyzed for gaps
- Codebase: `/Users/thangduong/Desktop/UniSelect/tests/scraper/adapters/bvh.test.ts` — existing adapter test pattern
- Codebase: `/Users/thangduong/Desktop/UniSelect/.planning/PROJECT.md` — v2.0 requirements, known bugs, constraints
- [dnd-kit Sortable preset docs](https://docs.dndkit.com/presets/sortable) — mobile touch, activation constraints, accessibility (HIGH)
- [Tailwind CSS v4 @theme directive](https://tailwindcss.com/docs/theme) — design token architecture (HIGH)
- [Design Tokens That Scale in 2026 — Tailwind v4 + CSS Variables](https://www.maviklabs.com/blog/design-tokens-tailwind-v4-2026) — three-layer token pattern (MEDIUM)
- [Dark Mode with Tailwind v4 and Next.js](https://www.thingsaboutweb.dev/en/posts/dark-mode-with-tailwind-v4-nextjs) — `@custom-variant dark` syntax (MEDIUM)
- [Top 5 Drag-and-Drop Libraries for React in 2026 — Puck](https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react) — library comparison including dnd-kit (MEDIUM)
- [Playwright fake server for scraper testing — ScrapeOps](https://scrapeops.io/playwright-web-scraping-playbook/nodejs-playwright-beginners-guide-part-5/) — fake HTTP server test pattern (MEDIUM)
- WebSearch results: "web crawler auto-discovery URL finding new pages 2026", "fake server test fixtures scraper resilience testing 2026", "drag drop reorder list mobile PWA react touch 2025", "tailwind v4 dark mode CSS variables semantic tokens 2025"

---
*Feature research for: UniSelect v2.0 — auto-discovery crawler, scraper resilience, editable nguyện vọng list, design tokens, engine testing*
*Researched: 2026-03-18*
