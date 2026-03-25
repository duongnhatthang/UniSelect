import { CheerioCrawler, Configuration } from '@crawlee/cheerio';
import { MemoryStorage } from '@crawlee/memory-storage';
import type {
  BaseHttpClient,
  HttpRequest,
  HttpResponse,
  StreamingHttpResponse,
  RedirectHandler,
} from '@crawlee/core';
import { Readable } from 'stream';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import os from 'os';
import type { DiscoveryCandidate } from '../lib/scraper/discovery/candidate';
import { scorePageForCutoffs } from '../lib/scraper/discovery/keyword-scorer';
import { SCORE_THRESHOLD } from '../lib/scraper/discovery/constants';
import { scorePageByGroundTruth, loadGroundTruth } from '../lib/scraper/discovery/ground-truth';

/**
 * A lightweight HTTP client that uses native Node.js `fetch` instead of `got-scraping`.
 *
 * This is required for test environments where MSW intercepts native fetch but NOT got-scraping.
 * CheerioCrawler uses this client for all requests including robots.txt fetches.
 */
class FetchHttpClient implements BaseHttpClient {
  async sendRequest<TResponseType extends 'text' | 'json' | 'buffer' = 'text'>(
    request: HttpRequest<TResponseType>,
  ): Promise<HttpResponse<TResponseType>> {
    const url = request.url.toString();
    const method = request.method?.toUpperCase() ?? 'GET';
    const headers = this.buildHeaders(request.headers);

    const response = await fetch(url, {
      method,
      headers,
      body:
        request.body instanceof Readable
          ? undefined
          : (request.body as BodyInit | undefined),
      signal: request.signal,
      redirect: request.followRedirect === false ? 'manual' : 'follow',
    });

    const responseHeaders = this.extractHeaders(response.headers);
    const responseUrl = response.url || url;

    let body: unknown;
    if (request.responseType === 'json') {
      body = await response.json();
    } else if (request.responseType === 'buffer') {
      const arrayBuffer = await response.arrayBuffer();
      body = Buffer.from(arrayBuffer);
    } else {
      body = await response.text();
    }

    return {
      url: responseUrl,
      statusCode: response.status,
      statusMessage: response.statusText,
      headers: responseHeaders,
      trailers: {},
      redirectUrls: [],
      complete: true,
      body: body as HttpResponse<TResponseType>['body'],
      request,
    };
  }

  async stream(
    request: HttpRequest,
    _onRedirect?: RedirectHandler,
  ): Promise<StreamingHttpResponse> {
    const url = request.url.toString();
    const method = request.method?.toUpperCase() ?? 'GET';
    const headers = this.buildHeaders(request.headers);

    const response = await fetch(url, {
      method,
      headers,
      signal: request.signal,
    });

    const responseHeaders = this.extractHeaders(response.headers);
    const responseUrl = response.url || url;

    if (!response.body) {
      throw new Error('Response body is null');
    }

    // Convert Web ReadableStream to Node.js Readable
    const nodeStream = Readable.fromWeb(
      response.body as Parameters<typeof Readable.fromWeb>[0],
    );

    let downloadedBytes = 0;
    const contentLength = parseInt(response.headers.get('content-length') ?? '0', 10) || 0;

    nodeStream.on('data', (chunk: Buffer) => {
      downloadedBytes += chunk.length;
    });

    return {
      url: responseUrl,
      statusCode: response.status,
      statusMessage: response.statusText,
      headers: responseHeaders,
      trailers: {},
      redirectUrls: [],
      complete: false,
      stream: nodeStream,
      request,
      get downloadProgress() {
        return {
          percent: contentLength > 0 ? downloadedBytes / contentLength : 0,
          transferred: downloadedBytes,
          total: contentLength || undefined,
        };
      },
      get uploadProgress() {
        return { percent: 0, transferred: 0 };
      },
    };
  }

  private buildHeaders(
    headers?: Record<string, string | string[] | undefined>,
  ): Record<string, string> {
    const result: Record<string, string> = {};
    if (!headers) return result;
    for (const [key, value] of Object.entries(headers)) {
      if (value === undefined) continue;
      result[key] = Array.isArray(value) ? value.join(', ') : value;
    }
    return result;
  }

  private extractHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
}

interface ScraperEntry {
  id: string;
  website_url: string;
  scrape_url: string | null;
  adapter_type: string;
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
  const httpClient = options?.useMemoryStorage ? new FetchHttpClient() : undefined;

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
      maxRequestsPerCrawl: 200,
      ...(httpClient ? { httpClient } : {}),

      async requestHandler({ $, request, enqueueLinks }) {
        const uniId = request.userData.universityId as string;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const keyword = scorePageForCutoffs(request.url, $ as any);

        // Ground-truth scoring: check if page contains known score-major pairs
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const groundTruth = scorePageByGroundTruth(uniId, $ as any);

        const score = keyword.score + groundTruth.score;
        const reasons = [...keyword.reasons, ...groundTruth.reasons];

        if (score > 0) {
          const existing = candidates.get(request.url);
          // Keep highest score for the same URL (deduplication)
          if (!existing || score > existing.score) {
            candidates.set(request.url, {
              url: request.url,
              universityId: uniId,
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
            '**/dao-tao*',
            '**/tin-tuc*',
            '**/nam-*',
            '**/2024*',
            '**/2025*',
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
    // Skip entries we already have a cutoff URL for
    if (entry.scrape_url !== null) continue;
    // Skip entries explicitly excluded
    if (entry.adapter_type === 'skip') continue;

    try {
      const parsed = new URL(entry.website_url);
      const homepage = `${parsed.protocol}//${parsed.hostname}/`;
      if (!seen.has(homepage)) {
        seen.add(homepage);
        startUrls.push({ url: homepage, universityId: entry.id });
      }
    } catch {
      console.warn(`[discover] Skipping invalid URL for ${entry.id}: ${entry.website_url}`);
    }
  }

  return startUrls;
}

// Main block — only runs when executed directly (not imported by tests)
if (process.argv[1]?.endsWith('discover.ts') || process.argv[1]?.endsWith('discover.js')) {
  (async () => {
    // Preload ground-truth data if available
    loadGroundTruth();

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
