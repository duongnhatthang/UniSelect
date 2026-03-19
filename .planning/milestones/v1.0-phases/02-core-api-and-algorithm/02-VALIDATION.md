---
phase: 2
slug: core-api-and-algorithm
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | `vitest.config.mts` |
| **Quick run command** | `npx vitest run tests/api/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/api/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | SCOR-01 | unit | `npx vitest run tests/api/recommend.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | SCOR-01 | unit | `npx vitest run tests/api/recommend.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | SRCH-01 | unit | `npx vitest run tests/api/universities.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 2 | SRCH-02 | unit | `npx vitest run tests/api/scores.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 2 | NGVG-01 | unit | `npx vitest run tests/api/` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 3 | INFRA-01 | integration | `npx vitest run tests/api/` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/api/recommend.test.ts` — stubs for recommendation algorithm (SCOR-01, NGVG-01)
- [ ] `tests/api/universities.test.ts` — stubs for /api/universities and /api/universities/[id]
- [ ] `tests/api/scores.test.ts` — stubs for /api/scores endpoint
- [ ] `tests/api/tohop.test.ts` — stubs for /api/tohop endpoint
- [ ] `tests/api/years.test.ts` — stubs for /api/years endpoint

*Existing infrastructure (Vitest) covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Edge cache returns in <200ms on repeat requests | SC3 | Requires Vercel CDN; cannot test locally | Deploy to Vercel, curl endpoint twice, compare response times |
| PgBouncer does not exhaust connections under concurrent requests | SC4 | Requires live Supabase + load testing | Run `npx vitest run` concurrently 10x, verify no connection errors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
