import { CheerioCrawler, Configuration } from '@crawlee/cheerio';
import { MemoryStorage } from '@crawlee/memory-storage';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import os from 'os';
import type { DiscoveryCandidate } from '../lib/scraper/discovery/candidate';
import { scorePageForCutoffs } from '../lib/scraper/discovery/keyword-scorer';
import { SCORE_THRESHOLD } from '../lib/scraper/discovery/constants';

interface ScraperEntry {
  id: string;
  url: string;
  static_verified: boolean;
}

interface StartUrl {
  url: string;
  universityId: string;
}

export interface RunDiscoverOptions {
  useMemoryStorage?: boolean;
}

/**
 * Run the auto-discovery crawler against a list of university homepages.
 *
 * @param startUrls  - Array of { url, universityId } to crawl
 * @param options    - Options for controlling crawler behavior (e.g. test isolation)
 * @returns          - Ranked array of DiscoveryCandidate (score >= SCORE_THRESHOLD, sorted descending)
 */
export async function runDiscover(
  startUrls: StartUrl[],
  options?: RunDiscoverOptions,
): Promise<DiscoveryCandidate[]> {
  const candidates: Map<string, DiscoveryCandidate> = new Map();

  let config: Configuration | undefined;

  if (options?.useMemoryStorage) {
    // Test isolation: use in-memory storage to avoid filesystem writes
    const storage = new MemoryStorage({ persistStorage: false });
    config = new Configuration({ storageClient: storage });
  } else {
    // Production: redirect crawlee storage to temp directory
    process.env.CRAWLEE_STORAGE_DIR = resolve(os.tmpdir(), 'crawlee-discover');
  }

  const crawler = new CheerioCrawler(
    {
      sameDomainDelaySecs: 2,
      respectRobotsTxtFile: { userAgent: 'UniSelectBot/1.0' },
      maxConcurrency: 1,
      maxRequestsPerCrawl: 50,

      async requestHandler({ $, request, enqueueLinks }) {
        const { score, reasons } = scorePageForCutoffs(request.url, $);

        if (score > 0) {
          const existing = candidates.get(request.url);
          // Keep highest score for the same URL (deduplication)
          if (!existing || score > existing.score) {
            candidates.set(request.url, {
              url: request.url,
              universityId: request.userData.universityId as string,
              score,
              reasons,
            });
          }
        }

        await enqueueLinks({
          strategy: 'same-hostname',
          globs: [
            '**/diem-chuan*',
            '**/diem-trung-tuyen*',
            '**/tuyen-sinh*',
            '**/xet-tuyen*',
            '**/thong-bao*',
            '**/tin-tuyen-sinh*',
            '**/ket-qua-trung-tuyen*',
          ],
          exclude: [
            '**/*.pdf',
            '**/*.jpg',
            '**/*.png',
            '**/*.gif',
            '**/*.doc',
            '**/*.docx',
            '**/*.xls',
            '**/*.xlsx',
          ],
          userData: request.userData,
        });
      },
    },
    config,
  );

  await crawler.run(
    startUrls.map(({ url, universityId }) => ({
      url,
      userData: { universityId },
    })),
  );

  // Filter by threshold, sort descending by score, deduplicate (Map already handles that)
  const results = Array.from(candidates.values())
    .filter((c) => c.score >= SCORE_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  return results;
}

/**
 * Build start URLs from scrapers.json — extract unique homepage origins
 * so the crawler starts at each university's root, not a deep cutoff URL.
 */
function buildStartUrlsFromScrapers(): StartUrl[] {
  const configPath = resolve(process.cwd(), 'scrapers.json');
  const entries: ScraperEntry[] = JSON.parse(readFileSync(configPath, 'utf-8'));

  const seen = new Set<string>();
  const startUrls: StartUrl[] = [];

  for (const entry of entries) {
    try {
      const parsed = new URL(entry.url);
      const homepage = `${parsed.protocol}//${parsed.hostname}/`;
      if (!seen.has(homepage)) {
        seen.add(homepage);
        startUrls.push({ url: homepage, universityId: entry.id });
      }
    } catch {
      console.warn(`[discover] Skipping invalid URL for ${entry.id}: ${entry.url}`);
    }
  }

  return startUrls;
}

// Main block — only runs when executed directly (not imported by tests)
if (process.argv[1]?.endsWith('discover.ts') || process.argv[1]?.endsWith('discover.js')) {
  (async () => {
    const startUrls = buildStartUrlsFromScrapers();
    console.log(`[discover] Starting discovery for ${startUrls.length} universities...`);

    const candidates = await runDiscover(startUrls);

    const outputPath = resolve(process.cwd(), 'discovery-candidates.json');
    writeFileSync(outputPath, JSON.stringify(candidates, null, 2), 'utf-8');

    console.log(
      `[discover] Discovered ${candidates.length} candidates from ${startUrls.length} universities`,
    );
    console.log(`[discover] Output written to: ${outputPath}`);
  })().catch((err) => {
    console.error('[discover] Fatal error:', err);
    process.exit(1);
  });
}
