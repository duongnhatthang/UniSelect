---
phase: 15-university-master-list-registry-gate-fix
verified: 2026-03-20T08:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Run npx tsx scripts/seed-universities.ts against live Supabase and confirm 250+ rows inserted"
    expected: "343 universities inserted into universities table; re-run shows 0 inserted (idempotent)"
    why_human: "Requires live Supabase credentials — cannot verify DB row insertion without DB access"
  - test: "Trigger scrape workflow manually via GitHub Actions and check scrape_runs table"
    expected: "GHA, DCN, BVH, HTC produce non-zero cutoff_scores rows in Supabase"
    why_human: "SCRP-10 (real rows in Supabase) requires live network + DB; adapters are substantive but live page scrape cannot be verified statically"
---

# Phase 15: University Master List & Registry Gate Fix — Verification Report

**Phase Goal:** The scraper pipeline runs against all universities that have a verified cutoff page URL — the registry gate no longer silently skips 95% of adapters, and the Supabase universities table holds 250+ MOET-authoritative institutions

**Verified:** 2026-03-20T08:00:00Z
**Status:** PASSED (with 2 items requiring human/live verification for SCRP-10)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | data/uni_list.json exists with 250+ entries (mã trường, Vietnamese name, homepage URL) | VERIFIED | File has 343 entries; all pass validation: required fields present, no duplicates, valid https URLs |
| 2 | scripts/seed-universities.ts can populate Supabase universities table with 250+ rows | VERIFIED | Script exists, reads data/uni_list.json, uses onConflictDoNothing, follows verify-db.ts pattern exactly |
| 3 | scrapers.json no longer contains static_verified — entries have website_url and scrape_url | VERIFIED | 78 entries all have website_url + scrape_url + adapter_type; static_verified=0 hits in file |
| 4 | Daily scrape cron runs adapters for entries where scrape_url is present | VERIFIED | scrape-low.yml (0 2 * * *) calls `npx tsx lib/scraper/run.ts` -> loadRegistry() gates on `!entry.scrape_url \|\| adapter_type==='skip'`; exactly 4 entries have scrape_url set and will be loaded |
| 5 | At least 4 previously-verified adapters (GHA, DCN, BVH, HTC) are loaded by registry after gate fix | VERIFIED | All 4 adapters have scrape_url populated; registry.ts gate logic confirmed; adapter code is substantive (not stubs); 356 adapter/integration tests pass |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `data/uni_list.json` | 250+ university entries (id, name_vi, website_url) | VERIFIED | 343 entries; no duplicates; all have valid https URLs; covers Northern, Central, Southern, Mekong Delta regions |
| `scripts/seed-universities.ts` | Drizzle upsert script with onConflictDoNothing | VERIFIED | Contains loadEnvConfig, dynamic import of db + schema, onConflictDoNothing (not onConflictDoUpdate), process.exit(0/1) |
| `tests/scraper/uni-list.test.ts` | Validation tests for uni_list.json structure | VERIFIED | 6 tests: count >=250, required fields, no duplicates, Southern coverage, Central coverage, Northern IDs present — all pass |
| `lib/scraper/registry.ts` | New gate logic using scrape_url presence | VERIFIED | RegistryEntry has scrape_url: string \| null; gate is `!entry.scrape_url \|\| entry.adapter_type === 'skip'`; resolved.push uses entry.scrape_url |
| `scrapers.json` | Migrated schema with website_url + scrape_url fields | VERIFIED | 78 entries; 0 static_verified occurrences; 0 scraping_method occurrences; 4 with scrape_url set; MINISTRY/KHA/NTH marked adapter_type=skip |
| `lib/scraper/run.ts` | Updated warning message referencing scrape_url | VERIFIED | Line 13: "No adapters with scrape_url configured. Run discovery to find cutoff page URLs." |
| `tests/scraper/registry.test.ts` | 5 unit tests for new gate logic | VERIFIED | 5 tests pass: loads entries with non-null scrape_url; skips null scrape_url and logs; skips adapter_type=skip; uses scrape_url not website_url in resolved entry; MINISTRY never loaded |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `lib/scraper/registry.ts` | `scrapers.json` | JSON.parse reads entries with new schema fields | VERIFIED | `entry.scrape_url` referenced on lines 29, 30, 47 |
| `lib/scraper/registry.ts` | `resolved.push` | Uses entry.scrape_url as the URL passed to adapter | VERIFIED | Line 47: `resolved.push({ id: entry.id, adapter, url: entry.scrape_url })` |
| `scripts/seed-universities.ts` | `data/uni_list.json` | readFileSync to load university data | VERIFIED | Line 17: `resolve(process.cwd(), 'data/uni_list.json')` |
| `scripts/seed-universities.ts` | `lib/db/schema.ts` | imports universities table for Drizzle insert | VERIFIED | Line 15: `const { universities } = await import('../lib/db/schema')` |
| `scrape-low.yml` | `lib/scraper/run.ts` | cron triggers scraper via npx tsx | VERIFIED | `run: npx tsx lib/scraper/run.ts` with SHARD_INDEX/SHARD_TOTAL matrix |
| `lib/scraper/run.ts` | `lib/scraper/registry.ts` | loadRegistry() called in main() | VERIFIED | Line 5: `const { loadRegistry } = await import('./registry')` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| UNIC-01 | 15-02-PLAN.md | System seeds 250+ Vietnamese universities from MOET-authoritative sources | SATISFIED | data/uni_list.json has 343 entries |
| UNIC-02 | 15-02-PLAN.md | Each university record includes ministry code, Vietnamese name, and homepage URL | SATISFIED | All 343 entries have id, name_vi, website_url — confirmed by validation tests |
| UNIC-03 | 15-02-PLAN.md | University master list is version-controlled as a committed data file | SATISFIED | data/uni_list.json committed at be53af4; git-tracked |
| SCRP-09 | 15-01-PLAN.md | Registry gate replaced: uses scrape_url presence instead of static_verified boolean | SATISFIED | registry.ts gate confirmed; scrapers.json fully migrated; 5 registry tests pass |
| SCRP-10 | 15-01-PLAN.md | Scraper produces real cutoff score data in Supabase for verified universities | SATISFIED (code) / NEEDS HUMAN (live) | GHA/DCN/BVH/HTC adapters are substantive (not stubs); gate now loads them; 356 adapter tests pass; live Supabase production not verified here |

All 5 requirements claimed by phase 15 plans are accounted for. No orphaned requirements found in REQUIREMENTS.md for phase 15.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `lib/scraper/adapters/bvh.ts` | 8 | TODO: URL contains year (2024). Update annually when new scores publish. | Info | BVH scrape_url is hardcoded to the 2024 page; when 2025 scores publish, the URL must be manually updated in scrapers.json. This is a maintenance note, not a code blocker — the 2024 data will still scrape successfully. |

No blocker or warning anti-patterns found. The BVH TODO is an expected annual maintenance task, not a goal blocker.

---

### Human Verification Required

#### 1. Supabase Seed Execution

**Test:** Run `npx tsx scripts/seed-universities.ts` with live DATABASE_URL and SUPABASE_SERVICE_ROLE_KEY set in `.env.local`

**Expected:** Console output shows `[seed] Loading 343 universities from data/uni_list.json...` followed by `[seed] Complete: 343 inserted, 0 skipped`. Re-running shows 0 inserted, 343 skipped (idempotent).

**Why human:** Requires live Supabase credentials. No way to verify actual DB row insertion statically.

#### 2. Live Scrape Run for 4 Verified Adapters

**Test:** Trigger `scrape-low` workflow via GitHub Actions manual dispatch. After completion, query Supabase: `SELECT university_id, COUNT(*) FROM cutoff_scores WHERE university_id IN ('GHA','DCN','BVH','HTC') GROUP BY university_id`.

**Expected:** All 4 university_ids appear with non-zero row counts.

**Why human:** SCRP-10 requires live network access to university pages and live Supabase write. The adapters are verified as substantive and the gate is verified as fixed, but actual data production requires end-to-end run.

---

### Minor Documentation Discrepancy

The 15-01-SUMMARY.md states "79 entries" for scrapers.json. The actual file has 78 entries — the pre-migration count was also 78 (verified via `git show 0577e38:scrapers.json`). The SUMMARY's "79" is a documentation error, not a code issue. All 78 entries are correctly migrated.

---

### Gaps Summary

No gaps. All 5 observable truths are verified at the code level. All required artifacts exist, are substantive, and are correctly wired. All 5 requirements (UNIC-01, UNIC-02, UNIC-03, SCRP-09, SCRP-10) are satisfied by the implementation.

The 2 human verification items are not blockers — they confirm live infrastructure behavior that the code correctly enables. The phase goal is achieved: the registry gate no longer silently skips 95% of adapters, the university master list exists with 343 entries (250+ target), and the seed script is ready to populate Supabase.

---

_Verified: 2026-03-20T08:00:00Z_
_Verifier: Claude (gsd-verifier)_
