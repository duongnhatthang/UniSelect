---
phase: 9
slug: scraper-resilience-testing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 + MSW 2.x |
| **Config file** | `vitest.config.mts` |
| **Quick run command** | `npx vitest run tests/scraper/integration/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/scraper/integration/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | SCRP-07 | unit | `npx vitest run tests/scraper/integration/` | ❌ W0 | ⬜ pending |
| 09-01-02 | 01 | 1 | SCRP-06 | integration | `npx vitest run tests/scraper/integration/` | ❌ W0 | ⬜ pending |
| 09-02-01 | 02 | 2 | SCRP-08 | smoke (GHA) | `python3 scripts/ocr_table.py tests/fixtures/ocr-smoke.jpg /tmp/out.json` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npm install --save-dev msw` — MSW not yet in package.json
- [ ] `tests/fixtures/*.ts` — 7 HTML fixture files
- [ ] `tests/fixtures/ocr-smoke.jpg` — tiny test image
- [ ] `tests/scraper/integration/msw-server.ts` — MSW server setup
- [ ] `tests/scraper/integration/cheerio-integration.test.ts` — integration test suite
- [ ] `.github/workflows/ci-ocr.yml` — PaddleOCR CI workflow

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PaddleOCR CI workflow passes on GHA | SCRP-08 | Requires GitHub Actions runner | Push workflow, check Actions tab for green run |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
