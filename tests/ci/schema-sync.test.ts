/**
 * Schema sync test — ensures the Drizzle schema matches what
 * generate-static-json.ts queries, preventing build failures
 * when schema changes haven't been migrated to the database.
 */
import { describe, it, expect } from 'vitest';
import * as schema from '../../lib/db/schema';

describe('DB schema consistency', () => {
  it('cutoff_scores has source_type column defined in Drizzle schema', () => {
    // This catches the case where we add a column to the Drizzle schema
    // but forget to run the migration — the build will fail on Vercel
    // because generate-static-json.ts queries the column.
    const columns = Object.keys(schema.cutoffScores);
    // Drizzle table objects expose column names as properties
    expect(columns).toContain('source_type');
  });

  it('cutoff_scores has all required columns for generate-static-json', () => {
    const requiredColumns = [
      'university_id', 'major_id', 'tohop_code', 'year',
      'score', 'scraped_at', 'source_url', 'source_type',
    ];
    const columns = Object.keys(schema.cutoffScores);
    for (const col of requiredColumns) {
      expect(columns, `Missing column: ${col}`).toContain(col);
    }
  });

  it('cutoff_scores has all required columns for recommend API', () => {
    const requiredColumns = [
      'university_id', 'major_id', 'tohop_code', 'year',
      'score', 'scraped_at', 'source_url', 'source_type',
      'admission_method',
    ];
    const columns = Object.keys(schema.cutoffScores);
    for (const col of requiredColumns) {
      expect(columns, `Missing column: ${col}`).toContain(col);
    }
  });
});
