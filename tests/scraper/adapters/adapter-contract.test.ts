/**
 * Adapter Contract Tests
 *
 * Verifies that every adapter module exports an object conforming to the
 * ScraperAdapter interface: { id: string, scrape: function }
 *
 * These are shape-only tests — no actual HTTP requests are made.
 */

import { describe, it, expect } from 'vitest';
import { ministryAdapter } from '../../../lib/scraper/adapters/ministry';
import { bkaAdapter } from '../../../lib/scraper/adapters/bka';
import { khaAdapter } from '../../../lib/scraper/adapters/kha';
import { nthAdapter } from '../../../lib/scraper/adapters/nth';
import { ghaAdapter } from '../../../lib/scraper/adapters/gha';
import { dcnAdapter } from '../../../lib/scraper/adapters/dcn';

const adapters = [
  { name: 'ministryAdapter', adapter: ministryAdapter, expectedId: 'MINISTRY' },
  { name: 'bkaAdapter', adapter: bkaAdapter, expectedId: 'BKA' },
  { name: 'khaAdapter', adapter: khaAdapter, expectedId: 'KHA' },
  { name: 'nthAdapter', adapter: nthAdapter, expectedId: 'NTH' },
  { name: 'ghaAdapter', adapter: ghaAdapter, expectedId: 'GHA' },
  { name: 'dcnAdapter', adapter: dcnAdapter, expectedId: 'DCN' },
];

describe('Adapter contract: all adapters conform to ScraperAdapter interface', () => {
  for (const { name, adapter, expectedId } of adapters) {
    describe(name, () => {
      it('exports an object (not null/undefined)', () => {
        expect(adapter).toBeDefined();
        expect(adapter).not.toBeNull();
        expect(typeof adapter).toBe('object');
      });

      it('has an id property of type string', () => {
        expect(typeof adapter.id).toBe('string');
        expect(adapter.id.length).toBeGreaterThan(0);
      });

      it(`has id equal to "${expectedId}"`, () => {
        expect(adapter.id).toBe(expectedId);
      });

      it('has a scrape property of type function', () => {
        expect(typeof adapter.scrape).toBe('function');
      });
    });
  }
});
