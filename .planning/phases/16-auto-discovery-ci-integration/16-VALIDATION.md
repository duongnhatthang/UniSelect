---
phase: 16
slug: auto-discovery-ci-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | DISC-01 | file check | `test -f .github/workflows/discover.yml` | ❌ W0 | ⬜ pending |
| 16-01-02 | 01 | 1 | DISC-01 | unit | `npx vitest run tests/scraper/discovery/` | ❌ W0 | ⬜ pending |
| 16-02-01 | 02 | 1 | DISC-02, DISC-03 | unit | `npx vitest run tests/scraper/apply-discovery.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/scraper/apply-discovery.test.ts` — tests for apply-discovery script
- [ ] `.github/workflows/discover.yml` — workflow file (primary deliverable)

*Existing vitest infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GHA workflow triggers on dispatch | DISC-01 | Requires GitHub Actions | Trigger workflow_dispatch, verify run appears |
| Artifact downloadable from run | DISC-02 | Requires GHA run | Check Actions tab for discovery-candidates.json artifact |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
