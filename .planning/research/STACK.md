# Stack Research

**Domain:** Vietnamese university admissions PWA — v2.0 additions only
**Researched:** 2026-03-18
**Confidence:** MEDIUM-HIGH (versions verified via WebSearch against npm registry; React 19 compatibility issues verified via GitHub issues)

> This file documents ONLY the new libraries needed for v2.0 features.
> Existing stack (Next.js 16, Supabase, Drizzle ORM, Serwist, next-intl, nuqs,
> Playwright, PaddleOCR, Cheerio, Tailwind v4, vitest) is unchanged.

---

## Recommended Stack — New Additions

### Feature 1: Auto-Discovery Crawler

**Goal:** Crawl university homepages using BFS link-following to find newly published cutoff score pages without manual URL maintenance.

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `crawlee` (`@crawlee/cheerio`) | ^3.13.7 | BFS link-discovery crawler with built-in request queue | Wraps Cheerio with `enqueueLinks()` supporting URL glob/regex filtering, depth control, and automatic deduplication. Avoids writing a manual BFS queue. Runs in Node.js with zero browser binary dependency — identical environment to existing GitHub Actions scraper jobs. The `CheerioCrawler` strategy is sufficient because Vietnamese university homepage navigation menus are mostly static HTML; Playwright-based discovery is only needed if a homepage itself requires JS rendering (rare). |

**Installation:**
```bash
npm install crawlee
```

**Why not raw Cheerio + custom BFS:** You already use Cheerio for parsing. Crawlee adds the request queue, retry logic, politeness delays, and `enqueueLinks` URL filtering on top — exactly the scaffolding a BFS crawler needs. Rolling this yourself costs 2-3x implementation time with worse edge case coverage.

**Why not Playwright crawler (crawlee's `PlaywrightCrawler`):** Discovery only needs to follow navigation links on static homepages. Playwright adds a 300-600 MB browser binary — already ruled out for GitHub Actions unless specifically needed. Use `CheerioCrawler` for discovery; fall back to `PlaywrightCrawler` only for homepages verified to require JS rendering.

**Why not Crawl4AI / Firecrawl:** Both are Python-first (Crawl4AI) or hosted SaaS (Firecrawl). The scraper pipeline is Node.js/TypeScript running in GitHub Actions. Crawlee is TypeScript-native, same runtime, same toolchain.

**Integration note:** Run the discovery crawler as a separate GitHub Actions job — not inside the API routes. Output is a list of candidate URLs written to Supabase (`url_candidates` table or similar), which the main scraper runner picks up. Keep discovery and data extraction as separate responsibilities.

**URL filtering pattern for cutoff pages:**
```typescript
await enqueueLinks({
  globs: ['**/diem-chuan**', '**/tuyen-sinh**', '**/thong-bao**'],
  // Exclude navigation anchors, login pages, external links
  exclude: ['**/login**', '**/admin**'],
  strategy: 'same-hostname',
});
```

---

### Feature 2: Scraper Resilience Testing (Fake Local HTTP Server)

**Goal:** Serve static fake HTML files during vitest test runs so scraper adapters can make real HTTP requests to controlled fixtures without hitting live university websites.

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `sirv` | ^3.0.2 | Lightweight static file server for Node.js | Used as a local HTTP server in vitest `globalSetup`. Start before tests, stop after. Serves HTML fixture files from `tests/fixtures/` so Cheerio and Playwright adapters make real `fetch()` calls to `http://localhost:PORT/...` — no mocking required. Simpler than Express for static serving. |

**Installation:**
```bash
npm install -D sirv
```

**Why not MSW (Mock Service Worker):** MSW intercepts `fetch()`/`XMLHttpRequest` at the Node.js module level using `@mswjs/interceptors`. It does NOT start an actual HTTP server. The scraper adapter runner calls `fetch(url)` where `url` is the real university URL. For testing, you want to redirect that URL to a local file — which requires either URL substitution at the test boundary or an actual HTTP server. A real server (sirv) is architecturally cleaner: adapters run unmodified, and tests simply pass `http://localhost:PORT/bvh.html` as the URL argument instead of the live URL.

**Why not `http-server` or `serve` CLI:** Both are CLI tools, not importable Node.js modules. `sirv` exports a handler function that integrates directly into a `node:http` server — ideal for `globalSetup`/`teardown` in vitest.

**vitest globalSetup pattern:**
```typescript
// tests/setup/static-server.ts
import { createServer } from 'node:http';
import sirv from 'sirv';

let server: ReturnType<typeof createServer>;

export async function setup() {
  const handler = sirv('tests/fixtures', { dev: true });
  server = createServer(handler);
  await new Promise<void>(resolve => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;
  process.env.FIXTURE_SERVER_PORT = String(port);
}

export async function teardown() {
  await new Promise<void>(resolve => server.close(() => resolve()));
}
```

Then in `vitest.config.mts`:
```typescript
globalSetup: ['tests/setup/static-server.ts']
```

Adapters under test receive `http://localhost:${process.env.FIXTURE_SERVER_PORT}/bvh.html` as the URL — no code change to the adapter itself.

**Fixture file structure:**
```
tests/fixtures/
  bvh/
    normal.html        # Standard table layout
    no-data.html       # Page exists but no cutoff table
    malformed.html     # Missing columns, bad encoding
    changed-layout.html # Simulates post-redesign layout change
  htc/
    ...
```

---

### Feature 3: Drag-and-Drop Reorder for Nguyện Vọng List

**Goal:** Users can drag items up/down to manually reorder their 15-choice nguyện vọng list.

**React 19 compatibility situation (as of March 2026):**
- `@dnd-kit/core` 6.3.1 — last published ~1 year ago, maintenance concerns, React 19 not explicitly supported (peerDeps: `>=16.8.0` which technically includes 19 via semver)
- `@hello-pangea/dnd` 18.0.1 — explicitly excludes React 19 in peerDeps (`^16 || ^17 || ^18`)
- `@atlaskit/pragmatic-drag-and-drop` 1.7.7 — peerDeps also caps at React 18; React 19 issue open with no timeline
- `motion` (formerly framer-motion) 12.37.0 — React 19 **fully supported** as of v12.27.5 (December 2025); includes `Reorder` component for drag-to-reorder lists

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `motion` | ^12.37.0 | Drag-to-reorder list with animation | Only major drag-reorder library with confirmed React 19 support. The `Reorder.Group` + `Reorder.Item` API directly matches the use case: a vertical sortable list of 15 items. Built-in spring animations improve perceived quality. Already likely used or considered for UI polish; adding it for reorder gets animation "for free". |

**Installation:**
```bash
npm install motion
```

**Usage pattern:**
```tsx
import { Reorder } from 'motion/react';

function NguyenVongList({ items, onChange }) {
  return (
    <Reorder.Group axis="y" values={items} onReorder={onChange}>
      {items.map(item => (
        <Reorder.Item key={item.id} value={item}>
          {/* card content */}
        </Reorder.Item>
      ))}
    </Reorder.Group>
  );
}
```

**Why not `@dnd-kit/core`:** Last release was ~1 year ago (6.3.1). Open GitHub issues about future maintenance and React 19 compatibility. The new `@dnd-kit/react` 0.3.2 API has documented bugs where `onDragEnd` source/target are always identical (GitHub issue #1664, open). Not production-safe for a reorder use case.

**Why not `@hello-pangea/dnd`:** Hard peerDep on React `^16 || ^17 || ^18` — explicitly rejects React 19. Project already runs React 19.2.3.

**Why not native HTML5 drag events:** The HTML5 DnD API has well-known inconsistencies across browsers (especially touch/mobile). Vietnamese students predominantly use Android phones. Native DnD has no touch support without additional libraries — a critical gap.

**Caveat:** Motion's `Reorder` component is **incompatible with Next.js page-level scrolling and routing** (documented known issue). This is acceptable for the nguyện vọng list which lives within a single page section, not across routes. Test explicitly on mobile (touch) before shipping.

---

### Feature 4: Design Token System with Dark Mode (Tailwind v4)

**Goal:** Establish a brand color palette with semantic tokens, plus dark mode toggling without page flash.

**No new libraries needed for tokens.** Tailwind v4's `@theme` directive IS the design token system. Define tokens in `globals.css`:

```css
@import "tailwindcss";

@theme {
  /* Brand palette */
  --color-brand-primary: hsl(221 83% 53%);
  --color-brand-accent:  hsl(142 71% 45%);

  /* Semantic tokens (light defaults) */
  --color-surface:         hsl(0 0% 100%);
  --color-surface-raised:  hsl(220 14% 96%);
  --color-on-surface:      hsl(222 47% 11%);
  --color-on-surface-muted: hsl(215 16% 47%);
  --color-border:          hsl(220 13% 91%);

  /* Typography */
  --font-sans: 'Be Vietnam Pro', ui-sans-serif, system-ui;
}

/* Dark mode overrides — CSS-only, no JS config */
@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));

@layer base {
  [data-theme=dark] {
    --color-surface:          hsl(222 47% 11%);
    --color-surface-raised:   hsl(217 33% 17%);
    --color-on-surface:       hsl(210 40% 98%);
    --color-on-surface-muted: hsl(215 20% 65%);
    --color-border:           hsl(217 33% 25%);
  }
}
```

Utilities like `bg-surface`, `text-on-surface`, `border-border` are generated automatically from `@theme` variables. No CSS-in-JS, no config file.

**For the toggle (flash-free):** One small library is needed.

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `next-themes` | ^0.4.6 | Theme provider for flash-free dark mode toggle | Injects a blocking inline script before page hydration to read `localStorage` and set `data-theme` on `<html>` before React renders — eliminating the white flash on dark-mode users. Uses `attribute="data-theme"` to match the Tailwind `@custom-variant` selector. Alternative is a manual `<script>` in `layout.tsx` — achievable but more fragile to maintain. |

**Installation:**
```bash
npm install next-themes
```

**Integration with Tailwind v4 `@custom-variant`:**
```tsx
// app/layout.tsx
import { ThemeProvider } from 'next-themes';

export default function RootLayout({ children }) {
  return (
    <html suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

The `attribute="data-theme"` on `ThemeProvider` aligns with the `@custom-variant dark` selector in globals.css. `suppressHydrationWarning` is required because the theme class is set server-unknown.

**Why not OS-preference only (no `next-themes`):** Tailwind v4 defaults to `prefers-color-scheme` via media query — no library needed for system-only mode. But students will want a manual toggle persisted across sessions. `next-themes` adds `localStorage` persistence + flash prevention in ~2KB.

**Why not a manual `<script>` in `layout.tsx`:** Doable, but `next-themes` encodes 4 years of edge cases (hydration, multiple tabs, system preference sync). Not worth reinventing.

---

### Feature 5: Recommendation Engine Tests with Synthetic Data

**Goal:** Test edge cases in the recommendation engine (NaN scores, null scores, boundary conditions, tier assignment) using controlled fake data fixtures.

**No new test runner needed** — vitest is already installed and running 349 tests. The addition is a data generation helper.

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@faker-js/faker` | ^10.3.0 | Generate synthetic university/major/cutoff data for tests | Produces realistic Vietnamese-range scores (10.0–30.0), random university IDs, random tổ hợp codes. Seeded (`faker.seed(42)`) for deterministic snapshots. Eliminates hand-written fixture duplication across 20+ edge case tests. v10 requires Node.js 20+ — check GitHub Actions runner. |

**Installation:**
```bash
npm install -D @faker-js/faker
```

**Factory pattern (recommended over raw faker calls in tests):**
```typescript
// tests/factories/cutoff.ts
import { faker } from '@faker-js/faker';
import type { CutoffDataRow } from '../../lib/db/schema';

faker.seed(42); // deterministic across CI runs

export function makeCutoffRow(overrides: Partial<CutoffDataRow> = {}): CutoffDataRow {
  return {
    university_id: faker.helpers.arrayElement(['BKA', 'BVH', 'DCN', 'GHA', 'HTC']),
    major_code: faker.string.numeric(7),
    tohop: faker.helpers.arrayElement(['A00', 'A01', 'B00', 'C00', 'D01']),
    year: faker.helpers.arrayElement([2022, 2023, 2024]),
    score: faker.number.float({ min: 15.0, max: 29.5, fractionDigits: 2 }),
    scraped_at: faker.date.recent().toISOString(),
    ...overrides,
  };
}

export function makeCutoffRows(count: number, overrides?: Partial<CutoffDataRow>) {
  return Array.from({ length: count }, () => makeCutoffRow(overrides));
}
```

**Edge case tests this enables:**
```typescript
// Null score propagation (known bug)
makeCutoffRow({ score: null })

// Boundary: student score exactly equals cutoff
makeCutoffRow({ score: 24.5 })  // student inputs 24.5

// Tiering: ensure 5+5+5 split with varied score gaps
makeCutoffRows(15, {}) // mixed scores, verify dream/practical/safe counts
```

**Why not hand-written fixtures:** 20+ edge cases mean 20+ manually maintained objects. When `CutoffDataRow` type changes (e.g., the `scraped_at: Date vs string` tech debt fix), factory functions update in one place.

**Why not `fishery` + `@faker-js/faker`:** Fishery adds a factory class pattern useful for complex relational objects with associations. `CutoffDataRow` is flat; plain factory functions are sufficient and have zero extra dependency.

---

## Summary: What Gets Added

| Package | Version | Category | New? |
|---------|---------|----------|------|
| `crawlee` | ^3.13.7 | Prod dep | YES — auto-discovery crawler |
| `sirv` | ^3.0.2 | Dev dep | YES — fake HTTP server for scraper tests |
| `motion` | ^12.37.0 | Prod dep | YES — drag-to-reorder nguyện vọng list |
| `next-themes` | ^0.4.6 | Prod dep | YES — flash-free dark mode toggle |
| `@faker-js/faker` | ^10.3.0 | Dev dep | YES — synthetic test data factory |

**Tailwind v4 `@theme` design tokens:** Zero new dependencies. Pure CSS using existing Tailwind v4.

---

## Installation

```bash
# Production dependencies
npm install crawlee motion next-themes

# Dev dependencies
npm install -D sirv @faker-js/faker
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `crawlee` | Raw Cheerio + custom BFS | If crawlee's request queue/retry logic is overkill for a one-shot discovery scan (not the case here — retries are valuable for flaky Vietnamese hosting) |
| `sirv` + vitest `globalSetup` | MSW (`msw/node`) | If testing components that call APIs (use MSW for those); for scraper adapters that make raw HTTP fetches, a real server is more architecturally honest |
| `motion` Reorder | `@dnd-kit/core` + `@dnd-kit/sortable` | If React 18 or earlier; dnd-kit is well-documented and widely used — but currently last-release ~1 year ago with React 19 compatibility unresolved |
| `next-themes` | Manual `<script>` in layout.tsx | For projects that never need a user-facing toggle (system preference only); saves 2KB |
| `@faker-js/faker` | Hand-written fixture objects | For very small test suites (<5 fixtures) where the factory abstraction adds more complexity than it saves |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@hello-pangea/dnd` | peerDeps explicitly cap at React 18; project uses React 19.2.3 | `motion` Reorder |
| `@atlaskit/pragmatic-drag-and-drop` | React 19 not supported; issue open with no ETA (Jan 2025) | `motion` Reorder |
| `@dnd-kit/react` (new API, v0.3.2) | Critical bug: `onDragEnd` source/target always identical (issue #1664, open); unstable API | `motion` Reorder or legacy `@dnd-kit/core` if React 18 |
| `playwright webServer` for fixture serving | Playwright's `webServer` config is for E2E browser tests, not vitest unit tests | `sirv` in vitest `globalSetup` |
| LLM-based URL classification for auto-discovery | Cost prohibitive (PROJECT.md out-of-scope constraint) | Crawlee + keyword glob patterns on `enqueueLinks` |
| `fishery` factory library | Adds a class-based factory abstraction that is overkill for flat `CutoffDataRow` objects | Plain factory functions with `@faker-js/faker` |

---

## Version Compatibility

| Package | Requires | Notes |
|---------|----------|-------|
| `crawlee` ^3.13.7 | Node.js ≥16 | GitHub Actions default Node (20) is fine |
| `@faker-js/faker` ^10.3.0 | Node.js ≥20 | v10 raised minimum; verify GitHub Actions runner uses Node 20 |
| `motion` ^12.37.0 | React ≥18.2 | React 19 fully supported since v12.27.5 (Dec 2025) |
| `next-themes` ^0.4.6 | Next.js ≥13 | No known Next.js 16 incompatibility |
| `sirv` ^3.0.2 | Node.js ≥14 | Dev-only; no runtime constraints |

---

## Stack Patterns by Variant

**For auto-discovery — homepage requires JS rendering (rare):**
- Use `PlaywrightCrawler` from crawlee instead of `CheerioCrawler`
- Same `enqueueLinks` API, just browser-rendered
- Only activate when a specific university's homepage is known JS-rendered

**For dark mode — system preference only, no toggle:**
- Skip `next-themes`
- Tailwind v4 defaults to `@media (prefers-color-scheme: dark)` with zero config
- Only add `next-themes` when a user-facing toggle + `localStorage` persistence is needed

**For scraper fixture tests — Playwright-based scrapers:**
- `sirv` serves the same HTML fixtures
- The Playwright scraper's `page.goto(url)` hits `http://localhost:PORT/fixture.html`
- No fixture format change needed; same static HTML works for Cheerio and Playwright scrapers

---

## Sources

- Crawlee npm: WebSearch confirmed version 3.13.7 (March 2026) — MEDIUM confidence
- Crawlee `enqueueLinks` docs: https://crawlee.dev/js/docs/examples/crawl-some-links — HIGH confidence
- sirv npm: WebSearch confirmed version 3.0.2 (September 2025) — MEDIUM confidence
- sirv + vitest globalSetup pattern: https://eshlox.net/setting-up-a-static-server-for-vitest-tests — MEDIUM confidence
- MSW comparison: https://mswjs.io/docs/comparison/ — HIGH confidence (does not spawn HTTP servers)
- motion (framer-motion) npm: WebSearch confirmed version 12.37.0, React 19 supported since 12.27.5 — MEDIUM-HIGH confidence
- motion Reorder docs: https://motion.dev/docs/react-reorder — HIGH confidence
- `@dnd-kit/core` 6.3.1 last release ~1 year ago: WebSearch confirmed — MEDIUM confidence
- `@hello-pangea/dnd` React 19 exclusion: GitHub discussion #810 + peerDeps — HIGH confidence
- `@atlaskit/pragmatic-drag-and-drop` React 19 issue: GitHub issue #181 (Jan 2025, open) — HIGH confidence
- `@dnd-kit/react` onDragEnd bug: GitHub issue #1664 (open) — HIGH confidence
- next-themes 0.4.6: WebSearch confirmed — MEDIUM confidence
- next-themes + Tailwind v4 data-attribute pattern: https://iifx.dev/en/articles/456423217 — MEDIUM confidence
- Tailwind v4 @theme + @custom-variant: https://tailwindcss.com/docs/theme + https://tailwindcss.com/docs/dark-mode — HIGH confidence
- @faker-js/faker 10.3.0: WebSearch confirmed — MEDIUM confidence
- @faker-js/faker Node.js 20 minimum requirement: https://fakerjs.dev/guide/ — HIGH confidence

---
*Stack research for: UniSelect v2.0 new feature additions*
*Researched: 2026-03-18*
