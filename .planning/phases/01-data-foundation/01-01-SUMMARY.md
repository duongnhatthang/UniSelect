---
phase: 01-data-foundation
plan: 01
subsystem: database
tags: [next.js, drizzle-orm, postgres, supabase, vitest, typescript, tailwind]

# Dependency graph
requires: []
provides:
  - Next.js 16 project scaffold with TypeScript and Tailwind
  - Drizzle ORM schema with 5 tables: universities, majors, tohopCodes, cutoffScores, scrapeRuns
  - Database connection module using postgres.js + Supabase pooler (prepare: false)
  - Migration SQL with DDL for all 5 tables, 3 performance indexes, and 77 university seed rows
  - drizzle.config.ts for drizzle-kit CLI
  - Vitest test framework configured with node environment
  - .env.example documenting DATABASE_URL and SUPABASE_SERVICE_ROLE_KEY
affects:
  - 01-02 (scraper framework — imports db and schema types)
  - 01-03 (adapters — uses schema for typed inserts)
  - 02-api (API routes — imports db connection and schema)
  - all subsequent phases

# Tech tracking
tech-stack:
  added:
    - next 16.1.7 (Next.js full-stack React framework)
    - drizzle-orm 0.45.1 (type-safe Postgres ORM)
    - drizzle-kit 0.31.x (migration CLI)
    - postgres 3.x (postgres.js driver)
    - "@supabase/supabase-js 2.99.x"
    - cheerio 1.2.0 (HTML parsing for scraping)
    - iconv-lite 0.7.x (encoding conversion for Vietnamese sites)
    - chardet 2.x (encoding detection)
    - vitest 4.x (unit test framework)
    - "@vitejs/plugin-react + vite-tsconfig-paths"
  patterns:
    - Supabase pooler connection (port 6543, prepare: false) for serverless-safe DB access
    - Drizzle custom migration with inline seed data (no separate seeder script)
    - Timestamp with timezone via timestamp('col', { withTimezone: true })

key-files:
  created:
    - lib/db/schema.ts
    - lib/db/index.ts
    - drizzle.config.ts
    - drizzle/migrations/0001_init.sql
    - vitest.config.mts
    - .env.example
    - package.json
    - tsconfig.json
    - next.config.ts
    - src/app/page.tsx
    - src/app/layout.tsx
  modified: []

key-decisions:
  - "Use timestamp with withTimezone:true instead of timestamptz — drizzle-orm 0.45.x dropped the timestamptz alias"
  - "77 universities seeded from uni_list_examples.md (all rows from source file)"
  - "Sub-university names with leading '- ' prefix stripped in INSERT values"

patterns-established:
  - "Pattern: Drizzle schema uses timestamp with withTimezone:true for all timestamp columns"
  - "Pattern: DB connection always via Supabase pooler URL (port 6543) with prepare:false"
  - "Pattern: Single migration file for schema DDL + seed data (atomic setup)"

requirements-completed: [PIPE-01, INFRA-01]

# Metrics
duration: 6min
completed: 2026-03-18
---

# Phase 1 Plan 01: Project Initialization and Drizzle Schema Summary

**Next.js 16 scaffold with Drizzle ORM schema (5 tables), postgres.js Supabase pooler connection, seed migration for 77 Vietnamese universities, and Vitest test framework**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-18T06:49:47Z
- **Completed:** 2026-03-18T06:55:31Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- Next.js 16.1.7 project initialized with TypeScript, Tailwind, App Router; all Phase 1 dependencies installed
- Drizzle ORM schema defines all 5 tables with correct types, FK references, UNIQUE constraint on cutoff_scores, and audit fields on scrape_runs
- Migration SQL contains DDL for all 5 tables + 3 performance indexes + 77 university seed rows with ON CONFLICT DO NOTHING
- DB connection uses postgres.js with Supabase pooler (port 6543, prepare: false) as required for serverless transaction-mode pooling
- Vitest configured with node environment, tsconfigPaths, and React plugin; runs without config errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize Next.js 15 project and install all Phase 1 dependencies** - `6903e48` (feat)
2. **Task 2: Define Drizzle schema, DB connection, migration with seed data, and Vitest config** - `42d7f04` (feat)

## Files Created/Modified

- `lib/db/schema.ts` - Drizzle schema with 5 pgTable definitions (universities, majors, tohopCodes, cutoffScores, scrapeRuns)
- `lib/db/index.ts` - DB connection via postgres.js + Drizzle using Supabase pooler with prepare:false
- `drizzle.config.ts` - drizzle-kit configuration pointing to lib/db/schema.ts
- `drizzle/migrations/0001_init.sql` - DDL for 5 tables + 3 indexes + 77 university seed rows
- `vitest.config.mts` - Vitest config with node environment, tsconfigPaths, React plugin
- `.env.example` - Documents DATABASE_URL (pooler URL) and SUPABASE_SERVICE_ROLE_KEY
- `package.json` - All Phase 1 deps: drizzle-orm, postgres, @supabase/supabase-js, cheerio, iconv-lite, chardet, vitest, drizzle-kit
- `src/app/page.tsx` - Minimal placeholder (UniSelect / Coming soon)
- `tsconfig.json` - TypeScript config from Next.js scaffold
- `next.config.ts` - Next.js configuration
- `src/app/layout.tsx` - App Router root layout

## Decisions Made

- Used `timestamp('col', { withTimezone: true })` instead of `timestamptz()` — drizzle-orm 0.45.x dropped the `timestamptz` alias (was a non-issue once fixed)
- All 77 universities from uni_list_examples.md seeded; sub-university names had leading "- " prefix stripped per plan instructions
- Used Next.js 16.1.7 (latest at execution time) instead of "15.x" specified in research — the `create-next-app@latest` installed 16.1.7; no functional difference for this phase

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `timestamptz` import error**
- **Found during:** Task 2 (schema.ts type check)
- **Issue:** `drizzle-orm/pg-core` 0.45.x does not export `timestamptz`; TypeScript threw TS2724 error
- **Fix:** Replaced `timestamptz('col')` with `timestamp('col', { withTimezone: true })` throughout schema.ts
- **Files modified:** lib/db/schema.ts
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** 42d7f04 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Necessary correctness fix for changed drizzle-orm API. No scope change.

## Issues Encountered

- `create-next-app@latest` installed version 16.1.7 (not 15.x as in research). This is the current stable release and fully compatible. The plan's "Next.js 15" was the version at research time (2026-03-17); the actual latest is 16.1.7.
- Directory name "UniSelect" (capital letters) prevented `npx create-next-app@latest . --yes` from running in-place. Scaffolded in `/tmp/uniselect-tmp` then rsync-copied files to project root.

## User Setup Required

External services require manual configuration before the scraper or any DB code can be tested:

1. Create a Supabase project at https://supabase.com
2. Copy the **Transaction Mode Pooler URL** (port 6543) from Project Settings > Database > Connection Pooling
3. Set `DATABASE_URL` to the pooler URL in `.env.local`
4. Copy the **service_role** key from Project Settings > API > Project API keys
5. Set `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`
6. Run `npx drizzle-kit migrate` (or apply `drizzle/migrations/0001_init.sql` directly in Supabase SQL editor) to create tables and seed universities

## Next Phase Readiness

- Schema is stable and all subsequent plans can import `db` from `lib/db/index.ts` and types from `lib/db/schema.ts`
- Scraper framework (plan 01-02) can begin immediately
- Pilot adapter work (plan 01-03) requires manual audit of target university pages before adapter writing

---
*Phase: 01-data-foundation*
*Completed: 2026-03-18*
