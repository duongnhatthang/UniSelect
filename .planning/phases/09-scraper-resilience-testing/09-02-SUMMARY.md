---
phase: 09-scraper-resilience-testing
plan: 02
subsystem: infra
tags: [paddleocr, github-actions, ci, ocr, pillow, python]

# Dependency graph
requires:
  - phase: 09-scraper-resilience-testing-01
    provides: scripts/ocr_table.py — the OCR script this CI workflow tests
provides:
  - GHA ci-ocr.yml workflow with PaddleOCR 3.x model caching via ~/.paddlex
  - Synthetic Vietnamese text image generator (Pillow) for CI testing without binary fixtures
affects:
  - 09-scraper-resilience-testing
  - Any future changes to scripts/ocr_table.py

# Tech tracking
tech-stack:
  added: [Pillow (already used), PaddleOCR (existing), actions/cache@v4, PADDLE_PDX_MODEL_SOURCE=BOS]
  patterns: [Cache PaddleOCR 3.x models at ~/.paddlex with hashFiles key, generate synthetic test images in CI via Python rather than committing binary fixtures]

key-files:
  created:
    - .github/workflows/ci-ocr.yml
    - tests/fixtures/ocr-smoke-generator.py
  modified: []

key-decisions:
  - "Cache key uses hashFiles('scripts/ocr_table.py') so model cache invalidates when the OCR script changes, ensuring model version stays consistent with the script"
  - "PADDLE_PDX_MODEL_SOURCE=BOS set at job level (not just warm-up step) to prevent remote model check after cache restore on any step"
  - "Synthetic image uses ASCII-safe Vietnamese text (no diacritics) to avoid font availability issues across Ubuntu runners while still exercising OCR pipeline"
  - "Test image generated at /tmp/ocr-smoke.jpg (not committed) — avoids binary files in git; Pillow creates the image fresh each CI run"

patterns-established:
  - "Pattern: Generate test fixtures via Python scripts, not binary commits — use Pillow to create images in CI on-the-fly"
  - "Pattern: Warm up PaddleOCR models in a dedicated step before using them — ensures model files are present before OCR runs"
  - "Pattern: Use restore-keys prefix for model caches — allows cache reuse across script versions when full key misses"

requirements-completed: [SCRP-08]

# Metrics
duration: 1min
completed: 2026-03-19
---

# Phase 09 Plan 02: OCR CI Smoke Test Workflow Summary

**GitHub Actions workflow that caches PaddleOCR 3.x models at ~/.paddlex and runs an end-to-end OCR smoke test against a Pillow-generated synthetic Vietnamese text image**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-03-19T04:51:54Z
- **Completed:** 2026-03-19T04:52:40Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Created `.github/workflows/ci-ocr.yml` with actions/cache@v4 targeting the PaddleOCR 3.x model path `~/.paddlex` (not the 2.x `~/.paddleocr` path)
- Set `PADDLE_PDX_MODEL_SOURCE=BOS` at job level to prevent remote model re-check after cache restore
- Created `tests/fixtures/ocr-smoke-generator.py` — a Pillow script that generates a synthetic JPEG with ASCII-safe Vietnamese text lines for CI OCR testing without binary fixtures in git
- Workflow triggers on push to `scripts/ocr_table.py` or the workflow file itself, plus `workflow_dispatch` for manual runs
- Smoke test asserts `len(data['lines']) > 0` from the OCR output JSON, verifying the full pipeline runs correctly

## Task Commits

Each task was committed atomically:

1. **Task 1: Create OCR smoke test image generator and GHA CI workflow** - `f35e415` (feat)

## Files Created/Modified

- `.github/workflows/ci-ocr.yml` - GHA workflow: checkout, setup-python 3.11, cache ~/.paddlex, install paddleocr+Pillow, warm up models, generate test image, run ocr_table.py, assert lines > 0
- `tests/fixtures/ocr-smoke-generator.py` - Pillow script generating a 400x200 white JPEG with 3 lines of ASCII-safe Vietnamese text at 20px font

## Decisions Made

- Cache key uses `hashFiles('scripts/ocr_table.py')` so the model cache invalidates automatically when the OCR script changes
- `PADDLE_PDX_MODEL_SOURCE=BOS` is set at job level (env block) rather than only on the warm-up step, ensuring it applies to all Python steps that might trigger a model download
- ASCII-safe text in the smoke image (no diacritics) avoids DejaVu font fallback issues while still exercising the full OCR extraction pipeline

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - this is a self-contained GitHub Actions workflow. No secrets or environment variables required for CI (model download uses the BOS public endpoint on cache miss).

## Next Phase Readiness

- PaddleOCR CI smoke test is in place; any future change to `scripts/ocr_table.py` will trigger automatic verification
- Cache warm-up pattern can be reused in scrape-low.yml and scrape-peak.yml to avoid the 2+ minute model download on every scrape run
- Model cache will grow the first time the workflow runs, then subsequent runs will use the cached models

---
*Phase: 09-scraper-resilience-testing*
*Completed: 2026-03-19*
