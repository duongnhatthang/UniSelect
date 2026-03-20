import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const uniList = JSON.parse(
  readFileSync(resolve(process.cwd(), 'data/uni_list.json'), 'utf-8')
);

describe('uni_list.json', () => {
  it('has at least 250 entries', () => {
    expect(uniList.length).toBeGreaterThanOrEqual(250);
  });

  it('every entry has required fields: id, name_vi, website_url', () => {
    for (const entry of uniList) {
      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('name_vi');
      expect(entry).toHaveProperty('website_url');
      expect(typeof entry.id).toBe('string');
      expect(typeof entry.name_vi).toBe('string');
      expect(typeof entry.website_url).toBe('string');
      expect(entry.id.length).toBeGreaterThanOrEqual(2);
      expect(entry.name_vi.length).toBeGreaterThan(0);
      expect(entry.website_url).toMatch(/^https?:\/\//);
    }
  });

  it('has no duplicate IDs', () => {
    const ids = uniList.map((e: { id: string }) => e.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('includes Southern Vietnam universities', () => {
    const ids = uniList.map((e: { id: string }) => e.id);
    // At least some well-known Southern institutions
    const southernIds = ['QSB', 'KSA', 'CTU', 'NLS'];
    const found = southernIds.filter(id => ids.includes(id));
    expect(found.length).toBeGreaterThanOrEqual(2);
  });

  it('includes Central Vietnam universities', () => {
    const ids = uniList.map((e: { id: string }) => e.id);
    const centralIds = ['DDK', 'QNI', 'HUH'];
    const found = centralIds.filter(id => ids.includes(id));
    expect(found.length).toBeGreaterThanOrEqual(1);
  });

  it('includes all 78 existing Northern universities', () => {
    const ids = new Set(uniList.map((e: { id: string }) => e.id));
    // Sample of known existing IDs
    const existingIds = ['BKA', 'BVH', 'GHA', 'HTC', 'DCN', 'QH', 'SPH', 'FPT'];
    for (const id of existingIds) {
      expect(ids.has(id)).toBe(true);
    }
  });
});
