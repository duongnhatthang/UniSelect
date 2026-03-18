---
phase: 3
slug: frontend-pwa
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | `vitest.config.mts` (node env); per-file `// @vitest-environment jsdom` for React component tests |
| **Quick run command** | `npx vitest run tests/components/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/components/` (or relevant test file)
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green + `next build --webpack` exits 0
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 0 | PIPE-05 | unit | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 0 | - | build | `npx next build --webpack` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | SCOR-01 | component | `npx vitest run tests/components/ScoreForm.test.tsx` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | SCOR-02 | component | `npx vitest run tests/components/ScoreForm.test.tsx` | ❌ W0 | ⬜ pending |
| 03-02-03 | 02 | 1 | NGVG-01 | component | `npx vitest run tests/components/NguyenVong.test.tsx` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | SRCH-01 | component | `npx vitest run tests/components/Search.test.tsx` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 2 | SRCH-02 | component | `npx vitest run tests/components/Search.test.tsx` | ❌ W0 | ⬜ pending |
| 03-03-03 | 03 | 2 | PIPE-05 | component | `npx vitest run tests/components/StalenessIndicator.test.tsx` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 3 | I18N-01 | unit | `npx vitest run tests/i18n/` | ❌ W0 | ⬜ pending |
| 03-04-02 | 04 | 3 | I18N-02 | unit | `npx vitest run tests/i18n/` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/components/ScoreForm.test.tsx` — stubs for SCOR-01, SCOR-02
- [ ] `tests/components/NguyenVong.test.tsx` — stubs for NGVG-01
- [ ] `tests/components/Search.test.tsx` — stubs for SRCH-01, SRCH-02
- [ ] `tests/components/StalenessIndicator.test.tsx` — stubs for PIPE-05
- [ ] `tests/i18n/translations.test.ts` — stubs for I18N-01, I18N-02
- [ ] `public/icon-192.png`, `public/icon-512.png` — required for valid PWA manifest
- [ ] API extension: `/api/recommend` returns `scraped_at` + `source_url` per row

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| App installable as PWA | SC7 | Requires browser Install prompt; cannot automate | Open in Chrome, check "Install app" in address bar |
| Offline loads cached data | SC7 | Requires service worker + network throttle | Chrome DevTools → Network → Offline; reload app |
| Vietnamese text renders correctly | I18N-01 | Font rendering is visual | Open app in browser, verify diacritics display correctly |
| nuqs URL sharing works end-to-end | SC3 | Requires live browser navigation | Encode nguyện vọng list, copy URL, open in new tab |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
