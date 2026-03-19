---
phase: 04-scraper-expansion
plan: "01"
subsystem: scraper
tags: [adapters, generator, registry, expansion]
dependency_graph:
  requires: []
  provides: [adapter-files-all-78, scrapers-registry-complete]
  affects: [scraper-execution, phase-04-sharding]
tech_stack:
  added: []
  patterns: [generator-script, semantic-text-anchors, idempotent-codegen]
key_files:
  created:
    - scripts/generate-adapters.ts
    - lib/scraper/adapters/qh.ts
    - lib/scraper/adapters/qhl.ts
    - lib/scraper/adapters/qhq.ts
    - lib/scraper/adapters/qhi.ts
    - lib/scraper/adapters/qhs.ts
    - lib/scraper/adapters/qht.ts
    - lib/scraper/adapters/qhx.ts
    - lib/scraper/adapters/qhe.ts
    - lib/scraper/adapters/qhf.ts
    - lib/scraper/adapters/qhj.ts
    - lib/scraper/adapters/qhy.ts
    - lib/scraper/adapters/nvh.ts
    - lib/scraper/adapters/tgc.ts
    - lib/scraper/adapters/hcp.ts
    - lib/scraper/adapters/bvh.ts
    - lib/scraper/adapters/hvd.ts
    - lib/scraper/adapters/hch.ts
    - lib/scraper/adapters/kma.ts
    - lib/scraper/adapters/hvm.ts
    - lib/scraper/adapters/nhh.ts
    - lib/scraper/adapters/hqt.ts
    - lib/scraper/adapters/hvn.ts
    - lib/scraper/adapters/hpn.ts
    - lib/scraper/adapters/hvq.ts
    - lib/scraper/adapters/htc.ts
    - lib/scraper/adapters/htn.ts
    - lib/scraper/adapters/hta.ts
    - lib/scraper/adapters/hyd.ts
    - lib/scraper/adapters/cmc.ts
    - lib/scraper/adapters/lda.ts
    - lib/scraper/adapters/gta.ts
    - lib/scraper/adapters/dcq.ts
    - lib/scraper/adapters/ccm.ts
    - lib/scraper/adapters/vhd.ts
    - lib/scraper/adapters/dkh.ts
    - lib/scraper/adapters/ddn.ts
    - lib/scraper/adapters/ddl.ts
    - lib/scraper/adapters/ddd.ts
    - lib/scraper/adapters/fpt.ts
    - lib/scraper/adapters/nhf.ts
    - lib/scraper/adapters/hbu.ts
    - lib/scraper/adapters/kcn.ts
    - lib/scraper/adapters/dqk.ts
    - lib/scraper/adapters/dkk.ts
    - lib/scraper/adapters/dks.ts
    - lib/scraper/adapters/kta.ts
    - lib/scraper/adapters/dlx.ts
    - lib/scraper/adapters/lnh.ts
    - lib/scraper/adapters/lph.ts
    - lib/scraper/adapters/mda.ts
    - lib/scraper/adapters/mhn.ts
    - lib/scraper/adapters/mtc.ts
    - lib/scraper/adapters/mth.ts
    - lib/scraper/adapters/ntu.ts
    - lib/scraper/adapters/dnv.ts
    - lib/scraper/adapters/pka.ts
    - lib/scraper/adapters/dpd.ts
    - lib/scraper/adapters/skd.ts
    - lib/scraper/adapters/sph.ts
    - lib/scraper/adapters/gnt.ts
    - lib/scraper/adapters/tdh.ts
    - lib/scraper/adapters/fbu.ts
    - lib/scraper/adapters/dmt.ts
    - lib/scraper/adapters/dtl.ts
    - lib/scraper/adapters/tdd.ts
    - lib/scraper/adapters/hnm.ts
    - lib/scraper/adapters/tla.ts
    - lib/scraper/adapters/tma.ts
    - lib/scraper/adapters/vhh.ts
    - lib/scraper/adapters/xda.ts
    - lib/scraper/adapters/yhb.ts
    - lib/scraper/adapters/ytc.ts
  modified:
    - scrapers.json
decisions:
  - "Generator script approach chosen over hand-writing 72 near-identical adapter files — reduces error surface, re-runnable for future additions"
  - "UNIVERSITIES array embedded in generator (not read from DB/JSON) — keeps generator self-contained and executable without DB access"
  - "Adapters include Vietnamese diacritic text anchors in addition to ASCII variants — increases resilience against encoding variations in university HTML"
metrics:
  duration: 3min
  completed_date: "2026-03-18"
  tasks_completed: 2
  files_created: 73
requirements_completed: [PIPE-04]
---

# Phase 4 Plan 01: Adapter Generator and Full Registry Summary

Generator-driven expansion from 6 to 78 university adapters using a typed data table and idempotent codegen script.

## What Was Built

### Task 1: Adapter Generator Script (scripts/generate-adapters.ts)

A tsx-executable generator that reads a typed `UNIVERSITIES` array (78 entries mirroring the seed migration) and writes adapter files for any university not already hand-crafted. Key properties:

- Idempotent: skips files that already exist (safe to re-run after adding new universities)
- Skip list: `MINISTRY, BKA, KHA, NTH, GHA, DCN` (6 hand-crafted adapters preserved)
- Generated 72 files in one run, wrote 0 on re-run
- Each generated adapter follows the exact bka.ts structural pattern:
  - Cheerio HTML parsing
  - Semantic text anchors to locate cutoff tables (not positional CSS)
  - Minimum-rows assertion throwing on 0 rows (silent failure prevention)
  - Exports named const `{id.toLowerCase()}Adapter: ScraperAdapter`

### Task 2: scrapers.json Complete Registry

Updated scrapers.json from 6 to 78 entries:

- Preserved existing 6 entries (MINISTRY, BKA, KHA, NTH, GHA, DCN) with all original values unchanged
- Added 72 new entries ordered alphabetically by id after the original 6
- Every entry: `static_verified: false` (safety gate — no adapter runs until manually audited)
- Every `adapter` field matches a `.ts` file in `lib/scraper/adapters/`

## Files Created

- 1 generator script: `scripts/generate-adapters.ts`
- 72 new adapter files under `lib/scraper/adapters/`
- 1 updated registry: `scrapers.json` (6 → 78 entries)

Total: 73 files created/modified

## Verification Results

| Check | Result |
|-------|--------|
| `lib/scraper/adapters/*.ts` count | 78 |
| `scrapers.json` entry count | 78 |
| Enabled adapters (`static_verified: true`) | 0 |
| TypeScript compile (`tsc --noEmit`) | Clean (no errors) |
| Generator idempotency (second run) | 0 written, 77 skipped |

## Deviations from Plan

None — plan executed exactly as written.

The generator template in the plan included Vietnamese diacritics in the text anchor search patterns (e.g., `h.includes('Điểm chuẩn')`, `h.includes('Tổ hợp')`, `h.includes('Ngành')`). These were included in the generated adapters alongside the ASCII variants already present in bka.ts, making the adapters more resilient to encoding variations in university HTML without changing the structural pattern.

## Self-Check

## Self-Check: PASSED

- scripts/generate-adapters.ts: FOUND
- scrapers.json: FOUND
- lib/scraper/adapters/qh.ts (sample generated adapter): FOUND
- Commit 5c4ec95 (generator + 72 adapters): FOUND
- Commit 91484ea (scrapers.json): FOUND
