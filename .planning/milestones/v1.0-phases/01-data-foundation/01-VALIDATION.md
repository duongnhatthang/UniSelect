---
phase: 1
slug: data-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.x |
| **Config file** | `vitest.config.mts` (Wave 0 — does not exist yet) |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/scraper/normalizer.test.ts` (normalizer is core validation logic)
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite green + `npx next build` passes
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-02-xx | 02 | 0 | PIPE-02 | unit (mock HTML) | `npx vitest run tests/scraper/adapters/bka.test.ts` | W0 | pending |
| 1-02-xx | 02 | 0 | PIPE-02 | unit (mock DB) | `npx vitest run tests/scraper/runner.test.ts` | W0 | pending |
| 1-02-xx | 02 | 0 | PIPE-02 | smoke | `npx yaml-lint .github/workflows/scrape-low.yml` | W0 | pending |
| 1-03-xx | 03 | 0 | PIPE-03 | unit | `npx vitest run tests/scraper/normalizer.test.ts` | W0 | pending |
| 1-04-xx | 04 | 0 | INFRA-01 | smoke | `npx next build` | W0 | pending |
| 1-04-xx | 04 | — | INFRA-01 | smoke (manual) | `curl -s -o /dev/null -w "%{http_code}" $VERCEL_URL` | Manual | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.mts` — framework config; install vitest + @vitejs/plugin-react + vite-tsconfig-paths
- [ ] `tests/scraper/normalizer.test.ts` — covers PIPE-03 normalization and rejection logic
- [ ] `tests/scraper/runner.test.ts` — covers PIPE-02 fail-open behavior and scrape_run logging
- [ ] `tests/scraper/adapters/bka.test.ts` — covers PIPE-02 adapter behavioral contract (mock fetch with sample HTML fixture, asserts non-empty RawRow[] with expected field shapes)
- [ ] `tests/scraper/adapters/adapter-contract.test.ts` — covers PIPE-02 adapter shape contract (id: string, scrape: function)

---

## Deferred DB Integration Tests

The following tests were originally planned for Wave 0 but are deferred to manual verification in Plan 01-03 Task 3 (checkpoint:human-verify). They require a live Supabase connection which is not available during CI or automated test runs in Phase 1:

| Deferred Test | Requirement | Reason for Deferral | Manual Verification |
|---------------|-------------|---------------------|---------------------|
| `tests/db/seed.test.ts` — PIPE-01: DB seeded with 78+ rows | PIPE-01 | Requires live Supabase DB connection; no test DB provisioning in Phase 1 | Run migration SQL in Supabase SQL Editor, then `SELECT count(*) FROM universities` — expect 78+ |
| `tests/db/upsert.test.ts` — PIPE-03: upsert idempotency | PIPE-03 | Requires live Supabase DB connection; runner upsert logic is unit-tested via mock in runner.test.ts | After first scrape run, re-run scraper and verify `SELECT count(*) FROM cutoff_scores` does not double |

These tests may be created in Phase 2 when a test database provisioning pattern is established, or if a Supabase local development setup (supabase CLI) is introduced.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Vercel deployment responds 200 on `/` | INFRA-01 | Requires live Vercel URL after deploy | `curl -s -o /dev/null -w "%{http_code}" $VERCEL_URL` — expect 200 |
| Ministry portal cutoff URL works | PIPE-02 | URL path changes each cycle; requires browser audit | Open portal, navigate to cutoff page, confirm structured data is accessible for 2025/2026 cycle |
| DB seeded with 78+ university rows | PIPE-01 | Requires live Supabase connection | Run migration in SQL Editor, then `SELECT count(*) FROM universities` — expect 78+ |
| Upsert idempotency | PIPE-03 | Requires live Supabase connection | Run scraper twice, verify row count does not double |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
