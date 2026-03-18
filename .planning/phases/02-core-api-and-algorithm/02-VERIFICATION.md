---
phase: 02-core-api-and-algorithm
verified: 2026-03-18T00:00:00Z
status: passed
score: 13/13 must-haves verified
re_verification: false
---

# Phase 2: Core API and Algorithm Verification Report

**Phase Goal:** All API endpoints are live, edge-cached, and the recommendation algorithm produces correct tiered results against real scraped data
**Verified:** 2026-03-18
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Recommendation engine computes correct weighted average from 1-3 years of cutoff data | VERIFIED | `lib/recommend/engine.ts` lines 14-18 define WEIGHTS {1:[1], 2:[1,2], 3:[1,2,3]}; lines 78-80 apply parseFloat + reduce with correct formula; 23 TDD tests confirm math |
| 2 | Engine classifies university-major pairs into dream/practical/safe tiers using locked margin thresholds | VERIFIED | `classifyTier()` in engine.ts lines 4-8 hard-codes DREAM_MARGIN=3, PRACTICAL_LOWER=-1, PRACTICAL_UPPER=2, SAFE_LOWER=-5, SAFE_UPPER=-2; tests cover all tier boundaries |
| 3 | Engine marks exactly top 15 results (or fewer if <15 qualify) with suggested_top_15 flag | VERIFIED | engine.ts lines 143-146: `for (let i = 0; i < results.length; i++) { results[i].suggested_top_15 = i < 15; }`; test 8 verifies exactly 15 marked from 20 |
| 4 | Engine flags data_years_limited=true when fewer than 3 years available | VERIFIED | engine.ts line 100: `data_years_limited: yearsCount < 3`; tests 2 and 3 explicitly assert true for 2-year and 1-year data |
| 5 | Engine excludes pairs with no cutoff score data | VERIFIED | engine.ts line 51: `if (rows.length === 0) return []`; also `if (tier === null) continue` on line 84 excludes below-safe pairs |
| 6 | DB timeout utility rejects after 10 seconds | VERIFIED | `lib/db/timeout.ts`: `Promise.race` with `setTimeout(() => reject(new Error('DB_TIMEOUT')), ms)`; all 6 route handlers call `withTimeout(..., 10_000)` |
| 7 | /api/universities returns cursor-paginated university list with next_cursor | VERIFIED | `lib/api/universities.ts` implements limit+1 fetch pattern, returns `meta.next_cursor`; route.ts wires it with `withTimeout` |
| 8 | /api/universities/[id] returns single university or 404 | VERIFIED | `app/api/universities/[id]/route.ts`: queries with `eq(universities.id, id).limit(1)`, returns `errorResponse('NOT_FOUND', ..., 404)` when `rows[0]` is falsy |
| 9 | /api/tohop returns all tohop codes with 24h edge cache header | VERIFIED | `app/api/tohop/route.ts` line 18: `'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600'` |
| 10 | /api/years returns distinct years with 24h edge cache header | VERIFIED | `app/api/years/route.ts`: `selectDistinct({ year })` + same s-maxage=86400 header |
| 11 | /api/scores returns cursor-paginated scores with 5min cache header | VERIFIED | `app/api/scores/route.ts` line 22: `'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60'`; `lib/api/scores.ts` implements cursor + multi-filter pagination |
| 12 | /api/recommend returns tiered results with suggested_top_15 flags for valid input | VERIFIED | route.ts lines 65-68: calls `recommend({ tohop_code, total_score }, rows as CutoffDataRow[])`; returns `{ data: results, meta: { count, years_available } }` |
| 13 | /api/recommend returns 400 for missing or invalid params | VERIFIED | route.ts lines 17-25: validates tohop with `/^[A-D]\d{2}$/` and score in `[10.0, 30.0]`; test file has 5 cases covering missing/invalid params |

**Score:** 13/13 truths verified

---

### Required Artifacts

#### Plan 02-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/recommend/types.ts` | Tier, RecommendInput, CutoffDataRow, RecommendResult types | VERIFIED | All 4 exports present; `score: string` correctly typed; 31 lines |
| `lib/recommend/engine.ts` | Pure recommendation algorithm, exports `recommend` | VERIFIED | 149 lines; substantive algorithm with grouping, weighting, tier logic, sort, and top-15 marking |
| `lib/api/helpers.ts` | Error response builder, exports `errorResponse` | VERIFIED | 11 lines; exports `errorResponse` with correct `{ error: { code, message } }` shape |
| `lib/db/timeout.ts` | Promise.race timeout wrapper, exports `withTimeout` | VERIFIED | 6 lines; `Promise.race` implementation; rejects with `Error('DB_TIMEOUT')` |
| `tests/api/recommend-engine.test.ts` | Algorithm unit tests, min 80 lines | VERIFIED | 354 lines; 23 test cases across 12 describe blocks |

#### Plan 02-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/api/tohop/route.ts` | GET /api/tohop endpoint | VERIFIED | 30 lines; exports GET; withTimeout wired; 24h cache set |
| `app/api/years/route.ts` | GET /api/years endpoint | VERIFIED | 36 lines; exports GET; selectDistinct; 24h cache set |
| `app/api/universities/route.ts` | GET /api/universities endpoint | VERIFIED | 27 lines; exports GET; delegates to getUniversities; 24h cache set |
| `app/api/universities/[id]/route.ts` | GET /api/universities/[id] endpoint | VERIFIED | 35 lines; exports GET; `params: Promise<{ id: string }>`; `await params` on line 12 |
| `app/api/scores/route.ts` | GET /api/scores endpoint | VERIFIED | 33 lines; exports GET; 5min cache set |
| `app/api/recommend/route.ts` | GET /api/recommend endpoint | VERIFIED | 85 lines; exports GET; full validation + anchor-year logic + engine wiring; no cache header |
| `lib/api/universities.ts` | University query logic with cursor pagination | VERIFIED | 20 lines; exports `getUniversities`; limit clamped to 200 |
| `lib/api/scores.ts` | Score query logic with cursor pagination | VERIFIED | 45 lines; exports `getScores`; dynamic WHERE conditions; limit clamped to 200; innerJoin across 3 tables |

---

### Key Link Verification

#### Plan 02-01 Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `lib/recommend/engine.ts` | `lib/recommend/types.ts` | import types | WIRED | Line 1: `import type { CutoffDataRow, RecommendInput, RecommendResult, Tier } from './types'` |
| `tests/api/recommend-engine.test.ts` | `lib/recommend/engine.ts` | import recommend function | WIRED | Line 2: `import { recommend } from '../../lib/recommend/engine'` |

#### Plan 02-02 Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/api/recommend/route.ts` | `lib/recommend/engine.ts` | import recommend | WIRED | Line 7: `import { recommend } from '../../../lib/recommend/engine'` |
| `app/api/recommend/route.ts` | `lib/db/timeout.ts` | import withTimeout | WIRED | Line 5: `import { withTimeout } from '../../../lib/db/timeout'` |
| `app/api/universities/route.ts` | `lib/api/universities.ts` | import getUniversities | WIRED | Line 2: `import { getUniversities } from '../../../lib/api/universities'` |
| `app/api/scores/route.ts` | `lib/api/scores.ts` | import getScores | WIRED | Line 2: `import { getScores } from '../../../lib/api/scores'` |
| `app/api/recommend/route.ts` | `lib/api/helpers.ts` | import errorResponse | WIRED | Line 6: `import { errorResponse } from '../../../lib/api/helpers'` |

All key links: WIRED. Relative imports used throughout (tsconfig `@/` alias maps to nonexistent `./src/*`; route files correctly use `../../../lib/...`).

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SCOR-01 | 02-01, 02-02 | User can select tổ hợp and enter a total score to see matched universities | PARTIAL — API layer complete | `/api/recommend` endpoint exists and produces tiered results; user-observable UI is Phase 3 |
| SCOR-02 | 02-01, 02-02 | User can enter individual subject scores; app calculates tổ hợp totals | PARTIAL — API layer complete | API infrastructure present; multi-subject calculation is Phase 3 frontend concern |
| NGVG-01 | 02-01, 02-02 | App generates tiered 15-choice nguyện vọng list | PARTIAL — API layer complete | Engine produces dream/practical/safe tiers with `suggested_top_15`; builder UI is Phase 3 |
| SRCH-01 | 02-02 | User can search universities by name (diacritic-aware) | PARTIAL — API layer complete | `/api/universities` with cursor pagination exists; diacritic-aware search in UI is Phase 3 |
| SRCH-02 | 02-02 | User can filter by tổ hợp code | PARTIAL — API layer complete | `/api/scores` accepts `tohop_code` filter; `/api/recommend` takes `tohop` param |

**Note on requirement traceability conflict:** REQUIREMENTS.md traceability table maps SCOR-01, SCOR-02, NGVG-01, SRCH-01, SRCH-02 entirely to Phase 3. However, Phase 2 plans correctly claim these IDs because Phase 2 delivers the API layer that Phase 3 consumes to satisfy them. The ROADMAP.md Phase 2 header explicitly states "(API layer enabling SCOR-01, SCOR-02, NGVG-01, SRCH-01, SRCH-02 — user-observable in Phase 3)". This is an intentional split: Phase 2 provides the backend contract; Phase 3 provides the user-observable fulfillment. The REQUIREMENTS.md traceability table reflects final observable delivery (Phase 3), not intermediate infrastructure delivery. No orphaned requirements.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | - |

Scanned all 13 created files for TODO/FIXME/HACK/PLACEHOLDER comments, empty implementations (`return null`, `return {}`, `return []`), and console-only handlers. No issues found. The two `return null` hits in engine.ts (line 25) and `return []` (line 51) are legitimate algorithm logic — not stubs.

---

### Human Verification Required

#### 1. Edge Cache Actually Applied at CDN

**Test:** Deploy to Vercel and issue two consecutive requests to `/api/tohop` or `/api/universities`. Inspect response headers in browser Network tab or `curl -I`.
**Expected:** Second request returns `X-Vercel-Cache: HIT` or equivalent CDN cache indicator; TTFB on repeat request is under 200ms.
**Why human:** Cannot verify CDN cache hits programmatically without a live deployment; `Cache-Control` headers are present in code but actual CDN behavior requires a real request through Vercel's edge network.

#### 2. Supabase Connection Pooling Under Concurrent Load

**Test:** Use a tool like `k6` or `ab` to send 20 concurrent requests to `/api/recommend` against a deployed instance connected to Supabase Supavisor (port 6543).
**Expected:** No connection exhaustion errors; all requests return 200 or 400 (no 503 from pool depletion); Supabase dashboard shows connections staying within free-tier limit.
**Why human:** ROADMAP Success Criterion 4 requires PgBouncer/Supavisor is configured and API does not exhaust connections under concurrency. This requires a live environment and load tool; code inspection only confirms `withTimeout` is wired but cannot verify actual pool behavior.

#### 3. Recommendation Results Against Real Scraped Data

**Test:** With real data in the database, call `/api/recommend?tohop=A00&score=25.0`. Inspect the response.
**Expected:** Results include recognizable Vietnamese universities with plausible weighted cutoff scores; tier assignments match manual calculation against known 2023-2025 cutoff data; `years_available` reflects actual data in DB.
**Why human:** Phase goal specifies "correct tiered results against real scraped data." Tests use mock DB data. Only a live DB query can confirm the algorithm produces sensible results with actual scraped cutoff scores.

---

### Gaps Summary

No gaps. All 13 must-haves verified at all three levels (exists, substantive, wired). All plan artifacts are present, non-stub, and correctly imported. All key links are wired. Three items are flagged for human verification because they require either a live deployment or live database data to confirm.

The one structural note is that the REQUIREMENTS.md traceability table attributes SCOR-01, SCOR-02, NGVG-01, SRCH-01, SRCH-02 to Phase 3 only, while Phase 2 PLANs claim them as well. This is consistent with ROADMAP.md's explicit framing and does not represent a gap — it is a documentation convention where the traceability table tracks final user-observable delivery rather than infrastructure delivery.

---

_Verified: 2026-03-18_
_Verifier: Claude (gsd-verifier)_
