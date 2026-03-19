# Phase 8: Scraper Foundation - Research

**Researched:** 2026-03-18
**Domain:** Node.js scraper pipeline refactoring — Drizzle ORM batch transactions, config-driven adapter factory, static JSON fallback
**Confidence:** HIGH

## Summary

Phase 8 is a pure infrastructure refactor of an existing, working scraper pipeline. All 78 adapters already exist and follow a single verified pattern (cheerio + semantic table parsing). The work has four distinct sub-problems: (1) add a zero-rows guard in the runner (not the adapters — they already throw, but the runner logs that as `status: 'error'`; the runner needs its own check for a silent regression where an adapter returns `[]` without throwing); (2) replace N×2 row-by-row DB calls with a batch transaction per adapter; (3) replace 78 near-identical adapter files with a `createCheerioAdapter(config)` factory; (4) add a static JSON fallback to `GET /api/recommend` when Supabase is unreachable.

The existing codebase has strong foundations: `ScraperAdapter` interface, `RawRow`/`NormalizedRow` types, the HTC adapter as the verified reference pattern, and a Vitest test suite with mocked Drizzle. The runner mock pattern in `tests/scraper/runner.test.ts` must be updated to mock `db.transaction()` once batch inserts land. The static fallback file already exists at `public/data/scores-by-tohop.json` and is indexed by tohop code.

**Primary recommendation:** Implement in this order — (1) zero-rows guard first (per STATE.md decision), (2) static JSON fallback (isolated, no dependencies), (3) batch insert transaction in runner, (4) adapter factory migration.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None explicitly locked — all implementation choices are at Claude's discretion.

Key constraints from STATE.md:
- Zero-rows guard must be the first commit before any factory work — silent `rows_written: 0` as `'ok'` is an invisible regression
- Batch inserts must wrap chunks in a single `db.transaction()` — partial failure without transaction leaves inconsistent university data

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase.

### Deferred Ideas (OUT OF SCOPE)
None — infrastructure phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCRP-01 | Generic adapter factory replaces 70+ copy-pasted cheerio adapters with a config-driven `createCheerioAdapter(config)` function | All 78 adapters follow the same pattern — header-finding + cell extraction + zero-row throw. Factory config needs: `id`, `scoreHeaderKeywords`, `tohopHeaderKeywords`, `majorHeaderKeywords`, `defaultTohop?` (for single-tohop universities like HTC) |
| SCRP-02 | Scraper runner uses batched DB inserts (one INSERT per table per adapter) instead of row-by-row upserts | Drizzle ORM 0.45.1 supports `db.transaction(tx => ...)` and batch `.values([...array])`. Supabase pooler requires `prepare: false` (already set). Need to chunk to avoid hitting Postgres parameter limit (~65535 params) |
| SCRP-03 | Zero-rows guard in runner rejects adapters returning empty results with explicit error logging | Current adapters throw on empty, caught as `status: 'error'`. Runner also needs explicit guard: if `rawRows.length === 0` after scrape, log `status: 'zero_rows'` directly without going through the error path |
| FIX-06 | /api/recommend falls back to static JSON (scores-by-tohop.json) when Supabase is unreachable | `public/data/scores-by-tohop.json` exists and is keyed by tohop code. Current route returns 503 on `DB_TIMEOUT`. Need to `readFile` the static file and run `recommend()` on it, returning 200 with a `meta.fallback: true` flag |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.1 (installed) | ORM + transaction API | Already used throughout; `db.transaction()` is the right API |
| cheerio | 1.2.0 (installed) | HTML parsing in adapter factory | All adapters use it; factory just parameterizes the same logic |
| vitest | 4.1.0 (installed) | Test framework | Already used; runner.test.ts exists and must be updated |
| Node.js `fs/promises` | Built-in | Async file read for fallback | Replace sync `readFileSync` in fallback path (FIX-08 alignment) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| drizzle-orm `sql` tag | Same as above | `sql\`excluded.score\`` in upsert conflict sets | Used in current runner; keep in batch version |
| `postgres` driver | 3.4.8 (installed) | Underlying Postgres client | `prepare: false` already set for Supabase Supavisor — do not change |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `db.transaction()` | Manual `BEGIN`/`COMMIT` | Transaction API is safer, typed, auto-rollbacks |
| Single giant batch | Chunked batches of ~500 rows | Postgres 65535 parameter limit; chunking mandatory for large universities |
| Factory replacing all files | Adding factory + keeping files | Files become dead code; cleaner to replace all 78 via registry mapping |

**Installation:** No new packages needed. All dependencies are already installed.

## Architecture Patterns

### Recommended Project Structure
```
lib/scraper/
├── types.ts           # unchanged
├── normalizer.ts      # unchanged
├── fetch.ts           # unchanged
├── registry.ts        # updated: maps adapter key to factory config
├── runner.ts          # updated: batch tx + zero-rows guard
├── run.ts             # unchanged
├── factory.ts         # NEW: createCheerioAdapter(config) function
└── adapters/          # all 78 files replaced by factory configs in scrapers.json / registry
    └── htc.ts         # kept as-is — only static_verified=true adapter; confirms factory matches output
```

### Pattern 1: Zero-Rows Guard in Runner

**What:** After `adapter.scrape()` returns, check `rawRows.length === 0` before normalization loop. Log `status: 'zero_rows'` to `scrape_runs`.
**When to use:** Always — this is a runner-level invariant, separate from the adapter throwing.
**Why the runner needs its own guard:** Adapters currently throw on 0 rows, which routes through the `catch` block as `status: 'error'`. That's correct behavior. But if a future adapter regression returns `[]` silently (no throw), the current runner writes `status: 'ok'` with `rows_written: 0` — an invisible data hole. The runner guard makes 0-row detection explicit and independent of adapter implementation.

```typescript
// Source: pattern derived from existing runner.ts structure
const rawRows = await config.adapter.scrape(config.url);

if (rawRows.length === 0) {
  await db.insert(scrapeRuns).values({
    university_id: config.id,
    status: 'zero_rows',
    rows_written: 0,
    rows_rejected: 0,
    error_log: `Adapter returned 0 rows — possible JS rendering or layout change`,
    github_run_id: githubRunId ?? null,
  });
  continue; // skip to next adapter
}
```

### Pattern 2: Batch Transaction Insert

**What:** Collect all normalized rows for an adapter, then write majors + cutoffScores in a single `db.transaction()` using `.values([...array])` bulk insert.
**When to use:** Always — replaces the row-by-row loop.

```typescript
// Source: Drizzle ORM 0.45.1 transaction API (verified in pg-core/db.d.ts)
// Chunk to avoid Postgres 65535-param limit
// cutoffScores has ~9 columns → safe chunk size: Math.floor(65535 / 9) = ~7281
// Use 500 as a conservative safe chunk

const CHUNK_SIZE = 500;

await db.transaction(async (tx) => {
  // 1. Upsert unique majors first (FK dependency)
  const uniqueMajorIds = [...new Set(normalizedRows.map(r => r.major_id))];
  for (const chunk of chunks(uniqueMajorIds, CHUNK_SIZE)) {
    await tx.insert(majors)
      .values(chunk.map(id => ({ id, name_vi: id })))
      .onConflictDoNothing();
  }

  // 2. Batch upsert cutoffScores
  for (const chunk of chunks(normalizedRows, CHUNK_SIZE)) {
    await tx.insert(cutoffScores)
      .values(chunk.map(r => ({
        university_id: r.university_id,
        major_id: r.major_id,
        tohop_code: r.tohop_code,
        year: r.year,
        score: String(r.score),
        admission_method: r.admission_method,
        source_url: r.source_url,
        scraped_at: r.scraped_at,
      })))
      .onConflictDoUpdate({
        target: [
          cutoffScores.university_id,
          cutoffScores.major_id,
          cutoffScores.tohop_code,
          cutoffScores.year,
          cutoffScores.admission_method,
        ],
        set: {
          score: sql`excluded.score`,
          source_url: sql`excluded.source_url`,
          scraped_at: sql`excluded.scraped_at`,
        },
      });
  }
});
```

**Supabase Supavisor note:** The `prepare: false` setting in `lib/db/index.ts` is required for transaction pool mode. `db.transaction()` works correctly with this setting — Drizzle issues explicit `BEGIN`/`COMMIT` statements rather than prepared transactions.

### Pattern 3: Config-Driven Adapter Factory

**What:** `createCheerioAdapter(config)` returns a `ScraperAdapter` given a configuration object. The registry loads factory configs from `scrapers.json` instead of `import('./adapters/X')`.

```typescript
// lib/scraper/factory.ts
export interface CheerioAdapterConfig {
  id: string;
  scoreKeywords: string[];        // e.g. ['điểm chuẩn', 'diem chuan', 'điểm trúng tuyển']
  majorKeywords: string[];        // e.g. ['mã ngành', 'ma nganh']
  tohopKeywords?: string[];       // omit for single-tohop universities
  defaultTohop?: string;          // e.g. 'A00' for HTC-pattern universities
  headerInFirstRow?: boolean;     // true when no <th> — headers are first <tr><td>
}

export function createCheerioAdapter(config: CheerioAdapterConfig): ScraperAdapter {
  return {
    id: config.id,
    async scrape(url: string): Promise<RawRow[]> {
      const html = await fetchHTML(url);
      const $ = cheerio.load(html);
      const rows: RawRow[] = [];
      const year = new Date().getFullYear() - 1;

      $('table').each((_, table) => {
        // Header detection: <th>/<thead td> first, else first <tr><td>
        // Column index finding by keywords (case-insensitive, normalized)
        // Row extraction loop
        // Push RawRow with defaultTohop fallback if tohopIdx === -1
      });

      if (rows.length === 0) {
        throw new Error(`${config.id} adapter returned 0 rows — possible JS rendering or layout change at ${url}`);
      }
      return rows;
    },
  };
}
```

**Registry update:** `scrapers.json` gains a `factory_config` object per entry. The registry checks: if `factory_config` present, use factory; if `adapter` filename present, dynamic import (for non-cheerio adapters like GHA/PaddleOCR). This lets GHA and future Playwright adapters coexist without being replaced.

### Pattern 4: Static JSON Fallback in /api/recommend

**What:** When `withTimeout` throws `DB_TIMEOUT`, read `public/data/scores-by-tohop.json` asynchronously and run `recommend()` on the filtered rows.
**When to use:** Only in the `DB_TIMEOUT` catch branch.

```typescript
// Source: derived from existing route.ts structure
// public/data/scores-by-tohop.json is keyed: { [tohop: string]: CutoffDataRow[] }
import { readFile } from 'fs/promises';
import { join } from 'path';

if (err instanceof Error && err.message === 'DB_TIMEOUT') {
  const filePath = join(process.cwd(), 'public/data/scores-by-tohop.json');
  const raw = await readFile(filePath, 'utf-8');
  const allData: Record<string, CutoffDataRow[]> = JSON.parse(raw);
  const fallbackRows = allData[tohop] ?? [];
  const results = recommend({ tohop_code: tohop, total_score: totalScore }, fallbackRows);
  const distinctYears = [...new Set(fallbackRows.map(r => r.year))].sort((a, b) => b - a);
  return Response.json({
    data: results,
    meta: { count: results.length, years_available: distinctYears, fallback: true },
  });
}
```

**Note:** `scores-by-tohop.json` is 9,569 bytes (verified) — a fast file read, safe in the error path. The `CutoffDataRow` type uses `scraped_at: Date | null` but the JSON will have it as a string — the existing cast pattern `rows as CutoffDataRow[]` is already used in the live path, acceptable here too.

### Anti-Patterns to Avoid
- **Replacing GHA adapter with factory:** GHA uses PaddleOCR, not cheerio. The factory must not replace non-cheerio adapters. Registry logic must preserve dynamic import path for PaddleOCR/Playwright adapters.
- **Single un-chunked batch insert:** `db.insert(cutoffScores).values(allRows)` with 200+ rows will work but risks hitting Postgres parameter limits for very large universities. Always chunk at 500.
- **Wrapping majors insert outside transaction:** FK violations become possible. Both majors and cutoffScores inserts must be inside the same transaction.
- **Synchronous `readFileSync` in fallback:** Next.js API routes run in async context; use `fs/promises` readFile. This also aligns with FIX-08 from Phase 11 — doing it right now avoids double-touch.
- **Changing `prepare: false` in db client:** Required for Supabase Supavisor transaction pooler. Removing it breaks all transactions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Batch SQL construction | Manual `VALUES ($1,$2), ($3,$4)...` string | `drizzle .values([...array])` | Parameter binding, SQL injection safe, typed |
| Transaction management | Manual `BEGIN`/`COMMIT`/`ROLLBACK` | `db.transaction(tx => ...)` | Auto-rollback on throw, typed tx object |
| Header normalization | Complex regex per adapter | Simple `toLowerCase().includes()` | Adapters already use this — factory inherits it |
| Chunking utility | Recursive array split | Simple `for` loop with slice | One-liner in the runner, no library needed |

**Key insight:** Every cheerio adapter in this codebase is already a copy-paste of the same 60-line pattern. The factory is just extracting the variable parts (keyword arrays, defaultTohop) into a config object.

## Common Pitfalls

### Pitfall 1: Supabase Supavisor Rejects Prepared Statements in Transactions
**What goes wrong:** If `prepare: false` is removed from the postgres client config, Supabase's transaction pool mode rejects prepared statements with `PreparedStatementAlreadyExists` errors.
**Why it happens:** Supavisor (Supabase's connection pooler) multiplexes connections; prepared statements from one session can conflict with another.
**How to avoid:** Never touch `lib/db/index.ts`. The `prepare: false` line must stay.
**Warning signs:** Errors like `prepared statement "drizzle_XX" already exists` in production logs.

### Pitfall 2: Transaction Callback Context — `tx` vs `db`
**What goes wrong:** Using `db.insert()` inside a `db.transaction()` callback instead of `tx.insert()` bypasses the transaction entirely.
**Why it happens:** Both `db` and `tx` have `.insert()` — easy to mix up.
**How to avoid:** In the transaction callback, use only `tx` for all DB operations.

### Pitfall 3: Factory Config Missing `headerInFirstRow` for HTC-Pattern Tables
**What goes wrong:** HTC and similar universities use `<td>` in the first row as headers (no `<th>` or `<thead>`). A factory that only checks `$('th, thead td')` returns empty header arrays and skips every table.
**Why it happens:** Non-standard HTML table structure — common in Vietnamese university CMSes.
**How to avoid:** Factory must support both modes — prefer `<th>/<thead td>` headers, fall back to first `<tr><td>` if empty. The HTC adapter code is the reference.

### Pitfall 4: `scores-by-tohop.json` Contains Only HTC Data
**What goes wrong:** The fallback works but returns near-empty results for most tohop codes because only HTC data was scraped at v1.0 time.
**Why it happens:** Only HTC had `static_verified: true` in scrapers.json at the time the file was generated.
**How to avoid:** This is a data completeness issue, not a code issue. Document in the fallback response `meta.fallback: true` so the frontend can surface a warning. Do not block Phase 8 implementation on this.

### Pitfall 5: Runner Test Mock Doesn't Know About `db.transaction`
**What goes wrong:** After adding batch transaction, existing `tests/scraper/runner.test.ts` breaks because `vi.mock('../../lib/db')` doesn't mock `db.transaction`.
**Why it happens:** The existing mock only provides `db.insert`. `db.transaction` is not mocked.
**How to avoid:** Update the mock to add `transaction: vi.fn().mockImplementation(async (fn) => fn(mockTx))` where `mockTx` exposes `insert`. This is a required test update in the same plan as the runner batch change.

### Pitfall 6: Zero-Rows Guard vs. Adapter Throw — Double Logging
**What goes wrong:** Adapter throws `Error('X returned 0 rows')` → runner catch block logs `status: 'error'`. If the runner guard runs before the throw, it could log `status: 'zero_rows'` AND then the catch logs `status: 'error'` creating two scrape_run records.
**Why it happens:** Guard must run after `scrape()` resolves successfully — if `scrape()` throws, the guard never executes. The guard only catches the silent `[] return` case. No double-logging possible in this ordering.
**How to avoid:** Guard placement is critical — place it immediately after the `rawRows` assignment, before the normalization loop. The catch block only runs if `scrape()` threw.

## Code Examples

### Drizzle Transaction API (verified from installed package)
```typescript
// Source: node_modules/drizzle-orm/pg-core/db.d.ts
// Signature: transaction<T>(transaction: (tx: PgTransaction<...>) => Promise<T>, config?): Promise<T>

await db.transaction(async (tx) => {
  await tx.insert(majors).values([...]).onConflictDoNothing();
  await tx.insert(cutoffScores).values([...]).onConflictDoUpdate({ ... });
});
// Auto-rollback on any throw inside the callback
```

### Simple Chunking Utility
```typescript
// No library needed — inline in runner.ts
function chunks<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}
```

### Vitest Mock Update for Transaction
```typescript
// Updated mock for tests/scraper/runner.test.ts after batch insert lands
const mockTx = {
  insert: mockInsert,
};
vi.mock('../../lib/db', () => ({
  db: {
    insert: mockInsert,
    transaction: vi.fn().mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
  },
}));
```

### Async File Read for Fallback
```typescript
// Source: Node.js built-in fs/promises
import { readFile } from 'fs/promises';
import { join } from 'path';

const raw = await readFile(join(process.cwd(), 'public/data/scores-by-tohop.json'), 'utf-8');
const data: Record<string, CutoffDataRow[]> = JSON.parse(raw);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Row-by-row `db.insert()` | Batch `db.insert().values([...])` in transaction | Phase 8 | 200 DB round-trips → 2 |
| 78 copy-paste adapter files | `createCheerioAdapter(config)` factory | Phase 8 | New adapters need only config entry |
| 503 on DB timeout | 200 with static fallback data | Phase 8 | Service stays up during Supabase hiccups |
| Adapter-level zero-row throw (maps to `error`) | Runner-level `zero_rows` status | Phase 8 | Distinct, queryable failure mode |

**Deprecated/outdated:**
- Row-by-row `db.insert()` loop in runner: replaced by batch transaction
- 78 individual adapter files (for cheerio adapters): replaced by factory + config. Non-cheerio adapters (GHA) remain as files.

## Open Questions

1. **Factory config storage location**
   - What we know: `scrapers.json` already has per-adapter entries with `id`, `adapter`, `url`, `static_verified`
   - What's unclear: Whether to embed `factory_config` in `scrapers.json` or keep a separate `factory-configs.json`
   - Recommendation: Embed in `scrapers.json` as an optional `factory_config` field — single source of truth; the registry already reads from that file

2. **HTC adapter migration**
   - What we know: HTC is the only `static_verified: true` adapter; it has non-standard table structure (headers in first `<tr><td>`)
   - What's unclear: Whether to migrate HTC to factory or keep it as a file
   - Recommendation: Keep HTC as-is for Phase 8. Its non-standard structure is a good integration test that the factory fallback logic works, but migrating it risks breaking the only proven working adapter. Migrate in Phase 9 after factory is proven on unverified adapters.

3. **Success criteria 3 interpretation: "2 round-trips"**
   - What we know: With chunking at 500, a university with 200 rows needs 1 majors insert + 1 cutoffScores insert = 2 DB round-trips. Both inside 1 transaction = 1 connection.
   - What's unclear: Whether the success criterion counts the `scrape_runs` insert as a third round-trip
   - Recommendation: Count majors + cutoffScores as "the writes" = 2 round-trips. scrape_run is a separate audit log write, not a data write.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.mts` (project root) |
| Quick run command | `npx vitest run tests/scraper/` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCRP-03 | Runner logs `status: 'zero_rows'` when adapter returns `[]` | unit | `npx vitest run tests/scraper/runner.test.ts` | ✅ (must add case) |
| SCRP-03 | scrape_run record has `rows_written: 0` and error message on zero-rows | unit | `npx vitest run tests/scraper/runner.test.ts` | ✅ (must add case) |
| SCRP-02 | 200+ rows write to Supabase in 2 round-trips (transaction mock) | unit | `npx vitest run tests/scraper/runner.test.ts` | ✅ (must add case) |
| SCRP-01 | Factory adapter returns same rows as HTC reference adapter | unit | `npx vitest run tests/scraper/` | ❌ Wave 0 |
| FIX-06 | GET /api/recommend returns 200 with fallback data when DB throws DB_TIMEOUT | unit | `npx vitest run tests/api/` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/scraper/runner.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/scraper/factory.test.ts` — covers SCRP-01: factory produces identical output to HTC reference
- [ ] `tests/api/recommend.test.ts` — covers FIX-06: fallback response on DB_TIMEOUT
- [ ] Update `tests/scraper/runner.test.ts` — add `db.transaction` mock + zero-rows test cases

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `lib/scraper/runner.ts`, `lib/scraper/types.ts`, `lib/scraper/registry.ts` — current runner logic verified directly
- Codebase inspection: `lib/scraper/adapters/*.ts` (78 files) — all use identical cheerio pattern with zero-row throw
- Codebase inspection: `lib/db/index.ts`, `lib/db/schema.ts` — Drizzle setup with `prepare: false` confirmed
- Codebase inspection: `app/api/recommend/route.ts` — current fallback path returns 503 on DB_TIMEOUT
- Codebase inspection: `public/data/scores-by-tohop.json` — 9,569 bytes, keyed by tohop code, exists
- Package verification: `drizzle-orm` 0.45.1 `node_modules/drizzle-orm/pg-core/db.d.ts` — `transaction()` signature confirmed
- Codebase inspection: `tests/scraper/runner.test.ts` — existing test patterns for mock extension

### Secondary (MEDIUM confidence)
- Drizzle ORM docs: `db.transaction()` auto-rollback behavior on throw — consistent with TypeScript signature observed
- Postgres parameter limit: 65535 params per query — well-established constraint, chunk size of 500 is conservative safe value

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages installed and version-verified in node_modules
- Architecture: HIGH — derived from direct reading of existing source files, not inference
- Pitfalls: HIGH — Pitfalls 1-3 and 5-6 derived from reading actual code; Pitfall 4 from inspecting the static JSON file

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable infrastructure; Drizzle API unlikely to change at patch level)
