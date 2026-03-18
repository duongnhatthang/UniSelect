/**
 * generate-adapters.ts
 *
 * Generates adapter files for all universities not already covered by existing adapters.
 * Re-runnable (idempotent): skips files that already exist.
 *
 * Usage: npx tsx scripts/generate-adapters.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface UniversityEntry {
  id: string;
  name: string;
  url: string;
}

const UNIVERSITIES: UniversityEntry[] = [
  { id: 'QH', name: 'ĐẠI HỌC QUỐC GIA HÀ NỘI', url: 'https://www.vnu.edu.vn/home/' },
  { id: 'QHL', name: 'Trường Đại học Luật - ĐHQG Hà Nội', url: 'https://law.vnu.edu.vn/' },
  { id: 'QHQ', name: 'Trường Quốc tế - ĐHQG Hà Nội', url: 'https://tuyensinh.vnuis.edu.vn/' },
  { id: 'QHI', name: 'Trường Đại học Công nghệ - ĐHQG Hà Nội', url: 'https://uet.vnu.edu.vn/' },
  { id: 'QHS', name: 'Trường ĐH Giáo dục - ĐHQG Hà Nội', url: 'https://education.vnu.edu.vn/' },
  { id: 'QHT', name: 'Trường ĐH Khoa học Tự nhiên - ĐHQG Hà Nội', url: 'https://hus.edu.vn/' },
  { id: 'QHX', name: 'Trường ĐH Khoa học Xã hội và Nhân văn - ĐHQG Hà Nội', url: 'https://ussh.vnu.edu.vn/' },
  { id: 'QHE', name: 'Trường Đại học Kinh tế - ĐHQG Hà Nội', url: 'https://ueb.edu.vn/' },
  { id: 'QHF', name: 'Trường Đại học Ngoại ngữ - ĐHQG Hà Nội', url: 'https://ulis.vnu.edu.vn/' },
  { id: 'QHJ', name: 'Trường Đại học Việt Nhật - ĐHQG Hà Nội', url: 'https://vju.ac.vn/' },
  { id: 'QHY', name: 'Trường Đại học Y Dược - ĐHQG Hà Nội', url: 'https://ump.vnu.edu.vn/' },
  { id: 'BKA', name: 'ĐẠI HỌC BÁCH KHOA HÀ NỘI', url: 'https://hust.edu.vn/' },
  { id: 'NVH', name: 'Học viện Âm nhạc Quốc gia Việt Nam', url: 'https://vnam.edu.vn/' },
  { id: 'TGC', name: 'Học viện Báo chí Tuyên truyền', url: 'https://daotaoajc.edu.vn/' },
  { id: 'HCP', name: 'Học viện Chính sách và Phát triển', url: 'https://apd.edu.vn/' },
  { id: 'BVH', name: 'Học viện Công nghệ Bưu chính Viễn thông', url: 'https://portal.ptit.edu.vn/' },
  { id: 'HVD', name: 'Học viện Dân tộc', url: 'https://hvdt.edu.vn/' },
  { id: 'HCH', name: 'Học viện Hành chính Quốc gia', url: 'https://www1.napa.vn/' },
  { id: 'KMA', name: 'Học viện Kỹ thuật Mật mã', url: 'https://actvn.edu.vn/' },
  { id: 'HVM', name: 'Học viện Múa Việt Nam', url: 'https://www.vnad.edu.vn/' },
  { id: 'NHH', name: 'Học viện Ngân hàng', url: 'https://hvnh.edu.vn/' },
  { id: 'HQT', name: 'Học viện Ngoại giao', url: 'https://www.dav.edu.vn/' },
  { id: 'HVN', name: 'Học viện Nông nghiệp Việt Nam', url: 'https://tuyensinh.vnua.edu.vn/' },
  { id: 'HPN', name: 'Học viện Phụ nữ Việt Nam', url: 'https://hvpnvn.edu.vn/' },
  { id: 'HVQ', name: 'Học viện Quản lý Giáo dục', url: 'https://www.naem.edu.vn/vi' },
  { id: 'HTC', name: 'Học viện Tài chính', url: 'https://hvtc.edu.vn/' },
  { id: 'HTN', name: 'Học viện Thanh Thiếu niên Việt Nam', url: 'https://vya.edu.vn/' },
  { id: 'HTA', name: 'Học viện Tòa án', url: 'http://hocvientoaan.edu.vn/' },
  { id: 'HYD', name: 'Học viện Y Dược học cổ truyền Việt Nam', url: 'http://vutm.edu.vn/' },
  { id: 'CMC', name: 'Trường Đại học CMC', url: 'https://cmc-u.edu.vn/' },
  { id: 'LDA', name: 'Trường Đại học Công đoàn', url: 'http://dhcd.edu.vn/' },
  { id: 'GTA', name: 'Trường Đại học Công nghệ Giao thông vận tải', url: 'https://utt.edu.vn/' },
  { id: 'DCQ', name: 'Trường Đại học Công nghệ và Quản lý Hữu nghị', url: 'https://utm.edu.vn/' },
  { id: 'CCM', name: 'Trường Đại học Công nghiệp Dệt may Hà Nội', url: 'http://hict.edu.vn/' },
  { id: 'DCN', name: 'Trường Đại học Công nghiệp Hà Nội', url: 'https://www.haui.edu.vn/' },
  { id: 'VHD', name: 'Trường Đại học Công nghiệp Việt Hung', url: 'https://viu.edu.vn/' },
  { id: 'DKH', name: 'Trường Đại học Dược Hà Nội', url: 'https://hup.edu.vn/' },
  { id: 'DDN', name: 'Trường Đại học Đại Nam', url: 'https://dainam.edu.vn/' },
  { id: 'DDL', name: 'Trường Đại học Điện lực', url: 'https://epu.edu.vn/' },
  { id: 'DDD', name: 'Trường Đại học Đông Đô', url: 'https://hdiu.edu.vn/' },
  { id: 'FPT', name: 'Trường Đại học FPT', url: 'https://hanoi.fpt.edu.vn/' },
  { id: 'GHA', name: 'Trường Đại học Giao thông vận tải', url: 'https://utc.edu.vn/' },
  { id: 'NHF', name: 'Trường Đại học Hà Nội', url: 'https://www.hanu.vn/' },
  { id: 'HBU', name: 'Trường Đại học Hòa Bình', url: 'https://daihochoabinh.edu.vn/' },
  { id: 'KCN', name: 'Trường Đại học Khoa học và Công nghệ Hà Nội', url: 'https://usth.edu.vn/' },
  { id: 'DQK', name: 'Trường Đại học Kinh doanh và Công nghệ Hà Nội', url: 'https://hubt.edu.vn/' },
  { id: 'DKK', name: 'Trường Đại học Kinh tế Kỹ thuật Công nghiệp', url: 'https://uneti.edu.vn/' },
  { id: 'KHA', name: 'Trường Đại học Kinh tế Quốc dân', url: 'https://www.neu.edu.vn/' },
  { id: 'DKS', name: 'Trường Đại học Kiểm sát Hà Nội', url: 'https://hpu.vn/' },
  { id: 'KTA', name: 'Trường Đại học Kiến trúc Hà Nội', url: 'https://hau.edu.vn/' },
  { id: 'DLX', name: 'Trường Đại học Lao động Xã hội', url: 'http://ulsa.edu.vn/' },
  { id: 'LNH', name: 'Trường Đại học Lâm nghiệp', url: 'https://vnuf.edu.vn/' },
  { id: 'LPH', name: 'Trường Đại học Luật Hà Nội', url: 'https://hlu.edu.vn/' },
  { id: 'MDA', name: 'Trường Đại học Mỏ Địa chất Hà Nội', url: 'http://humg.edu.vn/' },
  { id: 'MHN', name: 'Trường Đại học Mở Hà Nội', url: 'https://hou.edu.vn/' },
  { id: 'MTC', name: 'Trường Đại học Mỹ thuật Công nghiệp', url: 'https://uad.edu.vn/' },
  { id: 'MTH', name: 'Trường Đại học Mỹ thuật Việt Nam', url: 'https://mythuatvietnam.edu.vn/' },
  { id: 'NTH', name: 'Trường Đại học Ngoại thương', url: 'https://ftu.edu.vn/' },
  { id: 'NTU', name: 'Trường Đại học Nguyễn Trãi', url: 'https://daihocnguyentrai.edu.vn/' },
  { id: 'DNV', name: 'Trường Đại học Nội vụ Hà Nội', url: 'https://huha.edu.vn/' },
  { id: 'PKA', name: 'Trường Đại học Phenikaa', url: 'https://phenikaa-uni.edu.vn/vi' },
  { id: 'DPD', name: 'Trường Đại học Phương Đông', url: 'https://phuongdong.edu.vn/' },
  { id: 'SKD', name: 'Trường Đại học Sân khấu Điện ảnh', url: 'https://skda.edu.vn/' },
  { id: 'SPH', name: 'Trường Đại học Sư phạm Hà Nội', url: 'https://hnue.edu.vn/' },
  { id: 'GNT', name: 'Trường Đại học Sư phạm Nghệ thuật Trung ương Hà Nội', url: 'http://www.spnttw.edu.vn/' },
  { id: 'TDH', name: 'Trường Đại học Sư phạm Thể dục thể thao Hà nội', url: 'https://hupes.edu.vn/' },
  { id: 'FBU', name: 'Trường Đại học Tài chính Ngân hàng Hà Nội', url: 'https://fbu.edu.vn/gioi-thieu/' },
  { id: 'DMT', name: 'Trường Đại học Tài nguyên và Môi trường Hà Nội', url: 'https://hunre.edu.vn/' },
  { id: 'DTL', name: 'Trường Đại học Thăng Long', url: 'https://thanglong.edu.vn/node/1' },
  { id: 'TDD', name: 'Trường Đại học Thành Đô', url: 'https://thanhdo.edu.vn/' },
  { id: 'HNM', name: 'Trường Đại học Thủ đô Hà Nội', url: 'https://hnmu.edu.vn/' },
  { id: 'TLA', name: 'Trường Đại học Thủy lợi', url: 'https://www.tlu.edu.vn/' },
  { id: 'TMA', name: 'Trường Đại học Thương mại', url: 'https://tmu.edu.vn/' },
  { id: 'VHH', name: 'Trường Đại học Văn hóa Hà Nội', url: 'https://huc.edu.vn/' },
  { id: 'XDA', name: 'Trường Đại học Xây dựng Hà Nội', url: 'https://huce.edu.vn/' },
  { id: 'YHB', name: 'Trường Đại học Y Hà Nội', url: 'https://hmu.edu.vn/' },
  { id: 'YTC', name: 'Trường Đại học Y tế Công cộng', url: 'https://huph.edu.vn/' },
];

// Existing adapters — skip these (already hand-crafted)
const SKIP_IDS = new Set(['MINISTRY', 'BKA', 'KHA', 'NTH', 'GHA', 'DCN']);

function generateAdapterContent(uni: UniversityEntry): string {
  const varName = `${uni.id.toLowerCase()}Adapter`;
  return `/**
 * ${uni.id} Adapter — ${uni.name}
 *
 * TODO: Before setting static_verified: true in scrapers.json:
 * 1. Visit ${uni.url} and find the cutoff scores page (Tuyển sinh -> Điểm chuẩn)
 * 2. View page source (Ctrl+U) and confirm the table is in raw HTML (not JS-rendered)
 * 3. Update the url in scrapers.json to the specific cutoff page URL, not the homepage
 * 4. Verify column headers match the text anchors used below
 *
 * University: ${uni.name}
 * Ministry code: ${uni.id}
 * Homepage: ${uni.url}
 */

import * as cheerio from 'cheerio';
import { fetchHTML } from '../fetch';
import { RawRow, ScraperAdapter } from '../types';

export const ${varName}: ScraperAdapter = {
  id: '${uni.id}',
  async scrape(url: string): Promise<RawRow[]> {
    const html = await fetchHTML(url);
    const $ = cheerio.load(html);
    const rows: RawRow[] = [];
    const year = new Date().getFullYear() - 1;

    $('table').each((_, table) => {
      const headers = $(table)
        .find('th, thead td')
        .map((_, el) => $(el).text().trim())
        .get();

      const scoreIdx = headers.findIndex(
        (h) => h.includes('Diem chuan') || h.includes('diem chuan') || h.includes('Điểm chuẩn')
      );
      const tohopIdx = headers.findIndex(
        (h) => h.includes('To hop') || h.includes('Khoi') || h.includes('to hop') || h.includes('Tổ hợp')
      );
      const majorIdx = headers.findIndex(
        (h) =>
          h.includes('Ma nganh') ||
          h.includes('Nganh') ||
          h.includes('ma nganh') ||
          h.includes('nganh') ||
          h.includes('Ngành')
      );

      if (scoreIdx === -1) return;

      $(table)
        .find('tbody tr')
        .each((_, tr) => {
          const cells = $(tr)
            .find('td')
            .map((_, td) => $(td).text().trim())
            .get();
          if (cells.length === 0) return;

          rows.push({
            university_id: '${uni.id}',
            major_raw: cells[majorIdx] ?? '',
            tohop_raw: cells[tohopIdx] ?? '',
            year,
            score_raw: cells[scoreIdx] ?? '',
            source_url: url,
          });
        });
    });

    if (rows.length === 0) {
      throw new Error(
        \`${uni.id} adapter returned 0 rows — possible JS rendering or layout change at \${url}\`
      );
    }

    return rows;
  },
};
`;
}

function main(): void {
  const adaptersDir = path.join(__dirname, '..', 'lib', 'scraper', 'adapters');

  let written = 0;
  let skipped = 0;

  for (const uni of UNIVERSITIES) {
    if (SKIP_IDS.has(uni.id)) {
      console.log(`SKIP  ${uni.id} (existing hand-crafted adapter)`);
      skipped++;
      continue;
    }

    const filename = `${uni.id.toLowerCase()}.ts`;
    const filepath = path.join(adaptersDir, filename);

    if (fs.existsSync(filepath)) {
      console.log(`SKIP  ${filename} (already exists)`);
      skipped++;
      continue;
    }

    const content = generateAdapterContent(uni);
    fs.writeFileSync(filepath, content, 'utf-8');
    console.log(`WROTE ${filename}`);
    written++;
  }

  console.log(`\nDone: ${written} files written, ${skipped} skipped.`);
}

main();
