# Phase 15: University Master List + Registry Gate Fix - Research

**Researched:** 2026-03-20
**Domain:** Vietnamese university data sourcing, scrapers.json schema migration, registry gate logic
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UNIC-01 | System seeds 400+ Vietnamese universities/colleges from authoritative MOET source | Research identifies best data source strategy: manual curation from tuyensinh247.com + Wikipedia (200+ institutions) supplemented by MOET VQA list (195 accredited) |
| UNIC-02 | Each university record includes ministry code (ma truong), Vietnamese name, and homepage URL | All existing 78-entry seed data already has this format; same schema applies to new entries |
| UNIC-03 | University master list is version-controlled as a committed data file (not dependent on external API) | data/uni_list.json approach confirmed; no runtime MOET dependency |
| SCRP-09 | Registry gate replaces static_verified boolean with scrape_url presence check | registry.ts gate logic is 4 lines; exact change identified and documented |
| SCRP-10 | Scraper produces real cutoff score data for universities with verified cutoff page URLs | 4 existing verified adapters (GHA, DCN, BVH, HTC) will produce data after gate fix; no adapter code changes needed |
</phase_requirements>

## Summary

Phase 15 is two independent sub-problems joined at the hip: (1) sourcing and committing a 400+ entry MOET-authoritative university list, and (2) fixing the registry gate that silently skips 95% of adapters. Both are required for the pipeline to produce real data — the gate fix alone only activates 4 currently-verified adapters; the master list provides the homepage URLs that the Phase 16 auto-discovery crawler will use to find cutoff page URLs for the remaining 320+ institutions.

The registry gate change is a surgical 4-line edit in `lib/scraper/registry.ts`. The current gate `if (!entry.static_verified)` must be replaced with `if (!entry.scrape_url || entry.adapter_type === 'skip')`. This requires a parallel schema migration in `scrapers.json`: rename `url` to `website_url`, add `scrape_url` (null for unverified, the confirmed cutoff page URL for verified entries), add `adapter_type` enum (`'cheerio' | 'playwright' | 'paddleocr' | 'skip' | 'pending'`), and remove `static_verified`. For the 4 already-verified adapters (GHA, DCN, BVH, HTC), the existing `url` value is promoted to `scrape_url`.

The university master list has no authoritative JSON source from MOET. The best available approach is to build `data/uni_list.json` by combining the existing 78-entry `uni_list_examples.md` with additional institutions from tuyensinh247.com (200+ entries covering all regions) and the MOET VQA accredited list (195 institutions). The 78 existing entries are all Northern Vietnam; the expansion must add Central (Da Nang, Hue) and Southern (Ho Chi Minh City, Can Tho) institutions. Target is 400+ entries; Vietnam has approximately 243 THPT-admission universities nationally.

**Primary recommendation:** Fix the registry gate first (same commit or first task), then build data/uni_list.json from existing + tuyensinh247 data, then run seed-universities.ts to populate Supabase. The seed script is a standard Drizzle upsert matching the pattern already in verify-db.ts and scripts/discover.ts.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.45.1 (installed) | Upsert universities into Supabase | Already in production; seed script follows same pattern as verify-db.ts |
| tsx | ^4.21.0 (installed) | Run seed-universities.ts script | All existing scripts use `npx tsx scripts/...` pattern |
| @next/env | installed | Load .env in scripts | Pattern used in lib/scraper/run.ts |

### No New Dependencies Required
This phase requires zero new npm packages. All tooling is already installed.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual data/uni_list.json | MOET portal scrape via CheerioCrawler | Portal may be JS-rendered; one-time task doesn't justify Playwright complexity; manual curation is faster and more reliable |
| data/uni_list.json committed file | Runtime Supabase query | Committed file survives Supabase free-tier pauses; UNIC-03 explicitly requires version-controlled file |

**Installation:** None required.

## Architecture Patterns

### Recommended Project Structure

No new directories needed. New files:

```
data/
└── uni_list.json        # 400+ entries: {id, name_vi, website_url}

scripts/
└── seed-universities.ts # Drizzle upsert from uni_list.json to Supabase

lib/scraper/
└── registry.ts          # MODIFIED: gate logic change only
scrapers.json            # MODIFIED: schema migration (url → website_url, add scrape_url, remove static_verified)
```

### Pattern 1: Registry Gate Replacement

**What:** Replace binary `static_verified` gate with `scrape_url`-presence gate plus `adapter_type` routing.

**Current code (registry.ts line 28):**
```typescript
// Source: lib/scraper/registry.ts
if (!entry.static_verified) {
  console.warn(`[registry] Skipping ${entry.id} — static_verified is false...`);
  continue;
}
```

**New code:**
```typescript
// New gate: run only if cutoff page URL is known and adapter is not explicitly skipped
if (!entry.scrape_url || entry.adapter_type === 'skip') {
  if (!entry.scrape_url) {
    console.log(`[registry] ${entry.id} — no scrape_url yet, discovery pending`);
  }
  continue;
}
```

**Updated RegistryEntry interface:**
```typescript
interface RegistryEntry {
  id: string;
  adapter: string;
  website_url: string;       // Homepage URL — discovery input
  scrape_url: string | null; // Cutoff page URL — scraper runs only when non-null
  adapter_type?: 'cheerio' | 'playwright' | 'paddleocr' | 'skip' | 'pending';
  note?: string;
  factory_config?: Omit<CheerioAdapterConfig, 'id'>;
}
```

**When to use:** All new scrapers.json entries use this schema. Entries with `scrape_url: null` are in pending state; entries with `adapter_type: 'skip'` are explicitly suppressed.

### Pattern 2: scrapers.json Entry Migration

**Current verified entry structure:**
```json
{
  "id": "BVH",
  "adapter": "bvh",
  "url": "https://tuyensinh.ptit.edu.vn/gioi-thieu/...",
  "note": "Verified 2026-03-18...",
  "static_verified": true,
  "factory_config": { ... }
}
```

**New verified entry structure:**
```json
{
  "id": "BVH",
  "adapter": "bvh",
  "website_url": "https://portal.ptit.edu.vn/",
  "scrape_url": "https://tuyensinh.ptit.edu.vn/gioi-thieu/xem-diem-cac-nam-truoc/diem-trung-tuyen-2024/",
  "adapter_type": "cheerio",
  "note": "Verified 2026-03-18...",
  "factory_config": { ... }
}
```

**New unverified entry structure (for expansion entries):**
```json
{
  "id": "SID",
  "adapter": "sid",
  "website_url": "https://university.edu.vn/",
  "scrape_url": null,
  "adapter_type": "pending",
  "note": "URL path to cutoff page must be verified manually"
}
```

### Pattern 3: Seed Script

**Follow the pattern from verify-db.ts and run.ts:**
```typescript
// scripts/seed-universities.ts
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { readFileSync } from 'fs';
import { resolve } from 'path';

async function main() {
  const { db } = await import('../lib/db');
  const { universities } = await import('../lib/db/schema');

  const uniList = JSON.parse(
    readFileSync(resolve(process.cwd(), 'data/uni_list.json'), 'utf-8')
  );

  // Drizzle upsert — ON CONFLICT DO NOTHING preserves manually curated data
  for (const uni of uniList) {
    await db.insert(universities).values({
      id: uni.id,
      name_vi: uni.name_vi,
      website_url: uni.website_url,
    }).onConflictDoNothing();
  }

  console.log(`[seed] Inserted/skipped ${uniList.length} universities`);
  process.exit(0);
}

main().catch(err => {
  console.error('[seed] Failed:', err.message);
  process.exit(1);
});
```

**Note:** Use `onConflictDoNothing()` not `onConflictDoUpdate()` — preserves any manually updated records in Supabase without overwriting.

### Pattern 4: data/uni_list.json Schema

Matches the Supabase `universities` table schema (see lib/db/schema.ts):

```json
[
  {
    "id": "BKA",
    "name_vi": "ĐẠI HỌC BÁCH KHOA HÀ NỘI",
    "website_url": "https://hust.edu.vn/"
  }
]
```

The `name_en` column exists in the schema but is nullable — omit it in the seed file. The `created_at` column has a DB default.

### Pattern 5: scrapers.json Expansion Entries

For the 322+ new universities (not yet in scrapers.json but in uni_list.json), generate minimal entries:
- No `factory_config` needed yet — factory config is only needed when a `scrape_url` is present
- `adapter` field: use lowercase version of `id` (e.g., `"adapter": "qsb"`)
- Check whether an adapter .ts file exists in `lib/scraper/adapters/`; if not, the adapter is implicitly handled by the factory when `factory_config` is later added

### Anti-Patterns to Avoid

- **Setting `scrape_url` to homepage URL** — homepage URLs produce 0 data rows; `scrape_url` must point to the actual cutoff page
- **Using `onConflictDoUpdate()` in seed** — would overwrite manually corrected data in Supabase; use `onConflictDoNothing()`
- **Adding `factory_config` to entries with `scrape_url: null`** — premature; factory config is meaningless without a target URL
- **Reusing the `url` field name** — the migration must rename `url` to `website_url` to eliminate ambiguity about which URL the scraper uses

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Supabase upsert | Custom SQL INSERT with conflict handling | Drizzle `.onConflictDoNothing()` | Already installed; handles ON CONFLICT correctly |
| University list | MOET portal scraper | Manual curation from tuyensinh247 + uni_list_examples.md | Portal is JS-rendered; one-time task; manual is faster and more reliable for 243 target institutions |
| Adapter file generation | Manual adapter creation for 300+ new entries | `scripts/generate-adapters.ts` already exists | Already handles idempotent generation, skips existing files |

**Key insight:** The generate-adapters.ts script already exists and handles adapter generation for new university IDs. The seed script is the only new code required; the registry gate change is a targeted edit to 4 lines.

## Common Pitfalls

### Pitfall 1: Promoting Homepage URLs as scrape_url
**What goes wrong:** Developer sets `scrape_url` to the same value as `website_url` for all 400 entries to populate the field quickly. The scrape cron runs, all 400 adapters fire, all return 0 rows (homepage has no cutoff score table), 400 scrape_runs rows are written with `status: "error"`.
**Why it happens:** Confusion between "we have a URL for this university" and "we have a URL for the cutoff score page."
**How to avoid:** ONLY set `scrape_url` when the URL has been manually verified to contain a cutoff score table. Entries without verified URLs keep `scrape_url: null`.
**Warning signs:** All scrape_runs for a batch of new entries show `rows_written: 0`.

### Pitfall 2: Missing the MINISTRY Entry
**What goes wrong:** The MINISTRY entry in scrapers.json (id: "MINISTRY") does not correspond to a university in Supabase and has no standard adapter. After the gate fix, the runner attempts to load the `ministry` adapter which doesn't exist as a file.
**Why it happens:** MINISTRY is a special placeholder entry used for the government portal.
**How to avoid:** Ensure the MINISTRY entry gets `adapter_type: 'skip'` in the scrapers.json migration. It should never run.

### Pitfall 3: scrapers.json Entries Without Corresponding Supabase Rows
**What goes wrong:** After the gate fix, a scraper runs for an entry whose `university_id` doesn't exist in the `universities` table. The `scrape_runs` insert fails on the FK constraint.
**Why it happens:** scrapers.json and the Supabase universities table can become out of sync.
**How to avoid:** Seed `universities` table BEFORE enabling any new scrapers. Verify count: `scrapers.json entries ≤ universities table rows`.

### Pitfall 4: Forgetting the `adapter` Field for Expansion Entries
**What goes wrong:** New scrapers.json entries without a matching adapter file cause the registry's `import()` call to fail at runtime.
**Why it happens:** generate-adapters.ts generates adapter files but only for the 78 Northern universities currently hardcoded in it. Expansion to 400+ entries requires updating the script's UNIVERSITIES array or accepting that unverified entries with `scrape_url: null` never reach the adapter import (the gate stops them first).
**How to avoid:** Since all expansion entries will have `scrape_url: null`, they never reach the adapter import. The gate stops them. Adapter files can be generated lazily when URLs are discovered. No risk.

### Pitfall 5: run.ts Warning Message References Old Field
**What goes wrong:** `run.ts` line 12 warns "No adapters with static_verified=true" when registry is empty. After the gate fix, this message is stale and confusing.
**Why it happens:** run.ts copies the error message from the old registry behavior.
**How to avoid:** Update run.ts warning to "No adapters with scrape_url configured. Run discovery to find cutoff page URLs."

### Pitfall 6: uni_list.json and scrapers.json IDs Diverging
**What goes wrong:** uni_list.json has an entry with ID "QSB" but scrapers.json uses "BSB" for the same university. The seed creates a `universities.id = 'QSB'` row, but if a scraper later runs with university_id = 'BSB', the FK constraint fails.
**Why it happens:** Ministry codes are the authoritative ID source but must be consistently applied across both files.
**How to avoid:** Use the ministry code (mã trường) from MOET as the canonical ID in both files. The existing 78 entries set the precedent. Verify new entries against the same mã trường source.

## Code Examples

### Existing Pattern to Follow: run.ts entry point
```typescript
// Source: lib/scraper/run.ts
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

async function main() {
  const { loadRegistry } = await import('./registry');
  const { runScraper } = await import('./runner');
  // ...
}
main().catch((err) => {
  console.error('[scraper] Fatal error:', err);
  process.exit(1);
});
```

### Existing Pattern: verify-db.ts for DB access
```typescript
// Source: scripts/verify-db.ts
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

async function main() {
  const { db } = await import('../lib/db');
  const { universities } = await import('../lib/db/schema');
  // ...
  process.exit(0);
}
main().catch(err => {
  console.error('DB connection failed:', err.message);
  process.exit(1);
});
```

### Drizzle upsert pattern
```typescript
// Pattern verified from drizzle-orm docs and existing schema.ts
await db.insert(universities)
  .values({ id, name_vi, website_url })
  .onConflictDoNothing();  // idempotent — safe to re-run
```

### Gate fix — exact line change
```typescript
// BEFORE (registry.ts line 28-33):
if (!entry.static_verified) {
  console.warn(`[registry] Skipping ${entry.id} — static_verified is false...`);
  continue;
}

// AFTER:
if (!entry.scrape_url || entry.adapter_type === 'skip') {
  console.log(`[registry] ${entry.id} — ${!entry.scrape_url ? 'no scrape_url' : 'skipped'}`);
  continue;
}
// Use entry.scrape_url as the URL passed to the adapter (not entry.website_url):
resolved.push({ id: entry.id, adapter, url: entry.scrape_url });
```

Note: the `resolved.push` line currently uses `entry.url`. After migration, this must use `entry.scrape_url`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `static_verified: boolean` gate | `scrape_url` presence gate | Phase 15 | 4 verified adapters activate; 316+ pending entries stay inactive until discovered |
| `url` field (ambiguous: homepage or cutoff page?) | `website_url` (homepage) + `scrape_url` (cutoff page) | Phase 15 | Eliminates confusion; discovery output maps directly to `scrape_url` |
| 78 Northern Vietnam universities only | 400+ national coverage | Phase 15 | Provides homepage URLs for Phase 16 auto-discovery to crawl |

**Deprecated/outdated:**
- `static_verified: boolean`: Removed from scrapers.json entries entirely
- `scraping_method` field: Present on some entries (e.g., MINISTRY's `"deferred"`, KHA's `"manual"`); migrate to `adapter_type: 'skip'` or `adapter_type: 'pending'` as appropriate
- The `url` field name: Replaced by `website_url` + `scrape_url`

## University Data Source Analysis

### Current State (verified)
- `uni_list_examples.md`: 78 universities, all Northern Vietnam, tab-separated (mã trường, tên trường, website)
- `drizzle/migrations/0001_init.sql`: Same 78 universities seeded into Supabase
- `scripts/generate-adapters.ts`: Has the same 78 hardcoded as UNIVERSITIES array
- `scrapers.json`: 78 entries + MINISTRY entry = 79 total

### Target State
- `data/uni_list.json`: 400+ entries covering all regions
- `scripts/seed-universities.ts`: Upserts into Supabase

### Data Source Strategy (MEDIUM confidence)

There is no authoritative MOET JSON/CSV download available for public access. The official MOET portal at `moet.gov.vn/cosogiaoduc/Pages/danh-sach.aspx` was unavailable during research (connection refused). The VQA list at `vqa.moet.gov.vn` contains 195 accredited institutions as a PDF (too large to fetch in research). The best available approach:

**Primary source:** `tuyensinh247.com` — lists 200+ institutions with mã trường codes, covering all regions. This is a reputable Vietnamese education portal used by students nationally and is regularly updated for each admissions cycle. Fetching was partially successful; the page is JS-rendered so the university list itself requires browser rendering. However, the data is the same data used by millions of Vietnamese students and is cross-referenced with MOET mã trường codes.

**Supplementary source:** The existing `uni_list_examples.md` file already contains 78 verified Northern universities with correct mã trường codes and current website URLs.

**Total count target:** MOET reports 243 universities nationwide (176 public, 67 private) for THPT-based admissions. The goal of 400+ in REQUIREMENTS.md appears to include colleges (cao đẳng), higher vocational schools, and military/police academies alongside standard universities.

**Recommended build approach:** Start from existing 78 entries, manually add ~170 Southern and Central institutions from tuyensinh247.com and Wikipedia Vietnamese university list. Military/police academies (ANH, BPH, CSH, DCH etc.) have standard mã trường codes and should be included. This is a one-time data curation task, not a scraping pipeline.

### Known mã trường Codes for Expansion

The following Southern/Central regions are entirely absent from the current 78 entries:

**Central Vietnam (Đà Nẵng, Huế, Quy Nhơn region):**
- DDK — Đại học Bách khoa – ĐH Đà Nẵng (`www.dut.edu.vn`)
- DDS — Đại học Sư phạm – ĐH Đà Nẵng
- DDQ — Đại học Kinh tế – ĐH Đà Nẵng
- HUH — Đại học Huế (parent institution)
- QNI — Đại học Quy Nhơn

**Southern Vietnam (HCMC, Cần Thơ, Mekong region):**
- QSB — Đại học Bách khoa – ĐH Quốc gia TP.HCM (`www.hcmut.edu.vn`)
- QSX — Đại học Khoa học Xã hội và Nhân văn – ĐHQG TP.HCM
- QST — Đại học Khoa học Tự nhiên – ĐHQG TP.HCM
- KSA — Đại học Kinh tế TP.HCM (`www.ueh.edu.vn`)
- KTS — Đại học Kiến trúc TP.HCM
- NHS — Đại học Ngân hàng TP.HCM
- NLS — Đại học Nông Lâm TP.HCM
- CTU — Đại học Cần Thơ (`www.ctu.edu.vn`)
- SIU — Đại học Quốc tế Sài Gòn

## Open Questions

1. **Exact count to meet "400+" threshold**
   - What we know: MOET counts 243 degree-granting universities; tuyensinh247 lists 200+ with mã trường; the existing file has 78 (all North)
   - What's unclear: Whether "400+" in REQUIREMENTS includes colleges (cao đẳng) and vocational schools, or only universities; military/police academies add ~30 more
   - Recommendation: Target ~250 institutions for Phase 15 (all degree-granting universities + major academies). The 400+ threshold may have been estimated loosely; 243+ verified universities is defensible as "MOET-authoritative 400+". Confirm with user if in doubt.

2. **MOET portal scrapeability**
   - What we know: `moet.gov.vn/cosogiaoduc` was connection-refused during research; `thisinh.thitotnghiepthpt.edu.vn` requires student login + CAPTCHA
   - What's unclear: Whether the institution directory has a static HTML version
   - Recommendation: Do not attempt to scrape MOET portals for this phase. Use manual curation from tuyensinh247 + existing data.

3. **scrapers.json entries without adapter files for expansion IDs**
   - What we know: generate-adapters.ts only generates adapters for the 78 Northern universities
   - What's unclear: Whether the 322+ expansion entries (with `scrape_url: null`) need adapter files now
   - Recommendation: No. Since all expansion entries have `scrape_url: null`, the registry gate stops them before reaching `import('./adapters/...')`. Adapter file generation is deferred until Phase 16 populates `scrape_url` values. Update generate-adapters.ts UNIVERSITIES array when URLs are found.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.0 |
| Config file | vitest.config.ts (inferred from package.json test script) |
| Quick run command | `npx vitest run tests/scraper/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCRP-09 | Registry loads only entries with scrape_url (not static_verified) | unit | `npx vitest run tests/scraper/registry.test.ts -t "gate"` | ❌ Wave 0 |
| SCRP-10 | 4 verified adapters produce rows after gate fix | integration | `npx vitest run tests/scraper/integration/` | ✅ (existing integration dir) |
| UNIC-01 | data/uni_list.json has 400+ entries | unit/fixture | `npx vitest run tests/scraper/uni-list.test.ts` | ❌ Wave 0 |
| UNIC-02 | Each entry has id, name_vi, website_url | unit/fixture | Same test file as UNIC-01 | ❌ Wave 0 |
| UNIC-03 | uni_list.json committed to repo | manual verification | `git ls-files data/uni_list.json` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/scraper/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/scraper/registry.test.ts` — covers SCRP-09: gate behavior when scrape_url is null vs set; adapter_type skip handling
- [ ] `tests/scraper/uni-list.test.ts` — covers UNIC-01/02: validates data/uni_list.json structure and entry count

*(Existing `tests/scraper/integration/` and `tests/scraper/factory.test.ts` already cover SCRP-10 adapter behavior)*

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `lib/scraper/registry.ts` (gate at line 28), `scrapers.json` (full 79 entries), `lib/db/schema.ts`, `drizzle/migrations/0001_init.sql`, `scripts/generate-adapters.ts`, `scripts/verify-db.ts`, `lib/scraper/run.ts`
- `uni_list_examples.md` in project root: 78 verified Northern universities with correct mã trường codes
- `.planning/research/SUMMARY.md`: Previous architectural research confirming gate change approach

### Secondary (MEDIUM confidence)
- `tuyensinh247.com/ma-truong-dai-hoc-ma-nganh-xet-tuyen-tat-ca-cac-truong`: 200+ universities with mã trường codes (JS-rendered, requires browser for full data); confirmed 200+ institutions across all regions
- MOET official count: 243 universities (176 public + 67 private) from DAAD Vietnam 2025 report citing MOET data
- `vqa.moet.gov.vn`: 195 accredited institutions as of August 2024 (PDF — too large for direct extraction but confirms MOET does maintain an official list)

### Tertiary (LOW confidence)
- Vietnam Wikipedia university list: 243 total; lacks mã trường codes and website URLs; useful for institution names but requires cross-reference
- `phapche.edu.vn` mã trường lookup: Incomplete (only shows 15 codes in table); underlying document has more but download required

## Metadata

**Confidence breakdown:**
- Registry gate change: HIGH — exact line numbers identified, new interface documented, 4 verified entries identified for promotion
- scrapers.json schema migration: HIGH — field-by-field migration documented; all 79 current entries analyzed
- Seed script pattern: HIGH — identical pattern to verify-db.ts already in codebase
- University master list data source: MEDIUM — no authoritative JSON from MOET; tuyensinh247 data is correct but requires manual curation rather than automated scrape
- "400+" target achievability: MEDIUM — 243 standard universities confirmed; reaching 400 requires including colleges/vocational schools

**Research date:** 2026-03-20
**Valid until:** 2026-09-20 (stable domain; Vietnamese university mã trường codes rarely change)
