# Phase 9: Scraper Resilience Testing - Research

**Researched:** 2026-03-18
**Domain:** HTTP test interception (MSW), HTML fixture library, PaddleOCR CI caching
**Confidence:** HIGH

## Summary

Phase 9 upgrades the existing scraper test suite from `vi.mock('fetchHTML')` (unit-only) to full integration testing via a fake HTTP server that responds with HTML fixtures. The adapter under test calls the real `fetchHTML`, which makes a real `fetch()` call intercepted by MSW's Node.js request interceptors — no live university servers involved. This is the standard pattern for testing HTTP clients without live network dependencies.

The phase also ships the GitHub Actions CI job that actually runs PaddleOCR end-to-end against a test image, with `~/.paddlex` cached between runs so model downloads do not repeat on every workflow trigger. The current scraping workflows already install PaddleOCR on every shard but never cache the model directory — this is pure CI wasted time.

All implementation choices are at Claude's discretion (no locked decisions in CONTEXT.md).

**Primary recommendation:** Use MSW 2.x `setupServer` + `http.get` handlers as the fake HTTP server. This intercepts native `fetch()` at the Node.js level without launching a real HTTP server, requires zero additional ports, and is fully compatible with Vitest 4.x and Node 20+.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None — all implementation choices are at Claude's discretion.

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure/testing phase.

### Deferred Ideas (OUT OF SCOPE)
None — infrastructure phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCRP-06 | Fake HTTP server serves HTML fixtures for scraper integration tests (cheerio + Playwright adapters) | MSW 2.x `setupServer` intercepts native `fetch()` at Node level; no real server process needed; works transparently with existing `fetchHTML` utility |
| SCRP-07 | HTML fixture library covers verified adapter formats plus irregular edge cases (comma-decimal, missing table, multi-method) | 7 named edge-case formats identified below; stored as `.ts` constant files in `tests/fixtures/` |
| SCRP-08 | PaddleOCR pipeline runs in GitHub Actions CI with cached model downloads | PaddleOCR 3.x caches models in `~/.paddlex/official_models/`; `actions/cache@v4` on that path prevents re-download |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| msw | 2.12.13 (latest) | Fake HTTP server via Node.js request interception | Intercepts native `fetch()` without real server; used by Vitest docs as recommended approach; zero port binding |
| vitest | 4.1.0 (already installed) | Test runner | Already the project test framework |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| actions/cache@v4 | v4 (GitHub Marketplace) | Cache `~/.paddlex` model directory in GHA | PaddleOCR CI job only |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| MSW setupServer | nock | nock does NOT intercept native Node 18+ `fetch()`; requires `--no-experimental-fetch` flag or node-fetch package; project already uses native fetch in `fetchHTML` so nock is blocked |
| MSW setupServer | Real Express HTTP server (http-server, express) | Works but binds a real port, adds teardown complexity, slower startup; MSW is zero-overhead and more idiomatic for unit-integration hybrid tests |
| MSW setupServer | vi.mock('fetchHTML') (current pattern) | Current pattern tests the adapter logic but does NOT test that `fetchHTML` correctly decodes encoding/headers — integration value is lower |

**Installation:**
```bash
npm install --save-dev msw
```

**Version verification:** `npm view msw version` returned `2.12.13` on 2026-03-18.

## Architecture Patterns

### Recommended Project Structure
```
tests/
├── fixtures/                  # HTML fixture constants (new)
│   ├── generic-table.ts       # Standard thead/th table
│   ├── no-thead-headers.ts    # HTC-style: first-row td as headers
│   ├── comma-decimal.ts       # score_raw "24,50" not "24.50"
│   ├── windows-1252.ts        # Content-Type: charset=windows-1252
│   ├── broken-table.ts        # Table with no score column match
│   ├── renamed-headers.ts     # Headers with unusual keyword variants
│   └── js-stub.ts             # Bare page with no table (JS-rendered stub)
├── scraper/
│   ├── adapters/              # Existing vi.mock unit tests (unchanged)
│   └── integration/           # New MSW-based integration tests (new)
│       ├── msw-server.ts      # setupServer singleton
│       └── cheerio-integration.test.ts
└── ci/
    └── paddleocr-pipeline.test.ts   # OCR smoke test (new)
```

### Pattern 1: MSW Node.js Fake Server
**What:** `setupServer` from `msw/node` patches native `http`/`https` and `fetch` so that requests from the real `fetchHTML` utility are intercepted.
**When to use:** Any test that must call the real `fetchHTML` (or the real Playwright adapter's `fetch`) against a fixture URL.

```typescript
// Source: https://mswjs.io/docs/integrations/node/
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { beforeAll, afterEach, afterAll } from 'vitest';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// In a test, register a handler per fixture:
server.use(
  http.get('https://fake.test/generic', () =>
    HttpResponse.text(GENERIC_TABLE_HTML, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  )
);
```

**Key detail:** `onUnhandledRequest: 'error'` makes any unregistered URL throw in tests — catches accidental live network calls.

### Pattern 2: Windows-1252 Encoding Fixture
**What:** `fetchHTML` uses `chardet` + `iconv-lite` to decode non-UTF-8 responses. The integration test must serve a response with `charset=windows-1252` in the Content-Type to exercise this path.
**When to use:** SCRP-07 edge case #4.

```typescript
// Source: lib/scraper/fetch.ts logic — Content-Type charset triggers iconv-lite decode path
server.use(
  http.get('https://fake.test/windows-1252', () => {
    // Body is a Buffer with Windows-1252 encoded bytes
    const buf = iconv.encode('<table>...Tiếng Việt...</table>', 'windows-1252');
    return new HttpResponse(buf, {
      headers: { 'Content-Type': 'text/html; charset=windows-1252' },
    });
  })
);
```

### Pattern 3: PaddleOCR CI Smoke Test
**What:** A GitHub Actions workflow (`ci-ocr.yml`) that runs `python3 scripts/ocr_table.py` against a small test image fixture and asserts the output JSON contains at least one line.
**When to use:** SCRP-08.

```yaml
# Source: adapted from scrape-low.yml + actions/cache@v4 docs
- uses: actions/cache@v4
  with:
    path: ~/.paddlex
    key: paddleocr-models-${{ runner.os }}-${{ hashFiles('scripts/ocr_table.py') }}
    restore-keys: |
      paddleocr-models-${{ runner.os }}-
```

### Anti-Patterns to Avoid
- **Re-using `vi.mock('fetchHTML')` for integration tests:** These tests do not exercise chardet/iconv encoding detection path. Unit tests with vi.mock stay; new integration tests must use MSW.
- **Checking in large binary fixtures for PaddleOCR:** The OCR CI job should use a tiny synthetic JPEG (~5KB). Large images slow CI and bloat git history.
- **Hardcoding `~/.paddleocr` cache path:** PaddleOCR 3.x (used in `scripts/ocr_table.py`) stores models in `~/.paddlex/official_models/`, not `~/.paddleocr`. Caching the wrong path gives zero benefit.
- **Using `nock` for fetch interception:** nock does not intercept the native Node 18+ `fetch()` API used by `fetchHTML`. The project runs Node 24 — nock will silently pass through to live servers.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP request interception | Custom fetch monkey-patch | MSW `setupServer` | MSW handles both `fetch` and `http`/`https` modules; handles redirects, query strings, response streaming correctly |
| Encoding in fixture responses | Manual Buffer construction in every test | Helper function in `msw-server.ts` that accepts `{ html, charset }` | Deduplication; single place to update if MSW API changes |
| PaddleOCR model caching | Python script that downloads models | `actions/cache@v4` on `~/.paddlex` | Standard GHA pattern; hash-keyed on `ocr_table.py` to invalidate when Python script changes |

**Key insight:** MSW intercepts at the Node.js undici/fetch layer — the same layer `fetchHTML` uses — so the real chardet/iconv decoding path runs in integration tests without any live university network.

## Common Pitfalls

### Pitfall 1: MSW Not Intercepting (fetchHTML Bypasses)
**What goes wrong:** Tests appear to run but make live network calls (or fail with DNS errors).
**Why it happens:** `server.listen()` was not called before the import that uses `fetch`, OR the test uses a URL not matched by any registered handler.
**How to avoid:** Put `server.listen({ onUnhandledRequest: 'error' })` in `beforeAll`. Use exact URL strings in handlers that match what the adapter will call. Test with `server.events.on('request:start', ...)` to observe requests during debugging.
**Warning signs:** Tests fail with `ERR_NAME_NOT_RESOLVED` or ECONNREFUSED on fake domains like `fake.test`.

### Pitfall 2: Windows-1252 Fixture Not Exercising iconv Path
**What goes wrong:** Test passes but does not actually test encoding decoding.
**Why it happens:** The fixture HTML is stored as a UTF-8 string in TypeScript, so `chardet` detects UTF-8 and the iconv path is skipped.
**How to avoid:** The Windows-1252 fixture body MUST be a Buffer encoded with `iconv.encode(str, 'windows-1252')`, NOT a TypeScript string literal. The `Content-Type: charset=windows-1252` header triggers the `fetchHTML` declared-charset branch.

### Pitfall 3: PaddleOCR 3.x vs 2.x Model Directory
**What goes wrong:** CI caches `~/.paddleocr` but models actually download to `~/.paddlex`.
**Why it happens:** PaddleOCR 2.x used `~/.paddleocr`; version 3.x (current in `ocr_table.py`) uses `~/.paddlex/official_models/`.
**How to avoid:** Cache `~/.paddlex` in GHA workflow. Confirm by running `PaddleOCR(lang='vi')` locally and checking which directory is created.
**Warning signs:** CI download step takes 2+ minutes on every run despite cache being present.

### Pitfall 4: PaddleOCR Model Re-download on Every Run Despite Cache
**What goes wrong:** Even with `actions/cache`, PaddleOCR 3.x re-downloads models because it checks HuggingFace/ModelScope connectivity before using local cache.
**Why it happens:** PaddleOCR 3.x defaults to checking remote hosts (HuggingFace, BOS, ModelScope) for model updates even when local copies exist.
**How to avoid:** Set `PADDLE_PDX_MODEL_SOURCE=BOS` or pass explicit model dir paths to avoid the remote check. Alternatively, the warm-up step (`python3 -c "from paddleocr import PaddleOCR; PaddleOCR(lang='vi')"`) populates the cache on first run; subsequent runs with cache restore skip download.
**Warning signs:** GHA step "Warm up PaddleOCR models" always shows download progress logs even on cache hits.

### Pitfall 5: Playwright Adapter Integration Testing Complexity
**What goes wrong:** Attempting to MSW-intercept Playwright's browser-level fetch fails because Playwright launches a separate Chromium process that doesn't share the Node MSW interceptors.
**Why it happens:** MSW `setupServer` only intercepts the Node.js process that runs the test — not subprocesses or browser contexts.
**How to avoid:** Playwright adapter integration tests (DCN) should continue using `vi.mock('playwright')` pattern already established in `dcn.test.ts`. SCRP-06 scope is "cheerio + Playwright adapters" but the Playwright path is already covered by the existing mock approach — the fake server covers cheerio/fetch adapters only.

### Pitfall 6: JS-Stub Fixture Must Trigger the Right Error
**What goes wrong:** JS-stub fixture (page with no table) causes a test to fail with the wrong error message.
**Why it happens:** `createCheerioAdapter` throws `"${id} adapter returned 0 rows — possible JS rendering or layout change"`. The test must assert that exact error, not just `rejects.toThrow()`.
**How to avoid:** Assert `rejects.toThrow(/0 rows/)` to match the specific message pattern.

## Code Examples

### MSW Server Singleton (shared across integration test files)
```typescript
// tests/scraper/integration/msw-server.ts
// Source: https://mswjs.io/docs/integrations/node/
import { setupServer } from 'msw/node';

export const server = setupServer();
```

### Integration Test File Pattern
```typescript
// tests/scraper/integration/cheerio-integration.test.ts
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './msw-server';
import { createCheerioAdapter } from '../../../lib/scraper/factory';
import { GENERIC_TABLE_HTML } from '../../fixtures/generic-table';
import { COMMA_DECIMAL_HTML } from '../../fixtures/comma-decimal';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('createCheerioAdapter integration (real fetchHTML, fake server)', () => {
  it('parses generic thead/th table', async () => {
    server.use(
      http.get('https://fake.test/generic', () =>
        HttpResponse.text(GENERIC_TABLE_HTML, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      )
    );
    const adapter = createCheerioAdapter({
      id: 'TEST-INT',
      scoreKeywords: ['điểm chuẩn'],
      majorKeywords: ['mã ngành'],
      tohopKeywords: ['tổ hợp'],
    });
    const rows = await adapter.scrape('https://fake.test/generic');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].score_raw).toBe('26.00');
  });

  it('parses comma-decimal scores (24,50)', async () => {
    server.use(
      http.get('https://fake.test/comma', () =>
        HttpResponse.text(COMMA_DECIMAL_HTML, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      )
    );
    const adapter = createCheerioAdapter({
      id: 'TEST-COMMA',
      scoreKeywords: ['điểm chuẩn'],
      majorKeywords: ['mã ngành'],
      tohopKeywords: ['tổ hợp'],
    });
    const rows = await adapter.scrape('https://fake.test/comma');
    expect(rows[0].score_raw).toBe('24,50'); // raw is preserved; normalizer handles comma→dot
  });
});
```

### GHA PaddleOCR CI Workflow
```yaml
# .github/workflows/ci-ocr.yml
name: PaddleOCR CI

on:
  push:
    paths:
      - 'scripts/ocr_table.py'
      - '.github/workflows/ci-ocr.yml'
  workflow_dispatch:

jobs:
  ocr-smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'

      - name: Cache PaddleOCR models
        uses: actions/cache@v4
        with:
          path: ~/.paddlex
          key: paddleocr-models-${{ runner.os }}-${{ hashFiles('scripts/ocr_table.py') }}
          restore-keys: |
            paddleocr-models-${{ runner.os }}-

      - name: Install PaddleOCR
        run: pip install paddleocr

      - name: Warm up / download PaddleOCR models
        run: python3 -c "from paddleocr import PaddleOCR; PaddleOCR(lang='vi', use_gpu=False, show_log=False)"

      - name: Run OCR smoke test
        run: |
          python3 scripts/ocr_table.py tests/fixtures/ocr-smoke.jpg /tmp/ocr-output.json
          python3 -c "
          import json, sys
          data = json.load(open('/tmp/ocr-output.json'))
          assert len(data['lines']) > 0, 'OCR returned 0 lines'
          print(f'OCR smoke passed: {len(data[\"lines\"])} lines extracted')
          "
```

### 7 Required HTML Fixture Shapes
```typescript
// tests/fixtures/generic-table.ts — standard thead/th headers with tohop column
export const GENERIC_TABLE_HTML = `
<table>
  <thead><tr><th>Mã ngành</th><th>Tổ hợp</th><th>Điểm chuẩn</th></tr></thead>
  <tbody>
    <tr><td>7480201</td><td>A00</td><td>26.00</td></tr>
    <tr><td>7520103</td><td>A01</td><td>24.75</td></tr>
  </tbody>
</table>`;

// tests/fixtures/no-thead-headers.ts — HTC-style: first-row <td> as headers
export const NO_THEAD_HEADERS_HTML = `
<table>
  <tr><td>TT</td><td>Mã ngành</td><td>Tên ngành</td><td>Điểm trúng tuyển</td></tr>
  <tr><td>1</td><td>7340101</td><td>Quản trị kinh doanh</td><td>25.00</td></tr>
</table>`;

// tests/fixtures/comma-decimal.ts — Vietnamese decimal comma in score
export const COMMA_DECIMAL_HTML = `
<table>
  <thead><tr><th>Mã ngành</th><th>Tổ hợp</th><th>Điểm chuẩn</th></tr></thead>
  <tbody><tr><td>7480201</td><td>A00</td><td>24,50</td></tr></tbody>
</table>`;

// tests/fixtures/windows-1252.ts — served as Buffer, not string
// (see encoding pattern above — cannot be a TS string literal)

// tests/fixtures/broken-table.ts — table exists but score column keyword absent
export const BROKEN_TABLE_HTML = `
<table>
  <thead><tr><th>Chuyên ngành</th><th>Năm</th><th>Ghi chú</th></tr></thead>
  <tbody><tr><td>7480201</td><td>2025</td><td>Chờ cập nhật</td></tr></tbody>
</table>`;

// tests/fixtures/renamed-headers.ts — keyword variant "điểm trúng tuyển" not "điểm chuẩn"
export const RENAMED_HEADERS_HTML = `
<table>
  <thead><tr><th>Mã xét tuyển</th><th>Tổ hợp xét tuyển</th><th>Điểm trúng tuyển</th></tr></thead>
  <tbody><tr><td>7340101</td><td>D01</td><td>23.50</td></tr></tbody>
</table>`;

// tests/fixtures/js-stub.ts — page with no table (JS-rendered, stub only)
export const JS_STUB_HTML = `
<!DOCTYPE html><html><body>
  <div id="app">Loading...</div>
  <script>// content rendered by React</script>
</body></html>`;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `vi.mock('fetchHTML')` only | MSW fake server (integration) + vi.mock (unit) | Phase 9 | Integration tests now exercise chardet/iconv path |
| No HTML fixture directory | `tests/fixtures/*.ts` constants | Phase 9 | Fixture reuse across test files |
| No PaddleOCR CI | `ci-ocr.yml` with cached `~/.paddlex` | Phase 9 | OCR pipeline verified on every push to ocr_table.py |
| PaddleOCR model downloads every scrape run | GHA cache on `~/.paddlex` | Phase 9 | ~2 min saved per shard per scrape run |
| PaddleOCR 2.x API (`ocr.ocr()`) | PaddleOCR 3.x API (`ocr.predict()`) with 2.x fallback | Phase 8 (already done) | `ocr_table.py` already handles both APIs |

**Deprecated/outdated:**
- `~/.paddleocr` cache path: PaddleOCR 3.x uses `~/.paddlex/official_models/` — do not cache the old path
- nock: Does not work with native Node 18+ fetch; project is on Node 24

## Open Questions

1. **Does PaddleOCR 3.x still check remote on every init even with local models?**
   - What we know: The `PADDLE_PDX_MODEL_SOURCE=BOS` env var switches source; local model dir params bypass remote checks entirely
   - What's unclear: Whether the warm-up step + cache hit is sufficient for subsequent runs to be fully offline
   - Recommendation: Include `PADDLE_PDX_MODEL_SOURCE=BOS` in the CI workflow env as a safety net; monitor first few CI runs to confirm cache is effective

2. **Should DCN (Playwright) adapter get MSW-based integration tests?**
   - What we know: DCN uses a subprocess Chromium process; MSW only intercepts the Node test process
   - What's unclear: Whether Playwright's `page.route()` API could serve fixtures inside the browser context
   - Recommendation: Keep DCN on `vi.mock('playwright')` pattern; SCRP-06 is satisfied by cheerio adapters using MSW. The Playwright path is structurally different and well-covered by existing behavioral mocks.

3. **OCR smoke test image: synthetic or real scan?**
   - What we know: A synthetic JPEG with rendered text (e.g., generated with Pillow or included as a tiny static file) avoids copyright issues and keeps git size small
   - What's unclear: Whether PaddleOCR returns confident results on synthetic text (perfect fonts vs. scanned noise)
   - Recommendation: Use a real tiny JPEG crop from a public Vietnamese university cutoff announcement (already scraped in Phase 8). Alternatively, use Pillow to generate a 200x100px image with Vietnamese text — simpler, no copyright concern.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.mts` |
| Quick run command | `npx vitest run tests/scraper/integration/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCRP-06 | Fake server intercepts `fetchHTML` calls | integration | `npx vitest run tests/scraper/integration/cheerio-integration.test.ts` | Wave 0 |
| SCRP-07 | All 7 fixture formats parse correctly (or throw correctly for broken/js-stub) | integration | `npx vitest run tests/scraper/integration/` | Wave 0 |
| SCRP-08 | OCR pipeline extracts lines from test image | smoke (GHA) | `python3 scripts/ocr_table.py tests/fixtures/ocr-smoke.jpg /tmp/out.json` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/scraper/integration/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + GHA ci-ocr.yml workflow green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/scraper/integration/msw-server.ts` — MSW server singleton
- [ ] `tests/scraper/integration/cheerio-integration.test.ts` — covers SCRP-06, SCRP-07
- [ ] `tests/fixtures/generic-table.ts` — fixture 1
- [ ] `tests/fixtures/no-thead-headers.ts` — fixture 2
- [ ] `tests/fixtures/comma-decimal.ts` — fixture 3
- [ ] `tests/fixtures/windows-1252.ts` — fixture 4 (Buffer-based, iconv encoded)
- [ ] `tests/fixtures/broken-table.ts` — fixture 5
- [ ] `tests/fixtures/renamed-headers.ts` — fixture 6
- [ ] `tests/fixtures/js-stub.ts` — fixture 7
- [ ] `tests/fixtures/ocr-smoke.jpg` — tiny test image for OCR CI
- [ ] `.github/workflows/ci-ocr.yml` — covers SCRP-08
- [ ] Framework install: `npm install --save-dev msw` — not yet in package.json

## Sources

### Primary (HIGH confidence)
- MSW official docs (https://mswjs.io/docs/integrations/node/) — Node.js setupServer, lifecycle hooks, `onUnhandledRequest`
- MSW quick-start (https://mswjs.io/docs/quick-start/) — HttpResponse.text(), handler pattern
- `lib/scraper/fetch.ts` (project source) — confirmed chardet+iconv-lite decoding logic
- `lib/scraper/factory.ts` (project source) — confirmed keyword matching, 0-rows throw
- `scripts/ocr_table.py` (project source) — confirmed PaddleOCR 3.x `predict()` API + 2.x fallback
- PaddleOCR issue #15707 (https://github.com/PaddlePaddle/PaddleOCR/issues/15707) — confirmed `~/.paddlex/official_models/` cache path for 3.x
- PaddleOCR discussion #16334 (https://github.com/PaddlePaddle/PaddleOCR/discussions/16334) — confirmed offline model dir params

### Secondary (MEDIUM confidence)
- nock npm page + Code With Hugo article — confirmed nock fails on native Node 18+ fetch (verified from multiple sources)
- `npm view msw version` — confirmed 2.12.13 is latest stable (run 2026-03-18)

### Tertiary (LOW confidence)
- PADDLE_PDX_MODEL_SOURCE=BOS env var behavior — mentioned in community discussion, not in official GHA docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — MSW version verified via npm registry; incompatibility with nock verified from official project issue and independent blog
- Architecture: HIGH — based on reading actual project source (fetchHTML, factory, gha adapter, existing tests)
- Pitfalls: HIGH for encoding/MSW pitfalls (verified against source code); MEDIUM for PaddleOCR cache behavior (cross-referenced across GitHub issues)

**Research date:** 2026-03-18
**Valid until:** 2026-06-18 (MSW 2.x stable; PaddleOCR model path stable; GHA cache API stable)
