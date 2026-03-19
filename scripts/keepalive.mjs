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
} finally {
  await sql.end();
}
