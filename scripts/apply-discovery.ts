// Usage: npx tsx scripts/apply-discovery.ts [path/to/discovery-candidates.json]
// Human-gated: run locally after downloading artifact from GHA Actions tab.
// Never called from CI — see REQUIREMENTS.md "Out of Scope".

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import type { DiscoveryCandidate } from '../lib/scraper/discovery/candidate';

export interface ScraperEntry {
  id: string;
  adapter: string;
  website_url: string;
  scrape_url: string | null;
  adapter_type: string;
  note?: string;
  [key: string]: unknown;
}

/**
 * Pure function — no filesystem I/O. Applies discovery candidates to scrapers.json entries.
 *
 * Guards (critical safety constraints):
 * 1. Never overwrite entries that already have a non-null scrape_url.
 * 2. Never touch entries with adapter_type "skip".
 *
 * When patching:
 * - Sets scrape_url to the candidate URL.
 * - Sets adapter_type to "cheerio" so the registry gate runs the adapter.
 * - Candidates are assumed pre-sorted by score descending; first occurrence wins.
 */
export function applyDiscovery(
  entries: ScraperEntry[],
  candidates: DiscoveryCandidate[],
): { entries: ScraperEntry[]; patched: number } {
  // Build best-candidate map: first occurrence wins (pre-sorted descending by score)
  const bestByUni = new Map<string, DiscoveryCandidate>();
  for (const candidate of candidates) {
    if (!bestByUni.has(candidate.universityId)) {
      bestByUni.set(candidate.universityId, candidate);
    }
  }

  let patched = 0;

  const updated = entries.map((entry) => {
    // GUARD: never overwrite verified URLs
    if (entry.scrape_url !== null) {
      return entry;
    }
    // GUARD: never touch skip entries
    if (entry.adapter_type === 'skip') {
      return entry;
    }

    const candidate = bestByUni.get(entry.id);
    if (!candidate) {
      return entry;
    }

    console.log(`[apply] ${entry.id}: set scrape_url = ${candidate.url} (score ${candidate.score})`);
    patched++;

    return {
      ...entry,
      scrape_url: candidate.url,
      adapter_type: 'cheerio',
    };
  });

  return { entries: updated, patched };
}

// Main block — only runs when executed directly (not imported in tests)
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const candidatesPath = process.argv[2]
    ? resolve(process.argv[2])
    : resolve(process.cwd(), 'discovery-candidates.json');

  const scrapersPath = resolve(process.cwd(), 'scrapers.json');

  const candidates: DiscoveryCandidate[] = JSON.parse(readFileSync(candidatesPath, 'utf-8'));
  const entries: ScraperEntry[] = JSON.parse(readFileSync(scrapersPath, 'utf-8'));

  const { entries: updated, patched } = applyDiscovery(entries, candidates);

  writeFileSync(scrapersPath, JSON.stringify(updated, null, 2) + '\n', 'utf-8');
  console.log(`[apply] Patched ${patched} entries. scrapers.json updated.`);
}
