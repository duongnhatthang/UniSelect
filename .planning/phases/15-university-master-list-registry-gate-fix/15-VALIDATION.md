---
phase: 15
slug: university-master-list-registry-gate-fix
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 15 — Validation Strategy

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
| 15-01-01 | 01 | 1 | UNIC-01, UNIC-02, UNIC-03 | file check | `test -f data/uni_list.json && node -e "const d=require('./data/uni_list.json');console.log(d.length)"` | ❌ W0 | ⬜ pending |
| 15-02-01 | 02 | 1 | SCRP-09 | unit | `npx vitest run tests/scraper/registry.test.ts` | ❌ W0 | ⬜ pending |
| 15-02-02 | 02 | 1 | SCRP-10 | integration | `grep -c scrape_url scrapers.json` | ❌ W0 | ⬜ pending |
| 15-03-01 | 03 | 2 | UNIC-01 | script | `npx tsx scripts/seed-universities.ts --dry-run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/scraper/registry.test.ts` — tests for new scrape_url gate logic
- [ ] `data/uni_list.json` — university master list (primary deliverable)

*Existing vitest infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Supabase row count after seed | UNIC-01 | Requires live DB | Run seed script, check universities table count |
| Daily cron scrapes verified adapters | SCRP-10 | Requires GHA run | Trigger workflow_dispatch, check scrape_runs table |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
