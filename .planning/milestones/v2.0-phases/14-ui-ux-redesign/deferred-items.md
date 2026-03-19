# Deferred Items — Phase 14

## Pre-existing TypeScript error: scripts/discover.ts cheerio version conflict

**Found during:** Task 2 verification (npx next build)
**Error:** `Type error: Argument of type 'import(".../node_modules/@crawlee/utils/node_modules/cheerio/lib/esm/load").CheerioAPI' is not assignable to parameter of type 'import(".../node_modules/cheerio/dist/esm/load").CheerioAPI'. Property 'extract' is missing in type...`
**Location:** `scripts/discover.ts:195`
**Root cause:** `@crawlee/utils` vendors its own nested `cheerio` in `node_modules/@crawlee/utils/node_modules/cheerio`. When our root `tsconfig.json` includes `**/*.ts`, TypeScript picks up both cheerio types and they conflict.
**Impact:** `npx next build` TypeScript check fails. The error pre-existed Plan 14-01 (confirmed by running build on f0f7ecd).
**Fix options:**
1. Add `"scripts"` to `tsconfig.json` `exclude` array
2. Upgrade or pin `@crawlee/utils` to resolve the nested cheerio conflict
3. Cast the `$` parameter in `scripts/discover.ts` to `any` as a quick fix
**Scope:** Out of scope for Plan 14-01 — pre-existing issue not caused by this task's changes
