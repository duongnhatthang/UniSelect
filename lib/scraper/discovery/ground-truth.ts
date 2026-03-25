import type { CheerioAPI } from 'cheerio';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

interface SeedRow {
  university_id: string;
  major_raw: string;
  tohop_raw: string;
  year: number;
  score_raw: string;
}

/**
 * Known score-major pairs per university, loaded from seed data.
 * Key: university_id → Set of "score|major_id" fingerprints.
 */
let groundTruthMap: Map<string, Set<string>> | null = null;

const SEED_PATH = resolve(process.cwd(), 'data/seed/tuyensinh247-scores.json');

/**
 * Load ground-truth data from the seed file (lazy, cached).
 * Returns a Map: university_id → Set<"score|major_id">.
 */
export function loadGroundTruth(): Map<string, Set<string>> {
  if (groundTruthMap) return groundTruthMap;

  groundTruthMap = new Map();

  if (!existsSync(SEED_PATH)) {
    console.warn('[ground-truth] Seed file not found — ground-truth scoring disabled');
    return groundTruthMap;
  }

  const rows: SeedRow[] = JSON.parse(readFileSync(SEED_PATH, 'utf-8'));

  for (const row of rows) {
    const score = parseFloat(row.score_raw);
    if (isNaN(score)) continue;

    // Normalize score to 2 decimal places for matching
    const fingerprint = `${score.toFixed(2)}|${row.major_raw}`;

    if (!groundTruthMap.has(row.university_id)) {
      groundTruthMap.set(row.university_id, new Set());
    }
    groundTruthMap.get(row.university_id)!.add(fingerprint);
  }

  console.log(
    `[ground-truth] Loaded ${rows.length} rows for ${groundTruthMap.size} universities`,
  );
  return groundTruthMap;
}

/** Weight for ground-truth match (strongest signal) */
export const GROUND_TRUTH_WEIGHT = 10;

/** Minimum number of matching score-major pairs to assign ground-truth score */
export const MIN_MATCHES = 3;

/**
 * Score a page by checking if it contains known cutoff scores for a university.
 *
 * Extracts score-like numbers (XX.XX in 10-30 range) and major codes (7XXXXXX)
 * from the page text, then checks how many match ground-truth data.
 *
 * @param universityId - The university code to match against
 * @param $            - CheerioAPI loaded with the page HTML
 * @returns            - { score, matches, reasons }
 */
export function scorePageByGroundTruth(
  universityId: string,
  $: CheerioAPI,
): { score: number; matches: number; reasons: string[] } {
  const truthSet = loadGroundTruth().get(universityId);
  if (!truthSet || truthSet.size === 0) {
    return { score: 0, matches: 0, reasons: [] };
  }

  // Extract text from individual table cells to avoid concatenation issues
  // (cheerio .text() joins "7310101" and "25.43" into "731010125.43")
  const cellTexts: string[] = [];
  $('table td, table th').each((_, el) => {
    cellTexts.push($(el).text().trim());
  });

  // Also extract from body paragraphs as fallback
  if (cellTexts.length === 0) {
    $('p, li, span, div').each((_, el) => {
      const t = $(el).text().trim();
      if (t.length < 200) cellTexts.push(t);
    });
  }

  const text = cellTexts.join(' ');

  // Extract score-like numbers: XX.XX or XX,XX in range [10, 30]
  const scorePattern = /(\d{2}[.,]\d{1,2})/g;
  const foundScores = new Set<string>();
  let match;
  while ((match = scorePattern.exec(text)) !== null) {
    const val = parseFloat(match[1].replace(',', '.'));
    if (val >= 10 && val <= 30) {
      foundScores.add(val.toFixed(2));
    }
  }

  // Extract major codes: 7 followed by 6+ digits
  const majorPattern = /(7\d{6,})/g;
  const foundMajors = new Set<string>();
  while ((match = majorPattern.exec(text)) !== null) {
    foundMajors.add(match[1]);
  }

  // Count matches: a score+major pair from the page matches ground truth
  let matches = 0;
  const matchedPairs: string[] = [];

  for (const scoreVal of foundScores) {
    for (const majorVal of foundMajors) {
      const fingerprint = `${scoreVal}|${majorVal}`;
      if (truthSet.has(fingerprint)) {
        matches++;
        matchedPairs.push(fingerprint);
        if (matchedPairs.length >= 10) break; // Cap logging
      }
    }
    if (matchedPairs.length >= 10) break;
  }

  const reasons: string[] = [];
  if (matches >= MIN_MATCHES) {
    reasons.push(`ground-truth:${matches}-matches`);
    return { score: GROUND_TRUTH_WEIGHT, matches, reasons };
  }

  return { score: 0, matches, reasons };
}
