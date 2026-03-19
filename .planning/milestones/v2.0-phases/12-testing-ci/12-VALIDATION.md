---
phase: 12
slug: testing-ci
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 12 — Validation Strategy

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
| 12-01-01 | 01 | 1 | TEST-01 | unit | `npx vitest run tests/recommend/engine-edge-cases.test.ts` | ❌ W0 | ⬜ pending |
| 12-02-01 | 02 | 1 | TEST-02 | structural | `ls .github/workflows/ci.yml` | ❌ W0 | ⬜ pending |
| 12-02-02 | 02 | 1 | TEST-03, TEST-04 | structural | `test ! -d src/ && grep sw.js .gitignore` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/recommend/engine-edge-cases.test.ts` — covers TEST-01 edge cases
- [ ] `.github/workflows/ci.yml` — PR CI workflow
- [ ] `package.json` `test` script must exist

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CI workflow triggers on PR and passes | TEST-02 | Requires GitHub Actions | Open a test PR, verify checks run |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
