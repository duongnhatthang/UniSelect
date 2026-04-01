export type SourceType = 'aggregator' | 'user_submitted' | 'scraper';

export interface RawRow {
  university_id: string;
  major_raw: string;        // raw text from page
  tohop_raw: string;        // may be "A00" or "a00" or "Toan - Ly - Hoa"
  year: number;
  score_raw: string;        // may be "28.50" or "28,50"
  source_url: string;
  source_type?: SourceType; // defaults to 'scraper' if omitted
}

export interface NormalizedRow {
  university_id: string;
  major_id: string;
  tohop_code: string;       // uppercase [A-Z]\d{2,3}
  year: number;
  score: number;            // float in [10.0, 30.0]
  admission_method: string; // "THPT" for Phase 1
  source_url: string;
  source_type: SourceType;
  scraped_at: Date;
}

export interface ScraperAdapter {
  id: string;               // university ministry code
  scrape(url: string): Promise<RawRow[]>;
}
