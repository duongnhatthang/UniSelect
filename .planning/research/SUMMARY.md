# Project Research Summary

**Project:** UniSelect v2.0 — Vietnamese University Admissions PWA
**Domain:** Vietnamese university admissions data aggregation, scraping pipeline, PWA
**Researched:** 2026-03-18
**Confidence:** HIGH

## Executive Summary

UniSelect v2.0 builds incrementally on a shipped v1.0 system. The existing stack (Next.js 16, Supabase, Drizzle ORM, Playwright, PaddleOCR, Cheerio, Tailwind v4, vitest, nuqs, Serwist) remains unchanged. v2.0 adds five capability areas: auto-discovery of cutoff score URLs without manual maintenance, scraper resilience testing via fake local HTTP servers, recommendation engine edge-case tests with synthetic data, an editable nguyện vọng list, and a design token system with dark mode. Each new area requires only minimal library additions — crawlee (auto-discovery), sirv (test server), motion (drag-reorder), next-themes (dark mode toggle), and @faker-js/faker (test data) — none of which conflict with the existing stack. The biggest architectural wins are the generic adapter factory (reducing 70+ copy-pasted files to config-driven one-liners) and batch DB inserts (reducing N+1 writes to 2 round-trips per university).

The recommended build order is: adapter factory first (internal refactor, no UI or DB risk), then resilience test infrastructure, then auto-discovery crawler, then bug fixes, then recommendation engine tests and CI, then infrastructure hardening, then UI/UX. This ordering is driven by hard dependencies — the fake site infrastructure must exist before the crawler can be tested, and the adapter factory reduces surface area before the crawler adds new complexity. Bug fixes must precede engine tests because tests written against broken behavior document wrong outcomes. UI work has no upstream dependencies and goes last.

The primary risks are three GitHub Actions infrastructure concerns — IP banning from aggressive auto-discovery crawling, free-tier minute budget exhaustion during July peak, and Supabase auto-pause during development quiet periods. All three are preventable with rate limiting, caching, and a lightweight keep-alive workflow. A fourth critical risk is the silent 0-row success pattern in runner.ts: if the adapter factory regresses a working adapter to return zero rows, the scrape_run record shows `status: 'ok', rows_written: 0` — an invisible failure. A zero-rows guard must be the first commit before any factory work begins.

## Key Findings

### Recommended Stack

The existing stack is stable and does not change. v2.0 adds five packages. For auto-discovery, `crawlee` (@crawlee/cheerio ^3.13.7) is the correct choice because it wraps Cheerio with a built-in BFS request queue, retry logic, politeness delays, and `enqueueLinks` URL glob filtering — avoiding 2-3x custom implementation time. For test fixtures, `sirv` (^3.0.2) provides a lightweight Node.js static file server suitable for vitest `globalSetup`, giving Playwright adapters a real HTTP endpoint to navigate (MSW cannot do this — it intercepts at the module level, not the network level). For drag-to-reorder, `motion` (^12.37.0, formerly framer-motion) is the only major library with confirmed React 19 support as of December 2025; every other library (@hello-pangea/dnd, @atlaskit/pragmatic-drag-and-drop, @dnd-kit/react) either hard-caps React peerDeps at v18 or has open critical bugs. For dark mode, `next-themes` (^0.4.6) adds the blocking inline script that prevents the white flash on reload; the design token system itself is pure Tailwind v4 `@theme` CSS with no library required. For synthetic test data, `@faker-js/faker` (^10.3.0) with seeded factories eliminates hand-written fixtures across 20+ edge-case tests.

**Core new technologies:**
- `crawlee` ^3.13.7: BFS homepage crawler — wraps Cheerio with queue, retry, politeness; TypeScript-native unlike Python-first alternatives
- `sirv` ^3.0.2 (dev): static fixture server — needed for Playwright adapter tests where MSW cannot intercept headless browser navigation
- `motion` ^12.37.0: drag-to-reorder nguyện vọng list — only React 19-compatible drag library; `Reorder.Group` + `Reorder.Item` matches the use case exactly
- `next-themes` ^0.4.6: flash-free dark mode toggle — injects blocking script before React hydration; `attribute="data-theme"` aligns with Tailwind v4 `@custom-variant`
- `@faker-js/faker` ^10.3.0 (dev): synthetic test data factory — seeded for deterministic CI; requires Node.js 20+ on GitHub Actions runner (verify before enabling)

**Critical version constraints:**
- `motion` Reorder is incompatible with Next.js page-level scrolling/routing — only safe within a single-page section (acceptable for nguyện vọng list)
- `@faker-js/faker` v10 requires Node.js 20+ — confirm GitHub Actions runner version before Phase 5
- `@dnd-kit/react` 0.3.2 has an open critical bug where `onDragEnd` source/target are always identical (issue #1664) — do not use

### Expected Features

**Must have (P1 — scraper pipeline):**
- Generic adapter factory — reduces 70+ copy-pasted files to config-driven one-liners; prerequisite before expanding beyond 6 verified adapters
- Auto-discovery crawler — keyword-heuristic link scoring from university homepages; outputs ranked candidates to review file (human gate before scrapers.json update); prevents silent URL rot
- Fake server fixtures — required specifically for Playwright adapter tests; additive alongside existing vi.mock pattern for Cheerio adapters

**Must have (P2 — quality and correctness):**
- Fix NaN propagation, delta sign inversion, and trend color bugs — prerequisites for trustworthy test assertions; delta fix must touch both ResultsList.tsx and NguyenVongList.tsx atomically
- Recommendation engine edge-case tests — 8 identified missing scenarios: NaN input, null score, comma-decimal scores, all 5 tier boundary values, 0-practical pool, exactly-15-entry pool
- CI workflow on pull_request — depends on tests passing cleanly first
- Static fallback for /api/recommend — already missing per PROJECT.md; same pattern as existing universities fallback

**Should have (P3 — UX):**
- Design token system (`@theme` in globals.css, three-layer architecture) — required before dark mode; also fixes the broken Be Vietnam Pro font application
- Editable nguyện vọng list — fix useEffect auto-overwrite first; up/down buttons as mobile-first primary; optional drag-to-reorder via motion as progressive enhancement
- Dark mode — low effort once tokens exist; `@custom-variant dark` + next-themes
- Onboarding copy and tier label explanations — low-code, high student value
- Error boundaries (error.tsx, not-found.tsx)

**Defer to v3+:**
- Score scenario comparison mode ("what if I scored X vs Y")
- Share card generation (Zalo/Facebook)
- Client-side offline recommendation engine
- Học bạ and aptitude test pathways

### Architecture Approach

The v2.0 architecture adds a pre-scrape discovery phase and a test infrastructure layer without restructuring the existing three-tier system (GitHub Actions scraper pipeline → Supabase → Vercel API → Next.js PWA). The auto-discovery crawler runs as a GitHub Actions pre-step before `run.ts`, writes `discovered-urls.json` as ephemeral output, and `loadRegistry()` merges it at runtime — keeping `scrapers.json` as the human-edited source of truth with no write permissions required from Actions. The adapter factory is purely internal: each adapter file still exports `${id}Adapter` by name, so `registry.ts`'s dynamic import pattern requires zero changes. Batch DB inserts wrap each university's full row set in a database transaction, chunked at 200 rows to stay under Postgres's parameter limit, reducing from 2N sequential round-trips to 2 (or 2 × ceil(N/200)) per university. The design token layer is additive to `globals.css` — no component breaks on day one.

**Major components:**
1. `lib/scraper/crawler/` (new) — discover.ts (spider), classifier.ts (page type detection), types.ts (DiscoveredPage interface); runs as GitHub Actions pre-step only, never in Vercel API
2. `lib/scraper/adapters/generic-cheerio-factory.ts` (new) — config-driven factory returning ScraperAdapter; dcn (Playwright) and gha (PaddleOCR) stay as custom adapters
3. `tests/fixtures/` (new) — fake-sites HTML per university format + server.ts (sirv globalSetup); test-only, no production impact
4. `app/globals.css` `@theme` block (new) — three-layer token architecture: base palette → semantic aliases → dark mode overrides; Tailwind v4 CSS-first, no tailwind.config.ts
5. `components/NguyenVongList.tsx` (modified) — fix useEffect auto-overwrite, add up/down reorder buttons, optional motion Reorder component

**Key patterns to follow:**
- Discovery as pre-pass: discovery failures are non-fatal; fall back to scrapers.json URL; skip with `SKIP_DISCOVERY=1` for fast local runs
- Factory over inheritance: config-driven function returning plain object conforming to ScraperAdapter; no base class; works with existing dynamic registry import
- Collect-then-batch write: normalize all rows first, then single transaction with chunked INSERT; all-or-nothing per university

### Critical Pitfalls

1. **Silent 0-row success in runner.ts** — Adapter factory regression returns `[]`; runner.ts logs `status: 'ok', rows_written: 0` — an invisible failure. Prevention: add zero-rows guard (`status: 'zero_rows'`) as the very first commit before factory work begins. Never allow `rows_written: 0` to be logged as `'ok'`.

2. **GitHub Actions minute budget exhaustion before July peak** — Peak schedule (4×/day × 6 shards × 30 min) = 720 min/day vs. 2,000 min/month free tier. Prevention: cache Playwright browsers and PaddleOCR models via `actions/cache`, reduce scrape-low.yml to 3×/week, gate scrape-peak.yml to the specific 2-3 weeks of Ministry submission period, reduce shards from 6 to 3 until verified adapter count grows.

3. **Auto-discovery crawler triggering IP bans during July peak** — Vietnamese university servers are often shared hosting; 10-50 requests per university at full speed looks like a DDoS. Prevention: 2-3 second inter-request delay per domain, respect robots.txt (robots-parser npm), cap depth at 2 hops, cap at 20 pages per domain, set `User-Agent: UniSelectBot/1.0 (educational; non-commercial)`.

4. **Delta sign convention fix applied to only one component** — ResultsList.tsx and NguyenVongList.tsx have mirrored delta inversions. Fixing one without the other creates a worse state than either broken state alone. Prevention: define a shared `computeDelta()` utility, fix both components in a single PR with a test asserting correct sign in both.

5. **Supabase free tier auto-pause killing July scraping pipeline** — Database pauses after 7 consecutive days of inactivity. v2.0 development (March-June) involves deliberate scraping pauses that expose this gap. Prevention: GitHub Actions keep-alive workflow running `SELECT 1` every 5 days — less than 1 minute of Actions budget per week.

6. **Batch insert partial failure leaving inconsistent university data** — Multiple INSERT chunks without a wrapping transaction means a mid-batch network blip leaves some years/majors updated and others stale. Prevention: wrap all chunks for a university in a single `db.transaction()` call; test rollback with an intentionally failing mid-batch row.

## Implications for Roadmap

The architecture's hard dependency chain dictates phase ordering: factory before crawler (crawler tests need fake sites; factory reduces surface area before crawler adds complexity), resilience infrastructure before crawler tests, bug fixes before engine tests, UI last (no upstream dependencies).

### Phase 1: Scraper Foundation

**Rationale:** The generic adapter factory and batch DB inserts are purely internal refactors with no UI or DB schema dependency. They reduce code surface area and establish the zero-rows guard safety net before any new complexity is added. All downstream phases depend on a working factory.

**Delivers:** Generic cheerio adapter factory, migration of 4 verified adapters (htc, bvh, sph, tla) to factory configs, zero-rows guard in runner.ts, batch upsert in runner.ts with transaction wrapping, static fallback for /api/recommend.

**Addresses features from FEATURES.md:** Generic adapter factory (P1), static fallback for /api/recommend (P2).

**Avoids pitfalls:** Silent 0-row success (zero-rows guard is the first commit), batch insert partial failure (transaction wrapping from day one), adapter factory silent regressions (golden fixture comparison before deleting originals, one adapter at a time, originals kept in _legacy/).

**Research flag:** Standard patterns — factory function returning typed object is well-established; Drizzle batch insert and transaction wrapping are documented. No phase research needed.

### Phase 2: Resilience Test Infrastructure

**Rationale:** Fake site infrastructure must exist before the crawler can be tested against controlled HTML. Establishing the fixture server and HTML fixtures gives a safety net for both the existing adapters and the upcoming crawler work.

**Delivers:** `tests/fixtures/fake-sites/` HTML library covering 7+ edge case formats (generic table, no-thead headers, JS-stub, score image, Windows-1252 encoding, broken table, renamed headers, comma-decimal scores), vitest globalSetup fixture server (sirv), integration test suite for generic adapter factory against fake sites, PaddleOCR CI job with model caching.

**Addresses features from FEATURES.md:** Fake server fixtures (P1), per-format HTML fixture library (differentiator).

**Avoids pitfalls:** Fixture drift from real university pages (versioned filenames + adapter-to-fixture link comment + fixture audit step in verify-adapters.ts), PaddleOCR CI disk/time issue (cache models, separate job from Playwright, trigger only on relevant file changes).

**Research flag:** Standard patterns — sirv globalSetup is documented; Node.js HTTP server pattern is established. No phase research needed.

### Phase 3: Auto-Discovery Crawler

**Rationale:** Depends on fake sites (Phase 2) for testing crawler behavior against controlled HTML without hitting live university servers. Must come after factory work (Phase 1) because discovered pages feed into adapters.

**Delivers:** `lib/scraper/crawler/discover.ts` (spider + link extraction with politeness), `lib/scraper/crawler/classifier.ts` (page type detection), `lib/scraper/crawler/types.ts` (DiscoveredPage interface), modifications to `run.ts` and `registry.ts` to merge discovered-urls.json, integration tests against fake sites, discovery-candidates.json output format for human review.

**Addresses features from FEATURES.md:** Auto-discovery crawler (P1), candidate scoring without auto-commit (differentiator — human gate prevents wrong-year URL commits).

**Avoids pitfalls:** IP banning (rate limiting + robots.txt + depth cap + page cap + User-Agent from first implementation, not retrofitted), storing discovered URLs in DB (ephemeral discovered-urls.json only; source_url in cutoff_scores is the permanent record), crawler inside Vercel API (never — GitHub Actions only).

**Research flag:** Needs phase research — crawlee `enqueueLinks` glob pattern configuration for Vietnamese URL paths, robots-parser integration with CheerioCrawler lifecycle hooks, per-domain delay configuration within crawlee's RequestQueue API. Vietnamese keyword list should be validated against all 78 scrapers.json entries before implementation.

### Phase 4: Bug Fixes

**Rationale:** Isolated code-level patches with no architectural dependency. Doing them after scraper work avoids merge conflicts on files being simultaneously modified. Bug fixes must precede engine tests (Phase 5) because tests written against broken behavior document wrong outcomes.

**Delivers:** Fixed delta sign convention in both ResultsList.tsx and NguyenVongList.tsx (single PR with shared `computeDelta()` utility), fixed trend color semantics with copy update (amber + "Harder this year" tooltip), fixed NaN/null propagation in recommendation engine, fixed withTimeout timer leak, error boundaries (error.tsx, not-found.tsx), readFileSync → async in API fallback paths.

**Addresses features from FEATURES.md:** Fix NaN/delta/trend bugs (P2), error boundaries (P3).

**Avoids pitfalls:** Delta sign regression in one component only (both components in one PR, single shared utility, test asserting correct sign in both), trend color without copy (color and tooltip updated in same PR — color alone is ambiguous without domain context).

**Research flag:** Standard patterns — all fixes are targeted patches to known files with identified line numbers. No phase research needed.

### Phase 5: Recommendation Engine Tests and CI

**Rationale:** After bug fixes (Phase 4), the recommendation engine's behavior is correct. Write tests that assert the corrected behavior. CI workflow depends on tests passing cleanly.

**Delivers:** 8 new engine test scenarios (NaN input, null score, comma-decimal scores, all 5 tier boundary values, 0-practical pool, exactly-15-entry pool) using `@faker-js/faker` factory with `faker.seed(42)`, GitHub Actions CI workflow on `pull_request` running `npm test` and `npm run build`.

**Addresses features from FEATURES.md:** Recommendation engine edge-case tests (P2), CI workflow (P2), synthetic test data factory (differentiator).

**Avoids pitfalls:** No new pitfalls specific to this phase. Verify @faker-js/faker v10 Node.js 20+ requirement against GitHub Actions runner before this phase begins — if runner is Node 18, pin faker at v9 or upgrade runner.

**Research flag:** Standard patterns — vitest factory pattern and GitHub Actions pull_request trigger are well-established. No phase research needed.

### Phase 6: Infrastructure Hardening

**Rationale:** Actions caching and Supabase keep-alive are CI-level concerns that don't affect feature code. Group them into a dedicated hardening phase after all feature development is stable, timed before the July peak window.

**Delivers:** PaddleOCR model caching in GitHub Actions (`actions/cache` keyed on paddleocr version), Playwright browser caching, scrape-low.yml reduced to 3×/week, shard count reduced from 6 to 3 (matching current verified adapter count), scrape-peak.yml gated to Ministry submission window only, Supabase keep-alive workflow (SELECT 1 every 5 days), GitHub Actions minute budget verified at less than 450 min/week during peak simulation.

**Addresses features from FEATURES.md:** Infrastructure hygiene items from PROJECT.md tech debt.

**Avoids pitfalls:** GitHub Actions budget exhaustion (caching + schedule reduction), Supabase auto-pause (keep-alive workflow), N+1 adapter sharding waste (reduce shards to match actual verified adapter count).

**Research flag:** Standard patterns — `actions/cache` for Playwright and Python pip/model caches is documented. Verify GitHub Actions free tier minute limit for this repo's visibility (public vs private — limits differ). No phase research needed.

### Phase 7: UI/UX Redesign

**Rationale:** No other phase depends on UI changes. UI work is high-effort with low breakage risk for non-UI code. Design tokens must come before dark mode within this phase — implementing dark mode with scattered `dark:text-gray-100` classes across 8 components creates a maintenance trap.

**Delivers:** `@theme` design token block in globals.css (three-layer: brand palette → semantic aliases → tier/trend semantic tokens), Be Vietnam Pro font correctly applied via `--font-sans`, TierBadge.tsx migrated as reference component, editable NguyenVongList with useEffect fix + up/down reorder buttons + optional motion Reorder, onboarding overlay and tier label explanations, dark mode via `@custom-variant dark` + next-themes, remaining component token migration, grep verification (`grep -r 'text-green-600\|text-red-600\|bg-gray-100' components/` returns zero deprecated semantic classes).

**Addresses features from FEATURES.md:** Design token system (P3), editable nguyện vọng list (P3), dark mode (P3), onboarding + tier explanations (P3).

**Avoids pitfalls:** Design token migration missing hard-coded classes in dynamic objects (TREND_DISPLAY object must be migrated; grep verification at end of phase), dark mode partial coverage (sub-phase: tokens first, dark mode after tokens are stable — not simultaneous), motion Reorder cross-route incompatibility (list is single-page-section only — acceptable scope but must be tested explicitly on Android touch before committing).

**Research flag:** Needs phase research — (1) motion Reorder component touch behavior on Android (project's primary platform — primary validation before committing to the library); (2) dark mode selector: FEATURES.md uses `.dark` class-based selector, STACK.md uses `[data-theme=dark]` data-attribute — these must align with the `next-themes` `attribute` prop; resolve before writing any CSS.

### Phase Ordering Rationale

- Phase 1 before Phase 3: factory reduces adapter surface area before crawler adds new complexity; discovered pages feed into adapter pattern
- Phase 2 before Phase 3: fake sites are the test substrate for crawler integration tests
- Phase 4 before Phase 5: engine tests must assert correct (post-fix) behavior; tests written before fixes document wrong outcomes
- Phase 6 before July: caching and schedule changes must be in place before peak traffic; adding them during peak is too risky
- Phase 7 last: no feature phase depends on UI; design tokens are additive-only on day one; UI work is tolerant of being the last thing completed

### Research Flags

Phases needing deeper research during planning:
- **Phase 3 (Auto-Discovery Crawler):** crawlee `enqueueLinks` glob patterns for Vietnamese URL paths, robots-parser integration within CheerioCrawler lifecycle, per-domain rate limiting configuration, Vietnamese keyword list validation against full scrapers.json (78 entries including 72 unverified)
- **Phase 7 (UI/UX Redesign):** motion Reorder Android touch behavior + nuqs interaction (test first before committing); `@custom-variant dark` with `data-theme` attribute vs `.dark` class — inconsistency between FEATURES.md and STACK.md must be resolved before writing CSS

Phases with standard patterns (no phase research needed):
- **Phase 1 (Scraper Foundation):** Factory function pattern and Drizzle batch insert are documented and in current use
- **Phase 2 (Resilience Testing):** sirv + vitest globalSetup is a standard Node.js integration test pattern
- **Phase 4 (Bug Fixes):** Targeted patches to known files at identified line numbers
- **Phase 5 (Engine Tests and CI):** vitest factory pattern and GitHub Actions pull_request trigger are well-established
- **Phase 6 (Infrastructure Hardening):** actions/cache documentation is comprehensive for both Playwright and Python/pip caches

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Versions verified via npm registry web search (March 2026); React 19 compatibility issues confirmed via GitHub issues; motion Reorder Android touch behavior not independently confirmed — must validate in Phase 7 |
| Features | HIGH | Derived from direct codebase inspection + PROJECT.md requirements; test gaps identified by reading existing test file line-by-line against known bug list in PROJECT.md |
| Architecture | HIGH | Derived directly from reading the existing codebase (line numbers cited for integration points) — not from web search; all proposed changes are additive with identified zero-breakage integration contracts |
| Pitfalls | HIGH | Grounded in direct code inspection (line numbers cited: runner.ts line 63, ResultsList.tsx lines 46-47, NguyenVongList.tsx lines 52-53), confirmed by 7-agent v1.0 audit findings in PROJECT.md |

**Overall confidence:** HIGH

### Gaps to Address

- **motion Reorder Android touch behavior:** Not independently confirmed. Must be the first validation step in Phase 7 before committing to the library. If Android touch fails, up/down buttons remain the only interaction — which is the mobile-first recommendation anyway, so this is a safe fallback.

- **Dark mode selector inconsistency:** FEATURES.md describes `.dark` class-based toggle; STACK.md describes `[data-theme=dark]` data-attribute. Both are functionally equivalent but must match the `next-themes` `attribute` prop. Resolve during Phase 7 planning before writing any CSS — do not let both approaches coexist.

- **@faker-js/faker v10 Node.js 20 requirement:** Verify GitHub Actions runner Node.js version before Phase 5. If on Node 18, pin faker at v9 or upgrade the runner. Check with `node --version` in a workflow step.

- **Auto-discovery keyword list completeness:** The Vietnamese URL keyword list is derived from verified adapter URLs already in scrapers.json. It has not been validated against the 72 unverified adapters' homepage URLs. Run a manual scan of all 78 scrapers.json homepage URLs during Phase 3 planning to identify any keyword gaps.

- **GitHub Actions free vs. public repo minute limits:** PITFALLS.md cites 2,000 minutes/month. If the repository is public, limits are more generous. Verify repo visibility setting before designing caching strategy in Phase 6 — this determines how aggressively caching needs to be applied.

## Sources

### Primary (HIGH confidence)
- Existing codebase (direct inspection, 2026-03-18): runner.ts, registry.ts, types.ts, all adapters, NguyenVongList.tsx, ResultsList.tsx, recommend/engine.ts, globals.css, package.json, .github/workflows/, scrapers.json, tests/
- `.planning/PROJECT.md` — v2.0 requirements, known bugs (7-agent audit), tech debt constraints
- Tailwind CSS v4 docs — `@theme`, `@custom-variant dark`, CSS-first configuration
- motion (framer-motion) docs — Reorder component API; React 19 support confirmed since v12.27.5 (Dec 2025)
- crawlee docs — enqueueLinks, CheerioCrawler, request queue configuration
- Drizzle ORM docs — batch `.values()` insert, transaction wrapping, `prepare: false` requirement
- Supabase docs — free tier auto-pause policy (7 days inactivity), Supavisor transaction pool mode
- @hello-pangea/dnd GitHub — peerDeps explicitly cap at React 18 (discussion #810)
- @atlaskit/pragmatic-drag-and-drop GitHub — React 19 issue #181 (open, no ETA)
- @dnd-kit/react GitHub — onDragEnd source/target bug issue #1664 (open)

### Secondary (MEDIUM confidence)
- npm registry web search (March 2026) — version confirmations for crawlee 3.13.7, sirv 3.0.2, motion 12.37.0, next-themes 0.4.6, @faker-js/faker 10.3.0
- sirv + vitest globalSetup — eshlox.net implementation guide
- Dark mode + Tailwind v4 — thingsaboutweb.dev guide, iifx.dev next-themes + Tailwind v4 guide
- Design tokens + Tailwind v4 — maviklabs.com 2026 three-layer token pattern article
- ScrapeOps Playwright testing guide — fake HTTP server pattern for scraper tests
- Memory files: project_v2_auto_discovery.md, project_v2_scraper_resilience.md, project_scraper_limitations.md

### Tertiary (LOW confidence — needs validation during implementation)
- @dnd-kit/react onDragEnd bug (issue #1664) — check whether resolved before Phase 7; cited as reason to prefer motion
- GitHub Actions free tier minute limit — depends on repo visibility (public vs private); verify at github.com/features/actions
- motion Reorder Android touch behavior — not independently tested; must be verified before Phase 7 commitment

---
*Research completed: 2026-03-18*
*Ready for roadmap: yes*
