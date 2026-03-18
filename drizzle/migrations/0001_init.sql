-- 0001_init.sql
-- Schema DDL + university seed data (combined migration)
-- All 5 tables created with indexes, then universities seeded.

-- Universities table
CREATE TABLE universities (
  id TEXT PRIMARY KEY,
  name_vi TEXT NOT NULL,
  name_en TEXT,
  website_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Majors table
CREATE TABLE majors (
  id TEXT PRIMARY KEY,
  name_vi TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tổ hợp codes table
CREATE TABLE tohop_codes (
  code TEXT PRIMARY KEY,
  subjects TEXT[] NOT NULL,
  label_vi TEXT
);

-- Cutoff scores table
CREATE TABLE cutoff_scores (
  id BIGSERIAL PRIMARY KEY,
  university_id TEXT NOT NULL REFERENCES universities(id),
  major_id TEXT NOT NULL REFERENCES majors(id),
  tohop_code TEXT NOT NULL REFERENCES tohop_codes(code),
  year SMALLINT NOT NULL,
  score NUMERIC(5, 2),
  admission_method TEXT NOT NULL DEFAULT 'THPT',
  source_url TEXT,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (university_id, major_id, tohop_code, year, admission_method)
);

-- Scrape runs table
CREATE TABLE scrape_runs (
  id BIGSERIAL PRIMARY KEY,
  run_at TIMESTAMPTZ DEFAULT NOW(),
  university_id TEXT REFERENCES universities(id),
  status TEXT,
  rows_written INTEGER,
  rows_rejected INTEGER,
  error_log TEXT,
  github_run_id TEXT
);

-- Indexes for cutoff_scores query performance
CREATE INDEX idx_cutoff_uni_year ON cutoff_scores (university_id, year);
CREATE INDEX idx_cutoff_tohop_year ON cutoff_scores (tohop_code, year);
CREATE INDEX idx_cutoff_score_year_tohop ON cutoff_scores (score, year, tohop_code);

-- Seed: 78 Vietnamese universities from uni_list_examples.md
-- Sub-university names have leading "- " prefix stripped.
-- Vietnamese diacritics preserved exactly.
INSERT INTO universities (id, name_vi, website_url) VALUES
  ('QH', 'ĐẠI HỌC QUỐC GIA HÀ NỘI', 'https://www.vnu.edu.vn/home/'),
  ('QHL', 'Trường Đại học Luật - ĐHQG Hà Nội', 'https://law.vnu.edu.vn/'),
  ('QHQ', 'Trường Quốc tế - ĐHQG Hà Nội', 'https://tuyensinh.vnuis.edu.vn/'),
  ('QHI', 'Trường Đại học Công nghệ - ĐHQG Hà Nội', 'https://uet.vnu.edu.vn/'),
  ('QHS', 'Trường ĐH Giáo dục - ĐHQG Hà Nội', 'https://education.vnu.edu.vn/'),
  ('QHT', 'Trường ĐH Khoa học Tự nhiên - ĐHQG Hà Nội', 'https://hus.edu.vn/'),
  ('QHX', 'Trường ĐH Khoa học Xã hội và Nhân văn - ĐHQG Hà Nội', 'https://ussh.vnu.edu.vn/'),
  ('QHE', 'Trường Đại học Kinh tế - ĐHQG Hà Nội', 'https://ueb.edu.vn/'),
  ('QHF', 'Trường Đại học Ngoại ngữ - ĐHQG Hà Nội', 'https://ulis.vnu.edu.vn/'),
  ('QHJ', 'Trường Đại học Việt Nhật - ĐHQG Hà Nội', 'https://vju.ac.vn/'),
  ('QHY', 'Trường Đại học Y Dược - ĐHQG Hà Nội', 'https://ump.vnu.edu.vn/'),
  ('BKA', 'ĐẠI HỌC BÁCH KHOA HÀ NỘI', 'https://hust.edu.vn/'),
  ('NVH', 'Học viện Âm nhạc Quốc gia Việt Nam', 'https://vnam.edu.vn/'),
  ('TGC', 'Học viện Báo chí Tuyên truyền', 'https://daotaoajc.edu.vn/'),
  ('HCP', 'Học viện Chính sách và Phát triển', 'https://apd.edu.vn/'),
  ('BVH', 'Học viện Công nghệ Bưu chính Viễn thông', 'https://portal.ptit.edu.vn/'),
  ('HVD', 'Học viện Dân tộc', 'https://hvdt.edu.vn/'),
  ('HCH', 'Học viện Hành chính Quốc gia', 'https://www1.napa.vn/'),
  ('KMA', 'Học viện Kỹ thuật Mật mã', 'https://actvn.edu.vn/'),
  ('HVM', 'Học viện Múa Việt Nam', 'https://www.vnad.edu.vn/'),
  ('NHH', 'Học viện Ngân hàng', 'https://hvnh.edu.vn/'),
  ('HQT', 'Học viện Ngoại giao', 'https://www.dav.edu.vn/'),
  ('HVN', 'Học viện Nông nghiệp Việt Nam', 'https://tuyensinh.vnua.edu.vn/'),
  ('HPN', 'Học viện Phụ nữ Việt Nam', 'https://hvpnvn.edu.vn/'),
  ('HVQ', 'Học viện Quản lý Giáo dục', 'https://www.naem.edu.vn/vi'),
  ('HTC', 'Học viện Tài chính', 'https://hvtc.edu.vn/'),
  ('HTN', 'Học viện Thanh Thiếu niên Việt Nam', 'https://vya.edu.vn/'),
  ('HTA', 'Học viện Tòa án', 'http://hocvientoaan.edu.vn/'),
  ('HYD', 'Học viện Y Dược học cổ truyền Việt Nam', 'http://vutm.edu.vn/'),
  ('CMC', 'Trường Đại học CMC', 'https://cmc-u.edu.vn/'),
  ('LDA', 'Trường Đại học Công đoàn', 'http://dhcd.edu.vn/'),
  ('GTA', 'Trường Đại học Công nghệ Giao thông vận tải', 'https://utt.edu.vn/'),
  ('DCQ', 'Trường Đại học Công nghệ và Quản lý Hữu nghị', 'https://utm.edu.vn/'),
  ('CCM', 'Trường Đại học Công nghiệp Dệt may Hà Nội', 'http://hict.edu.vn/'),
  ('DCN', 'Trường Đại học Công nghiệp Hà Nội', 'https://www.haui.edu.vn/'),
  ('VHD', 'Trường Đại học Công nghiệp Việt Hung', 'https://viu.edu.vn/'),
  ('DKH', 'Trường Đại học Dược Hà Nội', 'https://hup.edu.vn/'),
  ('DDN', 'Trường Đại học Đại Nam', 'https://dainam.edu.vn/'),
  ('DDL', 'Trường Đại học Điện lực', 'https://epu.edu.vn/'),
  ('DDD', 'Trường Đại học Đông Đô', 'https://hdiu.edu.vn/'),
  ('FPT', 'Trường Đại học FPT', 'https://hanoi.fpt.edu.vn/'),
  ('GHA', 'Trường Đại học Giao thông vận tải', 'https://utc.edu.vn/'),
  ('NHF', 'Trường Đại học Hà Nội', 'https://www.hanu.vn/'),
  ('HBU', 'Trường Đại học Hòa Bình', 'https://daihochoabinh.edu.vn/'),
  ('KCN', 'Trường Đại học Khoa học và Công nghệ Hà Nội', 'https://usth.edu.vn/'),
  ('DQK', 'Trường Đại học Kinh doanh và Công nghệ Hà Nội', 'https://hubt.edu.vn/'),
  ('DKK', 'Trường Đại học Kinh tế Kỹ thuật Công nghiệp', 'https://uneti.edu.vn/'),
  ('KHA', 'Trường Đại học Kinh tế Quốc dân', 'https://www.neu.edu.vn/'),
  ('DKS', 'Trường Đại học Kiểm sát Hà Nội', 'https://hpu.vn/'),
  ('KTA', 'Trường Đại học Kiến trúc Hà Nội', 'https://hau.edu.vn/'),
  ('DLX', 'Trường Đại học Lao động Xã hội', 'http://ulsa.edu.vn/'),
  ('LNH', 'Trường Đại học Lâm nghiệp', 'https://vnuf.edu.vn/'),
  ('LPH', 'Trường Đại học Luật Hà Nội', 'https://hlu.edu.vn/'),
  ('MDA', 'Trường Đại học Mỏ Địa chất Hà Nội', 'http://humg.edu.vn/'),
  ('MHN', 'Trường Đại học Mở Hà Nội', 'https://hou.edu.vn/'),
  ('MTC', 'Trường Đại học Mỹ thuật Công nghiệp', 'https://uad.edu.vn/'),
  ('MTH', 'Trường Đại học Mỹ thuật Việt Nam', 'https://mythuatvietnam.edu.vn/'),
  ('NTH', 'Trường Đại học Ngoại thương', 'https://ftu.edu.vn/'),
  ('NTU', 'Trường Đại học Nguyễn Trãi', 'https://daihocnguyentrai.edu.vn/'),
  ('DNV', 'Trường Đại học Nội vụ Hà Nội', 'https://huha.edu.vn/'),
  ('PKA', 'Trường Đại học Phenikaa', 'https://phenikaa-uni.edu.vn/vi'),
  ('DPD', 'Trường Đại học Phương Đông', 'https://phuongdong.edu.vn/'),
  ('SKD', 'Trường Đại học Sân khấu Điện ảnh', 'https://skda.edu.vn/'),
  ('SPH', 'Trường Đại học Sư phạm Hà Nội', 'https://hnue.edu.vn/'),
  ('GNT', 'Trường Đại học Sư phạm Nghệ thuật Trung ương Hà Nội', 'http://www.spnttw.edu.vn/'),
  ('TDH', 'Trường Đại học Sư phạm Thể dục thể thao Hà nội', 'https://hupes.edu.vn/'),
  ('FBU', 'Trường Đại học Tài chính Ngân hàng Hà Nội', 'https://fbu.edu.vn/gioi-thieu/'),
  ('DMT', 'Trường Đại học Tài nguyên và Môi trường Hà Nội', 'https://hunre.edu.vn/'),
  ('DTL', 'Trường Đại học Thăng Long', 'https://thanglong.edu.vn/node/1'),
  ('TDD', 'Trường Đại học Thành Đô', 'https://thanhdo.edu.vn/'),
  ('HNM', 'Trường Đại học Thủ đô Hà Nội', 'https://hnmu.edu.vn/'),
  ('TLA', 'Trường Đại học Thủy lợi', 'https://www.tlu.edu.vn/'),
  ('TMA', 'Trường Đại học Thương mại', 'https://tmu.edu.vn/'),
  ('VHH', 'Trường Đại học Văn hóa Hà Nội', 'https://huc.edu.vn/'),
  ('XDA', 'Trường Đại học Xây dựng Hà Nội', 'https://huce.edu.vn/'),
  ('YHB', 'Trường Đại học Y Hà Nội', 'https://hmu.edu.vn/'),
  ('YTC', 'Trường Đại học Y tế Công cộng', 'https://huph.edu.vn/')
ON CONFLICT (id) DO NOTHING;
