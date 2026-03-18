export type Tier = 'dream' | 'practical' | 'safe';

export interface RecommendInput {
  tohop_code: string;
  total_score: number;
}

export interface CutoffDataRow {
  university_id: string;
  university_name_vi: string;
  major_id: string;
  major_name_vi: string;
  tohop_code: string;
  year: number;
  score: string;  // STRING from Postgres numeric — must parseFloat before arithmetic
}

export interface RecommendResult {
  university_id: string;
  university_name_vi: string;
  major_id: string;
  major_name_vi: string;
  tohop_code: string;
  weighted_cutoff: number;
  tier: Tier;
  trend: 'rising' | 'falling' | 'stable';
  data_years_limited: boolean;
  years_available: number;
  suggested_top_15: boolean;
}
