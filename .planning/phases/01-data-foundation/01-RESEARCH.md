# Phase 1: Data Foundation - Research

**Researched:** 2026-03-17
**Domain:** Supabase schema design, Drizzle ORM migrations, Cheerio web scraping, GitHub Actions scheduling, Next.js 15 + Vercel deployment
**Confidence:** HIGH (core stack verified via official docs and npm registry; Vietnamese web ecosystem specifics are MEDIUM from training knowledge and domain search)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **University seed data columns:** ministry code, name_vi, website URL only. Add `name_en` as nullable now (future Phase 3 i18n). No region, public/private status, or tier.
- **Seed loading mechanism:** Drizzle custom migration file with inline INSERT statements — schema creation and seed in one migration, no separate seeder script.
- **Scrape run tracking:** `scrape_runs` table per run: university_id, timestamp, success/fail status, rows_written count, error message. No raw HTML snapshots.
- **Per-score metadata:** Every `cutoff_scores` row stores `scraped_at` and `source_url` directly.
- **Validation — normalize then reject:** Strip whitespace, uppercase tổ hợp codes (a00→A00), convert comma-decimal scores (28,50→28.5). After normalization reject: score outside [10.0, 30.0], tổ hợp not matching `[A-D]\d{2}`, major code missing/empty, university_id not in universities table.
- **Rejections:** Logged to `scrape_runs.error_log`; run with >0 rejections is flagged (not failed) — other rows still commit.
- **Adapters — Phase 1 only Cheerio + native fetch:** No Playwright. Playwright deferred to Phase 4.
- **Pilot universities:** Ministry portal (first-class adapter) + BKA, KHA, NTH + 2 more static-HTML sites chosen by Claude.
- **Ministry portal runs first** in the GitHub Actions workflow; university adapters fill gaps.

### Claude's Discretion

- Which 2 additional universities beyond BKA/KHA/NTH to include in the pilot (pick easiest static-HTML sites from seed list).
- Exact Drizzle schema column types and index choices beyond success criteria.
- GitHub Actions job structure (single job vs. matrix) for the Phase 1 low-frequency workflow.
- `scrape_runs` error_log format (JSON array vs. text).

### Deferred Ideas (OUT OF SCOPE)

- Playwright support for JS-rendered pages — Phase 4.
- Region, public/private status, prestige tier on universities table — later migration.
- Per-row diff logging in scrape_runs — future enhancement.
- Raw HTML snapshot storage — future enhancement.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PIPE-01 | System maintains a list of Vietnamese universities and their websites, updated via infrequent automated discovery | Drizzle migration with seed INSERT statements; universities table with ministry code PK; 78+ institutions from uni_list_examples.md |
| PIPE-02 | System scrapes cutoff scores from university websites and Ministry portal on a schedule | Cheerio + native fetch adapter framework; adapter registry pattern; GitHub Actions scheduled workflow; scrape_runs audit table |
| PIPE-03 | Scraped data stores historical cutoff scores per university, per major, per tổ hợp, and per year | cutoff_scores table with UNIQUE constraint on (university_id, major_id, tohop_code, year, admission_method); upsert pattern; source_url + scraped_at per row |
| INFRA-01 | App is deployable on free-tier serverless infrastructure (Vercel + Supabase) | Next.js 15 via `create-next-app`; Vercel Hobby; Supabase free tier (500MB DB, 2 projects); environment variable wiring between Vercel and GitHub Actions secrets |
</phase_requirements>

---

## Summary

Phase 1 builds the entire data foundation that every subsequent phase depends on. The work is greenfield — no existing source files — and decomposes into four concrete deliverables: (1) Supabase Postgres schema with migrations and seed data, (2) a TypeScript scraper framework (runner + normalizer + adapter registry), (3) initial pilot adapters for the Ministry portal plus 5 universities, and (4) a GitHub Actions scheduled workflow that writes scraped data to Supabase nightly. A fifth deliverable — a deployed Next.js + Vercel project with environment variables connected — completes the infrastructure setup that Phase 2 API routes will extend.

The critical risk in this phase is building adapters before auditing whether each target university page is static HTML or JS-rendered. Every Phase 1 pilot site must be confirmed as static (Cheerio-compatible) before its adapter is written. The Ministry portal URL must also be manually verified, as portal URLs change between admission cycles. The validation layer (normalize then reject) must be in place before any data reaches the production database.

The stack is already decided: Next.js 15, Drizzle ORM 0.45.x with drizzle-kit, Supabase Postgres (free tier), Cheerio 1.2.0, native Node.js fetch, GitHub Actions, and Vitest for unit tests. All versions have been confirmed against npm registry as of March 2026.

**Primary recommendation:** Complete schema + migration + seed first (Wave 1), then scraper framework + normalizer (Wave 2), then adapters one by one (Wave 3), then GitHub Actions workflow (Wave 4), then Vercel deploy verification (Wave 5). Never write an adapter before auditing the target page's render method.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.x | Full-stack React framework; App Router; Vercel-native | Official project choice; server-first model; native PWA manifest |
| TypeScript | 5.x | Type safety across schema, adapters, and API | Domain types (tổ hợp codes, cutoff records) prevent category errors |
| Drizzle ORM | 0.45.1 | Type-safe Postgres query builder; migration runner | Lightweight (~7.4KB), TypeScript-first, works with postgres.js, drizzle-kit for migrations |
| drizzle-kit | latest stable (~0.30.x) | Schema migration generation and application | Paired CLI for drizzle-orm; generates SQL diffs and runs them |
| postgres (postgres.js) | 3.x | Low-level Postgres driver used by Drizzle | Fastest JS Postgres client; Supabase's pooler requires `prepare: false` in transaction mode |
| @supabase/supabase-js | 2.99.x | Supabase client for REST/anon access patterns | Standard Supabase client; use for upserts in scraper via service-role key |
| Cheerio | 1.2.0 | HTML parsing — jQuery-like API, pure Node.js | No browser binary; works in GitHub Actions and any Node 18+ env |
| iconv-lite | 0.6.x | Decode non-UTF-8 HTML responses (Windows-1258, TCVN3) | Vietnamese government sites use legacy encodings; must decode before Cheerio sees bytes |
| Vitest | 2.x | Unit testing for normalizer, validation logic | Vite-based, fast, zero config with Next.js; official Next.js test guide |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| chardet | 1.x | Detect encoding from raw response bytes | Use when Content-Type charset is absent or unreliable |
| @types/node | 20.x | TypeScript types for Node.js built-ins | Scraper scripts run in Node.js; types for fetch, Buffer, process |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Drizzle ORM | Prisma | Prisma is heavier; known cold-start issues on serverless; Drizzle has lighter footprint |
| postgres.js | node-postgres (pg) | Both work; postgres.js is faster; decision already locked |
| Cheerio | Playwright | Playwright requires 300-600MB browser binary; unusable in Vercel functions; deferred to Phase 4 |
| GitHub Actions | Vercel Cron | Vercel Hobby cron is once/day max; insufficient for July peak; GitHub Actions free for public repos |
| @supabase/supabase-js | Direct postgres.js | Supabase JS client provides auth header handling; use service-role key in scraper |

**Installation:**
```bash
# Next.js 15 scaffold
npx create-next-app@latest uniselect --typescript --tailwind --app --src-dir

# ORM + driver
npm install drizzle-orm postgres
npm install -D drizzle-kit

# Supabase client
npm install @supabase/supabase-js

# Scraping
npm install cheerio iconv-lite chardet

# Testing
npm install -D vitest @vitejs/plugin-react vite-tsconfig-paths
```

**Version verification (confirmed March 2026 via npm registry):**
- drizzle-orm: 0.45.1 (v1.0.0-beta actively in development — use 0.45.x stable)
- cheerio: 1.2.0
- @supabase/supabase-js: 2.99.2

---

## Architecture Patterns

### Recommended Project Structure

```
uniselect/
├── src/
│   └── app/                    # Next.js App Router (Phase 2+)
├── lib/
│   ├── db/
│   │   ├── schema.ts            # Drizzle schema definitions
│   │   └── index.ts             # DB connection (postgres.js + drizzle)
│   └── scraper/
│       ├── runner.ts            # Iterates registry, calls adapters, writes
│       ├── normalizer.ts        # RawRow → NormalizedRow; validate + reject
│       ├── registry.ts          # Loads scrapers.json config
│       └── adapters/
│           ├── ministry.ts      # Ministry portal adapter (first-class)
│           ├── bka.ts           # BKA (HUST) adapter
│           ├── kha.ts           # KHA (NEU) adapter
│           ├── nth.ts           # NTH (FTU) adapter
│           ├── [uni5].ts        # 4th pilot university
│           └── [uni6].ts        # 5th pilot university
├── scrapers.json                # Adapter registry config
├── drizzle/
│   └── migrations/
│       └── 0001_init.sql        # Schema + seed in one migration
├── drizzle.config.ts
├── .github/
│   └── workflows/
│       └── scrape-low.yml       # Daily scrape workflow
└── vitest.config.mts
```

### Pattern 1: Drizzle Schema with Custom Migration Seeding

**What:** Define the full schema in `lib/db/schema.ts`, generate SQL via drizzle-kit, then use a custom migration file to also insert the seed data (78+ universities) inline — no separate seeder script.

**When to use:** Phase 1 only. Schema and seed are one atomic operation: either both exist or neither does.

**Example:**
```typescript
// lib/db/schema.ts
import { pgTable, text, smallint, numeric, bigserial, timestamptz, integer } from 'drizzle-orm/pg-core';

export const universities = pgTable('universities', {
  id: text('id').primaryKey(),              // Ministry code e.g. "BKA"
  name_vi: text('name_vi').notNull(),       // Full Vietnamese name
  name_en: text('name_en'),                 // Nullable — Phase 3 fills this
  website_url: text('website_url'),
  created_at: timestamptz('created_at').defaultNow(),
});

export const majors = pgTable('majors', {
  id: text('id').primaryKey(),              // 7-digit mã ngành e.g. "7480201"
  name_vi: text('name_vi').notNull(),
  created_at: timestamptz('created_at').defaultNow(),
});

export const tohop_codes = pgTable('tohop_codes', {
  code: text('code').primaryKey(),          // e.g. "A00", "D01"
  subjects: text('subjects').array().notNull(), // ["Toan","Ly","HoaHoc"]
  label_vi: text('label_vi'),
});

export const cutoff_scores = pgTable('cutoff_scores', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  university_id: text('university_id').notNull().references(() => universities.id),
  major_id: text('major_id').notNull().references(() => majors.id),
  tohop_code: text('tohop_code').notNull().references(() => tohop_codes.code),
  year: smallint('year').notNull(),
  score: numeric('score', { precision: 5, scale: 2 }),  // NULL if not published
  admission_method: text('admission_method').notNull().default('THPT'),
  source_url: text('source_url'),
  scraped_at: timestamptz('scraped_at').defaultNow(),
}, (table) => ({
  uniq: unique().on(table.university_id, table.major_id, table.tohop_code, table.year, table.admission_method),
}));

export const scrape_runs = pgTable('scrape_runs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  run_at: timestamptz('run_at').defaultNow(),
  university_id: text('university_id').references(() => universities.id),
  status: text('status'),                   // "ok" | "error" | "flagged"
  rows_written: integer('rows_written'),
  rows_rejected: integer('rows_rejected'),
  error_log: text('error_log'),             // JSON array of rejection details
  github_run_id: text('github_run_id'),
});
```

```sql
-- drizzle/migrations/0001_init.sql (custom — schema + seed combined)
-- [Schema DDL generated by drizzle-kit generate, then extended with:]

INSERT INTO universities (id, name_vi, website_url) VALUES
  ('BKA', 'ĐẠI HỌC BÁCH KHOA HÀ NỘI', 'https://hust.edu.vn/'),
  ('KHA', 'Trường Đại học Kinh tế Quốc dân', 'https://www.neu.edu.vn/'),
  ('NTH', 'Trường Đại học Ngoại thương', 'https://ftu.edu.vn/'),
  -- ... 78+ rows from uni_list_examples.md
ON CONFLICT (id) DO NOTHING;
```

### Pattern 2: Adapter Interface with RawRow / NormalizedRow

**What:** Each adapter exports a single async `scrape(url)` function returning `RawRow[]`. The runner calls it, passes output to the centralised normalizer, never lets adapters normalize themselves.

**When to use:** Every scraper adapter. Deviating from this means schema changes break all adapters.

**Example:**
```typescript
// lib/scraper/types.ts
export interface RawRow {
  university_id: string;
  major_raw: string;        // raw text from page
  tohop_raw: string;        // may be "A00" or "Toán - Lý - Hóa"
  year: number;
  score_raw: string;        // may be "28.50" or "28,50"
  source_url: string;
}

export interface NormalizedRow {
  university_id: string;
  major_id: string;
  tohop_code: string;
  year: number;
  score: number;
  admission_method: string;
  source_url: string;
  scraped_at: Date;
}

export interface ScraperAdapter {
  scrape(url: string): Promise<RawRow[]>;
}
```

### Pattern 3: Normalizer with Normalize-then-Reject

**What:** All cosmetic fixes (whitespace, comma-decimal, lowercase tổ hợp) happen before validation. After normalization, apply hard rejects. Rejected rows are logged but do not block other rows from committing.

**When to use:** All scraped data passes through this one function before any DB write.

**Example:**
```typescript
// lib/scraper/normalizer.ts
// Source: locked decision from CONTEXT.md

export function normalize(raw: RawRow): NormalizedRow | null {
  // Step 1: Cosmetic normalization
  const tohop = raw.tohop_raw.trim().toUpperCase();           // a00 → A00
  const scoreStr = raw.score_raw.trim().replace(',', '.');    // 28,50 → 28.50
  const majorCode = raw.major_raw.trim();

  // Step 2: Hard validation — reject if fails
  const score = parseFloat(scoreStr);
  if (isNaN(score) || score < 10.0 || score > 30.0) return null;
  if (!/^[A-D]\d{2}$/.test(tohop)) return null;
  if (!majorCode) return null;

  return {
    university_id: raw.university_id,
    major_id: majorCode,
    tohop_code: tohop,
    year: raw.year,
    score,
    admission_method: 'THPT',
    source_url: raw.source_url,
    scraped_at: new Date(),
  };
}
```

### Pattern 4: Fail-Open Runner with Scrape Run Logging

**What:** Each adapter call is wrapped in try/catch. A single adapter failure never blocks others. All outcomes — success, rejection count, errors — are written to `scrape_runs`.

**Example:**
```typescript
// lib/scraper/runner.ts
for (const config of registry) {
  let rowsWritten = 0;
  let rowsRejected = 0;
  const rejectionLog: string[] = [];

  try {
    const adapter = loadAdapter(config.adapter);
    const raw = await adapter.scrape(config.url);

    for (const row of raw) {
      const normalized = normalize(row);
      if (!normalized) {
        rowsRejected++;
        rejectionLog.push(JSON.stringify(row));
        continue;
      }
      await db.upsert(normalized);
      rowsWritten++;
    }

    const status = rowsRejected > 0 ? 'flagged' : 'ok';
    await logRun(config.id, status, rowsWritten, rowsRejected,
                 JSON.stringify(rejectionLog));
  } catch (err) {
    await logRun(config.id, 'error', 0, 0, String(err));
    // continue to next university
  }
}
```

### Pattern 5: Supabase Connection with PgBouncer (Transaction Mode)

**What:** Connect via Supabase's shared pooler (port 6543) with `prepare: false`. Never connect directly to Postgres port (5432) from serverless / GitHub Actions contexts — each invocation creates a new connection.

**Example:**
```typescript
// lib/db/index.ts
// Source: https://orm.drizzle.team/docs/connect-supabase

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Use POOLER URL (port 6543) not direct DB URL (port 5432)
// Set prepare: false for transaction pool mode
const client = postgres(process.env.DATABASE_URL!, { prepare: false });
export const db = drizzle({ client });
```

### Pattern 6: GitHub Actions Scheduled Workflow

**What:** A `.github/workflows/scrape-low.yml` that runs daily at 02:00 UTC, checks out the repo, installs dependencies, runs the scraper script with the Supabase service-role key from secrets.

**Example:**
```yaml
# .github/workflows/scrape-low.yml
name: Scrape cutoff scores (low frequency)

on:
  schedule:
    - cron: '0 2 * * *'   # Daily at 02:00 UTC
  workflow_dispatch:        # Manual trigger always available

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx tsx lib/scraper/runner.ts
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

### Pattern 7: Encoding-Safe HTTP Fetch for Vietnamese Sites

**What:** Fetch as buffer, detect encoding, decode before passing to Cheerio. Never assume UTF-8.

**Example:**
```typescript
// lib/scraper/fetch.ts
import * as chardet from 'chardet';
import * as iconv from 'iconv-lite';

export async function fetchHTML(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'UniSelectBot/1.0 (educational; open source)' },
  });
  const buffer = Buffer.from(await res.arrayBuffer());

  // Check Content-Type header first
  const contentType = res.headers.get('content-type') ?? '';
  const charsetMatch = contentType.match(/charset=([^\s;]+)/i);
  const declared = charsetMatch?.[1]?.toLowerCase();

  // If declared and not UTF-8, use it; otherwise detect
  const encoding = (declared && declared !== 'utf-8' && declared !== 'utf8')
    ? declared
    : (chardet.detect(buffer) ?? 'utf-8');

  return iconv.decode(buffer, encoding);
}
```

### Anti-Patterns to Avoid

- **Positional CSS selectors:** Never use `table > tbody > tr:nth-child(2) > td`. Use semantic text anchors (find the `th` with text "Điểm chuẩn", then read the adjacent `td`). Sites redesign layouts annually.
- **Scraper inside a Vercel function:** Vercel Hobby has a short function timeout. Scraper always runs in GitHub Actions only.
- **Normalizing inside the adapter:** Adapters return `RawRow` (dumb raw text). One central normalizer owns all canonical mapping. Schema changes touch one file.
- **Assuming UTF-8:** Older Vietnamese `.edu.vn` sites use Windows-1258. Always fetch as buffer and decode properly.
- **Assuming a zero-row result means no data:** If a scraper previously returned N rows and now returns 0, flag it as a potential JS-rendering failure — don't silently write zero rows.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Postgres connection pooling | Custom connection pool logic | Supabase Supavisor pooler (port 6543) + `prepare: false` | PgBouncer transaction mode handles serverless connection burst; hand-rolled pools leak |
| SQL migrations | Raw `psql` scripts or manual ALTER TABLE | drizzle-kit generate + migrate | Tracked migration history in `__drizzle_migrations`; reproducible schema |
| Encoding detection | Regex on HTML meta tags | chardet + iconv-lite | chardet handles edge cases (BOM, mismatched declarations); regex misses binary-level encoding |
| Upsert collision handling | DELETE + INSERT cycle | Drizzle `.onConflictDoUpdate()` | DELETE + INSERT destroys audit history and `scraped_at` timestamps; upsert preserves them |
| Vietnamese character normalization | Custom diacritic table | `String.prototype.normalize('NFC')` + explicit NFC write | Unicode NFC is the canonical form; hand-built tables miss combining character sequences |

**Key insight:** The encoding and connection-pooling problems are deceptively complex. iconv-lite and the Supabase pooler URL solve problems that took experienced teams days to debug from scratch.

---

## Common Pitfalls

### Pitfall 1: Ministry Portal URL Changes Between Admission Cycles

**What goes wrong:** The Ministry portal at `thisinh.thitotnghiepthpt.edu.vn` changes its URL structure, login requirements, or HTML layout between cycles. The 2025 score-lookup portal (`tracuudiem.thitotnghiepthpt.edu.vn`) appears to be a separate subdomain from the nguyện vọng management portal (`thisinh.thitotnghiepthpt.edu.vn`). The điểm chuẩn data (cutoff scores) is different from điểm thi (exam results) — verify which portal publishes which data before building the adapter.

**Why it happens:** Government portals are redesigned on political/budget cycles with no API contract.

**How to avoid:** Manually verify the Ministry portal URL and HTML structure in a browser before writing the adapter. Document the specific URL that contains điểm chuẩn (cutoff scores), not just điểm thi (exam scores). These are published separately and at different times in the cycle.

**Warning signs:** Adapter returns 0 rows; response HTML is under 5KB; HTTP 302 redirect to login page.

### Pitfall 2: CSS Selector Lock-In (Scraping Brittleness)

**What goes wrong:** Scraper targets `table.diem-chuan > tbody > tr:nth-child(2) > td.score`. Site redesigns cosmetically and all data vanishes silently.

**How to avoid:** Use semantic text anchors. Find the `th` element containing "Điểm chuẩn" or "Tổ hợp", then navigate to the adjacent data cell. Write a minimum-rows assertion: if a source previously returned N rows and now returns 0, log as `flagged`, not `ok`.

**Warning signs:** Score distribution suddenly drops to null across multiple universities in one run.

### Pitfall 3: Silent Encoding Corruption on Vietnamese Sites

**What goes wrong:** Older `.edu.vn` sites use Windows-1258. Fetching as UTF-8 string produces mojibake ("Quản trị kinh doanh" → garbage). The scraper still "succeeds" and stores corrupt text.

**How to avoid:** Always fetch as `ArrayBuffer` → `Buffer`. Use `chardet.detect()` on the buffer. Decode with `iconv.decode(buffer, detectedEncoding)` before loading into Cheerio. NFC-normalize all stored strings at write time.

**Warning signs:** Major names containing characters like `Ã`, `â€`, or `Â±`; search returning zero results for a known school name.

### Pitfall 4: JS-Rendered Page Returning Empty Body

**What goes wrong:** A pilot university site renders its cutoff table via React/Vue. `fetch()` returns `<div id="app"></div>`. Cheerio finds no table. Zero rows written; no error raised.

**How to avoid:** Before writing any adapter, open the target URL in a browser with JavaScript disabled (or view page source). If the table is not present in raw HTML, the site is JS-rendered and must be deferred to Phase 4 (Playwright). Replace it with another pilot site from the seed list. Document the static/dynamic status per university in the adapter registry (`scrapers.json`).

**Warning signs:** Response body < 5KB for a page expected to contain tabular data; `cheerio.load(html)('table').length === 0`.

### Pitfall 5: Drizzle PgBouncer Transaction Mode — Prepared Statements Fail

**What goes wrong:** Using the direct Postgres URL (port 5432) from GitHub Actions creates a new connection per run. Using the pooler URL (port 6543) with `prepare: true` (the default) causes prepared statement errors in transaction pool mode.

**How to avoid:** Use the pooler URL (port 6543) always. Set `prepare: false` in the `postgres()` constructor. Store the pooler URL as `DATABASE_URL` in GitHub Actions secrets and in Vercel environment variables.

**Warning signs:** `Error: prepared statement already exists`; connection timeout errors in Actions logs.

### Pitfall 6: Supabase Free Tier Project Pausing

**What goes wrong:** Supabase pauses free projects after 7 days of inactivity. If the scraper runs are the only traffic and they pause too, the database becomes unavailable.

**How to avoid:** (a) Enable the "Pause Prevention" toggle in Supabase Dashboard → Project Settings. (b) The daily GitHub Actions scraper naturally wakes the project as a side effect. (c) Pin the connection check as the first step in the scraper runner.

**Warning signs:** `ECONNREFUSED` from Supabase connection; scraper run returns connection errors after a gap in activity.

### Pitfall 7: Major Code (Mã Ngành) Format Inconsistency Across Sources

**What goes wrong:** Ministry uses 7-digit codes (7480201). Some universities publish 6-digit legacy codes or descriptive strings. Cross-source joins fail; duplicate rows for the same program.

**How to avoid:** Build the `majors` table with 7-digit codes as the canonical standard. When an adapter returns a non-7-digit major code, log it as rejected (not silently stored). Phase 1 should only commit records whose major_id matches an entry in the `majors` lookup table.

**Warning signs:** `majors` table has records with 6-digit IDs; duplicate entries for the same program.

---

## Code Examples

Verified patterns from official sources:

### Drizzle Upsert (Supabase JS client)
```typescript
// Source: https://orm.drizzle.team/docs/connect-supabase
// and ARCHITECTURE.md locked decision

await db.insert(cutoff_scores)
  .values(normalizedRows)
  .onConflictDoUpdate({
    target: [
      cutoff_scores.university_id,
      cutoff_scores.major_id,
      cutoff_scores.tohop_code,
      cutoff_scores.year,
      cutoff_scores.admission_method,
    ],
    set: {
      score: sql`excluded.score`,
      source_url: sql`excluded.source_url`,
      scraped_at: sql`excluded.scraped_at`,
    },
  });
```

### Cheerio Scrape Pattern (Semantic Anchors)
```typescript
// Source: cheerio.js.org docs + pitfall prevention

import * as cheerio from 'cheerio';
import { fetchHTML } from '../fetch';

export const bkaAdapter: ScraperAdapter = {
  async scrape(url: string): Promise<RawRow[]> {
    const html = await fetchHTML(url);
    const $ = cheerio.load(html);
    const rows: RawRow[] = [];

    // Semantic: find header row containing "Điểm chuẩn", not positional selector
    $('table').each((_, table) => {
      const headers = $(table).find('th').map((_, th) => $(th).text().trim()).get();
      const scoreIdx = headers.findIndex(h => h.includes('Điểm chuẩn') || h.includes('Điểm'));
      const tohopIdx = headers.findIndex(h => h.includes('Tổ hợp') || h.includes('Khối'));
      const majorIdx = headers.findIndex(h => h.includes('Mã ngành') || h.includes('Ngành'));

      if (scoreIdx === -1) return; // Not a cutoff table

      $(table).find('tbody tr').each((_, tr) => {
        const cells = $(tr).find('td').map((_, td) => $(td).text().trim()).get();
        rows.push({
          university_id: 'BKA',
          major_raw: cells[majorIdx] ?? '',
          tohop_raw: cells[tohopIdx] ?? '',
          year: 2025,
          score_raw: cells[scoreIdx] ?? '',
          source_url: url,
        });
      });
    });

    // Minimum-rows assertion
    if (rows.length === 0) {
      throw new Error(`BKA adapter returned 0 rows — possible JS rendering or layout change at ${url}`);
    }

    return rows;
  },
};
```

### Vitest Config for Next.js 15
```typescript
// vitest.config.mts
// Source: https://nextjs.org/docs/app/guides/testing/vitest

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'node',  // use 'jsdom' for React component tests
    include: ['**/*.test.ts', '**/*.test.tsx'],
  },
});
```

### drizzle.config.ts
```typescript
// drizzle.config.ts

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prisma as default Node ORM | Drizzle ORM as preferred lightweight alternative | 2023–2024 | Drizzle is 10x lighter; better for serverless cold starts |
| next-pwa (Workbox) | Serwist (@serwist/next) | 2024 | next-pwa abandoned, incompatible with Next.js 14+; Serwist is the official replacement |
| Vercel Cron for scheduling | GitHub Actions for all scraping | Ongoing | Vercel Hobby cron is once/day max; GitHub Actions free for public repos with any cron |
| Supabase direct Postgres (port 5432) | Supabase Supavisor pooler (port 6543) | 2023–2024 | IPv4 deprecation + serverless requires pooling; direct connections exhaust limits instantly |
| next-intl 2.x (Pages Router) | next-intl 3.x (App Router native) | 2023 | Full Server Component support; no client-side bridging needed |

**Deprecated/outdated:**
- `next-pwa`: Abandoned; incompatible with Next.js 14+. Use `@serwist/next` instead.
- Direct Postgres port (5432) from serverless: Replaced by Supabase pooler port (6543).
- drizzle-orm v1.0.0-beta: Actively in development as of March 2026 — use 0.45.1 stable.

---

## Claude's Discretion Recommendations

### Additional 2 Pilot Universities (beyond BKA, KHA, NTH)

Based on the seed list in `uni_list_examples.md`, the easiest candidates are universities with modern, likely static-HTML websites that publish cutoff scores prominently. Recommended picks (subject to manual page audit before adapter work):

1. **GHA** (Trường Đại học Giao thông vận tải — `utc.edu.vn`): Large public university with publicly accessible cutoff pages; likely static-rendered.
2. **DCN** (Trường Đại học Công nghiệp Hà Nội — `haui.edu.vn`): High enrollment, established web presence, likely well-structured cutoff tables.

Both must be manually checked for static vs. JS-rendering before the adapter is written. If either is JS-rendered, substitute the next easiest site from the seed list (e.g., `XDA` — Xây dựng Hà Nội at `huce.edu.vn`, or `TLA` — Thủy lợi at `tlu.edu.vn`).

### GitHub Actions Job Structure

Use a **single job** for Phase 1's low-frequency daily workflow. Rationale: Phase 1 scrapes only 5–6 universities (pilot set). Sequential execution will complete in under 5 minutes. Matrix jobs add complexity that is not justified until Phase 5 when all 78+ sites are scraped. Document in the workflow YAML that sharding should be added in Phase 5.

### scrape_runs.error_log Format

Use **JSON array as text** stored in the `error_log` column. Each element is a stringified rejection object: `{ raw_row, rejection_reason }`. This gives structured data for debugging without requiring a separate `rejections` table. The column type is `TEXT` (Postgres has no native JSON validation for free-tier queries, and TEXT with JSON content is queriable via `json_array_elements` when needed).

---

## Open Questions

1. **Ministry portal điểm chuẩn URL**
   - What we know: `thisinh.thitotnghiepthpt.edu.vn` is the main portal; `tracuudiem.thitotnghiepthpt.edu.vn` is the exam score lookup subdomain. Điểm chuẩn (cutoff scores) are published separately from điểm thi (exam scores), typically in August after virtual filtering rounds.
   - What's unclear: Which specific URL/page path publishes the structured cutoff score data for all universities. Whether the page is static HTML or requires login. The 2025 cycle showed universities began announcing scores around August 22 after 10 rounds of virtual filtering.
   - Recommendation: **Manual audit required before writing the Ministry adapter.** Visit the portal in a browser, confirm the cutoff score page URL, check whether it requires login, and verify the HTML table structure. Flag this as a Wave 3 blocker.

2. **majors table seed data**
   - What we know: Cutoff scores require a `major_id` FK to the `majors` table. The Ministry publishes a canonical list of 7-digit mã ngành codes.
   - What's unclear: The complete canonical list of mã ngành is not included in the project's seed files. The normalizer must validate `major_id` against this table, but an incomplete `majors` table will cause all records with unlisted major codes to be rejected.
   - Recommendation: Either (a) seed `majors` from the Ministry's published Excel file of mã ngành before adapters run, or (b) relax the FK constraint in Phase 1 and insert unknown major codes on-the-fly (with a flag), hardening the constraint in Phase 2. Option (b) is more pragmatic for Phase 1 scope.

3. **tohop_codes seed completeness**
   - What we know: Common codes are A00, A01, B00, C00, D01, etc. Some universities use rare codes like D96.
   - What's unclear: Whether the initial `tohop_codes` seed covers all codes that will appear in pilot scrapes.
   - Recommendation: Seed from the Ministry's official published list of valid tổ hợp codes. Accept and store any `[A-D]\d{2}` code even if not pre-seeded (insert on-the-fly, flag for review). The FK can be relaxed in Phase 1 for tohop_codes.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.x |
| Config file | `vitest.config.mts` (Wave 0 — does not exist yet) |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PIPE-01 | universities table seeded with 78+ rows | integration (DB) | `npx vitest run tests/db/seed.test.ts` | Wave 0 |
| PIPE-02 | scraper adapter returns non-empty RawRow[] for a known URL | unit (mock fetch) | `npx vitest run tests/scraper/adapters/*.test.ts` | Wave 0 |
| PIPE-02 | runner logs scrape_run record on success and on error | unit (mock DB) | `npx vitest run tests/scraper/runner.test.ts` | Wave 0 |
| PIPE-02 | GitHub Actions workflow file is syntactically valid | smoke (yamllint) | `npx yaml-lint .github/workflows/scrape-low.yml` | Wave 0 |
| PIPE-03 | normalizer converts comma-decimal, uppercases tổ hợp, rejects out-of-range scores | unit | `npx vitest run tests/scraper/normalizer.test.ts` | Wave 0 |
| PIPE-03 | upsert does not duplicate rows on second run with same data | integration (DB) | `npx vitest run tests/db/upsert.test.ts` | Wave 0 |
| INFRA-01 | Next.js project builds without errors | smoke | `npx next build` | Wave 0 |
| INFRA-01 | Vercel deployment responds 200 on `/` | smoke (manual) | `curl -s -o /dev/null -w "%{http_code}" $VERCEL_URL` | Manual |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/scraper/normalizer.test.ts` (normalizer is the core validation logic)
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + `npx next build` passes before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `vitest.config.mts` — framework config; install vitest + @vitejs/plugin-react + vite-tsconfig-paths
- [ ] `tests/scraper/normalizer.test.ts` — covers PIPE-03 normalization and rejection logic
- [ ] `tests/scraper/runner.test.ts` — covers PIPE-02 fail-open behavior and scrape_run logging
- [ ] `tests/scraper/adapters/bka.test.ts` — covers PIPE-02 adapter contract (mock fetch with sample HTML)
- [ ] `tests/db/seed.test.ts` — covers PIPE-01 seed row count assertion
- [ ] `tests/db/upsert.test.ts` — covers PIPE-03 upsert idempotency

---

## Sources

### Primary (HIGH confidence)

- [drizzle-orm npm](https://www.npmjs.com/package/drizzle-orm) — version 0.45.1 confirmed March 2026
- [cheerio npm](https://www.npmjs.com/package/cheerio) — version 1.2.0 confirmed March 2026
- [@supabase/supabase-js npm](https://www.npmjs.com/package/@supabase/supabase-js) — version 2.99.2 confirmed March 2026
- [Drizzle ORM + Supabase official guide](https://orm.drizzle.team/docs/connect-supabase) — connection pooler setup, `prepare: false`
- [Drizzle custom migrations](https://orm.drizzle.team/docs/kit-custom-migrations) — seed via INSERT in migration file
- [Next.js Vitest guide](https://nextjs.org/docs/app/guides/testing/vitest) — `vitest.config.mts` structure
- `.planning/research/STACK.md` — verified technology choices (Next.js 15, Drizzle, Cheerio, GitHub Actions)
- `.planning/research/ARCHITECTURE.md` — adapter registry pattern, schema sketch, upsert strategy
- `.planning/research/PITFALLS.md` — encoding, selector brittleness, JS-rendering, Ministry portal risks

### Secondary (MEDIUM confidence)

- [WebSearch: Supabase free tier limits 2026](https://uibakery.io/blog/supabase-pricing) — 500MB DB, 2GB egress, 2 projects, 7-day pause after inactivity; consistent with training knowledge
- [WebSearch: iconv-lite encoding handling](https://webscraping.ai/faq/cheerio/how-do-you-handle-encoding-issues-with-cheerio) — pattern confirmed: fetch as buffer, decode with iconv-lite
- [WebSearch: Ministry portal 2025](https://thisinh.thitotnghiepthpt.edu.vn/) — portal confirmed live; điểm chuẩn published August after virtual filtering rounds
- [WebSearch: Drizzle ORM PostgreSQL 2026 tutorial](https://orm.drizzle.team/docs/get-started/postgresql-new) — migration and postgres.js patterns verified
- [WebSearch: Vitest Next.js 15 setup](https://www.wisp.blog/blog/setting-up-vitest-for-nextjs-15) — configuration pattern consistent with official docs

### Tertiary (LOW confidence)

- Specific Ministry portal URL path for điểm chuẩn data — requires manual verification before adapter work
- Static vs. JS-rendered status of GHA and DCN pilot university websites — requires manual audit
- Complete mã ngành canonical list completeness — requires downloading from Ministry's published Excel

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all library versions confirmed against npm registry March 2026
- Architecture: HIGH — based on official Drizzle docs, established ETL patterns, locked project decisions
- Pitfalls: HIGH for encoding/selector/connection (well-established); MEDIUM for Ministry portal specifics (URL needs manual verification)
- Validation architecture: HIGH — Vitest setup confirmed via official Next.js docs

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable libraries; re-verify if drizzle-orm releases v1.0.0 stable before planning completes)
