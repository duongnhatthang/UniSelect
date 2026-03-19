import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { ScraperAdapter } from './types';
import { createCheerioAdapter } from './factory';
import type { CheerioAdapterConfig } from './factory';

interface RegistryEntry {
  id: string;
  adapter: string;
  url: string;
  static_verified: boolean;
  note?: string;
  factory_config?: Omit<CheerioAdapterConfig, 'id'>;  // id comes from entry.id
}

interface ResolvedEntry {
  id: string;
  adapter: ScraperAdapter;
  url: string;
}

export async function loadRegistry(): Promise<ResolvedEntry[]> {
  const configPath = resolve(process.cwd(), 'scrapers.json');
  const entries: RegistryEntry[] = JSON.parse(readFileSync(configPath, 'utf-8'));
  const resolved: ResolvedEntry[] = [];

  for (const entry of entries) {
    if (!entry.static_verified) {
      console.warn(
        `[registry] Skipping ${entry.id} — static_verified is false. Manually verify the page is static HTML before enabling.`
      );
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

    resolved.push({ id: entry.id, adapter, url: entry.url });
  }

  return resolved;
}
