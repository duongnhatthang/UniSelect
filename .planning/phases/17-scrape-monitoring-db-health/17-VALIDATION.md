---
phase: 17
slug: scrape-monitoring-db-health
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 17 — Validation Strategy

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
| 17-01-01 | 01 | 1 | MON-01 | unit | `npx vitest run tests/api/scrape-status.test.ts` | ❌ W0 | ⬜ pending |
| 17-01-02 | 01 | 1 | MON-02 | script | `grep "DELETE FROM" scripts/keepalive.mjs` | ✅ | ⬜ pending |
| 17-01-03 | 01 | 1 | MON-03 | unit | `npx vitest run tests/scraper/runner.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/api/scrape-status.test.ts` — tests for scrape status API endpoint

*Existing vitest infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| API returns live DB data | MON-01 | Requires live Supabase | `curl /api/admin/scrape-status` |
| Pruning deletes old rows | MON-02 | Requires live DB with old data | Run keepalive, check row count |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
