# Phase 6: Tech Debt Cleanup - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Clean up accumulated tech debt items from the v1.0 milestone audit. Four specific fixes: ScoreForm dropdown labels, orphaned API routes, package.json script registration, and SUMMARY frontmatter correction.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure/cleanup phase. The four success criteria are fully specified in the ROADMAP.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/db/schema.ts` — tohopCodes table already has `label_vi` column defined
- `components/ScoreForm.tsx` — line 138 currently shows `{tc.code} ({tc.subjects.join(', ')})`, needs to use `label_vi`
- `lib/utils/tohop-subjects.ts` — TohopCode type definition

### Established Patterns
- API routes in `app/api/` directory (Next.js App Router)
- Scripts use `tsx` for TypeScript execution
- package.json scripts pattern: `"script-name": "tsx scripts/script-file.ts"`

### Integration Points
- `app/api/scores/route.ts` — orphaned route to remove
- `app/api/years/route.ts` — orphaned route to remove (also has test file)
- `scripts/check-staleness.ts` — exists but not registered in package.json scripts
- `.planning/phases/04-scraper-expansion/04-01-SUMMARY.md` and `04-02-SUMMARY.md` — need PIPE-04 in requirements_completed

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase with well-defined success criteria from ROADMAP.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---
*Phase: 06-tech-debt-cleanup*
*Context gathered: 2026-03-18 via Smart Discuss (infrastructure skip)*
