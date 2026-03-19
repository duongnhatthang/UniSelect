# Phase 11: Bug Fixes & Data Correctness - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix all known data correctness bugs atomically: delta sign convention, trend colors, NaN propagation, type safety, timer leak, async I/O, and error UI. All changes are precisely specified in REQUIREMENTS.md.

</domain>

<decisions>
## Implementation Decisions

### Delta Signs (FIX-01)
- Delta = userScore - cutoff everywhere (both ResultsList and NguyenVongList)
- Positive delta = student is above cutoff (good)
- Must use a shared `computeDelta()` utility per STATE.md decision

### Trend Colors (FIX-02)
- Rising cutoff = amber/warning (bad for student — harder to get in)
- Falling cutoff = green/favorable (good for student — easier to get in)

### NaN Filtering (FIX-03)
- Filter out null/unparseable scores BEFORE computing weighted averages
- No NaN values in recommendation output

### Error UI (FIX-07)
- Failed API calls show visible error banners with retry button
- Replace all silent `.catch(() => {})` patterns

### Claude's Discretion
- Specific component styling for error banners
- Timer cleanup implementation details (FIX-05)
- Type fix approach for CutoffDataRow (FIX-04)
- Async readFile migration approach (FIX-08)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/components/ResultsList.tsx` — current delta display
- `app/components/NguyenVongList.tsx` — current delta display
- `lib/recommend/engine.ts` — recommendation engine with score computation
- `lib/recommend/types.ts` — CutoffDataRow type definition
- `lib/db/timeout.ts` — withTimeout utility with timer leak
- `app/api/recommend/route.ts` — API route (FIX-08 async readFile already done in Phase 8)

### Established Patterns
- Tailwind CSS for styling
- next-intl for i18n (Vietnamese/English)
- nuqs for URL state management

### Integration Points
- ResultsList and NguyenVongList both display delta/trend
- recommend engine feeds both components
- Error UI needs to work with existing page layout

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond REQUIREMENTS.md specifications.

</specifics>

<deferred>
## Deferred Ideas

None — all bugs are in scope.

</deferred>
