---
phase: 8
slug: scraper-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | `vitest.config.mts` |
| **Quick run command** | `npx vitest run tests/scraper/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/scraper/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | SCRP-03 | unit | `npx vitest run tests/scraper/runner.test.ts` | ✅ (add case) | ⬜ pending |
| 08-01-02 | 01 | 1 | SCRP-03 | unit | `npx vitest run tests/scraper/runner.test.ts` | ✅ (add case) | ⬜ pending |
| 08-02-01 | 02 | 1 | FIX-06 | unit | `npx vitest run tests/api/recommend.test.ts` | ❌ W0 | ⬜ pending |
| 08-03-01 | 03 | 2 | SCRP-02 | unit | `npx vitest run tests/scraper/runner.test.ts` | ✅ (add case) | ⬜ pending |
| 08-04-01 | 04 | 3 | SCRP-01 | unit | `npx vitest run tests/scraper/factory.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/scraper/factory.test.ts` — stubs for SCRP-01 factory output comparison
- [ ] `tests/api/recommend.test.ts` — stubs for FIX-06 fallback verification
- [ ] Update `tests/scraper/runner.test.ts` — add `db.transaction` mock + zero-rows test cases

*Existing infrastructure covers SCRP-02 and SCRP-03 test locations.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Factory adapter produces identical Supabase rows as original adapter | SCRP-01 | Requires live DB comparison | Run HTC via factory and original, compare row output |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
