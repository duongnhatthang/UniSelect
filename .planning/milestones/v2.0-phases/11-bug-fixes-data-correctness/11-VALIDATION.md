---
phase: 11
slug: bug-fixes-data-correctness
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | `vitest.config.mts` |
| **Quick run command** | `npx vitest run tests/recommend/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | FIX-01 | unit | `npx vitest run tests/recommend/` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | FIX-02 | unit | `npx vitest run tests/recommend/` | ❌ W0 | ⬜ pending |
| 11-01-03 | 01 | 1 | FIX-03 | unit | `npx vitest run tests/recommend/` | ✅ (add case) | ⬜ pending |
| 11-02-01 | 02 | 1 | FIX-04, FIX-05 | unit | `npx vitest run` | ✅ (add case) | ⬜ pending |
| 11-02-02 | 02 | 1 | FIX-07, FIX-08 | visual | browser check | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `lib/recommend/delta.ts` — shared computeDelta utility
- [ ] Update tests for delta sign and trend color verification

*Existing test infrastructure covers engine tests.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Error banner with retry button visible on API failure | FIX-07 | Visual UI component | Disconnect DB, submit score form, verify banner appears |
| Trend colors correct (amber for rising) | FIX-02 | Visual verification | Compare year-over-year cutoff display colors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
