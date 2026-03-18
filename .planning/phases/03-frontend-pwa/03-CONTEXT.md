# Phase 3: Frontend PWA - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 delivers the complete user-facing PWA: score entry (quick + detailed modes), tiered recommendation list, nguyện vọng builder with URL sharing, university search with diacritic-aware filtering, data staleness indicators, Vietnamese/English i18n, and offline PWA installability. Consumes Phase 2 API endpoints. No new backend logic.

</domain>

<decisions>
## Implementation Decisions

### Score Entry & Matching
- Quick mode: tổ hợp code selector (dropdown) + total score input (10.0–30.0) → call /api/recommend
- Detailed mode: individual subject score inputs → client-side calculation of applicable tổ hợp totals → call /api/recommend with computed total
- Score validation client-side before API call; show inline error if out of range
- Results list: color-coded by tier — dream (blue), practical (green), safe (amber); sorted practical-first then dream then safe
- URL encodes score inputs via nuqs (query string state) for shareable links

### Nguyện Vọng Builder
- 15-choice list auto-generated from API `suggested_top_15: true` results
- Displayed as numbered list with tier badge and score delta
- URL-encoded via nuqs so entire list is shareable/bookmarkable
- No manual reorder in v1 (deferred to v2 per REQUIREMENTS.md)
- Teacher training (sư phạm) deprioritization already handled by API engine

### Search & Browse
- Diacritic-aware search: normalize both query and university names using `String.prototype.normalize('NFD')` + strip combining chars; case-insensitive
- Search is client-side against data fetched from /api/universities (paginated, cursor-based fetch-all on mount)
- Filter by tổ hợp: dropdown populated from /api/tohop; filters already-fetched university list
- Results update on every keystroke (no debounce needed for <200 items)

### Data Staleness Display
- Every cutoff score row shows `scraped_at` formatted as relative age (e.g., "3 days ago") using Intl.RelativeTimeFormat
- Source URL shown as a small link icon next to each score
- If `scraped_at` > 90 days: show amber warning badge "Data may be outdated"

### Internationalization
- next-intl for all UI strings; Vietnamese (`vi`) default locale, English (`en`) toggle
- Language toggle in header; persists to localStorage
- All 7 success criteria features must have complete translations in both locales — no untranslated strings
- Date/number formatting via Intl APIs respecting locale

### PWA & Offline
- Serwist (@serwist/next) for service worker; cache API responses for offline access
- Install prompt shown once after first meaningful interaction
- Offline: show cached recommendations/search results with "Offline — showing cached data" banner
- No runtime caching of /api/recommend (personalized); cache /api/universities, /api/tohop, /api/years

### Visual Design & Layout
- Mobile-first; single-column on small screens, two-column on ≥768px
- Use Tailwind CSS (already installed via Next.js scaffolding)
- Minimal, clean aesthetic — no heavy UI library; use native HTML elements + Tailwind
- Score tier colors: dream=blue-500, practical=green-500, safe=amber-500
- Vietnamese text must display correctly (no font substitution issues)

### Claude's Discretion
- Exact component file structure within `app/` and `components/`
- Specific Tailwind class choices beyond color palette
- Loading skeleton vs. spinner for async states

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/recommend/types.ts` — `RecommendResult`, `Tier` types for typing API responses
- `lib/api/helpers.ts` — error shape reference
- All 6 API routes live at `/api/*` — consume directly from client components
- `drizzle/migrations/0001_init.sql` — university seed data for reference (77 universities)

### Established Patterns
- Next.js 15 App Router; relative imports (no `@/` alias — tsconfig maps to nonexistent `./src/`)
- TypeScript strict mode throughout
- Vitest for tests; `vi.hoisted()` + `vi.mock()` pattern
- Tailwind CSS configured

### Integration Points
- `/api/recommend?tohop=A00&score=25.5` — main recommendation endpoint
- `/api/universities?limit=200` — full university list for search
- `/api/tohop` — tổ hợp codes for dropdown
- `/api/years` — available years for display
- `/api/scores?university_id=BKA` — per-university score history

</code_context>

<specifics>
## Specific Ideas

- State management for research flag noted: Serwist offline caching with Next.js App Router differs from Pages Router — worth a research pass before implementation (from STATE.md blockers)
- nuqs for URL state (score inputs, nguyện vọng list) — keep URLs human-readable
- The 2026 rule: teacher training programs only in top 5 — already handled by API, no frontend logic needed

</specifics>

<deferred>
## Deferred Ideas

- Manual reorder of nguyện vọng list (ADV-03) — v2
- Score range simulation slider (ADV-02) — v2
- Share/export via clipboard (ADV-04) — v2
- University detail full info page (ADV-06) — v2
- User accounts / saved lists (USR-01) — v2
- Native app (PATH-*) — v2

</deferred>
