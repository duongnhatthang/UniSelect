/**
 * verify-adapters.ts — Adapter URL Verification Script
 *
 * Probes candidate university URLs to report HTTP status, table presence,
 * score keyword presence, and row count. Helps identify static-HTML candidates
 * suitable for cheerio-based adapters.
 *
 * Usage: npx tsx scripts/verify-adapters.ts
 *
 * Output format per candidate:
 *   {ID}: OK | table={boolean} | diem_chuan={boolean} | tr_count={number}
 *   {ID}: ERROR {message}
 */

import { fetchHTML } from '../lib/scraper/fetch';

interface Candidate {
  id: string;
  url: string;
}

const CANDIDATES: Candidate[] = [
  {
    id: 'HTC',
    url: 'https://tuyensinh.hvtc.edu.vn/tabid/1699/catid/916/news/38174/TB-vv-Ket-qua-trung-tuyen-he-dai-hoc-chinh-quy-nam-2025/Default.aspx',
  },
  {
    id: 'BVH',
    url: 'https://tuyensinh.ptit.edu.vn/gioi-thieu/xem-diem-cac-nam-truoc/diem-trung-tuyen-2024/',
  },
  {
    id: 'DCN',
    url: 'https://tuyensinh.haui.edu.vn/diem-chuan-trung-tuyen-dai-hoc',
  },
  {
    id: 'GHA',
    url: 'https://tuyensinh.utc.edu.vn/?q=tin-tuyen-sinh/diem-trung-tuyen-dai-hoc-he-chinh-quy-nam-2025',
  },
  {
    id: 'BKA',
    url: 'https://hust.edu.vn/vi/news/tin-tuc-su-kien/dai-hoc-bach-khoa-ha-noi-cong-bo-diem-chuan-xttn-2024-655155.html',
  },
  {
    id: 'KHA',
    url: 'https://daotao.neu.edu.vn/vi/tuyen-sinh-dai-hoc-chinh-quy-2024/',
  },
  {
    id: 'NTH',
    url: 'https://ftu.edu.vn/tuyensinh/dai-hoc-chinh-quy/',
  },
  {
    id: 'SPH',
    url: 'https://hnue.edu.vn/Tuyensinh',
  }, // Hanoi National University of Education -- likely static CMS
  {
    id: 'TLA',
    url: 'https://www.tlu.edu.vn/tuyen-sinh',
  }, // Thuy Loi University -- likely static CMS
];

async function verifyCandidate(candidate: Candidate): Promise<void> {
  try {
    const html = await fetchHTML(candidate.url);

    const hasTable = html.includes('<table');
    const hasDiemChuan =
      html.toLowerCase().includes('diem chuan') ||
      html.toLowerCase().includes('diem trung tuyen') ||
      html.toLowerCase().includes('thpt');
    const trCount = (html.match(/<tr/gi) ?? []).length;

    console.log(
      `${candidate.id}: OK | table=${hasTable} | diem_chuan=${hasDiemChuan} | tr_count=${trCount}`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`${candidate.id}: ERROR ${message}`);
  }
}

async function main(): Promise<void> {
  console.log('=== Adapter URL Verification Report ===');
  console.log(`Probing ${CANDIDATES.length} candidate URLs...\n`);

  const results: Array<{ id: string; isStaticHtml: boolean }> = [];

  for (const candidate of CANDIDATES) {
    try {
      const html = await fetchHTML(candidate.url);

      const hasTable = html.includes('<table');
      const hasDiemChuan =
        html.toLowerCase().includes('diem chuan') ||
        html.toLowerCase().includes('diem trung tuyen') ||
        html.toLowerCase().includes('thpt');
      const trCount = (html.match(/<tr/gi) ?? []).length;

      console.log(
        `${candidate.id}: OK | table=${hasTable} | diem_chuan=${hasDiemChuan} | tr_count=${trCount}`
      );

      results.push({
        id: candidate.id,
        isStaticHtml: hasTable && trCount >= 5,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`${candidate.id}: ERROR ${message}`);
      results.push({ id: candidate.id, isStaticHtml: false });
    }
  }

  const successCount = results.filter((r) => r.isStaticHtml !== undefined).length;
  const staticCandidates = results.filter((r) => r.isStaticHtml);

  console.log(`\n=== Summary ===`);
  console.log(`Verified: ${successCount}/${CANDIDATES.length} candidates`);

  console.log(`\n=== STATIC HTML CANDIDATES ===`);
  if (staticCandidates.length === 0) {
    console.log('None found (all either errored or no table with >= 5 rows)');
  } else {
    for (const c of staticCandidates) {
      console.log(`  ${c.id}`);
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
