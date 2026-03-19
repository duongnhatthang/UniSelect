# Phase 1: Data Foundation - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a stable, validated data pipeline: Supabase schema (tables + indexes + migrations), scraper adapter framework (runner, normalizer, registry), university seed data (78+ institutions), initial scraper adapters for the Ministry portal and 5 universities, and a GitHub Actions scheduled workflow. Every subsequent phase depends on this schema being correct and stable before those phases begin.

</domain>

<decisions>
## Implementation Decisions

### University Seed Data
- Capture only: ministry code, name_vi (full Vietnamese name), website URL — no region, public/private status, or tier in Phase 1
- Add `name_en` as a nullable column now — future-proof for Phase 3 i18n English toggle; null values acceptable until Phase 3 fills them
- Seed data is loaded via a Drizzle migration file with inline INSERT statements — schema creation and seed in one migration, no separate seeder script

### Scrape Run Tracking
- `scrape_runs` table stores per-run: university_id, timestamp, success/fail status, rows_written count, error message (if any)
- No raw HTML snapshots — too much Supabase free-tier storage risk; status + counts + error message is sufficient for failure alerting and staleness tracking
- Every `cutoff_scores` row stores `scraped_at` timestamp and `source_url` directly on the row for granular per-score staleness

### Validation Strategy
- **Strict reject**: invalid records are logged to `scrape_runs.error_log` and discarded — nothing bad reaches the DB
- **Normalize first, then validate**: before rejection, the normalizer canonicalizes fixable cosmetic issues: strip whitespace, uppercase tổ hợp codes (e.g., `a00` → `A00`), convert comma-decimal scores (`28,50` → `28.5`)
- After normalization, reject records that fail these checks: score not a float in [10.0, 30.0], tổ hợp code not matching `[A-D]\d{2}`, major code missing or empty, university_id not in the universities table
- Validation failures are counted and surfaced in the scrape run summary — a run with >0 rejections is flagged (not failed) so other rows still commit

### Initial Adapter Scope
- Phase 1 uses **Cheerio + native fetch only** — no Playwright
- Playwright deferred entirely to Phase 4 (Scraper Expansion); Phase 1 pilot universities must be confirmed as static HTML before adapter work begins
- Initial pilot adapters: Ministry portal (first-class adapter, covers many universities) + BKA (Bách Khoa Hà Nội), KHA (Kinh tế Quốc Dân), NTH (Ngoại Thương), plus 2 more static-HTML sites chosen by Claude after auditing structure
- Ministry portal adapter runs first in the GitHub Actions workflow; individual university adapters fill gaps

### Claude's Discretion
- Which 2 additional universities beyond BKA/KHA/NTH to include in the pilot (pick easiest static-HTML sites from the seed list)
- Exact Drizzle schema column types and index choices beyond what success criteria specifies
- GitHub Actions job structure (single job vs. matrix) for the Phase 1 low-frequency workflow
- `scrape_runs` error_log format (JSON array vs. text)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### University seed data source
- `uni_list_examples.md` — Tab-separated list of 78+ Vietnamese universities with ministry codes, full Vietnamese names, and website URLs. This is the authoritative seed list for the universities table.

### Domain background
- `highschool.md` — Background on Vietnam's nguyện vọng system, exam scoring, tổ hợp codes, and 2026 rule changes (max 15 choices; teacher training programs only counted in top 5). Read for domain context before writing any schema or algorithm.

### Research (must-reads for Phase 1)
- `.planning/research/STACK.md` — Verified technology choices: Next.js 15, Drizzle ORM, Supabase free tier, Cheerio, GitHub Actions. Includes Supabase inactivity caveat and PgBouncer requirement.
- `.planning/research/ARCHITECTURE.md` — Adapter registry pattern, Supabase schema sketch, upsert strategy, scraper runner interface (`RawRow`, `ScraperAdapter`), component boundaries between scraper / DB / API / frontend.
- `.planning/research/PITFALLS.md` — Critical failure modes: CSS selector lock-in, encoding mismatch (Windows-1258 vs UTF-8), JS-rendered pages, silent data corruption. Validation and encoding handling approaches documented here.

### Project constraints
- `.planning/PROJECT.md` — Cost (free-tier only), scraping constraints (no LLM/OCR as primary method), tech stack, key decisions table.
- `.planning/REQUIREMENTS.md` — Requirements PIPE-01, PIPE-02, PIPE-03, INFRA-01 are in scope for Phase 1. Traceability table shows mapping.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None yet — this is the first phase and the codebase has no source files. Everything is greenfield.

### Established Patterns
- None yet from code. Patterns are defined in `.planning/research/ARCHITECTURE.md` and should be followed as the initial conventions.

### Integration Points
- Supabase project must be created and `DATABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` set as environment variables in both Vercel and GitHub Actions secrets before Phase 2 work can begin
- GitHub Actions workflow writes directly to Supabase (not through the Vercel API layer)
- Next.js project initialization on Vercel is a Phase 1 deliverable (success criterion 5) — creates the deployment context that Phase 2 API routes will extend

</code_context>

<specifics>
## Specific Ideas

- No specific visual/interaction references for this phase — it's pure data infrastructure
- The Ministry portal URL needs manual verification before building the adapter (flagged in STATE.md: `thisinh.thitotnghiepthpt.edu.vn` / `thptquocgia` — portal URLs change between cycles)
- Each university's cutoff page must be manually checked for static vs. JS-rendered before writing its adapter — document this per-university in the adapter registry

</specifics>

<deferred>
## Deferred Ideas

- Playwright support for JS-rendered university pages — Phase 4 (Scraper Expansion)
- Region, public/private status, prestige tier on universities table — add in a later migration when needed for filtering
- Per-row diff logging in scrape_runs — future enhancement if debugging demands it
- Raw HTML snapshot storage — future enhancement if brittle scrapers become a maintenance burden

</deferred>

---

*Phase: 01-data-foundation*
*Context gathered: 2026-03-17*
