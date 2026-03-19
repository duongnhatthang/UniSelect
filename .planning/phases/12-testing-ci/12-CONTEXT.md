# Phase 12: Testing & CI - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Add recommendation engine edge-case tests, create GitHub Actions CI workflow for PRs, remove dead src/ directory, and add public/sw.js to .gitignore.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure/testing phase.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/recommend/engine.ts` — recommendation engine to test
- `lib/recommend/types.ts` — CutoffDataRow, RecommendResult types
- `tests/` — existing Vitest test suite (492+ tests)
- `.github/workflows/` — existing scraping and OCR workflows

### Established Patterns
- Vitest 4.1.0 for testing
- GitHub Actions for CI/CD
- MSW for HTTP interception in tests

### Integration Points
- CI workflow needs to run `npm test` and `npm run build`
- src/ directory is unused Next.js scaffold (dead code)
- public/sw.js is a Serwist build artifact

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>
