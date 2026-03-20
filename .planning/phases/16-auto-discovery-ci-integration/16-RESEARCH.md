# Phase 16: Auto-Discovery CI Integration - Research

**Researched:** 2026-03-20
**Domain:** GitHub Actions artifact upload, TypeScript script authoring, scrapers.json patching
**Confidence:** HIGH

## Summary

Phase 16 wraps the already-working `scripts/discover.ts` crawler into a scheduled GitHub Actions workflow and adds a human-gated patching script. No new discovery logic is needed — the crawler, scoring algorithm, and test suite all exist and pass. The two deliverables are: (1) `.github/workflows/discover.yml` that runs weekly and uploads `discovery-candidates.json` as a GHA artifact, and (2) `scripts/apply-discovery.ts` that reads that file and patches `scrapers.json` entries.

The critical code change in `discover.ts` is updating `buildStartUrlsFromScrapers()` — it currently reads `entry.url` (old v1 schema) and `entry.static_verified` (removed in Phase 15). The new scrapers.json schema uses `website_url` for the homepage and `scrape_url` for the cutoff page. The crawler must start from `website_url`, not the old url field. The interface at line 147-150 of discover.ts is stale and must be updated.

The `apply-discovery.ts` script has one firm constraint from REQUIREMENTS.md and STATE.md: **never overwrite entries that already have a verified `scrape_url`**. Entries with `adapter_type: "skip"` should also be skipped. Only `pending` entries with `scrape_url: null` are eligible for patching.

**Primary recommendation:** Two-task phase. Task 1 fixes discover.ts schema migration + creates discover.yml + uploads artifact. Task 2 creates apply-discovery.ts with the protected-entries guard.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DISC-01 | Auto-discovery crawler runs as a GitHub Actions workflow (weekly cron + manual dispatch) | GHA `schedule` + `workflow_dispatch` pattern is established in scrape-low.yml and staleness-alert.yml. Weekly cron = `0 2 * * 0` (Sunday 02:00 UTC). No new secrets needed — crawler does not touch the database. |
| DISC-02 | Discovery output produces a ranked candidate list that can be reviewed and applied | `runDiscover()` already returns `DiscoveryCandidate[]` sorted by score descending. Output to `discovery-candidates.json` via `writeFileSync` exists in discover.ts main block. GHA `actions/upload-artifact@v4` uploads the file as a downloadable artifact. |
| DISC-03 | An apply-discovery script patches scrapers.json with verified cutoff page URLs (human-gated, not automatic) | `apply-discovery.ts` reads discovery-candidates.json, finds the best candidate per `universityId`, patches `scrape_url` only when current value is null AND `adapter_type` is not `"skip"`. Must be run locally by a human after reviewing the artifact — never called from CI. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@crawlee/cheerio` | `^3.16.0` | Crawler engine | Already installed, used by discover.ts |
| `@crawlee/memory-storage` | `^3.16.0` | Test isolation storage | Already installed, used in discover test |
| `tsx` | `^4.21.0` | Run TypeScript scripts directly | Already installed, used by all other scripts |
| `actions/upload-artifact` | `v4` | Upload discovery-candidates.json artifact | Current major version across all project workflows |
| `actions/checkout` | `v4` | Checkout code in CI | Consistent with all project workflows |
| `actions/setup-node` | `v4` | Node 24 setup | Consistent with all project workflows |

### No New Dependencies Required
This phase requires no new npm packages. The crawler is fully built. Only a new workflow file and a new TS script are needed.

**Version verification:** All versions confirmed by reading existing package.json and workflow files — no registry lookup needed.

## Architecture Patterns

### scrapers.json New Schema (Phase 15)

The schema migration from Phase 15 removed `static_verified` and `url`, replacing with:

```json
{
  "id": "BKA",
  "adapter": "bka",
  "website_url": "https://hust.edu.vn/",
  "scrape_url": null,
  "adapter_type": "pending",
  "note": "..."
}
```

- `website_url` — university homepage (what discover.ts should crawl FROM)
- `scrape_url` — cutoff page URL (what discover.ts is trying to FIND; null = not yet known)
- `adapter_type` — `"pending"` | `"cheerio"` | `"playwright"` | `"paddleocr"` | `"skip"`

### Current State of scrapers.json
- 78 total entries
- 70 with `adapter_type: "pending"` (and `scrape_url: null`) — these are the discovery targets
- 4 with non-null `scrape_url` (verified, must not be overwritten)
- 3 with `adapter_type: "skip"` (must not be touched)

### discover.ts: Required Schema Migration

The existing `buildStartUrlsFromScrapers()` function at line 258-278 has a **stale interface**:

```typescript
// CURRENT (stale — must update):
interface ScraperEntry {
  id: string;
  url: string;              // <-- old field, removed in Phase 15
  static_verified: boolean; // <-- removed in Phase 15
}

// reads entry.url (line 269) -- must change to entry.website_url
const parsed = new URL(entry.url);
```

The fix is straightforward — update the interface and the property access:

```typescript
// CORRECT (Phase 15 schema):
interface ScraperEntry {
  id: string;
  website_url: string;  // homepage URL to crawl from
  scrape_url: string | null;
  adapter_type: string;
}

// In buildStartUrlsFromScrapers():
const parsed = new URL(entry.website_url);
// Skip entries we already know
if (entry.scrape_url !== null) continue;
```

### GHA Workflow Pattern (discover.yml)

Based on `staleness-alert.yml` (the closest analog — a scheduled script, no matrix, no Playwright/OCR):

```yaml
name: Auto-discovery crawler

on:
  schedule:
    - cron: '0 2 * * 0'   # Weekly — Sundays at 02:00 UTC
  workflow_dispatch:

jobs:
  discover:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'
      - run: npm ci
      - name: Run auto-discovery crawler
        run: npx tsx scripts/discover.ts
      - name: Upload discovery candidates
        uses: actions/upload-artifact@v4
        with:
          name: discovery-candidates
          path: discovery-candidates.json
          if-no-files-found: warn
          retention-days: 30
```

Key decisions:
- No DATABASE_URL needed — discover.ts does not write to Supabase
- No Playwright or PaddleOCR — crawler uses cheerio (HTTP only)
- `if-no-files-found: warn` — don't fail if 0 candidates found (legitimate for some runs)
- `retention-days: 30` — keeps artifact downloadable for a month

### apply-discovery.ts Pattern

```typescript
// scripts/apply-discovery.ts
// Human-gated: run locally after downloading artifact from GHA
// Usage: npx tsx scripts/apply-discovery.ts [candidates-file]

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import type { DiscoveryCandidate } from '../lib/scraper/discovery/candidate';

interface ScraperEntry {
  id: string;
  website_url: string;
  scrape_url: string | null;
  adapter_type: string;
  [key: string]: unknown;
}

const candidatesPath = process.argv[2] ?? resolve(process.cwd(), 'discovery-candidates.json');
const scrapersPath = resolve(process.cwd(), 'scrapers.json');

const candidates: DiscoveryCandidate[] = JSON.parse(readFileSync(candidatesPath, 'utf-8'));
const entries: ScraperEntry[] = JSON.parse(readFileSync(scrapersPath, 'utf-8'));

// Best candidate per universityId (candidates are pre-sorted descending by score)
const bestByUni = new Map<string, DiscoveryCandidate>();
for (const c of candidates) {
  if (!bestByUni.has(c.universityId)) {
    bestByUni.set(c.universityId, c);
  }
}

let patched = 0;
for (const entry of entries) {
  // GUARD: never overwrite entries that already have a scrape_url
  if (entry.scrape_url !== null) continue;
  // GUARD: never touch skip entries
  if (entry.adapter_type === 'skip') continue;

  const candidate = bestByUni.get(entry.id);
  if (candidate) {
    entry.scrape_url = candidate.url;
    patched++;
    console.log(`[apply] ${entry.id}: set scrape_url = ${candidate.url} (score ${candidate.score})`);
  }
}

writeFileSync(scrapersPath, JSON.stringify(entries, null, 2), 'utf-8');
console.log(`[apply] Patched ${patched} entries. scrapers.json updated.`);
```

### Anti-Patterns to Avoid

- **Auto-invoking apply-discovery.ts from CI:** REQUIREMENTS.md explicitly lists "Automatic URL promotion from discovery (no human gate)" as Out of Scope. The workflow must never call apply-discovery.ts.
- **Using `entry.url` in discover.ts:** The old field no longer exists in Phase 15's scrapers.json. Will silently produce `undefined` which `new URL()` will throw on.
- **Overwriting entries with existing scrape_url:** Even if discovery finds a "better" URL, the guard must prevent it. Human review is the only path to updating verified entries.
- **Using `actions/upload-artifact@v3`:** v3 is deprecated. Use v4 (consistent with rest of project).
- **Failing the workflow if 0 candidates found:** Some universities may all be robots.txt-blocked or JS-rendered. `if-no-files-found: warn` is correct.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP crawling with robots.txt | Custom fetch loop | `@crawlee/cheerio` already installed | CheerioCrawler handles sameDomain delays, robots.txt, deduplication |
| Artifact upload | Uploading to S3 or GitHub Releases | `actions/upload-artifact@v4` | Native GHA feature, zero configuration |
| Scoring/filtering candidates | New scoring logic | Existing `scorePageForCutoffs()` | Tested, tuned, proven |

## Common Pitfalls

### Pitfall 1: discover.ts reads stale `entry.url` field
**What goes wrong:** `buildStartUrlsFromScrapers()` currently reads `entry.url` (Phase 14 schema). After Phase 15, entries have `website_url` instead. The crawler silently skips all entries or throws on `new URL(undefined)`.
**Why it happens:** discover.ts was written for the old schema and never updated when Phase 15 changed scrapers.json.
**How to avoid:** Update the `ScraperEntry` interface and all property accesses in `buildStartUrlsFromScrapers()` before running the workflow.
**Warning signs:** `[discover] Starting discovery for 0 universities...` in CI logs.

### Pitfall 2: discover.ts output path is relative to cwd
**What goes wrong:** `writeFileSync(resolve(process.cwd(), 'discovery-candidates.json'), ...)` writes to the repo root. This is correct for CI (checkout sets cwd to repo root). The artifact path in discover.yml must match: `path: discovery-candidates.json`.
**Why it happens:** If the step runs in a subdirectory, the file won't be found by upload-artifact.
**How to avoid:** Do not use `working-directory:` in the discover step. Let it inherit the default checkout directory.

### Pitfall 3: Running the workflow costs real HTTP requests to 400+ universities
**What goes wrong:** The first real run crawls all `website_url` entries in scrapers.json — currently 78 entries but Phase 15 adds ~400+ from uni_list.json. With `maxRequestsPerCrawl: 50` per university and `sameDomainDelaySecs: 2`, a full run could take 30-60+ minutes.
**Why it happens:** CheerioCrawler follows links up to `maxRequestsPerCrawl` per domain.
**How to avoid:** The existing `maxConcurrency: 1` and `maxRequestsPerCrawl: 50` settings are already conservative. GHA jobs have a 6-hour timeout; this should be fine. Document expected runtime in workflow comments.

### Pitfall 4: apply-discovery.ts must handle the case where scrapers.json has no `adapter` field for new entries
**What goes wrong:** Phase 15 seeded 400+ universities into scrapers.json. New entries may have different field shapes. The apply script must use `[key: string]: unknown` or similar to avoid type narrowing errors.
**How to avoid:** Use the index signature pattern shown in the code example above. Don't reconstruct the object from scratch — mutate in place.

### Pitfall 5: Weekly cron fires when cutoff season hasn't started
**What goes wrong:** In January-May, no universities have published cutoff scores yet. Discovery runs return 0 candidates. This is expected, not a bug.
**How to avoid:** `if-no-files-found: warn` (not `error`) on the artifact upload step. Add a comment in the workflow explaining seasonal behavior.

## Code Examples

### Corrected buildStartUrlsFromScrapers (discover.ts)
```typescript
// Source: scripts/discover.ts (modified for Phase 15 schema)
interface ScraperEntry {
  id: string;
  website_url: string;      // homepage — crawl FROM here
  scrape_url: string | null; // cutoff page — what we're looking FOR
  adapter_type: string;
}

function buildStartUrlsFromScrapers(): StartUrl[] {
  const configPath = resolve(process.cwd(), 'scrapers.json');
  const entries: ScraperEntry[] = JSON.parse(readFileSync(configPath, 'utf-8'));

  const seen = new Set<string>();
  const startUrls: StartUrl[] = [];

  for (const entry of entries) {
    // Skip entries we already know — no need to crawl them
    if (entry.scrape_url !== null) continue;
    // Skip entries explicitly excluded
    if (entry.adapter_type === 'skip') continue;

    try {
      const parsed = new URL(entry.website_url);  // <-- was entry.url
      const homepage = `${parsed.protocol}//${parsed.hostname}/`;
      if (!seen.has(homepage)) {
        seen.add(homepage);
        startUrls.push({ url: homepage, universityId: entry.id });
      }
    } catch {
      console.warn(`[discover] Skipping invalid URL for ${entry.id}: ${entry.website_url}`);
    }
  }

  return startUrls;
}
```

### GitHub Actions artifact upload pattern
```yaml
# Source: actions/upload-artifact@v4 official docs
- name: Upload discovery candidates
  uses: actions/upload-artifact@v4
  with:
    name: discovery-candidates
    path: discovery-candidates.json
    if-no-files-found: warn
    retention-days: 30
```

### Checking artifact exists before upload (defensive)
```yaml
# Optionally, ensure discover.ts always writes the file (even empty array)
# by checking exit code and using continue-on-error or if-no-files-found: warn
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `entry.url` (scrapers.json) | `entry.website_url` | Phase 15 (2026-03-20) | discover.ts buildStartUrlsFromScrapers must be updated |
| `entry.static_verified` | `entry.scrape_url !== null` | Phase 15 (2026-03-20) | apply-discovery guard condition changes |
| Manual discovery runs only | Weekly GHA cron | Phase 16 | Discovery becomes automatic |

## Open Questions

1. **Should discover.ts write `[]` (empty array) when no candidates found?**
   - What we know: Currently, if candidates is empty, `writeFileSync` still runs with an empty array JSON. The `actions/upload-artifact@v4` step will find the file and upload it.
   - What's unclear: Is an empty artifact useful to download, or confusing?
   - Recommendation: Keep writing the file even when empty. `if-no-files-found: warn` is a safety net in case of script crash before write.

2. **Should apply-discovery.ts also update `adapter_type` from "pending" to "cheerio" when patching?**
   - What we know: Discovery only finds URLs, not adapter types. The scraper factory selects the adapter based on `adapter_type`. If left as "pending", the scraper may not run.
   - What's unclear: Phase 15 design intent — does `adapter_type: "pending"` prevent scraping?
   - Recommendation: Check the registry gate logic in Phase 15 implementation. If "pending" entries skip scraping, apply-discovery should set `adapter_type: "cheerio"` as a default when patching. This needs verification during implementation.

3. **How long will a full discovery run take with 400+ universities?**
   - What we know: `maxConcurrency: 1`, `sameDomainDelaySecs: 2`, `maxRequestsPerCrawl: 50`. 400 universities × ~10 real requests each × 2s delay ≈ ~2.2 hours worst case.
   - What's unclear: Actual hit rate of quick homepage responses (many will 404/timeout fast).
   - Recommendation: Accept current settings for Phase 16. Add runtime note in workflow comments. Phase 18 can increase concurrency if needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.0 |
| Config file | vitest.config.ts (root) |
| Quick run command | `npx vitest run tests/scraper/discovery/` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DISC-01 | discover.yml exists and has correct triggers | manual | N/A — workflow file inspection | ❌ Wave 0 (new file) |
| DISC-01 | discover.ts reads `website_url` (not `url`) | unit | `npx vitest run tests/scraper/discovery/discover.test.ts` | ✅ (existing test covers runDiscover; schema test may need update) |
| DISC-02 | runDiscover() produces ranked candidates | integration | `npx vitest run tests/scraper/discovery/discover.test.ts` | ✅ |
| DISC-02 | discovery-candidates.json artifact produced | smoke | `npx tsx scripts/discover.ts` then check file exists | ❌ Wave 0 (manual verification step) |
| DISC-03 | apply-discovery.ts patches pending entries | unit | `npx vitest run tests/scripts/apply-discovery.test.ts` | ❌ Wave 0 |
| DISC-03 | apply-discovery.ts never overwrites non-null scrape_url | unit | `npx vitest run tests/scripts/apply-discovery.test.ts` | ❌ Wave 0 |
| DISC-03 | apply-discovery.ts skips adapter_type: "skip" entries | unit | `npx vitest run tests/scripts/apply-discovery.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/scraper/discovery/`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/scripts/apply-discovery.test.ts` — covers DISC-03 (patch logic, guard logic)
- [ ] `discover.yml` — DISC-01 workflow file (created during implementation, not a test gap)
- [ ] Update `tests/scraper/discovery/discover.test.ts` if schema migration changes test fixtures

*(No framework install needed — Vitest + MSW already configured and working)*

## Sources

### Primary (HIGH confidence)
- Read `scripts/discover.ts` directly — authoritative source for current implementation and stale interface
- Read `scrapers.json` (lines 1-120) — confirmed new Phase 15 schema with `website_url`, `scrape_url`, `adapter_type`
- Read `.github/workflows/scrape-low.yml` — established GHA workflow pattern for this project
- Read `.github/workflows/staleness-alert.yml` — closest analog to discover.yml (scheduled, no matrix, no OCR)
- Read `package.json` — confirmed installed dependencies, Node 24, tsx version
- Read `lib/scraper/discovery/candidate.ts` — DiscoveryCandidate interface (stable, no changes needed)
- Read `tests/scraper/discovery/discover.test.ts` — test coverage map for discovery

### Secondary (MEDIUM confidence)
- `actions/upload-artifact@v4` — used in other GHA workflows across the ecosystem; v4 is current major version as of 2025

### Tertiary (LOW confidence)
- Runtime estimate for 400-university crawl — calculated from known config params, not measured

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed; no new deps
- Architecture: HIGH — workflow pattern directly observable from existing yml files; schema migration is a direct code read
- Pitfalls: HIGH — stale interface identified by direct code inspection; runtime concerns are derived from known crawler settings

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable domain — no fast-moving dependencies)
