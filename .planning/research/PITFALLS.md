# Pitfalls Research

**Domain:** Vietnamese university admissions PWA — v2.0 feature additions to existing system
**Researched:** 2026-03-18
**Confidence:** HIGH — all pitfalls are grounded in direct codebase inspection (runner.ts, ResultsList.tsx, NguyenVongList.tsx, scrape-peak.yml, scrapers.json), known 7-agent audit findings from PROJECT.md, and documented project constraints. No speculative pitfalls.

---

## Critical Pitfalls

Mistakes that cause rewrites, silent data corruption, or CI pipeline collapse when adding v2 features to the existing system.

---

### Pitfall 1: Auto-Discovery Crawler Gets University IP-Banned During July Peak

**What goes wrong:**
A naive crawler starting from university homepages issues 10–50 sequential HTTP requests per university to follow links matching "tuyen sinh / diem chuan" keywords. Vietnamese university servers are often shared hosting or underpowered VMs. The server rate-limits or blocks the crawler's IP. Once banned, the entire scraping pipeline for that university fails silently — the adapter errors out with 403 or connection timeout, `scrape_run` records `status: 'error'`, and if this happens during July peak, there is no way to recover that university's data until the ban expires (24–72 hours).

**Why it happens:**
Auto-discovery is inherently more aggressive than the current targeted scraping. Today's scraper makes exactly one HTTP request per university (to a known URL). A crawler that spiders homepage → link list → page classification makes 10–50 requests per university at maximum speed. At 78 universities × 4×/day during July, an unconstrained crawler looks like a DDoS attempt to any shared-hosting firewall.

**How to avoid:**
- Enforce a minimum inter-request delay of 2–3 seconds **per domain** (not global — parallel crawling of different universities is fine).
- Respect `robots.txt` before crawling any path. Use `robots-parser` npm package.
- Set crawl depth limit: homepage → 1 hop → 2 hops maximum. Score pages are never more than 2 links from the homepage.
- Set a per-domain page cap (20 pages max) to bound worst-case request count.
- Use a distinct `User-Agent` identifying the crawler: `UniSelectBot/1.0 (educational; non-commercial)`.
- Test crawl aggressiveness against local fake university servers (with simulated 429 responses) before any live run.

**Warning signs:**
- HTTP 429 or 403 responses in `scrape_run.error_log` for previously-working adapters.
- `ECONNRESET` or `ETIMEDOUT` errors appearing only after a discovery run.
- A university that was returning data suddenly returns 0 rows after a crawl run.

**Phase to address:**
Auto-discovery crawler phase. Rate limiting must be designed from the first implementation — retrofitting politeness after IP bans is too late if July peak is approaching.

---

### Pitfall 2: Adapter Factory Refactoring Silently Breaks Working Adapters via 0-Row Success

**What goes wrong:**
The 70+ adapter files share the same cheerio table-parsing pattern but with per-university column index variations (e.g., BVH has the score in the "THPT (100)" column; other adapters use different header names). Extracting a generic factory that auto-detects column positions from header keywords is correct in theory, but if it fails to handle any edge case in the 6 verified adapters, those adapters start returning 0 raw rows.

The critical danger: `runner.ts` line 63 sets `status = rowsRejected > 0 ? 'flagged' : 'ok'`. If an adapter returns `[]` (zero rows, no exception thrown), the scrape_run logs `status: 'ok', rows_written: 0`. This is a **silent failure** — the system reports success while writing nothing.

**Why it happens:**
Each existing adapter hard-codes knowledge about its university's table structure in comments. A generic factory replaces that specificity with pattern matching. Pattern matching is necessarily broader and can match the wrong column or fail to match at all. Without a zero-rows guard, the regression is invisible.

**How to avoid:**
- **First change before any factory work:** add a zero-rows guard to `runner.ts`. If `rawRows.length === 0`, either throw an error or record `status: 'zero_rows'` — never allow 0-row scrape to be logged as `'ok'`.
- Before removing any adapter file, run it against a live URL and save the output as a golden fixture.
- Run all 6 verified adapters through the factory and compare output against golden fixtures before deleting any original file.
- Keep original adapter files in `_legacy/` until all 6 verified adapters are confirmed producing identical output.
- Migrate one adapter at a time, not all 70 simultaneously.

**Warning signs:**
- `scrape_run` records showing `rows_written: 0` for adapters that previously wrote rows.
- `status: 'ok'` with `rows_written: 0` — this is the exact silent failure signature.
- Golden fixture comparison fails.

**Phase to address:**
Adapter factory phase. The zero-rows guard must be the very first commit — before factory development begins — so the safety net exists from the start.

---

### Pitfall 3: GitHub Actions Free Tier Budget Exhausted Before July Peak Ends

**What goes wrong:**
Each scraping job (1 shard) takes ~30 minutes due to: `npm ci` (~3 min), Playwright browser install (~5 min), PaddleOCR model download (~10 min), actual scraping (~12 min). With `scrape-low.yml` running 1×/day × 6 shards = 6 jobs/day × 30 min = 180 min/day. For 31 non-peak days: 5,580 min. Peak: `scrape-peak.yml` runs 4×/day × 6 shards = 24 jobs/day × 30 min = 720 min/day × 31 days = 22,320 min. Total July: ~22,320 min — 11× over the 2,000 min/month free tier.

This is already a known problem (PROJECT.md tech debt section). Adding an auto-discovery workflow that runs on its own schedule makes it worse.

**Why it happens:**
PaddleOCR model download (~400–600 MB for Vietnamese language) and Playwright browser installation happen on every run because GitHub Actions ephemeral runners have no persistent state. Models and browsers are re-downloaded on each of the 24 daily peak jobs.

**How to avoid:**
- Cache Playwright browsers: `actions/cache` keyed on `${{ runner.os }}-playwright-${{ hashFiles('package-lock.json') }}`.
- Cache PaddleOCR models: `actions/cache` keyed on `${{ runner.os }}-paddleocr-${{ steps.paddleocr-version.outputs.version }}` targeting `~/.paddleocr/`.
- Move `scrape-low.yml` to 3×/week (Monday/Wednesday/Friday) — data changes at most once per year per university, daily is wasteful.
- Run auto-discovery as a separate weekly workflow (or manual `workflow_dispatch`), not inside the daily scrape cron.
- Gate `scrape-peak.yml` to exactly the 2–3 weeks around the Ministry's official nguyện vọng submission period, not all of July.
- Reduce from 6 shards to 3 shards when only 6 adapters are verified — 6 shards for 6 adapters means 5 shards run 1 adapter each and 1 shard runs 0.

**Warning signs:**
- GitHub Actions billing page showing minutes approaching 1,500 before mid-July.
- Workflow runs queuing or failing "No runners available."
- Runs that previously completed in 25 min now taking 40+ min (cache miss — model re-download).

**Phase to address:**
Infrastructure / CI optimization phase. Cache setup must be implemented before enabling peak schedule — otherwise the budget blows out in the first week of July.

---

### Pitfall 4: Delta Sign Convention Fix Breaks Both Components If Fixed Atomically Is Missed

**What goes wrong:**
`ResultsList.tsx` line 46: `delta = cutoff - userScore` — positive value means the student is BELOW the cutoff (unfavorable). `NguyenVongList.tsx` line 52: `delta = userScore - cutoff` — positive value means the student is ABOVE the cutoff (favorable). These are inverted relative to each other.

The sign prefix logic is also wrong in `ResultsList.tsx` line 47: `sign = cutoff >= userScore ? '+' : ''` adds '+' when the cutoff exceeds the student's score — exactly when the student is below the bar. A student with score 24 against a cutoff of 25 sees "+1.0", suggesting they're ahead, when they are 1 point short.

Fixing only one component at a time creates a state where both show the same number with opposite signs and opposite prefix logic — temporarily worse than either broken state.

**Why it happens:**
The two components were built separately and both had the delta direction wrong, but in mirrored ways. It's natural to fix one and submit a PR — but the fix is only meaningful if applied simultaneously to both components.

**How to avoid:**
- Define a single `computeDelta(userScore: number, cutoff: number): number` utility that returns `userScore - cutoff` (positive = student above cutoff = favorable). Import it in both components.
- Fix both components in one PR. Do not split across two PRs.
- Add a test that asserts: for `userScore=25, cutoff=24`, both components display `+1.0`; for `userScore=23, cutoff=24`, both display `-1.0`.
- The sign prefix logic must be: add `'+'` when `userScore >= cutoff`, nothing otherwise. Validate this in the same test.

**Warning signs:**
- ResultsList showing "+1.0" for a university where the student's score is BELOW the cutoff.
- NguyenVongList showing the same number as ResultsList but with opposite sign.
- A PR that fixes delta in only one component.

**Phase to address:**
Bug fixes phase. Atomic — fix both components in a single PR with a test.

---

### Pitfall 5: Trend Color Fix Incomplete Without Semantic Copy Update

**What goes wrong:**
`ResultsList.tsx` maps `rising → text-green-600` and `falling → text-red-600`. For a Vietnamese student, a rising cutoff is BAD — the bar is going up, qualifying is harder. Fixing only the color (swapping to rising → red, falling → green) creates the second-order problem: a red ↑ arrow is visually alarming without context, and a green ↓ arrow is confusing without explanation. A student who sees a red arrow may think "I'm rejected" rather than "this university's cutoff went up."

**Why it happens:**
Color was mapped from a generic "green = good, red = bad" pattern without domain-specific semantics. Financial chart conventions (rising = green) were applied to admissions data where rising cutoff = worse for the student.

**How to avoid:**
- Change colors to student-perspective semantics: falling cutoff → `text-green-600` (easier to get in), rising cutoff → `text-amber-500` (harder to get in — use amber/warning, not red, because red implies rejection). Stable → `text-gray-400`.
- Add tooltip or inline label text alongside the trend icon: "↑ Harder this year" vs "↓ Easier this year." The icon + color alone is ambiguous without copy.
- Update trend color and copy in the same PR as part of the bug fixes phase.
- During the design token migration (P3), encode these as semantic tokens: `color.trend.favorable`, `color.trend.warning`, `color.trend.neutral`. This prevents recurrence.

**Warning signs:**
- Rising trend displayed as green in the UI while adjacent section says "this university is getting more competitive."
- Any PR that changes color without updating tooltip/label copy.

**Phase to address:**
Bug fixes phase (semantics + color + copy change together). Design token migration phase prevents recurrence.

---

### Pitfall 6: Supabase Free Tier Auto-Pause Kills July Scraping Pipeline

**What goes wrong:**
Supabase free tier pauses the database after 7 consecutive days of inactivity. During normal development (off-season), scraping runs daily so the database stays active. But any deliberate pause — code freeze for testing, disabling cron to debug a workflow, a 2-week vacation — exposes the gap. The next cron run (possibly in July) hits a paused DB, all adapters throw connection errors, all `scrape_run` records log `status: 'error'`, and no new data is written. The static fallback serves stale data.

The risk is highest during the v2.0 development period (March–June) when scraping infrastructure is being modified and runs may be temporarily disabled.

**Why it happens:**
The daily scraping cron acts as an implicit keep-alive, masking the risk. Any pause longer than 7 days triggers the auto-pause. This is not visible until the next run fails.

**How to avoid:**
- Add a lightweight GitHub Actions keep-alive workflow: runs a `SELECT 1` query every 5 days via the Supabase REST API or direct Postgres connection. Uses < 1 minute of Actions budget per week.
- Document the auto-pause behavior in the project README so future maintainers don't accidentally pause scraping for more than a week.
- Add `X-Served-By: static-fallback` header detection to the staleness alert script — if the API returns static fallback data, fire an alert immediately.

**Warning signs:**
- Supabase dashboard shows "Paused" status.
- All scrape runs in a batch return `status: 'error'` with connection refused / ECONNREFUSED messages.
- `/api/universities` response includes `X-Served-By: static-fallback` header.
- `check-staleness.ts` script fires for all universities simultaneously.

**Phase to address:**
Infrastructure hardening phase. The keep-alive workflow is a 10-line addition that prevents a catastrophic July scenario.

---

### Pitfall 7: Batch Insert Partial Failures Leave University Data in Inconsistent State

**What goes wrong:**
The current `runner.ts` does row-by-row inserts (N+1 pattern). Migrating to batch inserts is the right call, but if the batch for a university is NOT wrapped in a database transaction and the batch is chunked across multiple `db.insert()` calls, a network blip between chunks leaves partial data: some years/majors for that university are updated with fresh scores, others remain stale. The `scrape_run` record shows `rows_written: 30` of an expected 50, with no error — partial success is not flagged.

In Drizzle ORM, `db.insert().values([...array])` is a single SQL statement and safe, but if rows are chunked into multiple `.values()` calls (necessary to stay under Postgres's ~65,535 parameter limit), each chunk is an independent transaction by default.

**Why it happens:**
Batch insert feels like a simple "just pass an array" change. The transaction boundary between chunks is not obvious without reading Drizzle's internals.

**How to avoid:**
- Wrap each university's full batch insert in `db.transaction(async (tx) => { ... })`. All-or-nothing per university.
- Keep chunks within a single transaction even if chunking is required for parameter limits.
- Add assertion: after the transaction commits, verify `rows_written` matches `rawRows.filter(normalize !== null).length`.
- Test partial failure with fake website fixtures: configure one fixture to return a row that causes a DB constraint violation mid-batch. Confirm full university batch rolls back.

**Warning signs:**
- `rows_written` count in `scrape_run` doesn't match the expected count from adapter output minus normalization rejections.
- Some majors for a university have updated `scraped_at` while others have stale timestamps from the same scrape run.
- Postgres `too many parameters` errors after switching to batch inserts.

**Phase to address:**
Scraper expansion phase (batch DB inserts). Transaction wrapping must be part of the initial implementation, not a follow-on.

---

### Pitfall 8: Design Token Migration Misses Hard-Coded Tailwind Classes in Dynamic Objects

**What goes wrong:**
Migrating to a design token system requires replacing all hard-coded Tailwind utility classes with semantic tokens. `ResultsList.tsx` already uses a pattern that is easy to miss during migration: the `TREND_DISPLAY` object maps trend values to Tailwind color strings at the object definition level:

```typescript
const TREND_DISPLAY = {
  rising:  { icon: '↑', color: 'text-green-600' },
  falling: { icon: '↓', color: 'text-red-600' },
  ...
};
```

Tailwind's JIT scanner includes these classes because they appear as string literals. If migration replaces them with CSS custom properties (`color: 'var(--color-trend-rising)'`) and removes the Tailwind class strings, the JIT scanner no longer generates the old classes — but the new CSS variables must be defined in a separate CSS file included by Tailwind's `@source` config. Missing either step produces invisible text (undefined CSS variable = no color applied).

Dark mode adds a second failure mode: if `dark:` variants are added to some components but not others in the same PR, some cards render correctly in dark mode while others become unreadable.

**Why it happens:**
Global find-and-replace across 8 components looks complete. Dynamic class patterns in objects are easy to miss because they don't look like inline JSX props. Dark mode requires touching every component — partial coverage is invisible until viewing the UI in dark mode.

**How to avoid:**
- Create `tailwind.config.ts` semantic theme extensions FIRST, before touching any component.
- Set up visual regression tests (Playwright screenshot comparison) for at least one representative component before migrating.
- Migrate components one at a time; run visual tests after each.
- Add dark mode as a separate sub-phase AFTER design tokens are stable — not simultaneously.
- After migration, run: `grep -r 'text-green-600\|bg-gray-100\|text-red-600' components/` to find missed hard-coded classes.

**Warning signs:**
- Some components show Tailwind colors; others show CSS custom property colors (inconsistent appearance).
- Dark mode works on some cards but not others.
- Build size increases (Tailwind including both old and new class variants simultaneously).
- Trend color arrows are invisible (undefined CSS variable fallback = no color).

**Phase to address:**
UI/UX redesign phase. Design tokens first, then dark mode as a separate sub-phase.

---

### Pitfall 9: PaddleOCR CI Test Fails From Model Download Size on Constrained Runners

**What goes wrong:**
PaddleOCR v3.x downloads model files (~400–600 MB for Vietnamese language) on first initialization. The existing `scrape-peak.yml` already downloads these on every run. Adding a dedicated PaddleOCR CI test workflow means a second workflow that also downloads models. If both workflows run concurrently (e.g., a PR triggers CI while a scheduled scrape is running), combined disk usage becomes:

- OS baseline: ~4 GB
- Node modules (`npm ci`): ~300 MB
- Playwright Chromium: ~350 MB
- PaddleOCR models: ~500 MB per workflow
- Total on two concurrent runners sharing ephemeral storage: can reach 6–7 GB per runner, which is well within GitHub's 14 GB limit per runner, but model download time (~10 min per job) inflates total job time.

The actual risk is not disk exhaustion but **build time**. If PaddleOCR models are not cached, a CI test that should take 3 minutes takes 15 minutes because of model download. This burns Actions budget and makes CI feel broken.

**Why it happens:**
OCR CI tests are added without configuring the same model cache that the scraping workflows use. The scraping workflow is set up first; the CI workflow is written separately and the cache step is forgotten.

**How to avoid:**
- Cache PaddleOCR models: `actions/cache` with key `${{ runner.os }}-paddleocr-${{ env.PADDLEOCR_VERSION }}` targeting `~/.paddleocr/`.
- The PaddleOCR CI job should NOT install Playwright — they serve different purposes. Keep them in separate jobs.
- Trigger the PaddleOCR CI test only on PRs that modify `ocr_table.py`, `scrape-peak.yml`, or `lib/scraper/` — not on every push.
- After implementing the cache, verify it works by checking two consecutive runs: first run should show "Cache miss"; second run should show "Cache hit" and complete in < 5 minutes.

**Warning signs:**
- PaddleOCR CI job taking > 12 minutes (model download on every run — cache not working).
- Actions budget consumed disproportionately by OCR-related jobs.
- "Cache miss" on every run despite using `actions/cache` (wrong cache key or path).

**Phase to address:**
Scraper expansion / CI integration phase.

---

### Pitfall 10: Scraper Resilience Fixtures Drift From Real University Pages

**What goes wrong:**
Fake local HTTP servers serving static HTML fixtures are the test substrate for scraper resilience testing. If a university changes its page structure and the real adapter is updated to handle the new format, but the fixture is NOT updated to reflect the new format, the test still passes against the old fixture. The adapter is now tested only against a format that no longer exists in production. Tests give false confidence.

**Why it happens:**
Fixtures are written once during test setup and rarely revisited. The adapter and the fixture have no enforced linkage. A developer updating an adapter to handle a changed table structure tests locally against the live website, confirms it works, and submits the PR — but doesn't update the fixture because nothing in the workflow requires it.

**How to avoid:**
- Name fixture files with a version or date: `bvh-2025-table.html`. This makes it obvious when a fixture is stale.
- Add a comment in each adapter file pointing to its corresponding fixture: `// fixture: tests/fixtures/bvh-2025-table.html`. Changing one implies changing the other.
- Include a "fixture audit" step in `verify-adapters.ts`: compare the structure (column count, first-row header text) of the live page against the fixture. Flag structural differences.
- In PR reviews: if an adapter file is modified but its corresponding fixture is not, require explanation.

**Warning signs:**
- All adapter tests pass but a verified adapter returns 0 rows in the next production scrape.
- Fixture HTML contains table headers that no longer appear on the live university website.
- The fixture audit comparison (if implemented) shows header drift.

**Phase to address:**
Scraper resilience testing phase. Fixture versioning and linkage conventions must be established before writing the first fixture — not retrofitted.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `readFileSync` in API fallback paths (already in `route.ts`) | Simple synchronous read | Blocks Node.js event loop under high concurrency during July spike | Replace with async `readFile` in v2 — never acceptable in production serverless |
| No transaction wrapping on batch inserts | Faster to implement | Partial batch failures leave inconsistent DB state per-university | Never — transactions are required for batch correctness |
| Hard-coded year in adapter URL (`new Date().getFullYear() - 1` in `bvh.ts`) | Works for most of the year | Dec/Jan ambiguity; fails if universities publish early; breaks when factory extracts this logic | Replace with year parameter from `scrapers.json` during factory refactoring |
| Copy-pasted adapter per university (70+ files) | Fast initial implementation | Bugs must be fixed in N files; factory refactoring is now mandatory v2 work | No longer acceptable — factory is the v2 fix |
| 6 shards for 6 verified adapters (1 adapter/shard) | Mirrors future state when 78 are verified | 5 shards are no-ops today, burning Actions minutes on startup overhead | Reduce to 2–3 shards until verified adapter count grows |
| `static_verified: false` adapters with homepage URLs in `scrapers.json` | Defers manual URL audit work | Auto-discovery builds from wrong base URLs; 72 adapters have homepage URLs, not score page URLs | Must audit before auto-discovery; auto-discovery needs a correct starting URL to crawl from |
| Trend colors as hard-coded Tailwind strings in `TREND_DISPLAY` object | Simple to write inline | Cannot change semantic meaning without grepping all files; migrates awkwardly to design tokens | Replace during design token migration with `cva` or CSS variables |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase + Drizzle pooler (port 6543) | Setting `prepare: true` (Drizzle default) with PgBouncer in transaction mode | Must use `prepare: false` — already correct in v1; do not change this setting during refactoring |
| GitHub Actions matrix sharding | Running 6 shards when only 6 adapters are active (1 adapter per shard = 5× startup overhead) | Match shard count to actual adapter count; consider dynamic shard count via strategy matrix |
| PaddleOCR v3.x predict() API | Calling `ocr()` method (v2.x API) — PaddleOCR 3.x changed to `predict()` | Already fixed in `ocr_table.py` per git log; do not revert during any refactoring |
| Playwright + GitHub Actions | Running `npx playwright install` (all browsers) when only Chromium is needed | Use `npx playwright install chromium --with-deps` — already correct; do not generalize during CI refactoring |
| Vercel + Next.js build + Supabase | `generate-static` chained into `npm run build`; Vercel runs this during deploy | Requires `DATABASE_URL` set in Vercel environment variables; verify this is set before any deployment that changes static generation |
| nuqs + React 19 | `useQueryState` and `useEffect` dependencies can cause infinite loops when effect deps include the setter | The `NguyenVongList.tsx` effect already suppresses the lint warning — verify the v2 editable list implementation doesn't reintroduce this issue |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Row-by-row DB inserts in runner.ts (current) | 78 adapters × ~30 rows each = ~2,340 sequential DB round-trips per shard | Batch inserts per university (v2 planned) | At 78 verified adapters, N+1 inserts take 10–20 min per shard instead of 1–2 min |
| Auto-discovery crawling all 78 universities in parallel | Connection pool exhaustion; mass IP bans | Limit concurrent domains to 5–10 with a queue; per-domain delay | With 78 universities and 10–50 requests each, fully concurrent = 780–3,900 simultaneous connections |
| `readFileSync` in `/api/universities` fallback (current) | Event loop blocks at high concurrency; Vercel function timeout | Replace with `fs.promises.readFile` or pre-load at module initialization | Under July traffic (hundreds concurrent), one block cascades into 502 errors |
| 6 shards × 30 min each for 6 adapters | 3 hours of Actions budget per day for 6 adapters' worth of work | Reduce shard count; cache model downloads | Already over budget at peak schedule; getting worse as more adapters are verified |

---

## UX Pitfalls

Common user experience mistakes specific to v2 feature additions.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Delta sign inverted in ResultsList (current bug) | Student sees "+1.0" next to a university where they are 1 point SHORT of qualifying; assumes they're ahead | Fix: `userScore - cutoff`; positive = student above cutoff = favorable |
| Rising trend shown as green (current bug) | Student interprets rising cutoff = good match; over-ranks competitive universities | Rising cutoff → amber/warning + "Harder this year" tooltip |
| Editable nguyện vọng list with no persistence signal | Student reorders list, closes browser, changes lost | URL state (nuqs already in use) + visible notice "Your list is saved in this URL" |
| Tier labels without concrete score context | "Dream" / "Safe" are opaque to students unfamiliar with the system | Show threshold: "Dream: your score is 3+ points above cutoff (25.0)" |
| No error boundary on failed API calls (current: silent `.catch(() => {})`) | Students see empty results with no explanation | Replace with error state UI: "Could not load recommendations — retry" |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces specific to v2.

- [ ] **Adapter factory migration:** "Done" only when all 6 verified adapters produce byte-identical output vs golden fixtures on live URLs. Verify with `verify-adapters.ts` against real websites — not just against fake fixtures.
- [ ] **Zero-rows guard in runner.ts:** "Done" only when `status: 'ok'` with `rows_written: 0` is impossible. Test by running an adapter that returns `[]` and confirming `status: 'zero_rows'` or `status: 'error'` is logged.
- [ ] **Auto-discovery crawler:** "Done" only when rate limiting and `robots.txt` compliance are tested against a live university homepage without triggering 429/403 over 3 consecutive test runs.
- [ ] **Batch DB inserts:** "Done" only when wrapped in a transaction with a rollback test. Verify: intentionally fail one row mid-batch and confirm full university batch rolls back to pre-batch state.
- [ ] **Delta sign fix:** "Done" only when both `ResultsList.tsx` and `NguyenVongList.tsx` are updated in the same PR, with a test asserting `+1.0` for student above cutoff and `-1.0` for student below cutoff in both components.
- [ ] **Trend color fix:** "Done" only when tooltip/label copy is updated alongside color. Color alone without context is ambiguous.
- [ ] **PaddleOCR CI test:** "Done" only when cache hit is confirmed on second run. Verify: trigger CI twice; second run should show "Cache hit" and complete in < 5 minutes.
- [ ] **Design token migration:** "Done" only when `grep -r 'text-green-600\|text-red-600\|bg-gray-100' components/` returns zero results referencing deprecated semantic classes.
- [ ] **GitHub Actions minute budget:** "Done" only when a full peak-schedule week uses < 450 min (2,000 / 4.4 weeks). Measure before/after caching implementation.
- [ ] **Supabase keep-alive job:** "Done" only when manually triggered and confirmed to execute a successful DB query — and confirmed to keep the database active after a simulated 7-day pause.
- [ ] **Font fix (Be Vietnam Pro):** "Done" only when DevTools computed styles show `font-family: 'Be Vietnam Pro'` on body text in Chrome. Not confirmed by code inspection alone.
- [ ] **Fixture resilience tests:** "Done" only when a structural change to a fixture HTML file causes the corresponding adapter test to fail — confirming the fixture audit mechanism catches drift.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| IP ban from auto-discovery during peak | HIGH (24–72 hr wait; no data from that university during peak) | Fallback to manual URL for that university; reduce global crawl aggressiveness; add that domain to a known-slow list |
| Adapter factory breaks verified adapters | MEDIUM (revert; restore `_legacy/` originals; re-verify before retry) | Git revert the factory PR; restore original adapter files from `_legacy/`; verify on live sites; re-attempt factory migration one adapter at a time |
| Actions minutes exhausted mid-July | HIGH (cannot scrape until next billing cycle on the 1st) | Pre-generate static JSON manually using `generate-static-json.ts`; deploy to Vercel manually; write correct data to DB via `verify-db.ts` |
| Supabase auto-pause during peak | MEDIUM (~30 sec to resume manually via dashboard) | Log in to Supabase dashboard; click "Restore"; wait for resume; re-run failed shard via `workflow_dispatch` |
| Delta sign regression in one component only | LOW (one-line fix + redeploy in minutes) | Fix remaining component; add test; deploy |
| Batch insert partial failure | MEDIUM (re-run scraper for affected university; transaction rollback means clean starting state) | Trigger `workflow_dispatch` for affected shard; batch insert with transaction overwrites partial data cleanly |
| Design token migration misses hard-coded classes | LOW (grep; fix in follow-up PR) | `grep -r 'text-green-600\|text-red-600' components/`; fix misses in a follow-up PR |
| Fixture drift causes false-positive test pass | MEDIUM (discover only when production scrape fails) | Update fixture from live page; add fixture audit step to `verify-adapters.ts` to detect future drift |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| IP ban from auto-discovery (P1) | Auto-discovery crawler phase | Test against fake local servers with simulated 429 responses; no 403/429 on 3 consecutive live homepage crawls |
| Adapter factory silent 0-row failure (P2) | Adapter factory phase — zero-rows guard first | `status: 'ok'` with `rows_written: 0` is impossible; golden fixture comparison passes for all 6 verified adapters |
| GitHub Actions budget overrun (P3) | Infrastructure / CI optimization phase | Peak schedule week uses < 450 min; cache hit confirmed on second run |
| Delta sign fix regression (P4) | Bug fixes phase | Test asserts `+1.0` for above-cutoff in both ResultsList and NguyenVongList |
| Trend color without copy (P5) | Bug fixes phase | Tooltip present; user can interpret without seeing arrow color |
| Supabase auto-pause (P6) | Infrastructure hardening phase | Keep-alive workflow confirmed; DB stays active after 7-day silence |
| Batch insert partial failure (P7) | Scraper expansion phase | Rollback test passes; `rows_written` matches expected count |
| Design token regression (P8) | UI/UX redesign phase | No hard-coded semantic color classes remain; visual regression test passes |
| PaddleOCR CI disk/time issue (P9) | Scraper expansion / CI phase | Cache hit on second run; OCR CI completes in < 5 min |
| Fixture drift (P10) | Scraper resilience testing phase | Fixture audit detects structural header drift on a modified fixture |

---

## Sources

- Codebase direct inspection (2026-03-18):
  - `lib/scraper/runner.ts` — silent 0-row success pattern (line 63 `status = rowsRejected > 0 ? 'flagged' : 'ok'`)
  - `components/ResultsList.tsx` — inverted delta (line 46–47)
  - `components/NguyenVongList.tsx` — inverted delta in opposite direction (line 52–53)
  - `.github/workflows/scrape-peak.yml` — 4×/day × 6 shards; no model caching
  - `.github/workflows/scrape-low.yml` — daily × 6 shards; no model caching
  - `lib/scraper/adapters/bvh.ts` — hard-coded `getFullYear() - 1` year logic
  - `app/api/universities/route.ts` — `readFileSync` in static fallback path
  - `scrapers.json` — 72/78 entries with `static_verified: false` and homepage URLs
- Project audit findings: `PROJECT.md` — Known Tech Debt section (7-agent audit, 2026-03-18)
- Memory: `project_v2_auto_discovery.md` — rate limiting and robots.txt requirements
- Memory: `project_v2_scraper_resilience.md` — fake website testing requirements
- Memory: `project_scraper_limitations.md` — Vietnamese university scraping constraints
- Supabase documentation: free tier auto-pauses after 7 days inactivity (HIGH confidence — official policy)
- GitHub Actions documentation: 2,000 free minutes/month for private repos; public repos have more generous limits — verify current limits for this repo's visibility setting (MEDIUM confidence — confirm at github.com/features/actions)
- PaddleOCR v3.x API change (`predict()` replaces `ocr()`) — confirmed from `ocr_table.py` git history in repo

---
*Pitfalls research for: UniSelect v2.0 — Vietnamese university admissions PWA (adding features to existing system)*
*Researched: 2026-03-18*
