# Phase 13: Infrastructure Hardening - Research

**Researched:** 2026-03-19
**Domain:** GitHub Actions caching, CI workflow optimization, Supabase keep-alive
**Confidence:** HIGH

## Summary

Phase 13 has three distinct tasks: (1) add `actions/cache@v4` for PaddleOCR models and Playwright browsers to the scraping workflows, (2) verify and document that the scraping schedule fits within constraints, and (3) create a Supabase keep-alive cron workflow. Each task is independent and straightforward to implement.

**Critical finding confirmed by official GitHub docs:** UniSelect is a **PUBLIC** repository. GitHub Actions usage is completely free and unlimited for public repositories — the 2,000 minute/month quota only applies to private repos. The "budget concern" in the audit was based on treating the repo as private. This means INFR-02's success criterion ("fewer than 450 Actions minutes for a simulated July peak week") cannot be interpreted as a billing constraint. It must be interpreted as a **wall-clock efficiency target**: the sum of wall-clock minutes for 28 triggers (4/day × 7 days) should be under 450 minutes — achievable with caching (28 × ~10min = 280 min) but not without it (28 × ~18min = 504 min).

The existing scraping workflows (`scrape-peak.yml`, `scrape-low.yml`) already have `actions/setup-python cache:'pip'` for pip packages and `actions/setup-node cache:'npm'` for npm, but are **missing cache steps for PaddleOCR models (~/.paddlex) and Playwright browser binaries (~/.cache/ms-playwright)**. The `ci-ocr.yml` workflow already has the correct PaddleOCR model cache pattern — it just needs to be ported to the scraping workflows.

**Primary recommendation:** Port the `actions/cache@v4` pattern from `ci-ocr.yml` (PaddleOCR) into both `scrape-peak.yml` and `scrape-low.yml`, add a Playwright binary cache step using `hashFiles('package-lock.json')` as the cache key, and create a separate `supabase-keepalive.yml` that runs `SELECT 1` via `DATABASE_URL` every 5 days.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None — all implementation choices are at Claude's discretion.

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase.

Key constraints from STATE.md:
- Verify GitHub Actions free tier minute limit for this repo's visibility (public vs private) before designing caching strategy — limits differ
- GitHub Actions July budget: 4x/day × 6 shards exceeds free tier by 3.7x (per audit)

### Deferred Ideas (OUT OF SCOPE)
None — infrastructure phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFR-01 | GitHub Actions caches PaddleOCR models and Playwright browsers across workflow runs | `actions/cache@v4` with `~/.paddlex` (already in ci-ocr.yml) and `~/.cache/ms-playwright` (needs adding); conditional Playwright install on cache-miss |
| INFR-02 | Scraping shard count optimized to fit within GitHub Actions free-tier budget for July peak | Repo is PUBLIC = free/unlimited minutes; success criterion interpreted as wall-clock efficiency proof: with cache, 28 triggers × ~10 min = 280 min < 450 target |
| INFR-03 | Supabase keep-alive cron workflow prevents auto-pause during low-activity periods | Supabase free tier pauses after 7 days inactivity; a `SELECT 1` via Drizzle `DATABASE_URL` every 5 days provides sufficient margin |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| actions/cache | v4 | Cache workflow dependencies across runs | Official GitHub action; v4 is current as of 2025 |
| actions/setup-node | v4 | Node.js setup with npm cache | Already used in all workflows |
| actions/setup-python | v5 | Python setup with pip cache | Already used in all workflows |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Drizzle ORM (`db` from `lib/db/index.ts`) | existing | Execute `SELECT 1` for keep-alive | Use existing project DB connection; no new dependencies |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `SELECT 1` via Drizzle | Supabase Edge Function heartbeat | Edge Function requires Supabase CLI + separate deploy step; Drizzle + DATABASE_URL is already available in Actions secrets |
| `SELECT 1` via Drizzle | Supabase REST API ping | REST API needs anon key; DATABASE_URL is already used by scraping jobs |
| Cache `~/.cache/ms-playwright` | Docker layer caching | Docker caching is more complex and heavyweight; actions/cache is the standard |

**Installation:** No new packages required. Everything is in existing workflows.

**Version verification:** `actions/cache@v4` is current — confirmed by GitHub Actions changelog (November 2025 cache limit changes reference v4 as current).

---

## Architecture Patterns

### Recommended Project Structure
```
.github/workflows/
├── scrape-peak.yml      # ADD: PaddleOCR model cache + Playwright binary cache
├── scrape-low.yml       # ADD: PaddleOCR model cache + Playwright binary cache
├── ci-ocr.yml           # ALREADY HAS: PaddleOCR model cache (reference implementation)
├── ci.yml               # No change needed
├── staleness-alert.yml  # No change needed
└── supabase-keepalive.yml  # NEW: keep-alive cron workflow
```

### Pattern 1: PaddleOCR Model Cache (already proven in ci-ocr.yml)

**What:** Cache the `~/.paddlex` directory that PaddleOCR 3.x uses to store downloaded model files
**When to use:** Any workflow that calls `PaddleOCR(lang='vi', ...)` — the warm-up step downloads ~500MB of model files on first run

**Reference implementation from ci-ocr.yml:**
```yaml
- name: Cache PaddleOCR models (~/.paddlex)
  uses: actions/cache@v4
  with:
    path: ~/.paddlex
    key: paddleocr-models-${{ runner.os }}-${{ hashFiles('scripts/ocr_table.py') }}
    restore-keys: |
      paddleocr-models-${{ runner.os }}-

env:
  PADDLE_PDX_MODEL_SOURCE: BOS  # Must be set at job level — prevents remote re-check after cache restore
```

**Key decision (from Phase 09 context):** `PADDLE_PDX_MODEL_SOURCE=BOS` must be set at the **job level** (not step level) to prevent PaddleOCR from attempting remote model verification after a cache restore. Without this, even a cache hit triggers a slow remote check.

### Pattern 2: Playwright Browser Binary Cache

**What:** Cache `~/.cache/ms-playwright` (Linux path for Chromium binaries)
**When to use:** Any workflow running `npx playwright install chromium --with-deps`

```yaml
- name: Cache Playwright browsers
  id: playwright-cache
  uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
    restore-keys: |
      playwright-${{ runner.os }}-

- name: Install Playwright browsers
  if: steps.playwright-cache.outputs.cache-hit != 'true'
  run: npx playwright install chromium --with-deps

- name: Install Playwright OS dependencies only
  if: steps.playwright-cache.outputs.cache-hit == 'true'
  run: npx playwright install-deps chromium
```

**Critical nuance:** On Linux, OS-level shared libraries (libglib, libnss, etc.) cannot be cached by `actions/cache`. They must be reinstalled even on a cache hit via `npx playwright install-deps chromium`. Skipping this on a cache hit causes Chromium launch failures.

### Pattern 3: Supabase Keep-Alive Workflow

**What:** A cron workflow that connects to Supabase via `DATABASE_URL` and runs a trivial query to reset the 7-day inactivity timer
**When to use:** Any free-tier Supabase project with development quiet periods

```yaml
name: Supabase keep-alive

on:
  schedule:
    - cron: '0 10 */5 * *'   # Every 5 days at 10:00 UTC — safely within 7-day pause window
  workflow_dispatch:

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Ping database
        run: npx tsx scripts/db-keepalive.ts
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

**Script approach:** Use `npx tsx` with a minimal inline script that leverages the existing Drizzle connection. This reuses `lib/db/index.ts` so there is no new dependency.

**Alternative inline approach** (no extra script file needed):
```yaml
- name: Ping database
  run: node -e "
    const { Client } = require('pg');
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    client.connect().then(() => client.query('SELECT 1')).then(() => { console.log('keep-alive ok'); client.end(); }).catch(e => { console.error(e); process.exit(1); });
  "
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

**Note:** The `pg` package is already installed as a transitive dependency of Drizzle. But using `npx tsx` with a proper TypeScript script is cleaner and consistent with the project's `npx tsx` pattern in all other workflows.

### Pattern 4: Wall-Clock Efficiency Dry-Run Calculation (INFR-02 verification)

Since INFR-02's success criterion is "fewer than 450 Actions minutes for a simulated July peak week, verified by dry-run calculation", the verification artifact is a comment/calculation, not code.

**Calculation to document in PLAN summary:**
- Public repo: minutes are free/unlimited (no billing constraint)
- July peak: 4 triggers/day × 7 days = 28 workflow triggers
- 6 parallel shards per trigger → wall-clock time = longest shard duration
- Without cache: ~18 min/trigger × 28 = ~504 wall-clock minutes
- With cache (PaddleOCR + Playwright): ~10 min/trigger × 28 = ~280 wall-clock minutes
- Result: 280 < 450 ✓

### Anti-Patterns to Avoid

- **Setting `PADDLE_PDX_MODEL_SOURCE` at step level only:** PaddleOCR checks the env var at import time, not at invocation time. It must be a job-level `env:` block.
- **Skipping `playwright install-deps` on cache hit:** The OS shared libraries are not in the cache. Always run `install-deps` even on a hit.
- **Using `SELECT 1` via Supabase REST API (not direct DB):** The REST API endpoint may cache differently or not count as DB activity. Direct Postgres `SELECT 1` is unambiguous.
- **Cache key tied only to `runner.os` with no file hash:** Cache will never invalidate when Playwright or PaddleOCR version changes.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cache invalidation for PaddleOCR models | Custom version-tracking script | `hashFiles('scripts/ocr_table.py')` in cache key | Already proven in ci-ocr.yml; hashFiles is idiomatic |
| Playwright version in cache key | Parsing package.json manually | `hashFiles('package-lock.json')` | Lock file changes exactly when Playwright version changes |
| Supabase activity ping | Supabase Edge Function + deployment | Simple Drizzle `SELECT 1` in a cron workflow | No extra infrastructure; uses existing DATABASE_URL secret |
| OS dependency caching for Playwright | Attempting to cache system libs | `npx playwright install-deps` on every cache hit | System-level binaries are not portable/cacheable |

**Key insight:** All three requirements use existing primitives (actions/cache, existing secrets, existing Drizzle DB connection). No new libraries, no new infrastructure.

---

## Common Pitfalls

### Pitfall 1: PADDLE_PDX_MODEL_SOURCE not set at job level
**What goes wrong:** Cache restores `~/.paddlex` correctly, but PaddleOCR still makes a network request to verify model integrity, adding 1-2 minutes of latency and potentially failing in network-restricted environments.
**Why it happens:** PaddleOCR reads `PADDLE_PDX_MODEL_SOURCE` at Python module import time. A step-level env var is too late.
**How to avoid:** Set `PADDLE_PDX_MODEL_SOURCE: BOS` in the job-level `env:` block (as already done in ci-ocr.yml).
**Warning signs:** Warm-up step takes the same time as a cache miss despite a cache hit being logged.

### Pitfall 2: Playwright cache hit but Chromium fails to launch
**What goes wrong:** Playwright launches Chromium and gets "error while loading shared libraries: libglib-2.0.so.0"
**Why it happens:** OS-level shared libraries are host-specific and cannot be archived by actions/cache. They must be installed on every runner instance.
**How to avoid:** Always run `npx playwright install-deps chromium` unconditionally (or conditionally with `cache-hit == 'true'`).
**Warning signs:** Playwright steps pass on cache misses but fail on cache hits.

### Pitfall 3: Supabase keep-alive not counting as activity
**What goes wrong:** Supabase still pauses the project despite the workflow running.
**Why it happens:** Some approaches (hitting the REST API without auth, or using Supabase client with expired keys) don't register as database activity.
**How to avoid:** Use a direct Postgres `SELECT 1` via `DATABASE_URL` — this is unambiguous DB activity. Verify the `DATABASE_URL` secret is the correct Postgres connection string (not the Supabase anon REST URL).
**Warning signs:** Supabase dashboard shows "Last active" date is not updating.

### Pitfall 4: Keep-alive cron more than 7 days apart
**What goes wrong:** Supabase pauses between runs (e.g., if using `*/7` day schedule and a run fails, the next is 14 days away).
**Why it happens:** `0 0 */7 * *` means "every 7th day of month" in cron — not "every 7 days". Day 1, 8, 15, 22, 29 then nothing until next month.
**How to avoid:** Use `*/5` (every 5 days) for a comfortable safety margin. Add `workflow_dispatch` so a failed run can be manually retried.
**Warning signs:** Supabase emails warning about upcoming pause.

### Pitfall 5: Cache eviction removing Playwright/PaddleOCR entries
**What goes wrong:** Cache hits occur initially but stop after a few weeks.
**Why it happens:** GitHub evicts cache entries not accessed in 7 days. The scraping workflows run daily, so this should not be an issue for the scraping workflows. But the keep-alive workflow only runs every 5 days — it doesn't use the cache.
**How to avoid:** Scraping workflows run frequently enough (daily minimum) to keep the cache entries alive. No special action required.
**Warning signs:** Workflow logs show "Cache not found" after previously showing "Cache restored."

---

## Code Examples

### INFR-01: Add cache steps to scrape workflows (minimal diff)

The existing `scrape-peak.yml` steps for Playwright and PaddleOCR:
```yaml
# BEFORE (no caching):
- name: Install Playwright browsers
  run: npx playwright install chromium --with-deps
- name: Install PaddleOCR
  run: pip install paddleocr
- name: Warm up PaddleOCR models
  run: python3 -c "from paddleocr import PaddleOCR; PaddleOCR(lang='vi', use_gpu=False, show_log=False)"
```

Replace with:
```yaml
# AFTER (with caching):
- name: Cache Playwright browsers
  id: playwright-cache
  uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
    restore-keys: |
      playwright-${{ runner.os }}-

- name: Install Playwright browsers
  if: steps.playwright-cache.outputs.cache-hit != 'true'
  run: npx playwright install chromium --with-deps

- name: Install Playwright OS dependencies
  if: steps.playwright-cache.outputs.cache-hit == 'true'
  run: npx playwright install-deps chromium

- name: Cache PaddleOCR models (~/.paddlex)
  uses: actions/cache@v4
  with:
    path: ~/.paddlex
    key: paddleocr-models-${{ runner.os }}-${{ hashFiles('scripts/ocr_table.py') }}
    restore-keys: |
      paddleocr-models-${{ runner.os }}-

- name: Install PaddleOCR
  run: pip install paddleocr

- name: Warm up PaddleOCR models
  run: python3 -c "from paddleocr import PaddleOCR; PaddleOCR(lang='vi', use_gpu=False, show_log=False)"
```

The `PADDLE_PDX_MODEL_SOURCE: BOS` env var must be added to the job-level `env:` block:
```yaml
jobs:
  scrape:
    runs-on: ubuntu-latest
    env:
      PADDLE_PDX_MODEL_SOURCE: BOS    # ADD THIS
    strategy:
      ...
```

### INFR-03: supabase-keepalive.yml (new file)

```yaml
name: Supabase keep-alive

on:
  schedule:
    - cron: '0 10 */5 * *'   # Every 5 days at 10:00 UTC
  workflow_dispatch:

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Ping Supabase database
        run: node -e "
          const { Client } = require('pg');
          (async () => {
            const client = new Client({ connectionString: process.env.DATABASE_URL });
            await client.connect();
            await client.query('SELECT 1');
            console.log('keep-alive: database is active');
            await client.end();
          })().catch(e => { console.error('keep-alive failed:', e.message); process.exit(1); });
        "
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

**Why `node -e` with `pg` directly:** `pg` is already installed as a dependency of `drizzle-orm`. No new packages. Using `npx tsx` with a TypeScript file requires a file to exist; inline `node -e` avoids a new script file in the repository.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `actions/cache@v2/v3` | `actions/cache@v4` | 2023 | v4 uses immutable cache entries; no partial writes |
| PaddleOCR models in `~/.paddleocr` | `~/.paddlex` | PaddleOCR 3.x | Cache path changed; old cache key would miss |
| Manually specifying Playwright version in cache key | `hashFiles('package-lock.json')` | Established pattern | Automatic invalidation on Playwright upgrades |

**Deprecated/outdated:**
- `~/.paddleocr` cache path: PaddleOCR 3.x uses `~/.paddlex`. Using old path causes cache misses. (ci-ocr.yml already uses the correct `~/.paddlex`.)

---

## Open Questions

1. **Does `pip install paddleocr` need caching separately from model files?**
   - What we know: `actions/setup-python cache:'pip'` already caches the wheel files. The pip install step is fast (~30 sec) when wheels are cached.
   - What's unclear: Whether there is meaningful additional time savings from also caching the pip site-packages directory.
   - Recommendation: Leave pip caching to `setup-python cache:'pip'` — it already handles this. Only add the `~/.paddlex` model cache.

2. **Does `pg` package exist in node_modules for the inline `node -e` approach?**
   - What we know: Drizzle ORM depends on `pg` as a peer dependency; the project uses Drizzle.
   - What's unclear: Whether `pg` is listed in `package.json` directly or only as a transitive dep.
   - Recommendation: Check `package.json` before using the inline approach. If `pg` is not directly listed, use `npx tsx scripts/db-keepalive.ts` with a minimal TypeScript script instead.

3. **Is the `*/5` cron schedule reliable for "every 5 days"?**
   - What we know: `*/5` in the day-of-month position means days 1, 6, 11, 16, 21, 26, 31 — maximum gap is 5 days (or 6 days between day 26 and day 1 of next month if the month has 28/29/30 days).
   - What's unclear: In February (28 days), the gap from day 26 to next day 1 is 3 days — fine. No gap exceeds 6 days in any month.
   - Recommendation: `*/5` is safe. For maximum safety, use `*/4` (every 4th day).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (already installed) |
| Config file | `vitest.config.ts` (if exists) or package.json `test` script |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFR-01 | PaddleOCR + Playwright cache steps exist in scrape-peak.yml and scrape-low.yml | manual-only (workflow YAML inspection) | `grep -c "playwright-cache" .github/workflows/scrape-peak.yml` | ❌ Wave 0 |
| INFR-02 | Dry-run calculation shows < 450 min wall-clock for 28 triggers | manual-only (arithmetic verification) | n/a — documented calculation | n/a |
| INFR-03 | supabase-keepalive.yml exists with schedule ≤ 5 days | manual-only (workflow YAML inspection) | `grep "*/5\|*/4\|*/3\|*/2\|*/1" .github/workflows/supabase-keepalive.yml` | ❌ Wave 0 |

**Note:** All three INFR requirements are infrastructure/configuration changes, not unit-testable code. Verification is by workflow file inspection and workflow run history. No new Vitest tests are needed for this phase. The existing test suite (`npm test`) should continue to pass without modification.

### Sampling Rate
- **Per task commit:** `npm test` (existing suite — should not be broken by YAML changes)
- **Per wave merge:** `npm test`
- **Phase gate:** `npm test` green + manual inspection of workflow YAML changes

### Wave 0 Gaps
- None for automated tests — this phase adds no testable code logic
- Workflow YAML changes are verified by file diff review only

---

## Sources

### Primary (HIGH confidence)
- GitHub official docs (billing) — confirmed public repos have unlimited free minutes: https://docs.github.com/billing/managing-billing-for-github-actions/about-billing-for-github-actions
- GitHub official docs (limits) — concurrent job limits and cache storage limits: https://docs.github.com/en/actions/reference/limits
- `ci-ocr.yml` in this repository — reference implementation for PaddleOCR model caching with `PADDLE_PDX_MODEL_SOURCE: BOS` at job level

### Secondary (MEDIUM confidence)
- Playwright caching guide — cache path `~/.cache/ms-playwright`, conditional install on cache-hit: https://dev.to/jpoehnelt/caching-playwright-binaries-in-github-actions-2mfc
- Playwright solutions guide — conditional `install-deps` on Linux for cache hits: https://playwrightsolutions.com/playwright-github-action-to-cache-the-browser-binaries/
- Supabase free tier pause policy — 7 days inactivity threshold: https://supabase.com/docs/guides/platform/going-into-prod
- Supabase keep-alive via GitHub Actions — pattern confirmed by multiple sources: https://dev.to/jps27cse/how-to-prevent-your-supabase-project-database-from-being-paused-using-github-actions-3hel

### Tertiary (LOW confidence)
- Phase 09 STATE.md decision: `PADDLE_PDX_MODEL_SOURCE=BOS` at job level required — consistent with official PaddleOCR docs behavior; LOW only because unverified against current PaddleOCR 3.x docs directly

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — actions/cache@v4 and GitHub billing policy confirmed by official docs
- Architecture: HIGH — PaddleOCR pattern directly from ci-ocr.yml; Playwright pattern from multiple verified sources
- Pitfalls: HIGH — Linux OS deps pitfall confirmed by Playwright maintainer issues; PADDLE_PDX_MODEL_SOURCE from Phase 09 decision log

**Research date:** 2026-03-19
**Valid until:** 2026-07-01 (GitHub Actions pricing for public repos has been stable; Supabase free tier policy may change)
