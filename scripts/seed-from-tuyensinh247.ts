/**
 * seed-from-tuyensinh247.ts
 *
 * Extracts cutoff score data from diemthi.tuyensinh247.com for all universities.
 * The site uses Next.js SSR with flight data embedded in `self.__next_f.push()` calls.
 * No Playwright needed — plain fetch + regex extraction.
 *
 * Data includes: major code, major name, tohop codes, score, year, admission method.
 * Only extracts "Điểm thi THPT" (THPT exam) admission method scores.
 *
 * Usage:
 *   npx tsx scripts/seed-from-tuyensinh247.ts
 *   npx tsx scripts/seed-from-tuyensinh247.ts --limit 10   # Test with 10 universities
 *
 * Output: data/seed/tuyensinh247-scores.json
 */

import { writeFileSync, readFileSync } from 'fs';
import { resolve } from 'path';

interface ScoreRecord {
  id: number;
  school_id: number;
  code: string;          // major code e.g. "7310101"
  name: string;          // major name
  block: string;         // tohop codes e.g. "A00; A01; D01; D07"
  mark: number;          // cutoff score
  year: number;
  mark_type: number;
  admission_name: string;
  admission_alias: string;
}

interface RawRow {
  university_id: string;
  major_raw: string;
  tohop_raw: string;
  year: number;
  score_raw: string;
  source_url: string;
}

interface UniversityEntry {
  code: string;
  slug: string;
}

const BASE_URL = 'https://diemthi.tuyensinh247.com';
const DELAY_MS = 1500; // Rate limit: 1.5s between requests
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetch the main listing page and extract all university slug-code pairs.
 */
async function fetchUniversityList(): Promise<UniversityEntry[]> {
  const url = `${BASE_URL}/diem-chuan.html`;
  console.log(`[listing] Fetching ${url}`);

  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Failed to fetch listing: ${res.status}`);
  const html = await res.text();

  const entries: UniversityEntry[] = [];
  const seen = new Set<string>();
  const linkPattern = /href="\/diem-chuan\/([^"]+?)\.html"/g;

  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    const fullSlug = match[1];
    const parts = fullSlug.split('-');
    const code = parts[parts.length - 1];

    // Validate: code should be 2-4 uppercase letters
    if (/^[A-Z]{2,4}$/.test(code) && !seen.has(code)) {
      seen.add(code);
      const slug = parts.slice(0, -1).join('-');
      entries.push({ code, slug });
    }
  }

  console.log(`[listing] Found ${entries.length} universities`);
  return entries;
}

/**
 * Extract score records from Next.js flight data embedded in the HTML.
 * The data is in `self.__next_f.push([1, "..."])` calls containing JSON-like objects.
 */
function extractScoreRecords(html: string): ScoreRecord[] {
  const records: ScoreRecord[] = [];

  // Match JSON objects in the Next.js flight data
  // Pattern: "id":NNNN,"school_id":NNN,"code":"7XXXXXX",...
  const pattern = /\{[^{}]*"id":\d+[^{}]*"school_id":\d+[^{}]*"code":"[^"]*"[^{}]*"mark":[^{}]*"year":\d{4}[^{}]*\}/g;

  let match;
  while ((match = pattern.exec(html)) !== null) {
    try {
      // Unescape the JSON (it's double-escaped in the flight data)
      const jsonStr = match[0].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      const record = JSON.parse(jsonStr) as ScoreRecord;

      // Only keep records with valid data
      if (record.code && record.mark !== null && record.year) {
        records.push(record);
      }
    } catch {
      // Some matches may not be valid JSON — skip
    }
  }

  return records;
}

/**
 * Extract from Next.js RSC flight data which is double-escaped in the HTML.
 * Format in HTML: self.__next_f.push([1,"...\\nNN:{\\\"id\\\":186039,...}"])
 * After first unescape: \nNN:{"id":186039,...}
 */
function extractScoreRecordsRobust(html: string): ScoreRecord[] {
  const records: ScoreRecord[] = [];

  // The flight data uses \\" for quotes inside the push string.
  // Pattern matches the escaped JSON objects.
  const recordPattern = /\w+:\{\\"id\\":(\d+),\\"school_id\\":(\d+),\\"code\\":\\"([^\\]*?)\\",\\"display_code\\":[^,]*,\\"name\\":\\"([^\\]*?)\\",\\"block\\":\\"([^\\]*?)\\",\\"mark\\":([\d.]+),\\"quota\\":[^,]*,\\"type\\":\d+,\\"mark_type\\":(\d+),\\"year\\":(\d{4}),.*?\\"admission_name\\":\\"([^\\]*?)\\",\\"admission_alias\\":\\"([^\\]*?)\\"/g;

  let match;
  while ((match = recordPattern.exec(html)) !== null) {
    records.push({
      id: parseInt(match[1]),
      school_id: parseInt(match[2]),
      code: match[3],
      name: match[4].trim().replace(/\\u00a0/g, ' ').replace(/^\s+/, ''),
      block: match[5],
      mark: parseFloat(match[6]),
      year: parseInt(match[8]),
      mark_type: parseInt(match[7]),
      admission_name: match[9],
      admission_alias: match[10],
    });
  }

  return records;
}

/**
 * Convert score records to RawRow format for our pipeline.
 * Splits multiple tohop codes into individual rows.
 * Only includes THPT admission method.
 */
function toRawRows(records: ScoreRecord[], universityCode: string, sourceUrl: string): RawRow[] {
  const rows: RawRow[] = [];

  for (const record of records) {
    // Only include THPT exam scores
    if (record.admission_alias !== 'diem-thi-thpt') continue;

    // Split multiple tohop codes
    const tohopCodes = record.block.split(/;\s*/);

    for (const tohop of tohopCodes) {
      const cleaned = tohop.trim().toUpperCase();
      if (!cleaned) continue;

      rows.push({
        university_id: universityCode,
        major_raw: record.code,
        tohop_raw: cleaned,
        year: record.year,
        score_raw: String(record.mark),
        source_url: sourceUrl,
      });
    }
  }

  return rows;
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.indexOf('--limit');
  const limit = limitArg >= 0 ? parseInt(args[limitArg + 1]) : Infinity;

  // Step 1: Get university list
  const universities = await fetchUniversityList();
  const toProcess = universities.slice(0, Math.min(limit, universities.length));

  console.log(`\nProcessing ${toProcess.length} universities...\n`);

  const allRows: RawRow[] = [];
  const stats = {
    attempted: 0,
    succeeded: 0,
    failed: 0,
    zeroRows: 0,
    totalRows: 0,
  };

  // Step 2: Fetch each university page and extract data
  for (const uni of toProcess) {
    stats.attempted++;
    const url = `${BASE_URL}/diem-chuan/${uni.slug}-${uni.code}.html`;

    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (!res.ok) {
        console.log(`[${uni.code}] HTTP ${res.status} — skipping`);
        stats.failed++;
        await sleep(DELAY_MS);
        continue;
      }

      const html = await res.text();

      // Try robust extraction first, fall back to JSON parsing
      let records = extractScoreRecordsRobust(html);
      if (records.length === 0) {
        records = extractScoreRecords(html);
      }

      const rows = toRawRows(records, uni.code, url);

      if (rows.length === 0) {
        console.log(`[${uni.code}] 0 THPT rows (${records.length} total records)`);
        stats.zeroRows++;
      } else {
        console.log(`[${uni.code}] ${rows.length} THPT rows extracted`);
        allRows.push(...rows);
        stats.succeeded++;
        stats.totalRows += rows.length;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[${uni.code}] Error: ${msg}`);
      stats.failed++;
    }

    // Rate limit
    await sleep(DELAY_MS);
  }

  // Step 3: Write output
  const outputPath = resolve(process.cwd(), 'data/seed/tuyensinh247-scores.json');
  writeFileSync(outputPath, JSON.stringify(allRows, null, 2), 'utf-8');

  console.log(`\n=== Summary ===`);
  console.log(`Attempted: ${stats.attempted}`);
  console.log(`Succeeded: ${stats.succeeded}`);
  console.log(`Failed: ${stats.failed}`);
  console.log(`Zero THPT rows: ${stats.zeroRows}`);
  console.log(`Total THPT rows: ${stats.totalRows}`);
  console.log(`Output: ${outputPath}`);

  // Also write a mapping file for reference
  const mappingPath = resolve(process.cwd(), 'data/seed/tuyensinh247-mapping.json');
  const mapping = universities.map((u) => ({ code: u.code, slug: u.slug }));
  writeFileSync(mappingPath, JSON.stringify(mapping, null, 2), 'utf-8');
  console.log(`Mapping: ${mappingPath}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
