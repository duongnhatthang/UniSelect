---
phase: 10
slug: auto-discovery-crawler
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 + MSW 2.x |
| **Config file** | `vitest.config.mts` |
| **Quick run command** | `npx vitest run tests/scraper/discovery/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/scraper/discovery/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | SCRP-04, SCRP-05 | integration | `npx vitest run tests/scraper/discovery/` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npm install crawlee` — not yet in package.json
- [ ] `lib/scraper/discover.ts` — crawler module
- [ ] `tests/scraper/discovery/discover.test.ts` — integration tests
- [ ] MSW handlers for fake university homepages with robots.txt

*Existing MSW infrastructure from Phase 9 covers HTTP interception.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Rate limiting respects 2-3s delay | SCRP-05 | Timing-sensitive test | Run crawler against 2+ pages on same domain, verify elapsed time |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
