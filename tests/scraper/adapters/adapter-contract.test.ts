/**
 * Adapter Contract Tests
 *
 * Verifies that every adapter module exports an object conforming to the
 * ScraperAdapter interface: { id: string, scrape: function }
 *
 * These are shape-only tests — no actual HTTP requests are made.
 *
 * Dynamically reads scrapers.json so new adapters are automatically covered
 * without any changes to this file.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

interface RegistryEntry {
  id: string;
  adapter: string;
  static_verified: boolean;
  note?: string;
}

const registry: RegistryEntry[] = JSON.parse(
  readFileSync(resolve(process.cwd(), 'scrapers.json'), 'utf-8')
);

describe('Adapter contract: all adapters conform to ScraperAdapter interface', () => {
  for (const entry of registry) {
    const adapterFile = `../../../lib/scraper/adapters/${entry.adapter}`;
    const exportName = `${entry.adapter}Adapter`;

    describe(`${exportName} (${entry.id})`, () => {
      let adapter: { id: string; scrape: unknown };

      beforeAll(async () => {
        const mod = await import(adapterFile);
        adapter = mod[exportName];
      });

      it('exports an object (not null/undefined)', () => {
        expect(adapter).toBeDefined();
        expect(adapter).not.toBeNull();
        expect(typeof adapter).toBe('object');
      });

      it('has an id property of type string', () => {
        expect(typeof adapter.id).toBe('string');
        expect(adapter.id.length).toBeGreaterThan(0);
      });

      it(`has id equal to "${entry.id}"`, () => {
        expect(adapter.id).toBe(entry.id);
      });

      it('has a scrape property of type function', () => {
        expect(typeof adapter.scrape).toBe('function');
      });
    });
  }
});
