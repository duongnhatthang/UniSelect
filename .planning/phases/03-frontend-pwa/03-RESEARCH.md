# Phase 3: Frontend PWA - Research

**Researched:** 2026-03-18
**Domain:** Next.js 16 App Router, PWA/Serwist, next-intl, nuqs, Tailwind CSS v4
**Confidence:** HIGH (verified against current docs and npm registry)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Score Entry & Matching**
- Quick mode: tổ hợp code selector (dropdown) + total score input (10.0–30.0) → call /api/recommend
- Detailed mode: individual subject score inputs → client-side calculation of applicable tổ hợp totals → call /api/recommend with computed total
- Score validation client-side before API call; show inline error if out of range
- Results list: color-coded by tier — dream (blue), practical (green), safe (amber); sorted practical-first then dream then safe
- URL encodes score inputs via nuqs (query string state) for shareable links

**Nguyện Vọng Builder**
- 15-choice list auto-generated from API `suggested_top_15: true` results
- Displayed as numbered list with tier badge and score delta
- URL-encoded via nuqs so entire list is shareable/bookmarkable
- No manual reorder in v1 (deferred to v2 per REQUIREMENTS.md)
- Teacher training (sư phạm) deprioritization already handled by API engine

**Search & Browse**
- Diacritic-aware search: normalize both query and university names using `String.prototype.normalize('NFD')` + strip combining chars; case-insensitive
- Search is client-side against data fetched from /api/universities (paginated, cursor-based fetch-all on mount)
- Filter by tổ hợp: dropdown populated from /api/tohop; filters already-fetched university list
- Results update on every keystroke (no debounce needed for <200 items)

**Data Staleness Display**
- Every cutoff score row shows `scraped_at` formatted as relative age (e.g., "3 days ago") using Intl.RelativeTimeFormat
- Source URL shown as a small link icon next to each score
- If `scraped_at` > 90 days: show amber warning badge "Data may be outdated"

**Internationalization**
- next-intl for all UI strings; Vietnamese (`vi`) default locale, English (`en`) toggle
- Language toggle in header; persists to localStorage
- All 7 success criteria features must have complete translations in both locales — no untranslated strings
- Date/number formatting via Intl APIs respecting locale

**PWA & Offline**
- Serwist (@serwist/next) for service worker; cache API responses for offline access
- Install prompt shown once after first meaningful interaction
- Offline: show cached recommendations/search results with "Offline — showing cached data" banner
- No runtime caching of /api/recommend (personalized); cache /api/universities, /api/tohop, /api/years
- (Note: /api/scores not mentioned — treat as uncached like /api/recommend)

**Visual Design & Layout**
- Mobile-first; single-column on small screens, two-column on ≥768px
- Use Tailwind CSS (already installed via Next.js scaffolding)
- Minimal, clean aesthetic — no heavy UI library; use native HTML elements + Tailwind
- Score tier colors: dream=blue-500, practical=green-500, safe=amber-500
- Vietnamese text must display correctly (no font substitution issues)

### Claude's Discretion
- Exact component file structure within `app/` and `components/`
- Specific Tailwind class choices beyond color palette
- Loading skeleton vs. spinner for async states

### Deferred Ideas (OUT OF SCOPE)
- Manual reorder of nguyện vọng list (ADV-03) — v2
- Score range simulation slider (ADV-02) — v2
- Share/export via clipboard (ADV-04) — v2
- University detail full info page (ADV-06) — v2
- User accounts / saved lists (USR-01) — v2
- Native app (PATH-*) — v2
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SRCH-01 | User can search universities by name (Vietnamese diacritic-aware search) | NFD normalize + strip combining chars pattern; client-side against /api/universities fetch |
| SRCH-02 | User can filter search results by tổ hợp code | Dropdown from /api/tohop; client-side filter on fetched array |
| SCOR-01 | User can select a tổ hợp and enter a total score to see ranked list (quick mode) | nuqs for URL state; RecommendResult type from lib/recommend/types.ts; tier color mapping |
| SCOR-02 | User can enter individual subject scores; app calculates tổ hợp totals (detailed mode) | Client-side arithmetic; tổ hợp subjects from /api/tohop subjects array; same /api/recommend endpoint |
| NGVG-01 | App generates tiered 15-choice nguyện vọng list (dream/practical/safe) | Filter suggested_top_15:true from RecommendResult; nuqs URL encoding; Intl.RelativeTimeFormat for ages |
| I18N-01 | App defaults to Vietnamese language throughout | next-intl 4.8.3 without i18n routing; cookie-based locale; vi default in i18n/request.ts |
| I18N-02 | User can toggle to English language | Cookie set + router.refresh() pattern; toggle in header with localStorage read on mount |
| PIPE-05 | User can see data staleness (age and source) for every cutoff score displayed | scraped_at + source_url exist in cutoff_scores schema; Intl.RelativeTimeFormat; 90-day amber badge |
</phase_requirements>

---

## Summary

Phase 3 is a pure frontend phase that consumes six existing API endpoints and delivers the complete user-facing PWA. The backend schema already contains `scraped_at` and `source_url` on `cutoff_scores`, the `RecommendResult` type exposes `suggested_top_15` and `tier`, and the `/api/recommend` endpoint is fully functional. No backend changes are required.

The three major technical challenges are: (1) Serwist + Next.js 16 integration, where Next.js 16 defaults to Turbopack but Serwist requires webpack for the `next build` step — requiring a split dev/build script configuration; (2) next-intl without URL-based locale routing, which uses a cookie + `router.refresh()` pattern that has known cache-invalidation edge cases; (3) nuqs URL encoding of the 15-item nguyện vọng list, which requires a compact serialization strategy to stay within URL length limits.

The project uses Next.js 16.1.7 (already installed), React 19.2.3, and Tailwind CSS v4 (installed). This research confirms all three new libraries (next-intl 4.8.3, nuqs 2.8.9, @serwist/next 9.5.7) are the current stable releases and are compatible with the existing stack.

**Primary recommendation:** Install next-intl, nuqs, and @serwist/next. Split package.json scripts to `"dev": "next dev --turbopack"` and `"build": "next build --webpack"`. Use next-intl without i18n routing (cookie + router.refresh). Use nuqs NuqsAdapter in root layout. Build components in a flat `components/` directory under the project root using relative imports (no `@/` alias).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next-intl | 4.8.3 | i18n strings, locale switching | Official Next.js App Router i18n recommendation; supports without-routing mode; useTranslations works in RSC and client |
| nuqs | 2.8.9 | URL query string state (scores, nguyện vọng list) | Type-safe useState-equivalent for URL params; NuqsAdapter works with App Router; batch updates atomic |
| @serwist/next | 9.5.7 | Service worker / PWA / offline caching | next-pwa successor; supports Next.js 16 App Router; active maintenance; Turbopack backport in 9.x |
| serwist | 9.5.7 | Service worker runtime (peer dep of @serwist/next) | Must match @serwist/next version |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/react | 16.3.2 | Component tests in jsdom | Needed for testing React client components; install alongside vitest |
| @testing-library/dom | 10.4.1 | DOM query utilities | Peer dep of @testing-library/react |
| jsdom | 29.0.0 | Browser DOM simulation for Vitest | Required to set `environment: 'jsdom'` in vitest config per-test |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| next-intl without routing | next-intl with [locale] URL segment | URL routing is more SEO-friendly but adds folder nesting and middleware; overkill for this app |
| nuqs | React.useState + URL.searchParams manual | nuqs handles serialization, browser history, RSC search params — hand-rolling is error-prone |
| @serwist/next | next-pwa | next-pwa does not support Turbopack; maintenance stalled |

**Installation:**
```bash
npm install next-intl nuqs @serwist/next serwist
npm install -D @testing-library/react @testing-library/dom jsdom
```

**Version verification (confirmed against npm registry 2026-03-18):**
- next-intl: 4.8.3 (latest stable)
- nuqs: 2.8.9 (latest stable)
- @serwist/next: 9.5.7 (latest stable)
- serwist: 9.5.7 (must match @serwist/next)

---

## Architecture Patterns

### Recommended Project Structure
```
app/
├── layout.tsx              # NuqsAdapter + NextIntlClientProvider wrap
├── page.tsx                # Score entry UI (quick + detailed mode tabs)
├── manifest.ts             # Next.js metadata route for PWA manifest
├── sw.ts                   # Serwist service worker entry point
├── ~offline/
│   └── page.tsx            # Offline fallback page
messages/
├── vi.json                 # Vietnamese strings (default locale)
└── en.json                 # English strings
i18n/
└── request.ts              # getRequestConfig — reads locale from cookie
components/
├── ScoreForm.tsx            # Quick mode + detailed mode tabs
├── ResultsList.tsx          # Tier-colored recommendation results
├── NguyenVongList.tsx       # 15-choice builder with tier badges
├── UniversitySearch.tsx     # Diacritic-aware search + tổ hợp filter
├── StalenessIndicator.tsx   # scraped_at relative time + source link
└── LocaleToggle.tsx         # Cookie-set + router.refresh locale switch
public/
├── sw.js                    # Generated by Serwist build (do not edit)
└── icons/                   # PWA icons (192x192, 512x512 required)
```

Note: No `@/` path alias. The existing tsconfig maps `@/*` to `./src/*` which does not exist. Use relative imports throughout (e.g., `../../components/ResultsList`).

### Pattern 1: Serwist App Router Setup

**What:** Wrap next.config.ts with `withSerwistInit`; place service worker at `app/sw.ts`.

**When to use:** Only for the initial setup task.

```typescript
// next.config.ts — Source: https://serwist.pages.dev/docs/next/getting-started
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development", // disable in dev to avoid caching interference
});

export default withSerwist({
  // existing Next.js config here
});
```

```typescript
// app/sw.ts — Source: https://serwist.pages.dev/docs/next/getting-started
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Exclude /api/recommend (personalized, never cache)
    {
      urlPattern: /\/api\/recommend.*/,
      handler: "NetworkOnly",
      options: {},
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [{
      url: "/~offline",
      matcher({ request }) {
        return request.destination === "document";
      },
    }],
  },
});

serwist.addEventListeners();
```

**CRITICAL build script split** (Next.js 16 Turbopack + Serwist webpack conflict):
```json
// package.json scripts
{
  "dev": "next dev --turbopack",
  "build": "next build --webpack",
  "start": "next start"
}
```

**tsconfig.json additions** (required for sw.ts compilation):
```json
{
  "compilerOptions": {
    "types": ["@serwist/next/typings"],
    "lib": ["dom", "dom.iterable", "esnext", "webworker"]
  },
  "exclude": ["node_modules", "public/sw.js"]
}
```

### Pattern 2: next-intl Without i18n Routing

**What:** Cookie-based locale; no URL prefix; provider wrap in layout.

**When to use:** All i18n setup tasks.

```typescript
// i18n/request.ts — Source: https://next-intl.dev/docs/getting-started/app-router/without-i18n-routing
import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = store.get('NEXT_LOCALE')?.value || 'vi'; // default Vietnamese

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

```typescript
// next.config.ts addition
import createNextIntlPlugin from 'next-intl/plugin';
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');
// Compose: withSerwist(withNextIntl({ ... }))
```

```typescript
// app/layout.tsx — NextIntlClientProvider wrap (no locale prop needed in without-routing mode)
import { NextIntlClientProvider } from 'next-intl';
// ... NuqsAdapter wrap also goes here
```

```typescript
// components/LocaleToggle.tsx — locale switch pattern
'use client';
import { useRouter } from 'next/navigation';

export function LocaleToggle({ currentLocale }: { currentLocale: string }) {
  const router = useRouter();
  const toggle = () => {
    const next = currentLocale === 'vi' ? 'en' : 'vi';
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000`;
    router.refresh(); // triggers RSC re-render with new locale from cookie
  };
  return <button onClick={toggle}>{currentLocale === 'vi' ? 'EN' : 'VI'}</button>;
}
```

### Pattern 3: nuqs URL State

**What:** Wrap root layout with `NuqsAdapter`; use `useQueryState` / `useQueryStates` in client components.

```typescript
// app/layout.tsx
import { NuqsAdapter } from 'nuqs/adapters/next/app';
// ...
<NuqsAdapter>
  <NextIntlClientProvider>
    {children}
  </NextIntlClientProvider>
</NuqsAdapter>
```

```typescript
// Score form — quick mode URL state
// Source: https://nuqs.dev/docs/adapters
'use client';
import { useQueryStates } from 'nuqs';
import { parseAsString, parseAsFloat } from 'nuqs';

const [scoreState, setScoreState] = useQueryStates({
  tohop: parseAsString.withDefault(''),
  score: parseAsFloat.withDefault(0),
});
```

```typescript
// Nguyện vọng list — encode as JSON array in URL
// Keep compact: encode university_id + major_id pairs only
import { parseAsJson } from 'nuqs';

const [nguyenVong, setNguyenVong] = useQueryState(
  'nv',
  parseAsJson<Array<{ u: string; m: string }>>().withDefault([])
);
```

### Pattern 4: Diacritic-Aware Vietnamese Search

**What:** Normalize both query and target to NFD, strip combining characters.

```typescript
// Source: CONTEXT.md decision + MDN String.prototype.normalize
function normalizeVi(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritical marks
    .toLowerCase();
}

// Usage in filter
const filtered = universities.filter(u =>
  normalizeVi(u.name_vi).includes(normalizeVi(query))
);
```

Note: This strips ALL diacritics including tones. For display, always use the original un-normalized string.

### Pattern 5: Data Staleness Display

**What:** Format `scraped_at` as relative time; show amber badge if > 90 days old.

```typescript
// Source: CONTEXT.md + MDN Intl.RelativeTimeFormat
function formatStaleness(scrapedAt: string, locale: string): string {
  const ageMs = Date.now() - new Date(scrapedAt).getTime();
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (ageDays < 1) return rtf.format(0, 'day');
  if (ageDays < 30) return rtf.format(-ageDays, 'day');
  if (ageDays < 365) return rtf.format(-Math.floor(ageDays / 30), 'month');
  return rtf.format(-Math.floor(ageDays / 365), 'year');
}

const isStale = (scrapedAt: string) =>
  Date.now() - new Date(scrapedAt).getTime() > 90 * 24 * 60 * 60 * 1000;
```

### Pattern 6: Vietnamese Font Setup

**What:** Use next/font/google with `subsets: ['latin', 'vietnamese']` to prevent font substitution fallback.

```typescript
// app/layout.tsx
import { Be_Vietnam_Pro } from 'next/font/google';
const font = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600'],
  variable: '--font-be-vietnam',
});
```

Alternatives: `Noto_Sans` with `subsets: ['latin', 'vietnamese']` also works. The key is the `'vietnamese'` subset; without it, browsers may substitute system fonts that render tones incorrectly on some devices.

### Anti-Patterns to Avoid
- **Using `@/` path alias:** tsconfig maps this to `./src/*` which does not exist in this project. Always use relative imports.
- **Caching /api/recommend in service worker:** This is personalized by score input; caching it breaks correctness. Use `NetworkOnly` rule placed before `defaultCache`.
- **Setting locale in localStorage only:** localStorage is not available during SSR. Use `document.cookie` on client and `cookies()` on server, both keyed to `NEXT_LOCALE`.
- **Running `next build` with Turbopack:** Serwist requires webpack for the build step. `next build --webpack` is mandatory.
- **Placing sw.ts outside app/:** For App Router, service worker source must be at `app/sw.ts`. Pages Router uses a different location.
- **Forgetting `exclude: ["public/sw.js"]` in tsconfig:** Without this, TypeScript tries to type-check the compiled service worker output, causing errors.
- **Using `withNextIntl` without composing with `withSerwist`:** Both plugins must wrap `nextConfig`. Compose them: `withSerwist(withNextIntl({ ... }))`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL query string state | Manual URLSearchParams + useEffect | nuqs `useQueryState` | Handles SSR search params, browser history, type parsing, atomic batch updates |
| i18n string management | Object map + conditional rendering | next-intl `useTranslations` | Handles RSC + client, locale-aware pluralization, missing key detection |
| Service worker / offline | Custom fetch event listeners | Serwist `defaultCache` + runtime caching | Cache strategies (NetworkFirst, CacheFirst, StaleWhileRevalidate) require subtle expiry/conflict logic |
| PWA manifest | Static `public/manifest.json` | `app/manifest.ts` metadata route | Next.js 16 App Router generates it with proper cache headers; metadata route auto-linked in `<head>` |
| Relative time formatting | Manual "X days ago" string | `Intl.RelativeTimeFormat` | Already in CONTEXT.md decision; handles locale-aware pluralization and edge cases |

**Key insight:** All three external libraries (nuqs, next-intl, @serwist/next) exist precisely because their respective domains (URL state, i18n, service workers) have enough edge cases that hand-rolled solutions consistently fail at scale or under locale-switching.

---

## Common Pitfalls

### Pitfall 1: Serwist webpack/Turbopack Build Conflict
**What goes wrong:** `next build` fails with "This build is using Turbopack, with a webpack config" error because `withSerwistInit` injects a webpack config and Next.js 16 defaults to Turbopack.
**Why it happens:** Next.js 16 made Turbopack the default bundler. Serwist's Next.js plugin injects webpack configuration at build time. The two are incompatible unless explicitly separated.
**How to avoid:** Set `"build": "next build --webpack"` in package.json scripts. Keep `"dev": "next dev --turbopack"` for fast development.
**Warning signs:** Build error mentioning turbopack + webpack config conflict; service worker not generated after `next build`.

### Pitfall 2: next-intl Cookie Cache Stale on Locale Switch
**What goes wrong:** After `router.refresh()`, the page re-renders but still shows the old locale because Next.js RSC cache returns a HIT.
**Why it happens:** Next.js caches RSC responses. `router.refresh()` should bust this, but in some deployment configurations the upstream cache (Vercel Edge) may serve stale content.
**How to avoid:** Set the cookie with `path=/` and `max-age` (not session-only). If cache issues persist, call `revalidatePath('/', 'layout')` via a Server Action instead of relying on `router.refresh()` alone.
**Warning signs:** Language toggle appears to work (no error) but page text does not change until full browser reload.

### Pitfall 3: nuqs Encoding Makes URL Unreadable for Nguyện Vọng List
**What goes wrong:** Encoding 15 items as JSON produces a URL > 2000 characters, which breaks sharing on some platforms and may be truncated by SMS.
**Why it happens:** Each item has university_id (3-5 chars) + major_id (7 chars). 15 items as JSON array = ~300 chars minimum, but URL-encoding inflates it.
**How to avoid:** Use compact encoding: store only `{u: universityId, m: majorId}` pairs. Strip all unnecessary keys. Use `parseAsJson` with a compact schema. Consider a 30-char max shortcode if list grows. For v1 with 15 items, this is within limits if keys are short.
**Warning signs:** URL > 2000 characters in browser address bar during testing.

### Pitfall 4: Service Worker Serves Stale /api/universities After Data Update
**What goes wrong:** User sees old university list because service worker cache hasn't expired.
**Why it happens:** `defaultCache` uses StaleWhileRevalidate for API routes, which serves from cache immediately and updates in background. If the app scrapes new data, the cache update is transparent to the current session.
**How to avoid:** For `/api/universities` and `/api/tohop`, this behavior is acceptable (data changes infrequently). Add `"Offline — showing cached data"` banner when service worker detects offline mode. No action needed for the cache staleness itself in v1.
**Warning signs:** University list shows old data immediately after a scrape run — this is by design for StaleWhileRevalidate, not a bug.

### Pitfall 5: `lib["webworker"]` TypeScript Conflict
**What goes wrong:** Adding `"webworker"` to `tsconfig.json` lib causes TypeScript errors in regular app code where browser globals like `Window` conflict with `ServiceWorkerGlobalScope`.
**Why it happens:** Both `"dom"` and `"webworker"` define global objects that overlap.
**How to avoid:** Create a separate `tsconfig.sw.json` that extends the root config and only adds `"webworker"` to lib, then reference it only for `app/sw.ts`. Alternatively, use the `exclude: ["public/sw.js"]` approach from Serwist docs and accept that `app/sw.ts` may have minor type warnings in the IDE.
**Warning signs:** Type errors about `Window` not assignable to `ServiceWorkerGlobalScope` or vice versa in non-service-worker files.

### Pitfall 6: Vietnamese Characters Displaying as Boxes (Font Fallback)
**What goes wrong:** Vietnamese tone marks (dấu sắc, huyền, nặng, etc.) display as empty boxes or incorrect glyphs on mobile devices that lack a Vietnamese system font.
**Why it happens:** If no Google Font with `subsets: ['vietnamese']` is loaded, browsers fall back to system fonts. Android system fonts vary by manufacturer; some don't support Vietnamese extended Unicode.
**How to avoid:** Load a Google Font that includes the Vietnamese subset using `next/font/google`. Use `Be_Vietnam_Pro` or `Noto_Sans` with `subsets: ['latin', 'vietnamese']`.
**Warning signs:** Text looks fine on macOS/iOS (Apple fonts cover Vietnamese) but shows boxes on some Android devices during testing.

---

## Code Examples

Verified patterns from official sources and confirmed against existing project:

### API Response Shape (RecommendResult)
```typescript
// Source: lib/recommend/types.ts (existing project file)
interface RecommendResult {
  university_id: string;
  university_name_vi: string;
  major_id: string;
  major_name_vi: string;
  tohop_code: string;
  weighted_cutoff: number;
  tier: 'dream' | 'practical' | 'safe';
  trend: 'rising' | 'falling' | 'stable';
  data_years_limited: boolean;
  years_available: number;
  suggested_top_15: boolean;
}
// Note: scraped_at and source_url are NOT in RecommendResult.
// They must be fetched separately via /api/scores?university_id=X
// OR the /api/recommend endpoint must be extended to include them.
// DESIGN DECISION NEEDED: See Open Questions #1.
```

### Tier Color Mapping (Tailwind v4)
```typescript
// Source: CONTEXT.md decisions
const TIER_COLORS = {
  dream:     'text-blue-500 border-blue-500 bg-blue-50',
  practical: 'text-green-500 border-green-500 bg-green-50',
  safe:      'text-amber-500 border-amber-500 bg-amber-50',
} as const;
```

### Client-Side Tổ Hợp Score Calculation (Detailed Mode)
```typescript
// Source: CONTEXT.md decisions + /api/tohop response shape
// tohop_codes.subjects = ["Toan","Ly","HoaHoc"] (array of 3 subjects)
function calculateTotal(
  subjectScores: Record<string, number>, // { "Toan": 9.5, "Ly": 8.0, ... }
  subjects: string[]                     // from TohopCode.subjects
): number | null {
  const scores = subjects.map(s => subjectScores[s]);
  if (scores.some(s => s === undefined)) return null; // missing required subject
  return scores.reduce((sum, s) => sum + s, 0);
}
```

### Offline Detection Banner
```typescript
// Source: MDN navigator.onLine
'use client';
import { useEffect, useState } from 'react';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  useEffect(() => {
    setIsOffline(!navigator.onLine);
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);
  if (!isOffline) return null;
  return (
    <div className="bg-amber-100 text-amber-800 text-sm px-4 py-2 text-center">
      Offline — showing cached data
    </div>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| next-pwa | @serwist/next | 2023–2024 | next-pwa does not support Turbopack; Serwist is the maintained fork |
| Pages Router locale files | next-intl with App Router | Next.js 13+ | No built-in App Router i18n; next-intl fills the gap |
| Manual URL state with useEffect | nuqs useQueryState | 2023+ | Eliminates sync bugs between URL and component state |
| `"build": "next build"` | `"build": "next build --webpack"` (with Serwist) | Next.js 16 | Turbopack is now default; Serwist still requires webpack |
| `swSrc: "public/sw.ts"` | `swSrc: "app/sw.ts"` | App Router era | Service worker source lives in app/ for App Router projects |

**Deprecated/outdated:**
- `next-pwa`: Incompatible with Turbopack; not maintained for Next.js 15+. Do not use.
- `react-intl` / `i18next` for Next.js App Router: Not native to App Router; require extra boilerplate. next-intl is the App Router-native choice.
- `@next/font` (old syntax): Replaced by `next/font/google` in current Next.js.

---

## Open Questions

1. **scraped_at / source_url not in /api/recommend response**
   - What we know: `RecommendResult` type (from `lib/recommend/types.ts`) does not include `scraped_at` or `source_url`. These fields exist in the `cutoff_scores` DB schema and are available via `/api/scores?university_id=X`.
   - What's unclear: The Phase 3 requirement PIPE-05 says "every cutoff score displayed" must show data age and source. This requires either (a) extending the recommend API response to include scraped_at + source_url per result, or (b) fetching per-university scores separately and joining on client.
   - Recommendation: Extend `/api/recommend` response to include `scraped_at` and `source_url` per result row. This is a small DB query change (add two fields to the SELECT in `route.ts`) and avoids N+1 API calls from the client. This is the only Phase 2 → Phase 3 bridge change needed.

2. **PWA manifest icons**
   - What we know: PWA installability requires at minimum 192×192 and 512×512 PNG icons. No icons currently exist in `public/`.
   - What's unclear: Whether to generate them programmatically (aurora scharff article covers this for Next.js 16) or provide static PNGs.
   - Recommendation: Create static placeholder icons in `public/icons/` as part of Wave 0 setup. Generation can be deferred.

3. **Vitest environment for component tests**
   - What we know: Current `vitest.config.mts` uses `environment: 'node'`. React component tests require `environment: 'jsdom'`. Changing globally would break existing API route tests.
   - What's unclear: Whether to add per-file docblock `// @vitest-environment jsdom` or configure a test `include` pattern that routes `*.test.tsx` files to jsdom and `*.test.ts` to node.
   - Recommendation: Use `// @vitest-environment jsdom` docblock at the top of each component test file. This is the simplest approach that does not affect existing tests.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.mts` (exists) |
| Quick run command | `npx vitest run --reporter=verbose tests/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SRCH-01 | normalizeVi strips diacritics and matches correctly | unit | `npx vitest run tests/utils/normalize.test.ts -x` | ❌ Wave 0 |
| SRCH-02 | filter by tổ hợp code narrows university list | unit | `npx vitest run tests/components/UniversitySearch.test.tsx -x` | ❌ Wave 0 |
| SCOR-01 | quick mode form calls /api/recommend with correct params | unit | `npx vitest run tests/components/ScoreForm.test.tsx -x` | ❌ Wave 0 |
| SCOR-02 | calculateTotal sums subjects correctly, returns null for missing | unit | `npx vitest run tests/utils/calculateTotal.test.ts -x` | ❌ Wave 0 |
| NGVG-01 | suggested_top_15 results are filtered and URL-encoded | unit | `npx vitest run tests/components/NguyenVongList.test.tsx -x` | ❌ Wave 0 |
| I18N-01 | Vietnamese is the default locale when no cookie set | unit | `npx vitest run tests/i18n/request.test.ts -x` | ❌ Wave 0 |
| I18N-02 | locale toggle sets NEXT_LOCALE cookie and calls router.refresh | unit | `npx vitest run tests/components/LocaleToggle.test.tsx -x` | ❌ Wave 0 |
| PIPE-05 | isStale returns true for scraped_at > 90 days; false otherwise | unit | `npx vitest run tests/utils/staleness.test.ts -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/` (fast — skips scraper tests)
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/utils/normalize.test.ts` — covers SRCH-01; pure function, no mocks needed
- [ ] `tests/utils/calculateTotal.test.ts` — covers SCOR-02; pure function
- [ ] `tests/utils/staleness.test.ts` — covers PIPE-05; pure function
- [ ] `tests/i18n/request.test.ts` — covers I18N-01; mock `next/headers` cookies()
- [ ] `tests/components/ScoreForm.test.tsx` — covers SCOR-01; add `// @vitest-environment jsdom`
- [ ] `tests/components/UniversitySearch.test.tsx` — covers SRCH-02; jsdom
- [ ] `tests/components/NguyenVongList.test.tsx` — covers NGVG-01; jsdom
- [ ] `tests/components/LocaleToggle.test.tsx` — covers I18N-02; jsdom
- [ ] Install `@testing-library/react @testing-library/dom jsdom` as devDependencies

---

## Sources

### Primary (HIGH confidence)
- `https://serwist.pages.dev/docs/next/getting-started` — exact next.config setup, sw.ts contents, tsconfig changes, App Router paths
- `https://next-intl.dev/docs/getting-started/app-router/without-i18n-routing` — cookie-based locale setup, files required, router.refresh pattern
- `https://nuqs.dev/docs/adapters` — NuqsAdapter import path for Next.js App Router
- npm registry (`npm view` 2026-03-18) — confirmed versions: next-intl@4.8.3, nuqs@2.8.9, @serwist/next@9.5.7, serwist@9.5.7
- `lib/recommend/types.ts` (project file) — RecommendResult shape
- `lib/db/schema.ts` (project file) — scraped_at and source_url existence confirmed

### Secondary (MEDIUM confidence)
- `https://blog.logrocket.com/nextjs-16-pwa-offline-support/` — confirmed `"build": "next build --webpack"` split; disable SW in dev pattern
- `https://github.com/serwist/serwist/issues/54` — Turbopack support status confirmed backported to 9.x
- `https://github.com/amannn/next-intl/issues/1334` — cache invalidation pitfall with router.refresh confirmed

### Tertiary (LOW confidence — flag for validation)
- nuqs nguyện vọng list URL length concern: estimated from character counts; not empirically tested against 15 real items

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions confirmed against npm registry 2026-03-18
- Architecture: HIGH — patterns from official docs; project structure from existing codebase inspection
- Pitfalls: HIGH (Serwist/Turbopack) / MEDIUM (next-intl cache) — both verified with GitHub issues
- Validation architecture: HIGH — pure functions are directly testable; component tests follow established Vitest jsdom pattern

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (30 days — these are stable libraries; Serwist Turbopack integration may change sooner if v10 ships)
