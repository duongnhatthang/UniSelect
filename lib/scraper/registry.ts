import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ScraperAdapter } from './types';

interface RegistryEntry {
  id: string;
  adapter: string;
  url: string;
  static_verified: boolean;
  note?: string;
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
    const mod = await import(`./adapters/${entry.adapter}`);
    // Each adapter module exports a named adapter object conforming to ScraperAdapter
    const adapter: ScraperAdapter = mod.default ?? mod[`${entry.adapter}Adapter`];
    resolved.push({ id: entry.id, adapter, url: entry.url });
  }

  return resolved;
}
