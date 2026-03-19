export const PAGE_TITLE_KEYWORDS: string[] = [
  'diem chuan',
  'điểm chuẩn',
  'diem trung tuyen',
  'điểm trúng tuyển',
  'điểm xét tuyển',
];

export const URL_SLUG_KEYWORDS: string[] = [
  'diem-chuan',
  'diem-trung-tuyen',
  'tuyen-sinh',
  'xet-tuyen',
  'thong-bao',
  'tin-tuyen-sinh',
  'ket-qua-trung-tuyen',
  'xem-diem-cac-nam-truoc',
];

export const HEADING_KEYWORDS: string[] = [
  'điểm chuẩn',
  'diem chuan',
  'điểm trúng tuyển',
  'mã ngành',
  'ma nganh',
  'tổ hợp',
  'to hop',
  'khối',
  'khoi',
  'mã xét tuyển',
  'ma xet tuyen',
  'ngành',
  'nganh',
];

export const TABLE_HEADER_KEYWORDS: string[] = HEADING_KEYWORDS;

/** Minimum score to include a candidate in output (a URL slug hit alone qualifies) */
export const SCORE_THRESHOLD = 3;

/** Score weights */
export const URL_SLUG_WEIGHT = 3;
export const TITLE_WEIGHT = 2;
export const HEADING_WEIGHT = 1;
export const TABLE_WEIGHT = 5;
