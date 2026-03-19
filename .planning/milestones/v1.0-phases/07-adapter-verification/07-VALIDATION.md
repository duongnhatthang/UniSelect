---
phase: 7
slug: adapter-verification
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | PIPE-01, PIPE-02 | integration | `npx vitest run tests/scraper/` | ✅ | ⬜ pending |
| 07-01-02 | 01 | 1 | PIPE-03 | manual | Web fetch verification | N/A | ⬜ pending |
| 07-01-03 | 01 | 1 | INFRA-02 | manual | Run generate-static, check output | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Vitest already configured with scraper contract tests.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| URL verification against live sites | PIPE-01 | External HTTP requests to university sites | Fetch each URL, verify 200 status + HTML score tables |
| Scraper writes to DB | PIPE-02, PIPE-03 | Requires live Supabase connection | Run scraper with DATABASE_URL, check rows inserted |
| Static JSON contains real data | INFRA-02 | Requires DB with scraped data | Run generate-static, check scores-by-tohop.json has entries |
| Playwright adapter works | PIPE-02 | Requires headless browser | Run adapter against JS-rendered page, verify rows returned |
| PaddleOCR prototype works | PIPE-02 | Requires Python + OCR setup | Run OCR script against score image, verify extracted text |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
