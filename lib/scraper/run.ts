import { loadRegistry } from './registry';
import { runScraper } from './runner';

async function main() {
  console.log('[scraper] Starting scrape run...');
  const registry = await loadRegistry();

  if (registry.length === 0) {
    console.warn(
      '[scraper] No adapters with static_verified=true. Set static_verified to true in scrapers.json after manual page audit.'
    );
    process.exit(0);
  }

  const shardIndex = parseInt(process.env.SHARD_INDEX ?? '0', 10);
  const shardTotal = parseInt(process.env.SHARD_TOTAL ?? '1', 10);
  const shard = registry.filter((_, i) => i % shardTotal === shardIndex);

  const githubRunId = process.env.GITHUB_RUN_ID ?? undefined;
  await runScraper(shard, githubRunId);
  console.log('[scraper] Scrape run complete.');
}

main().catch((err) => {
  console.error('[scraper] Fatal error:', err);
  process.exit(1);
});
