---
phase: 14-ui-ux-redesign
plan: "03"
subsystem: frontend
tags: [nguyen-vong-list, tier-badge, url-persistence, user-owned-state, i18n]
dependency_graph:
  requires: [14-01]
  provides: [editable-nguyen-vong-list, tier-badge-tooltip, add-to-list-button]
  affects: [components/NguyenVongList.tsx, components/TierBadge.tsx, components/ScoreForm.tsx, components/ResultsList.tsx]
tech_stack:
  added: []
  patterns: [lifted-state, url-persistence-nuqs, tier-grouping-headers, tooltip-hover-tap]
key_files:
  created: []
  modified:
    - components/NguyenVongList.tsx
    - components/TierBadge.tsx
    - components/ScoreForm.tsx
    - components/ResultsList.tsx
    - messages/vi.json
    - messages/en.json
    - tests/components/NguyenVongList.test.tsx
decisions:
  - NvItem type exported from NguyenVongList.tsx so ScoreForm and tests can import it without circular deps
  - TierBadge uses React useState for tap-toggle on mobile rather than CSS-only approach (CSS-only has no mobile tap support)
  - Tier grouping headers render based on position index (0, 5, 10) not result.tier — user can freely order schools
  - ScoreForm owns nuqs nv state; NguyenVongList is pure presentational (props in/callbacks out)
metrics:
  duration: "6m 36s"
  completed_date: "2026-03-19"
  tasks_completed: 2
  files_modified: 7
---

# Phase 14 Plan 03: Editable Nguyen Vong List Summary

**One-liner:** User-owned nguyen vong list with add/remove/reorder, tier grouping headers (5+5+5), TierBadge score margin tooltip, and lifted nuqs state in ScoreForm.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | TierBadge tooltip + NguyenVongList rewrite | b9730a2 | components/TierBadge.tsx, components/NguyenVongList.tsx, messages/vi.json, messages/en.json |
| 2 | Wire add-to-list, lift state, update tests | 8e9610e | tests/components/NguyenVongList.test.tsx |

## What Was Built

### NguyenVongList rewrite (user-owned state)
- Props changed from `{ results, userScore }` to `{ nguyenVong, setNguyenVong, results, userScore }`
- Removed the auto-sync `useEffect` that was overwriting user choices on every results change
- `moveUp(index)`, `moveDown(index)`, `removeFromList(index)` functions implemented
- Tier grouping headers at positions 1/6/11 (indices 0/5/10) with tier name + description
- Empty state shows "Add to preference list" prompt instead of returning null
- List capped at 15 items

### TierBadge tooltip
- Added optional `delta?: string` prop
- Tooltip renders only when delta provided
- Hover support via CSS `group-hover:opacity-100`
- Tap support via React `useState` toggle (mobile-friendly)
- Positioned `absolute bottom-full` for above-badge placement

### State lifted to ScoreForm
- `useQueryState('nv', parseAsJson<NvItem[]>(...))` moved from NguyenVongList to ScoreForm
- `addToList(result)` function: deduplicates and enforces 15-item cap
- Both `ResultsList` and `NguyenVongList` receive state as props
- NguyenVongList always renders (shows empty state) — removed `results.length > 0` guard

### ResultsList add-to-list button
- New optional props: `onAddToList?(result)` and `nguyenVong?`
- "+" button on each result card with 3 states: add, already-in-list (checkmark), list-full (disabled)
- TierBadge now receives `delta` prop for tooltip display

### i18n
- Added 13 new keys to both vi.json and en.json: tierDream, tierPractical, tierSafe, tierDreamDesc, tierPracticalDesc, tierSafeDesc, addToList, removeFromList, moveUp, moveDown, listFull, alreadyInList, scoreMargin
- Vietnamese uses proper diacritics

## Decisions Made

1. **NvItem exported from NguyenVongList.tsx** — Allows ScoreForm and test files to import without creating a separate types file. Clean single-source-of-truth.

2. **TierBadge tap-toggle uses React useState** — CSS-only hover works on desktop but has no touch equivalent. Mobile users need to be able to tap to see the score margin.

3. **Tier grouping headers use position index, not result.tier** — Students can (and should) freely order their list. The 5+5+5 strategy is about position slots, not about matching schools to their computed tier.

4. **ScoreForm owns nuqs nv state** — NguyenVongList becomes a pure presentational component. This is the correct React pattern: state at the parent that coordinates both ResultsList (read for "already in list") and NguyenVongList (read/write).

## Deviations from Plan

### Pre-existing Work Applied Automatically (Rule 3)

During the previous 14-02 plan execution, a Rule 3 fix was applied that already wired ScoreForm.tsx and ResultsList.tsx with the new props (`onAddToList`, `nguyenVong`, `hasSubmitted`). This plan's Task 2 found those files already updated. Only the test file (NguyenVongList.test.tsx) required updates in this plan's Task 2 commit.

### Pre-existing Build Failure (Out of Scope)

`scripts/discover.ts` has a Cheerio API type conflict (pre-existing, documented in STATE.md from Phase 14 Plan 01). Build fails with the same error before and after this plan's changes. Deferred per prior decision.

## Verification

- `grep -q "moveUp" components/NguyenVongList.tsx` — PASS
- `grep -rn "setNguyenVong(top15" components/` — returns nothing (GOOD)
- `grep -q "addToList" components/ScoreForm.tsx` — PASS
- `grep -q "delta" components/TierBadge.tsx` — PASS
- `npx vitest run tests/components/NguyenVongList.test.tsx` — 9/9 PASS

## Self-Check: PASSED

Files exist:
- components/NguyenVongList.tsx — FOUND
- components/TierBadge.tsx — FOUND
- components/ScoreForm.tsx — FOUND
- components/ResultsList.tsx — FOUND
- tests/components/NguyenVongList.test.tsx — FOUND

Commits exist:
- b9730a2 — FOUND
- 8e9610e — FOUND
