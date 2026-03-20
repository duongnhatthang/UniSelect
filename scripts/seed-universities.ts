import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { readFileSync } from 'fs';
import { resolve } from 'path';

interface UniListEntry {
  id: string;
  name_vi: string;
  website_url: string;
}

async function main() {
  const { db } = await import('../lib/db');
  const { universities } = await import('../lib/db/schema');

  const uniListPath = resolve(process.cwd(), 'data/uni_list.json');
  const uniList: UniListEntry[] = JSON.parse(readFileSync(uniListPath, 'utf-8'));

  console.log(`[seed] Loading ${uniList.length} universities from data/uni_list.json...`);

  let inserted = 0;
  let skipped = 0;

  for (const uni of uniList) {
    const result = await db.insert(universities).values({
      id: uni.id,
      name_vi: uni.name_vi,
      website_url: uni.website_url,
    }).onConflictDoNothing();

    // onConflictDoNothing returns rowCount 0 when skipped
    if (result && 'rowCount' in result && result.rowCount === 0) {
      skipped++;
    } else {
      inserted++;
    }
  }

  console.log(`[seed] Complete: ${inserted} inserted, ${skipped} skipped (already existed)`);
  console.log(`[seed] Total universities in data file: ${uniList.length}`);
  process.exit(0);
}

main().catch(err => {
  console.error('[seed] Failed:', err.message);
  process.exit(1);
});
