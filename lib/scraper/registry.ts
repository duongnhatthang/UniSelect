import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { ScraperAdapter } from './types';
import { createCheerioAdapter } from './factory';
import type { CheerioAdapterConfig } from './factory';

interface RegistryEntry {
  id: string;
  adapter: string;
  website_url: string;
  scrape_url: string | null;
  adapter_type?: 'cheerio' | 'playwright' | 'paddleocr' | 'skip' | 'pending';
  note?: string;
  factory_config?: Omit<CheerioAdapterConfig, 'id'>;
}

export interface ResolvedEntry {
  id: string;
  adapter: ScraperAdapter;
  url: string;
  adapterType: string;
}

export async function loadRegistry(): Promise<ResolvedEntry[]> {
  const configPath = resolve(process.cwd(), 'scrapers.json');
  const entries: RegistryEntry[] = JSON.parse(readFileSync(configPath, 'utf-8'));
  const resolved: ResolvedEntry[] = [];

  for (const entry of entries) {
    if (!entry.scrape_url || entry.adapter_type === 'skip') {
      if (!entry.scrape_url) {
        console.log(`[registry] ${entry.id} — no scrape_url yet, discovery pending`);
      }
      continue;
    }

    let adapter: ScraperAdapter;

    if (entry.factory_config) {
      // Use factory for cheerio-based adapters
      adapter = createCheerioAdapter({ id: entry.id, ...entry.factory_config });
    } else {
      // Dynamic import for non-cheerio adapters (GHA/PaddleOCR, Playwright)
      const mod = await import(`./adapters/${entry.adapter}`);
      adapter = mod.default ?? mod[`${entry.adapter}Adapter`];
    }

    resolved.push({ id: entry.id, adapter, url: entry.scrape_url, adapterType: entry.adapter_type ?? 'cheerio' });
  }

  return resolved;
}
