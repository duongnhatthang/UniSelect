# Phase 12: Testing & CI - Research

**Researched:** 2026-03-19
**Domain:** Vitest unit testing, GitHub Actions CI, git housekeeping
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None — all implementation choices are at Claude's discretion.

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure/testing phase.

### Deferred Ideas (OUT OF SCOPE)
None — infrastructure phase.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TEST-01 | Recommendation engine has synthetic data tests covering NaN input, null score, comma-decimal, all 5 tier boundary values, 0-practical pool, and exactly-15 pool | Engine source read; all edge cases mapped to exact score values below |
| TEST-02 | GitHub Actions CI workflow runs `npm test` and `npm run build` on pull requests | Existing workflow patterns studied; `npm test` script does not yet exist in package.json |
| TEST-03 | Dead `src/` directory removed from repository | Confirmed: `src/app/` has 4 git-tracked files that are Next.js scaffold duplicates of `app/` |
| TEST-04 | `public/sw.js` added to .gitignore (build artifact, not source) | Confirmed: `public/sw.js` IS currently git-tracked and NOT in .gitignore |
</phase_requirements>

---

## Summary

Phase 12 is a pure infrastructure phase with four discrete tasks: write recommendation engine tests, add a PR CI workflow, delete `src/`, and ignore `public/sw.js`. There is no new library adoption required — Vitest 4.1.0 is already installed with a working `vitest.config.mts`. The only package gap is `@faker-js/faker` for synthetic test data generation, but as noted below, faker is NOT needed — the engine tests require precise boundary values, which are best expressed as inline literals, not randomized data.

The biggest execution risk is TEST-02: `package.json` has NO `test` script. The CI workflow will fail `npm test` until that script is added. The second risk is TEST-04: `public/sw.js` is currently tracked by git, so adding it to `.gitignore` alone is not sufficient — it must also be untracked with `git rm --cached`.

**Primary recommendation:** Write engine tests first with explicit boundary values (no faker needed), add `"test": "vitest run"` to package.json, create the CI workflow, delete `src/`, then fix `.gitignore` + untrack `public/sw.js`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 4.1.0 (installed) | Test runner | Already in use; config at `vitest.config.mts` |
| vite-tsconfig-paths | 6.1.1 (installed) | Path alias resolution in tests | Already in vitest config — needed for `@/lib/...` imports |
| @vitejs/plugin-react | 6.0.1 (installed) | React transform for test files | Already in vitest config |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @faker-js/faker | NOT NEEDED | Synthetic data | Do NOT use — boundary value tests require exact numbers, not random |
| actions/setup-node@v4 | v4 | Node.js setup in CI | Existing workflows use this pattern with `node-version: '20'` |
| actions/cache@v4 | v4 | npm cache in CI | Existing workflows use `cache: 'npm'` on setup-node |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `vitest run` | `vitest --run` | Same behavior; `vitest run` is standard |
| Inline boundary values | @faker-js/faker | Faker adds noise to boundary tests — exact values are clearer and deterministic |

**Installation:** No new packages needed. If `@types/node` is missing in CI, it is already at `^20` in devDependencies.

**Version verification:** Vitest 4.1.0 is installed and confirmed via `node_modules/vitest/package.json`. Its Node.js engine requirement is `^20.0.0 || ^22.0.0 || >=24.0.0`. Existing CI workflows use `node-version: '20'` — this satisfies the requirement.

---

## Architecture Patterns

### Recommended Project Structure

```
tests/
├── recommend/
│   ├── delta.test.ts       # existing — computeDelta tests
│   └── engine.test.ts      # NEW — recommend() edge case tests
.github/
└── workflows/
    ├── ci.yml              # NEW — PR test + build workflow
    ├── ci-ocr.yml          # existing
    ├── scrape-low.yml      # existing
    ├── scrape-peak.yml     # existing
    └── staleness-alert.yml # existing
```

### Pattern 1: Vitest node environment test file

The existing `vitest.config.mts` sets `environment: 'node'` globally and picks up `**/*.test.ts`. New engine tests go in `tests/recommend/engine.test.ts` — no config changes needed.

**Example structure:**
```typescript
// tests/recommend/engine.test.ts
import { describe, it, expect } from 'vitest';
import { recommend } from '../../lib/recommend/engine';
import type { CutoffDataRow, RecommendInput } from '../../lib/recommend/types';

// helper to build a minimal CutoffDataRow
function row(overrides: Partial<CutoffDataRow> & { score: string }): CutoffDataRow {
  return {
    university_id: 'U01',
    university_name_vi: 'Test University',
    major_id: 'M01',
    major_name_vi: 'Test Major',
    tohop_code: 'A00',
    year: 2024,
    scraped_at: null,
    source_url: null,
    ...overrides,
  };
}
```

### Pattern 2: GitHub Actions PR workflow

The existing scrape workflows establish the convention. The CI workflow follows the same shape but triggers on `pull_request`.

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:

jobs:
  test-and-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test
      - run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co' }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder' }}
```

Note: `npm run build` runs `generate-static && next build --webpack`. The `generate-static` script reads from Supabase — it may need env vars or a fallback. This must be accounted for in planning.

### Pattern 3: Untracking a git-tracked file before .gitignore

When a file is already tracked by git, adding it to `.gitignore` does NOT remove it from the index. The correct sequence is:

```bash
# 1. Add to .gitignore
echo 'public/sw.js' >> .gitignore

# 2. Remove from git index (keep file on disk)
git rm --cached public/sw.js

# 3. Commit both changes together
git add .gitignore
git commit -m "chore: ignore public/sw.js build artifact"
```

### Anti-Patterns to Avoid

- **Adding to .gitignore without `git rm --cached`:** The file remains tracked; CI will still see it in the tree.
- **Using faker for boundary value tests:** Non-deterministic data obscures which boundary is being tested. Use exact values.
- **Triggering CI on `push` only:** Requirements say "opening a pull request triggers CI" — use `on: pull_request`.
- **Running `next build` without required env vars:** The build will fail in CI if Supabase URL/key are not available; use placeholder secrets or a build-time env bypass.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test runner | Custom test harness | `vitest run` (already installed) | Config already exists at `vitest.config.mts` |
| CI Node.js setup | Manual nvm install | `actions/setup-node@v4` with `cache: 'npm'` | Existing workflows already use this pattern |
| Path alias resolution in tests | Manual `resolve.alias` | `vite-tsconfig-paths` plugin (already in vitest config) | Already wired up |

**Key insight:** No new tooling is needed for this phase. Everything required is already installed — the only additions are new files (test file, workflow file) and deletions (`src/`, untrack `public/sw.js`).

---

## Common Pitfalls

### Pitfall 1: `npm test` script missing

**What goes wrong:** CI runs `npm test`, gets `npm error Missing script: "test"`, fails immediately with exit code 1.
**Why it happens:** `package.json` has no `test` script — confirmed by inspection. The project uses vitest but never wired it to the standard `npm test` entry point.
**How to avoid:** Add `"test": "vitest run"` to the `scripts` block in `package.json` before writing the CI workflow.
**Warning signs:** Running `npm test` locally fails with "Missing script" error.

### Pitfall 2: `public/sw.js` remains tracked after .gitignore update

**What goes wrong:** `.gitignore` lists `public/sw.js` but `git ls-files public/sw.js` still shows the file; TEST-04 criterion "not tracked by git" fails verification.
**Why it happens:** `.gitignore` only prevents UNTRACKED files from being staged. Files already in the index are not affected.
**How to avoid:** Run `git rm --cached public/sw.js` in the same commit as the `.gitignore` update.
**Warning signs:** `git ls-files public/sw.js` returns the path even after `.gitignore` entry added.

### Pitfall 3: `src/` deletion leaves tracked files in index

**What goes wrong:** Deleting `src/` via filesystem removes the directory but git still shows the files as deleted (staged). If not committed, the directory reappears on checkout.
**Why it happens:** Filesystem delete and git delete are separate operations.
**How to avoid:** Use `git rm -r src/` to both delete and stage the deletion in one step. The 4 tracked files are: `src/app/favicon.ico`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`.
**Warning signs:** `git status` shows deleted files as unstaged after manual `rm -rf src/`.

### Pitfall 4: `npm run build` failing in CI due to missing env vars

**What goes wrong:** `generate-static` script calls Supabase at build time; without `DATABASE_URL` or Supabase credentials, the build step fails even if tests pass.
**Why it happens:** `npm run build` is `npm run generate-static && next build`. Generate-static reads the database.
**How to avoid:** Check whether `generate-static` has a graceful fallback when Supabase is unreachable. If it does (it uses async readFile fallback per FIX-06/FIX-08), then build may succeed with placeholder env vars. Confirm and document in the plan.
**Warning signs:** Build step exits non-zero with Supabase connection error in CI logs.

### Pitfall 5: Tier boundary off-by-one in tests

**What goes wrong:** Tests pass the wrong score for a boundary case; the test "works" but doesn't actually test the boundary.
**Why it happens:** The engine uses `>=` and `<=` comparisons — the exact boundary value must be used, not boundary ± epsilon.
**How to avoid:** Use exact boundary values derived from engine constants. See Code Examples below.

---

## Code Examples

### Tier Boundary Values (derived from engine.ts constants)

```
DREAM_MARGIN = 3      → diff >= 3         → cutoff=20, score=23 is DREAM boundary
PRACTICAL_LOWER = -1  → diff >= -1        → cutoff=20, score=19 is PRACTICAL lower boundary
PRACTICAL_UPPER = 2   → diff <= 2         → cutoff=20, score=22 is PRACTICAL upper boundary
SAFE_LOWER = -5       → diff >= -5        → cutoff=20, score=15 is SAFE lower boundary
SAFE_UPPER = -2       → diff <= -2        → cutoff=20, score=18 is SAFE upper boundary

EXCLUDED zone:        diff < -5           → cutoff=20, score=14 is EXCLUDED
GAP zone:             -2 < diff < -1      → no integer fits exactly; use score=18.5 for gap test
```

All 5 tiers (including excluded/null) and the gap zone between practical and safe:

```typescript
// Source: lib/recommend/engine.ts — DREAM_MARGIN, PRACTICAL_LOWER/UPPER, SAFE_LOWER/UPPER
// cutoff = 20, all score values chosen to hit exact boundaries

it('classifies DREAM: score exactly at dream boundary (diff = 3)', () => {
  const result = recommend({ tohop_code: 'A00', total_score: 23 }, [row({ score: '20' })]);
  expect(result[0].tier).toBe('dream');
});

it('classifies PRACTICAL: score at lower practical boundary (diff = -1)', () => {
  const result = recommend({ tohop_code: 'A00', total_score: 19 }, [row({ score: '20' })]);
  expect(result[0].tier).toBe('practical');
});

it('classifies PRACTICAL: score at upper practical boundary (diff = 2)', () => {
  const result = recommend({ tohop_code: 'A00', total_score: 22 }, [row({ score: '20' })]);
  expect(result[0].tier).toBe('practical');
});

it('classifies SAFE: score at upper safe boundary (diff = -2)', () => {
  const result = recommend({ tohop_code: 'A00', total_score: 18 }, [row({ score: '20' })]);
  expect(result[0].tier).toBe('safe');
});

it('classifies SAFE: score at lower safe boundary (diff = -5)', () => {
  const result = recommend({ tohop_code: 'A00', total_score: 15 }, [row({ score: '20' })]);
  expect(result[0].tier).toBe('safe');
});

it('excludes result: score below safe lower boundary (diff = -6)', () => {
  const result = recommend({ tohop_code: 'A00', total_score: 14 }, [row({ score: '20' })]);
  expect(result).toHaveLength(0);
});
```

### NaN Input and Null Score Tests

```typescript
// Source: lib/recommend/engine.ts lines 76-80 — validRows filter
it('filters NaN score: row with score "NaN" is excluded from computation', () => {
  // Only row has NaN score → group skipped → empty results
  const result = recommend({ tohop_code: 'A00', total_score: 25 }, [row({ score: 'NaN' })]);
  expect(result).toHaveLength(0);
});

it('filters null score: row with score null is excluded from computation', () => {
  // score type is string, but null coerces to '' → parseFloat('') = NaN → filtered
  const result = recommend({ tohop_code: 'A00', total_score: 25 }, [row({ score: null as unknown as string })]);
  expect(result).toHaveLength(0);
});

it('uses valid rows when mixed with null scores', () => {
  const rows = [
    row({ year: 2022, score: null as unknown as string }),
    row({ year: 2023, score: '20' }),
  ];
  const result = recommend({ tohop_code: 'A00', total_score: 25 }, rows);
  expect(result[0].tier).toBe('dream');
  expect(result[0].data_years_limited).toBe(true); // only 1 valid year
});
```

### Comma-Decimal Score Test

```typescript
// Source: lib/recommend/engine.ts line 77 — parseFloat('20,5') = 20 (not 20.5)
// Vietnamese data uses comma as decimal separator; must be pre-normalized
it('handles comma-decimal score: "20,5" — parseFloat gives 20, not 20.5', () => {
  // This is a KNOWN BEHAVIOR test — the engine uses raw parseFloat
  // score "20,5" → parseFloat("20,5") = 20 (comma stops parsing)
  // weighted_cutoff will be 20, not 20.5
  const result = recommend({ tohop_code: 'A00', total_score: 23 }, [row({ score: '20,5' })]);
  // parseFloat('20,5') = 20, diff = 3 → dream
  expect(result[0].tier).toBe('dream');
  expect(result[0].weighted_cutoff).toBeCloseTo(20);
});
```

### 0-Practical Pool and Exactly-15 Pool Tests

```typescript
// Source: lib/recommend/engine.ts lines 153-156 — suggested_top_15 marking

it('handles 0-practical pool: returns only dream/safe results', () => {
  const dreamRow = row({ university_id: 'U01', major_id: 'M01', score: '20' }); // score 25, diff=5 → dream
  const safeRow  = row({ university_id: 'U02', major_id: 'M02', score: '28' }); // score 25, diff=-3 → safe
  const result = recommend({ tohop_code: 'A00', total_score: 25 }, [dreamRow, safeRow]);
  expect(result.every(r => r.tier !== 'practical')).toBe(true);
  expect(result).toHaveLength(2);
});

it('marks exactly 15 as suggested_top_15 when pool is exactly 15', () => {
  // Build 15 distinct university/major pairs all in practical range
  const rows = Array.from({ length: 15 }, (_, i) =>
    row({ university_id: `U${i}`, major_id: `M${i}`, score: '20' }) // total_score=21, diff=1 → practical
  );
  const result = recommend({ tohop_code: 'A00', total_score: 21 }, rows);
  expect(result.filter(r => r.suggested_top_15)).toHaveLength(15);
  expect(result.every(r => r.suggested_top_15)).toBe(true);
});

it('marks only first 15 when pool exceeds 15', () => {
  const rows = Array.from({ length: 20 }, (_, i) =>
    row({ university_id: `U${i}`, major_id: `M${i}`, score: '20' })
  );
  const result = recommend({ tohop_code: 'A00', total_score: 21 }, rows);
  expect(result.filter(r => r.suggested_top_15)).toHaveLength(15);
});
```

### Minimal CI Workflow

```yaml
# Source: pattern from .github/workflows/scrape-low.yml + scrape-peak.yml
name: CI

on:
  pull_request:

jobs:
  test-and-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test
      - run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate `--run` flag | `vitest run` command | Vitest 1.0+ | Both work; `vitest run` is clearer intent |
| `actions/checkout@v3` | `actions/checkout@v4` | 2023 | Existing workflows already use v4 |
| `actions/setup-node@v3` | `actions/setup-node@v4` | 2023 | Existing workflows already use v4 |

**Deprecated/outdated:**
- `actions/cache@v3`: Replaced by `actions/cache@v4` — existing workflows already use v4. Use v4 in new workflow.
- `jest` with Next.js: Vitest is the project standard; do not introduce Jest.

---

## Open Questions

1. **Does `npm run build` require live Supabase credentials?**
   - What we know: `npm run build` = `npm run generate-static && next build`. `generate-static` reads from Supabase. FIX-06 adds a static JSON fallback for the API route, but `generate-static` itself may still try to connect.
   - What's unclear: Whether `generate-static` exits 0 or non-zero when Supabase is unreachable, and whether the static JSON fallback files already exist in the repo.
   - Recommendation: During planning, the implementor should run `npm run build` with an invalid `DATABASE_URL` locally to confirm behavior. If it fails, the CI workflow needs repository secrets or a `continue-on-error` guard on generate-static, or an alternative build command.

2. **@faker-js/faker Node.js version concern (from STATE.md)**
   - What we know: STATE.md flags a concern: "Verify @faker-js/faker v10 Node.js 20+ requirement against GitHub Actions runner before Phase 12." Faker is NOT installed and is NOT needed for these tests.
   - What's unclear: Nothing — this concern is moot since boundary value tests use explicit literals.
   - Recommendation: Do not install faker. The concern is resolved by not using it.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.mts` (exists) |
| Quick run command | `npx vitest run tests/recommend/engine.test.ts` |
| Full suite command | `npm test` (after adding script) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-01 | NaN input excluded from weighted average | unit | `npx vitest run tests/recommend/engine.test.ts` | Wave 0 |
| TEST-01 | Null score excluded from weighted average | unit | `npx vitest run tests/recommend/engine.test.ts` | Wave 0 |
| TEST-01 | Comma-decimal score parsed as integer part | unit | `npx vitest run tests/recommend/engine.test.ts` | Wave 0 |
| TEST-01 | All 5 tier boundary values correct | unit | `npx vitest run tests/recommend/engine.test.ts` | Wave 0 |
| TEST-01 | 0-practical pool returns only dream/safe | unit | `npx vitest run tests/recommend/engine.test.ts` | Wave 0 |
| TEST-01 | Exactly-15 pool marks all 15 as top-15 | unit | `npx vitest run tests/recommend/engine.test.ts` | Wave 0 |
| TEST-02 | PR triggers CI: npm test + npm run build | smoke | Manual — open a PR and verify checks appear | N/A (workflow file) |
| TEST-03 | src/ directory not in repository | smoke | `git ls-files src/` returns empty | N/A (deletion task) |
| TEST-04 | public/sw.js not tracked by git | smoke | `git ls-files public/sw.js` returns empty | N/A (git housekeeping) |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/recommend/engine.test.ts`
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green + `git ls-files src/` empty + `git ls-files public/sw.js` empty before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/recommend/engine.test.ts` — covers all TEST-01 cases (NaN, null, comma-decimal, 5 tier boundaries, 0-practical, exactly-15)
- [ ] `package.json` `test` script — add `"test": "vitest run"` (currently missing; CI will fail without it)

---

## Sources

### Primary (HIGH confidence)

- Direct file inspection: `lib/recommend/engine.ts` — all tier boundary constants read from source
- Direct file inspection: `lib/recommend/types.ts` — CutoffDataRow.score type confirmed as `string`
- Direct file inspection: `vitest.config.mts` — confirmed environment, include pattern, plugins
- Direct file inspection: `package.json` — confirmed vitest 4.1.0, no `test` script, no faker
- Direct file inspection: `node_modules/vitest/package.json` — confirmed Node.js engine `^20.0.0 || ^22.0.0 || >=24.0.0`
- Direct file inspection: `.github/workflows/scrape-low.yml` — confirmed node-version: '20', actions versions
- Direct file inspection: `tests/recommend/delta.test.ts` — confirmed existing test pattern
- Git CLI: `git ls-files public/sw.js` — confirmed public/sw.js IS tracked
- Git CLI: `git ls-files src/` — confirmed 4 files tracked in src/

### Secondary (MEDIUM confidence)

- GitHub Actions official docs (workflow syntax) — `on: pull_request` trigger, job structure
- Vitest 4.x docs — `vitest run` CLI command

### Tertiary (LOW confidence)

- None — all claims verified from source code inspection or official versioned packages.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified from installed node_modules
- Architecture: HIGH — all patterns derived from existing codebase conventions
- Pitfalls: HIGH — confirmed from direct git and filesystem state inspection
- Boundary values: HIGH — derived algebraically from engine.ts constants (not guessed)

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable domain — Vitest and GitHub Actions are not fast-moving)
