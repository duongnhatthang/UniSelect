# Phase 11: Bug Fixes & Data Correctness - Research

**Researched:** 2026-03-18
**Domain:** TypeScript/React bug fixes — delta sign convention, color semantics, NaN propagation, type mismatch, timer leak, async I/O, error UI
**Confidence:** HIGH

## Summary

All seven bugs in this phase are fully observable in existing source files. No external libraries need to be introduced; every fix involves modifying existing code in well-understood files. The bugs fall into three categories: display logic errors (FIX-01, FIX-02), data safety errors (FIX-03, FIX-04, FIX-05, FIX-08), and UX correctness (FIX-07).

The most critical fix is FIX-01 (delta sign): `ResultsList.tsx` currently computes `cutoff - userScore` (inverted), while `NguyenVongList.tsx` correctly computes `userScore - cutoff`. A student above cutoff should see a positive delta. Both must be unified under a shared `computeDelta()` utility to prevent future drift. FIX-02 (trend colors) inverts the meaning: the current green-for-rising color scheme tells students "rising cutoff = good", which is backwards — a rising cutoff makes admission harder.

The remaining fixes are mechanical but important. FIX-03 requires filtering out `null` and `NaN` scores in the engine before weighted-average arithmetic. FIX-04 changes `scraped_at: string | null` to `scraped_at: Date | null` in `CutoffDataRow` to match the Drizzle timestamp return type. FIX-05 adds timer cleanup to `withTimeout`. FIX-07 replaces three silent `.catch(() => {})` calls with visible error banners. FIX-08 confirms that `readFile` (async) is already in `route.ts` — the fallback path is correct; no change needed there unless the static JSON path is still using `readFileSync` elsewhere.

**Primary recommendation:** Fix all seven bugs atomically in a single PR. Group into three tasks: (1) delta+trend display logic with shared utility, (2) engine NaN guard + type fix + timer cleanup, (3) error UI + FIX-08 verification.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Delta = userScore - cutoff everywhere (both ResultsList and NguyenVongList)
- Positive delta = student is above cutoff (good)
- Must use a shared `computeDelta()` utility per STATE.md decision
- Rising cutoff = amber/warning (bad for student — harder to get in)
- Falling cutoff = green/favorable (good for student — easier to get in)
- Filter out null/unparseable scores BEFORE computing weighted averages
- No NaN values in recommendation output
- Failed API calls show visible error banners with retry button
- Replace all silent `.catch(() => {})` patterns

### Claude's Discretion
- Specific component styling for error banners
- Timer cleanup implementation details (FIX-05)
- Type fix approach for CutoffDataRow (FIX-04)
- Async readFile migration approach (FIX-08)

### Deferred Ideas (OUT OF SCOPE)
None — all bugs are in scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FIX-01 | Delta sign convention: userScore - cutoff everywhere; positive = above cutoff | ResultsList.tsx line 46 has inverted formula; NguyenVongList.tsx line 52 is correct. Both need shared computeDelta() |
| FIX-02 | Trend colors: rising cutoff = amber/warning, falling cutoff = green | TREND_DISPLAY in ResultsList.tsx line 14-18 has rising=green (inverted); must swap to amber and remove red-for-falling |
| FIX-03 | Filter null/unparseable scores before weighted average computation | engine.ts line 78 does `parseFloat(r.score)` with no null guard — null score becomes NaN, NaN propagates through arithmetic |
| FIX-04 | CutoffDataRow.scraped_at: Date \| null (not string \| null) | schema.ts shows timestamp type; Drizzle returns Date; types.ts line 16 declares string \| null incorrectly |
| FIX-05 | withTimeout clears setTimeout on promise resolution | timeout.ts line 1-6: timer ref not captured; clearTimeout never called on resolution |
| FIX-07 | Failed API calls show error banners with retry (replace silent .catch(() => {})) | ScoreForm.tsx has 3 silent catch blocks (lines 35, 72-74, 88) — all swallow errors silently |
| FIX-08 | readFileSync in API fallback replaced with async readFile | route.ts already uses async readFile from fs/promises — verify no other paths use readFileSync |
</phase_requirements>

## Bug Analysis (Per Requirement)

### FIX-01: Delta Sign Convention

**Current state (WRONG in ResultsList.tsx, line 46):**
```typescript
// ResultsList.tsx line 46 — INVERTED
const delta = (result.weighted_cutoff - userScore).toFixed(1);
const sign = result.weighted_cutoff >= userScore ? '+' : '';
```
When `userScore=25` and `cutoff=24` (student is above cutoff), this computes `-1.0` and shows no `+` sign. The student is above cutoff but sees a negative number with no prefix.

**Current state (CORRECT in NguyenVongList.tsx, line 52):**
```typescript
// NguyenVongList.tsx line 52 — CORRECT
const delta = (userScore - result.weighted_cutoff).toFixed(1);
const sign = userScore >= result.weighted_cutoff ? '+' : '';
```
NguyenVongList already does it correctly.

**Fix:** Extract to a shared utility, apply to both components:
```typescript
// lib/recommend/delta.ts
export function computeDelta(userScore: number, cutoff: number): string {
  const diff = userScore - cutoff;
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${diff.toFixed(1)}`;
}
```

**CONFIDENCE:** HIGH — source code directly inspected.

---

### FIX-02: Trend Colors

**Current state (WRONG):**
```typescript
// ResultsList.tsx lines 14-18
const TREND_DISPLAY = {
  rising:  { icon: '↑', color: 'text-green-600' },  // WRONG: green = good = rising = bad for student
  falling: { icon: '↓', color: 'text-red-600' },    // WRONG: red = bad = falling = good for student
  stable:  { icon: '–', color: 'text-gray-400' },
} as const;
```

**Fix (from locked decisions):**
```typescript
const TREND_DISPLAY = {
  rising:  { icon: '↑', color: 'text-amber-600' },   // amber/warning = harder to get in
  falling: { icon: '↓', color: 'text-green-600' },   // green/favorable = easier to get in
  stable:  { icon: '–', color: 'text-gray-400' },
} as const;
```
Tailwind's `text-amber-600` is the standard amber/warning color in the existing Tailwind v4 setup. No new dependencies needed.

**CONFIDENCE:** HIGH — source code directly inspected; Tailwind color class verified as part of existing stack.

---

### FIX-03: NaN Filtering in Engine

**Current state (BROKEN):**
```typescript
// engine.ts line 78
const scores = lastRows.map(r => parseFloat(r.score));
```
When `r.score` is `null` (schema allows `NULL` for unpublished scores), `parseFloat(null)` returns `NaN`. This NaN propagates through the weighted average computation and produces `NaN` in `weighted_cutoff`, which then appears in the recommendation output.

**Schema confirmation:**
```typescript
// schema.ts line 46
score: numeric('score', { precision: 5, scale: 2 }), // NULL if not published
```

**Fix:** Filter rows with null/NaN scores BEFORE the weighted average:
```typescript
// Filter out null/unparseable scores before arithmetic
const validRows = lastRows.filter(r => {
  const parsed = parseFloat(r.score ?? '');
  return !isNaN(parsed);
});
if (validRows.length === 0) continue; // skip if no valid scores remain
const scores = validRows.map(r => parseFloat(r.score));
const yearsCount = validRows.length;
const weights = WEIGHTS[yearsCount] ?? [1];
```

**CONFIDENCE:** HIGH — schema confirms `null` is possible; `parseFloat(null)` → `NaN` is JavaScript spec behavior.

---

### FIX-04: CutoffDataRow Type Mismatch

**Current state (WRONG in types.ts, line 16):**
```typescript
scraped_at: string | null;  // WRONG
```

**Schema (schema.ts line 49):**
```typescript
scraped_at: timestamp('scraped_at', { withTimezone: true }).defaultNow(),
```

Drizzle ORM returns `timestamp` columns as `Date` objects in TypeScript, not strings. The `CutoffDataRow` type must match what Drizzle actually returns.

**Fix:**
```typescript
scraped_at: Date | null;  // CORRECT — matches Drizzle timestamp return type
```

**Downstream impact check:** `StalenessIndicator` receives `scrapedAt` from `RecommendResult.scraped_at`. `RecommendResult` also declares `scraped_at: string | null`. Both interfaces need the type updated. The `StalenessIndicator` component (inspected separately) must accept `Date | null` and handle formatting.

Read `StalenessIndicator.tsx` before implementing to confirm its prop type and whether `new Date(scraped_at)` is called internally.

**CONFIDENCE:** HIGH — schema and Drizzle ORM type behavior are well-established.

---

### FIX-05: Timer Leak in withTimeout

**Current state (BROKEN):**
```typescript
// lib/db/timeout.ts
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('DB_TIMEOUT')), ms)
  );
  return Promise.race([promise, timeout]);
}
```
The `setTimeout` handle is not captured, so when `promise` resolves first, the timeout timer continues running until it fires, then silently rejects an already-settled Promise. In long-running processes (Next.js server), this accumulates open handles.

**Fix (at Claude's discretion per CONTEXT.md):**
```typescript
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timerId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => reject(new Error('DB_TIMEOUT')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timerId));
}
```
`.finally()` runs on both resolution and rejection, ensuring the timer is always cleared.

**CONFIDENCE:** HIGH — timer leak pattern is well-understood; `.finally()` + `clearTimeout` is the standard fix.

---

### FIX-07: Error UI (Replace Silent Catch Blocks)

**Current state — three silent catch blocks in ScoreForm.tsx:**

1. **Line 35:** Tohop codes fetch on mount
```typescript
.catch(() => {});  // Tohop list silently fails — user sees empty dropdown
```

2. **Lines 72-74:** Manual submit handler
```typescript
} catch {
  // ignore
}
```

3. **Line 88:** Auto-submit (detailed mode)
```typescript
.catch(() => {})
```

**Fix pattern:** Add an `error` state to `ScoreForm` and render a visible error banner with a retry button. At Claude's discretion for styling, but must be visible (not hidden behind a flag).

```typescript
// State addition
const [apiError, setApiError] = useState<string | null>(null);

// Error banner (Tailwind, consistent with existing style)
{apiError && (
  <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-center justify-between">
    <p className="text-sm text-red-700">{apiError}</p>
    <button
      type="button"
      onClick={handleRetry}
      className="text-sm font-medium text-red-700 underline ml-3"
    >
      {t('retry')}
    </button>
  </div>
)}
```

**i18n:** The retry button label needs a translation key. Check existing `messages/` files to see what keys exist. If `retry` is missing, add it to both `en.json` and `vi.json`.

**CONFIDENCE:** HIGH — source code directly inspected; error banner pattern is standard React.

---

### FIX-08: Async readFile Verification

**Current state — already FIXED in route.ts:**
```typescript
// app/api/recommend/route.ts line 2 — already async
import { readFile } from 'fs/promises';
// ...
const raw = await readFile(filePath, 'utf-8');  // line 84
```

The CONTEXT.md notes: "FIX-08 async readFile already done in Phase 8". Verify no other API routes or scripts use `readFileSync` in production paths:

- `scripts/generate-static-json.ts` — scripts are build-time, not request-path, so `readFileSync` is acceptable there
- `app/api/` routes — must all use async `readFile`
- `lib/` — check for any synchronous file I/O in request handlers

**CONFIDENCE:** HIGH — route.ts directly inspected; Phase 8 already resolved the main instance.

---

## Standard Stack

### Core (all pre-existing — no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | 19.2.3 | Component rendering | Project baseline |
| Tailwind CSS | v4 | Styling error banner | Already used everywhere |
| next-intl | 4.8.3 | i18n for error/retry text | Already used for all UI strings |
| TypeScript | ^5 | Type fixes (FIX-04) | Project baseline |
| Vitest | ^4.1.0 | Test framework | Already configured |

### No New Dependencies
All fixes are in-place code corrections. No new packages are required.

## Architecture Patterns

### Recommended Project Structure Changes
```
lib/
├── recommend/
│   ├── delta.ts         # NEW: shared computeDelta() utility (FIX-01)
│   ├── engine.ts        # MODIFY: add NaN filter (FIX-03)
│   └── types.ts         # MODIFY: scraped_at: Date | null (FIX-04)
├── db/
│   └── timeout.ts       # MODIFY: add clearTimeout (FIX-05)
components/
├── ResultsList.tsx       # MODIFY: use computeDelta(), fix trend colors (FIX-01, FIX-02)
├── NguyenVongList.tsx    # MODIFY: use computeDelta() (FIX-01)
└── ScoreForm.tsx         # MODIFY: add error state, replace silent catches (FIX-07)
messages/                 # MODIFY: add retry key if missing (FIX-07)
```

### Pattern 1: Shared Utility for Delta Computation
**What:** Extract delta computation to `lib/recommend/delta.ts` — a pure function with no side effects.
**When to use:** When the same calculation is needed in multiple components.
**Why:** STATE.md decision mandates a shared `computeDelta()` utility — this prevents the two components from diverging again.

### Pattern 2: Error State Co-located with Fetch Logic
**What:** Place `apiError` state and `setApiError` calls adjacent to the fetch calls that can fail.
**When to use:** FIX-07 error banner in `ScoreForm.tsx`.
**Why:** Retry logic must reference the same parameters as the original call; co-location makes this natural.

### Pattern 3: `.finally()` for Resource Cleanup
**What:** Chain `.finally(() => clearTimeout(timerId))` on `Promise.race()`.
**When to use:** Any `Promise.race()` involving a timeout-based reject.
**Why:** Fires on both resolution and rejection, ensuring no timer leak regardless of outcome.

### Anti-Patterns to Avoid
- **Silent catch blocks:** `catch(() => {})` hides errors from users and developers. Every catch must either surface an error to the user or re-throw.
- **Inline delta computation in JSX:** Computing `cutoff - userScore` directly in a render function creates inconsistency risk. Use `computeDelta()`.
- **`parseFloat()` without null guard on nullable DB columns:** `score` is nullable in the schema. Always guard before arithmetic.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Amber color for warning state | Custom CSS color | `text-amber-600` (Tailwind) | Already in design system; consistent with other warning states |
| i18n for retry button | Hardcoded English string | `t('retry')` via next-intl | Existing i18n infrastructure; Vietnamese users need Vietnamese text |
| Error boundary component | Wrapper HOC | React `useState` + conditional render | For inline fetch errors, state is simpler than error boundaries (which catch render errors, not fetch errors) |

**Key insight:** Every bug in this phase is a one-to-five-line fix. Resist adding abstraction layers or utility libraries — the complexity of the bugs is social (wrong formula, wrong color meaning), not technical.

## Common Pitfalls

### Pitfall 1: Fixing Delta Sign in Only One Component
**What goes wrong:** ResultsList is fixed but NguyenVongList is not (or vice versa), so students see contradictory delta values across the two lists.
**Why it happens:** The components are rendered separately; a reviewer might miss one.
**How to avoid:** The shared `computeDelta()` utility from STATE.md enforces consistency — if both components import and call it, both are fixed atomically.
**Warning signs:** Tests for NguyenVongList and ResultsList must both assert the same sign convention.

### Pitfall 2: NaN Guard After Instead of Before Weighted Average
**What goes wrong:** Filtering `NaN` from the final `weightedCutoff` result (e.g., `if (isNaN(weightedCutoff)) continue`) instead of filtering the input rows.
**Why it happens:** It seems equivalent, but filtering inputs is semantically correct — a null score means "no data for that year", so the weight for that year should be omitted, not included as zero.
**How to avoid:** Filter `validRows` before building `scores` and `weights` arrays.
**Warning signs:** Test case: `[{score: '25.00', year: 2023}, {score: null, year: 2024}]` — the weighted cutoff should use only 2023 data (weight [1]), not average in a zero.

### Pitfall 3: CutoffDataRow Type Change Breaks StalenessIndicator
**What goes wrong:** Changing `scraped_at` from `string | null` to `Date | null` causes a TypeScript error in `StalenessIndicator` if it calls `new Date(scraped_at)` (double-wrapping) or passes it to a string-expecting function.
**Why it happens:** The type change propagates through `RecommendResult` to the component props.
**How to avoid:** Read `StalenessIndicator.tsx` before implementing. Update its prop type and internal usage simultaneously with the type change.
**Warning signs:** `tsc --noEmit` will surface the cascade immediately.

### Pitfall 4: Missing i18n Key for Retry Button
**What goes wrong:** Error banner renders `"retry"` (the key) instead of "Thử lại" / "Retry" because the key is absent from translation files.
**Why it happens:** New UI strings need new translation keys; the linter won't catch missing i18n keys at build time.
**How to avoid:** Add `retry` key to both `messages/vi.json` and `messages/en.json` before the component renders it.
**Warning signs:** The component renders the raw key string instead of translated text.

### Pitfall 5: Retry Button Doesn't Actually Retry
**What goes wrong:** The retry button exists in the DOM but clicking it does nothing (no handler, or handler doesn't re-trigger the fetch).
**Why it happens:** The retry logic must call the same fetch function that originally failed, with the same parameters.
**How to avoid:** Extract the fetch logic into a named function (e.g., `fetchRecommendations()`) that both the form submit and the retry button call.

## Code Examples

### Verified Patterns From Source

#### computeDelta utility (new file)
```typescript
// lib/recommend/delta.ts
// Source: derived from NguyenVongList.tsx line 52 (correct formula)
export function computeDelta(userScore: number, cutoff: number): string {
  const diff = userScore - cutoff;
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${diff.toFixed(1)}`;
}
```

#### ResultsList delta display (corrected)
```typescript
// Before (WRONG — ResultsList.tsx line 46):
const delta = (result.weighted_cutoff - userScore).toFixed(1);
const sign = result.weighted_cutoff >= userScore ? '+' : '';

// After (CORRECT):
import { computeDelta } from '../lib/recommend/delta';
// ...
const deltaStr = computeDelta(userScore, result.weighted_cutoff);
// Renders: {deltaStr}
```

#### Trend color correction
```typescript
// Before (WRONG — ResultsList.tsx lines 14-18):
const TREND_DISPLAY = {
  rising:  { icon: '↑', color: 'text-green-600' },
  falling: { icon: '↓', color: 'text-red-600' },
  stable:  { icon: '–', color: 'text-gray-400' },
};

// After (CORRECT — student perspective):
const TREND_DISPLAY = {
  rising:  { icon: '↑', color: 'text-amber-600' },  // harder to get in
  falling: { icon: '↓', color: 'text-green-600' },  // easier to get in
  stable:  { icon: '–', color: 'text-gray-400' },
};
```

#### NaN guard in engine (engine.ts, around line 73-82)
```typescript
// After groupRows.sort and lastRows = groupRows.slice(-3):
const validRows = lastRows.filter(r => {
  const parsed = parseFloat(r.score ?? '');
  return !isNaN(parsed);
});
if (validRows.length === 0) continue;

const scores = validRows.map(r => parseFloat(r.score));
const yearsCount = validRows.length;
const weights = WEIGHTS[yearsCount] ?? [1];
const weightSum = weights.reduce((a, b) => a + b, 0);
const weightedCutoff = scores.reduce((acc, s, i) => acc + s * weights[i], 0) / weightSum;
```

#### withTimeout timer cleanup
```typescript
// lib/db/timeout.ts — fixed
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timerId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => reject(new Error('DB_TIMEOUT')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timerId!));
}
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.0 |
| Config file | vitest.config.mts |
| Quick run command | `npx vitest run tests/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FIX-01 | `computeDelta(25, 24)` returns `'+1.0'`; `computeDelta(23, 24)` returns `'-1.0'` | unit | `npx vitest run tests/recommend/delta.test.ts` | ❌ Wave 0 |
| FIX-01 | ResultsList renders `'+1.0'` when userScore=25, cutoff=24 | component | `npx vitest run tests/components/ResultsList.test.tsx` | ❌ Wave 0 |
| FIX-02 | Rising trend renders with `text-amber-600` class, not `text-green-600` | component | `npx vitest run tests/components/ResultsList.test.tsx` | ❌ Wave 0 |
| FIX-02 | Falling trend renders with `text-green-600` class | component | `npx vitest run tests/components/ResultsList.test.tsx` | ❌ Wave 0 |
| FIX-03 | Engine with `score: null` row produces no NaN in output | unit | `npx vitest run tests/api/recommend-engine.test.ts` | ✅ (extend) |
| FIX-03 | Engine with mix of valid + null scores excludes null from weighted avg | unit | `npx vitest run tests/api/recommend-engine.test.ts` | ✅ (extend) |
| FIX-04 | `CutoffDataRow.scraped_at` type is `Date \| null` — TypeScript compile check | type | `npx tsc --noEmit` | ✅ (type-level) |
| FIX-05 | `withTimeout` clears timer after resolution (no pending timer) | unit | `npx vitest run tests/api/helpers-timeout.test.ts` | ✅ (extend) |
| FIX-07 | Error banner appears when fetch fails | component | `npx vitest run tests/components/ScoreForm.test.tsx` | ✅ (extend) |
| FIX-07 | Retry button re-triggers fetch | component | `npx vitest run tests/components/ScoreForm.test.tsx` | ✅ (extend) |
| FIX-08 | No `readFileSync` in `app/api/` routes | static grep | `grep -r "readFileSync" app/api/` | N/A (manual verify) |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/api/recommend-engine.test.ts tests/api/helpers-timeout.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/recommend/delta.test.ts` — covers FIX-01 computeDelta utility
- [ ] `tests/components/ResultsList.test.tsx` — covers FIX-01 display + FIX-02 trend colors

*(Existing `tests/api/recommend-engine.test.ts`, `tests/api/helpers-timeout.test.ts`, and `tests/components/ScoreForm.test.tsx` need new test cases added, not new files.)*

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `cutoff - userScore` in ResultsList | `userScore - cutoff` via computeDelta | Phase 11 | Positive delta now means student is above cutoff (correct) |
| green for rising cutoff | amber for rising cutoff | Phase 11 | Color conveys correct student-perspective meaning |
| No null guard on score | Filter null rows before weighted avg | Phase 11 | No NaN in recommendation output |

## Open Questions

1. **StalenessIndicator prop type**
   - What we know: `StalenessIndicator` receives `scrapedAt` from `ResultsList`. The current `RecommendResult.scraped_at` is `string | null`.
   - What's unclear: Whether `StalenessIndicator` internally calls `new Date(scrapedAt)` (in which case changing to `Date | null` means removing that wrapper) or expects a string.
   - Recommendation: Read `StalenessIndicator.tsx` before implementing FIX-04. The fix requires updating both the type definition and any component that renders the field.

2. **i18n key for retry**
   - What we know: `next-intl` is used for all UI strings; `messages/vi.json` and `messages/en.json` are the translation files.
   - What's unclear: Whether a `retry` key already exists in the translation files.
   - Recommendation: Check `messages/` files before implementing FIX-07. If absent, add `"retry": "Thử lại"` (Vietnamese) and `"retry": "Retry"` (English).

3. **FIX-08 scope verification**
   - What we know: `app/api/recommend/route.ts` already uses async `readFile` (Phase 8 completed this).
   - What's unclear: Whether any other API routes or `lib/` files use `readFileSync` in request paths.
   - Recommendation: Run `grep -r "readFileSync" app/ lib/` before marking FIX-08 complete. If nothing found, this is a no-op verification task.

## Sources

### Primary (HIGH confidence)
- Direct source inspection: `/components/ResultsList.tsx` — delta formula inversion confirmed (line 46)
- Direct source inspection: `/components/NguyenVongList.tsx` — correct formula confirmed (line 52)
- Direct source inspection: `/lib/recommend/engine.ts` — `parseFloat(r.score)` with no null guard (line 78)
- Direct source inspection: `/lib/recommend/types.ts` — `scraped_at: string | null` type mismatch (line 16)
- Direct source inspection: `/lib/db/schema.ts` — `timestamp` type confirms Drizzle returns `Date` (line 49)
- Direct source inspection: `/lib/db/timeout.ts` — timer handle not captured, no clearTimeout (lines 1-6)
- Direct source inspection: `/components/ScoreForm.tsx` — three silent catch blocks (lines 35, 72-74, 88)
- Direct source inspection: `/app/api/recommend/route.ts` — already uses async `readFile` (lines 2, 84)
- Direct source inspection: `/vitest.config.mts` — Vitest + @vitejs/plugin-react setup

### Secondary (MEDIUM confidence)
- Drizzle ORM documentation: `timestamp` columns return JavaScript `Date` objects in TypeScript — standard Drizzle behavior
- MDN: `parseFloat(null)` returns `NaN` — JavaScript specification

## Metadata

**Confidence breakdown:**
- Bug identification: HIGH — all bugs confirmed by direct source inspection
- Fix approach: HIGH — each fix is a small, well-scoped change with known correct behavior
- Test gaps: HIGH — existing test files identified; new test cases specified
- Downstream type cascade (FIX-04): MEDIUM — StalenessIndicator prop type not yet inspected

**Research date:** 2026-03-18
**Valid until:** Stable — these are in-place fixes, not ecosystem-dependent
