---
phase: 17-scrape-monitoring-db-health
verified: 2026-03-20T08:45:00Z
status: passed
score: 6/6 must-haves verified
re_verification: false
---

# Phase 17: Scrape Monitoring + DB Health Verification Report

**Phase Goal:** Pipeline health is observable — maintainers can query per-university scrape status, the scrape_runs table will not exhaust Supabase's 500 MB free tier, and each GHA scrape run logs a human-readable summary
**Verified:** 2026-03-20T08:45:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                               | Status     | Evidence                                                                                                    |
|----|-------------------------------------------------------------------------------------|------------|-------------------------------------------------------------------------------------------------------------|
| 1  | runScraper returns a RunSummary with attempted/succeeded/failed/zero_rows counts    | VERIFIED   | `RunSummary` interface at line 14–19 of runner.ts; return value at line 133; all 4 counter branches present |
| 2  | Each GHA shard prints a summary line showing counts at job end                      | VERIFIED   | run.ts lines 23–28: `const summary = await runScraper(...)` then console.log with all 4 fields              |
| 3  | keepalive.mjs deletes scrape_runs rows older than 90 days                           | VERIFIED   | keepalive.mjs lines 18–23: `DELETE FROM scrape_runs WHERE run_at < NOW() - INTERVAL '90 days' RETURNING id` |
| 4  | GET /api/admin/scrape-status returns JSON array of per-university scrape status     | VERIFIED   | route.ts exports `getScrapeStatus()` and `GET`; returns `{ data: [...] }` with `Cache-Control: no-store`    |
| 5  | Each entry includes university_id, last_run_at, last_status, last_rows_written      | VERIFIED   | route.ts lines 9–17: Drizzle select with `max(run_at)`, `array_agg` ORDER BY DESC for status/rows; plus `has_error` boolean |
| 6  | Endpoint uses withTimeout and errorResponse for consistency with other API routes   | VERIFIED   | route.ts lines 3–4 import both; line 23 wraps query in `withTimeout(..., 10_000)`; DB_TIMEOUT caught        |

**Score:** 6/6 truths verified

---

### Required Artifacts

| Artifact                                   | Provides                                             | Status     | Details                                                                     |
|--------------------------------------------|------------------------------------------------------|------------|-----------------------------------------------------------------------------|
| `lib/scraper/runner.ts`                    | RunSummary interface + runScraper return value       | VERIFIED   | Interface at line 14; `Promise<RunSummary>` return type at line 31; counters at lines 35, 52, 118, 128 |
| `lib/scraper/run.ts`                       | Summary console.log per shard in GHA logs            | VERIFIED   | `const summary = await runScraper(...)` at line 23; log at lines 24–28     |
| `scripts/keepalive.mjs`                    | 90-day prune DELETE query                            | VERIFIED   | Lines 18–23; uses `RETURNING id` to log pruned count                        |
| `tests/scraper/runner.test.ts`             | RunSummary count tests (4 scenarios)                 | VERIFIED   | `describe('RunSummary counts', ...)` block at line 227; all 4 plan scenarios covered |
| `app/api/admin/scrape-status/route.ts`     | GET endpoint returning per-university scrape status  | VERIFIED   | Exports `getScrapeStatus` and `GET`; Drizzle groupBy query with all required fields |
| `tests/api/scrape-status.test.ts`          | Unit tests for getScrapeStatus query function        | VERIFIED   | 5 tests covering shape, empty result, multiple unis, error status, db.select call |

---

### Key Link Verification

| From                                        | To                          | Via                                      | Status     | Details                                                             |
|---------------------------------------------|-----------------------------|------------------------------------------|------------|---------------------------------------------------------------------|
| `lib/scraper/runner.ts`                     | `lib/scraper/run.ts`        | runScraper return value consumed         | WIRED      | run.ts line 23: `const summary = await runScraper(shard, githubRunId)` |
| `scripts/keepalive.mjs`                     | scrape_runs table           | raw postgres-js DELETE                   | WIRED      | keepalive.mjs line 19: `DELETE FROM scrape_runs`                    |
| `app/api/admin/scrape-status/route.ts`      | `lib/db/schema.ts`          | Drizzle query on scrapeRuns table        | WIRED      | route.ts line 2 imports `scrapeRuns`; used in `.from(scrapeRuns)` and `.groupBy(scrapeRuns.university_id)` |
| `app/api/admin/scrape-status/route.ts`      | `lib/db/timeout.ts`         | withTimeout wrapper                      | WIRED      | route.ts line 3 imports `withTimeout`; line 23 wraps getScrapeStatus() |
| `.github/workflows/supabase-keepalive.yml`  | `scripts/keepalive.mjs`     | GHA cron triggers node keepalive.mjs     | WIRED      | workflow step: `run: node scripts/keepalive.mjs` on `*/5 * *` cron |

---

### Requirements Coverage

| Requirement | Source Plan | Description                                                                              | Status    | Evidence                                                                 |
|-------------|-------------|------------------------------------------------------------------------------------------|-----------|--------------------------------------------------------------------------|
| MON-01      | 17-02       | Scrape status queryable — per-university last scrape time, rows written, error status    | SATISFIED | `GET /api/admin/scrape-status` returns university_id, last_run_at, last_status, last_rows_written, has_error |
| MON-02      | 17-01       | scrape_runs retention policy (90-day pruning) to stay within Supabase 500MB free-tier   | SATISFIED | keepalive.mjs prunes rows older than 90 days on every cron invocation   |
| MON-03      | 17-01       | GHA scrape workflow logs summary statistics at end of each run                           | SATISFIED | run.ts prints `[scraper] Summary -- shard X/Y: N attempted, N succeeded, N failed, N zero-rows` |

REQUIREMENTS.md also confirms all three are marked `[x]` and listed as `Complete` in the phase tracking table.

---

### Anti-Patterns Found

None detected. Checked all 4 production files modified in this phase:

- `lib/scraper/runner.ts` — no TODO/FIXME, no stub returns
- `lib/scraper/run.ts` — no TODO/FIXME, console.log is the intentional GHA log line
- `scripts/keepalive.mjs` — no TODO/FIXME, no placeholder
- `app/api/admin/scrape-status/route.ts` — no TODO/FIXME, no stub returns

---

### Test Results

All 17 tests pass across both test files:

- `tests/scraper/runner.test.ts` — 13 tests (7 original runScraper behavior tests + 4 new RunSummary count tests + 2 existing coverage tests) — all pass
- `tests/api/scrape-status.test.ts` — 5 tests covering shape, empty result, multiple universities, error status, db.select call — all pass

Commits verified in git log:
- `e93824c` — test(17-01): RED failing RunSummary count tests
- `24c52f9` — feat(17-01): RunSummary return type + GHA summary log
- `bc1f85c` — feat(17-01): scrape_runs 90-day pruning in keepalive.mjs
- `92e6daa` — test(17-02): RED failing getScrapeStatus tests
- `9988636` — feat(17-02): GET /api/admin/scrape-status endpoint

---

### Human Verification Required

#### 1. Live endpoint response shape

**Test:** With the app running, call `curl http://localhost:3000/api/admin/scrape-status`
**Expected:** JSON `{ "data": [{ "university_id": "...", "last_run_at": "...", "last_status": "ok|error|flagged|zero_rows", "last_rows_written": N, "has_error": false }] }` with `Cache-Control: no-store` response header
**Why human:** Requires running Next.js app connected to live Supabase database; the unit tests mock the DB layer

#### 2. GHA keepalive prune output in CI

**Test:** Trigger the `supabase-keepalive` workflow via `workflow_dispatch` on GitHub
**Expected:** Job log line `keep-alive: pruned N scrape_run rows older than 90 days` (N may be 0 if no old rows exist yet)
**Why human:** Requires GitHub Actions environment with DATABASE_URL secret set

#### 3. GHA scrape shard summary in CI

**Test:** Observe a completed scrape-low or scrape-peak workflow run on GitHub
**Expected:** Each shard job log contains `[scraper] Summary -- shard X/Y: N attempted, N succeeded, N failed, N zero-rows`
**Why human:** Requires a live GHA run; not reproducible purely from static code inspection

---

### Gaps Summary

No gaps. All 6 must-haves are verified. All 3 requirements (MON-01, MON-02, MON-03) are satisfied. No anti-patterns detected. Phase goal is fully achieved.

---

_Verified: 2026-03-20T08:45:00Z_
_Verifier: Claude (gsd-verifier)_
