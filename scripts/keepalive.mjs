/**
 * Supabase keep-alive ping.
 * Runs via GitHub Actions cron to prevent free-tier auto-pause.
 * Uses .mjs extension for native ESM (avoids tsx/esbuild dependency).
 */
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('ERROR: DATABASE_URL not set');
  process.exit(1);
}

const sql = postgres(url, { prepare: false });
try {
  const result = await sql`SELECT 1 as ok`;
  console.log('keep-alive: database is active', result);
  const pruned = await sql`
    DELETE FROM scrape_runs
    WHERE run_at < NOW() - INTERVAL '90 days'
    RETURNING id
  `;
  console.log(`keep-alive: pruned ${pruned.length} scrape_run rows older than 90 days`);
} finally {
  await sql.end();
}
