# Phase 14: UI/UX Redesign - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement design token system, fix font application, add error boundaries, create editable nguyện vọng list, onboarding banner, dark mode, empty states, and tier badge tooltips.

</domain>

<decisions>
## Implementation Decisions

### Visual Design System
- Blue primary color palette with semantic tokens — professional, trustworthy for education
- next-themes with `class` strategy + CSS variables for dark mode
- Tailwind v4 @theme with semantic names (--color-primary, --color-surface, --color-on-surface, etc.)
- Font fix: add `font-family: var(--font-be-vietnam)` to the font-sans token in Tailwind config

### Editable Nguyện Vọng List
- Up/down buttons as primary reorder interaction + optional drag via motion's Reorder component
- State persistence via nuqs URL params (already used in project) — shareable, no login needed
- "+" button on each result card → appends to nguyện vọng list
- Visual tier grouping headers dividing 1-5 (dream), 6-10 (practical), 11-15 (safe) with explanation text

### Onboarding & Empty States
- Dismissible banner at top of page explaining what UniSelect does + what info needed (first-time visitors)
- Empty state before submission: guidance text with icon: "Enter your score above to see matching universities"
- Error boundary (error.tsx, not-found.tsx): full-page Vietnamese/English error with retry button and home link
- Tier badge hover/tap: tooltip showing concrete score margin (e.g., "Điểm bạn cao hơn 2.3 so với điểm chuẩn")

### Claude's Discretion
- Specific color hex values within the blue palette
- Animation/transition timing
- Icon choices
- Responsive breakpoints
- Tooltip positioning strategy

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/layout.tsx` — root layout with Be Vietnam Pro font loaded (variable `--font-be-vietnam`)
- `app/page.tsx` — main page with ScoreForm, ResultsList
- `components/ScoreForm.tsx` — score input form with error state (from Phase 11)
- `components/ResultsList.tsx` — results display with computeDelta and trend colors
- `components/NguyenVongList.tsx` — current nguyện vọng list display
- `components/TierBadge.tsx` — existing tier badge component
- `components/LocaleToggle.tsx` — language switcher
- `messages/vi.json`, `messages/en.json` — i18n message files

### Established Patterns
- Tailwind CSS for styling (scattered hardcoded colors like `text-gray-900`, `bg-gray-50`)
- next-intl for i18n with cookie-based locale
- nuqs for URL state management
- Dynamic imports for below-fold components

### Integration Points
- `app/globals.css` — Tailwind directives, needs @theme block
- `tailwind.config.ts` or CSS — font-sans token needs fix
- New error.tsx and not-found.tsx at app/ level
- next-themes ThemeProvider wrapping in layout.tsx
- nuqs for nguyện vọng list state persistence

</code_context>

<specifics>
## Specific Ideas

- Onboarding banner should mention: "Nhập điểm thi THPT và tổ hợp của bạn để xem danh sách trường phù hợp"
- Tier explanation should reference the 5+5+5 strategy from PROJECT.md
- Dark mode should not flash white on initial load (suppressHydrationWarning on html element)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
