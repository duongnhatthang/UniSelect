import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

async function main() {
  const { db } = await import('../lib/db');
  const { universities, tohopCodes } = await import('../lib/db/schema');
  const { sql } = await import('drizzle-orm');

  const uniCount = await db.select({ count: sql<number>`count(*)` }).from(universities);
  const tohopCount = await db.select({ count: sql<number>`count(*)` }).from(tohopCodes);

  console.log('Universities:', uniCount[0].count);
  console.log('Tohop codes:', tohopCount[0].count);

  // Sample a few rows
  const sampleUnis = await db.select().from(universities).limit(3);
  console.log('\nSample universities:');
  sampleUnis.forEach(u => console.log(`  ${u.id}: ${u.name_vi}`));

  const sampleTohop = await db.select().from(tohopCodes).limit(3);
  console.log('\nSample tohop codes:');
  sampleTohop.forEach(t => console.log(`  ${t.code}: ${t.label_vi} (${t.subjects})`));

  process.exit(0);
}

main().catch(err => {
  console.error('DB connection failed:', err.message);
  process.exit(1);
});
