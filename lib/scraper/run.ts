import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import type { ResolvedEntry } from './registry';

export function filterAndShard(
  registry: ResolvedEntry[],
  shardType: string,
  shardIndex: number,
  shardTotal: number
): ResolvedEntry[] {
  const typeFiltered =
    shardType === 'all'
      ? registry
      : registry.filter((e) => e.adapterType === shardType);
  return typeFiltered.filter((_, i) => i % shardTotal === shardIndex);
}

async function main() {
  const { loadRegistry } = await import('./registry');
  const { runScraper } = await import('./runner');

  console.log('[scraper] Starting scrape run...');
  const registry = await loadRegistry();

  if (registry.length === 0) {
    console.warn(
      '[scraper] No adapters with scrape_url configured. Run discovery to find cutoff page URLs.'
    );
    process.exit(0);
  }

  const shardType = process.env.SHARD_TYPE ?? 'all';
  const shardIndex = parseInt(process.env.SHARD_INDEX ?? '0', 10);
  const shardTotal = parseInt(process.env.SHARD_TOTAL ?? '1', 10);
  const shard = filterAndShard(registry, shardType, shardIndex, shardTotal);

  const githubRunId = process.env.GITHUB_RUN_ID ?? undefined;
  const summary = await runScraper(shard, githubRunId);
  console.log(
    `[scraper] Summary -- shard ${shardIndex}/${shardTotal} (${shardType}): ` +
    `${summary.attempted} attempted, ${summary.succeeded} succeeded, ` +
    `${summary.failed} failed, ${summary.zero_rows} zero-rows`
  );
}

main().catch((err) => {
  console.error('[scraper] Fatal error:', err);
  process.exit(1);
});
