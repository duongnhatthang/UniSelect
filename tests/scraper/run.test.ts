import { describe, it, expect } from 'vitest';
import type { ResolvedEntry } from '../../lib/scraper/registry';
import { filterAndShard } from '../../lib/scraper/run';

// Fixed test registry: 3 cheerio, 1 playwright, 1 paddleocr
const makeEntry = (id: string, adapterType: string): ResolvedEntry => ({
  id,
  adapter: {} as ResolvedEntry['adapter'],
  url: `https://${id}.example.com`,
  adapterType,
});

const testRegistry: ResolvedEntry[] = [
  makeEntry('uni-1', 'cheerio'),
  makeEntry('uni-2', 'cheerio'),
  makeEntry('uni-3', 'cheerio'),
  makeEntry('uni-4', 'playwright'),
  makeEntry('uni-5', 'paddleocr'),
];

describe('filterAndShard', () => {
  it('SHARD_TYPE=cheerio returns only cheerio entries (3 of 5)', () => {
    const result = filterAndShard(testRegistry, 'cheerio', 0, 1);
    expect(result).toHaveLength(3);
    expect(result.every((e) => e.adapterType === 'cheerio')).toBe(true);
  });

  it('SHARD_TYPE=playwright returns only playwright entries (1 of 5)', () => {
    const result = filterAndShard(testRegistry, 'playwright', 0, 1);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('uni-4');
  });

  it('SHARD_TYPE=paddleocr returns only paddleocr entries (1 of 5)', () => {
    const result = filterAndShard(testRegistry, 'paddleocr', 0, 1);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('uni-5');
  });

  it('SHARD_TYPE=all returns all 5 entries', () => {
    const result = filterAndShard(testRegistry, 'all', 0, 1);
    expect(result).toHaveLength(5);
  });

  it('shard modulo applies AFTER type filtering: SHARD_TYPE=cheerio, shardIndex=0, shardTotal=2 returns entries at even indices of cheerio list', () => {
    // cheerio list: [uni-1, uni-2, uni-3] at indices 0,1,2
    // shard 0/2 = indices where i%2===0 => indices 0, 2 => uni-1, uni-3
    const result = filterAndShard(testRegistry, 'cheerio', 0, 2);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('uni-1');
    expect(result[1].id).toBe('uni-3');
  });
});
