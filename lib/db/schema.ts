import {
  pgTable,
  text,
  smallint,
  numeric,
  bigserial,
  timestamp,
  integer,
  unique,
} from 'drizzle-orm/pg-core';

export const universities = pgTable('universities', {
  id: text('id').primaryKey(),              // Ministry code e.g. "BKA"
  name_vi: text('name_vi').notNull(),       // Full Vietnamese name
  name_en: text('name_en'),                 // Nullable — Phase 3 fills this
  website_url: text('website_url'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const majors = pgTable('majors', {
  id: text('id').primaryKey(),              // 7-digit mã ngành e.g. "7480201"
  name_vi: text('name_vi').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const tohopCodes = pgTable('tohop_codes', {
  code: text('code').primaryKey(),          // e.g. "A00", "D01"
  subjects: text('subjects').array().notNull(), // ["Toan","Ly","HoaHoc"]
  label_vi: text('label_vi'),
});

export const cutoffScores = pgTable(
  'cutoff_scores',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    university_id: text('university_id')
      .notNull()
      .references(() => universities.id),
    major_id: text('major_id')
      .notNull()
      .references(() => majors.id),
    tohop_code: text('tohop_code')
      .notNull()
      .references(() => tohopCodes.code),
    year: smallint('year').notNull(),
    score: numeric('score', { precision: 5, scale: 2 }), // NULL if not published
    admission_method: text('admission_method').notNull().default('THPT'),
    source_url: text('source_url'),
    source_type: text('source_type').notNull().default('aggregator'), // 'aggregator' | 'user_submitted' | 'scraper'
    scraped_at: timestamp('scraped_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    uniq: unique().on(
      table.university_id,
      table.major_id,
      table.tohop_code,
      table.year,
      table.admission_method
    ),
  })
);

export const scrapeRuns = pgTable('scrape_runs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  run_at: timestamp('run_at', { withTimezone: true }).defaultNow(),
  university_id: text('university_id').references(() => universities.id),
  status: text('status'),                    // "ok" | "error" | "flagged"
  rows_written: integer('rows_written'),
  rows_rejected: integer('rows_rejected'),
  error_log: text('error_log'),              // JSON array of rejection details (stored as text)
  github_run_id: text('github_run_id'),
});
