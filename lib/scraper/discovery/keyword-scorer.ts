import type { CheerioAPI } from 'cheerio';
import {
  PAGE_TITLE_KEYWORDS,
  URL_SLUG_KEYWORDS,
  HEADING_KEYWORDS,
  TABLE_HEADER_KEYWORDS,
  URL_SLUG_WEIGHT,
  TITLE_WEIGHT,
  HEADING_WEIGHT,
  TABLE_WEIGHT,
} from './constants';

/**
 * Score an HTML page for Vietnamese cutoff-score signals.
 *
 * Signals checked (in order of strength):
 *   1. URL slug keywords (URL_SLUG_WEIGHT = 3 per match)
 *   2. Page title keywords (TITLE_WEIGHT = 2 per match)
 *   3. Heading keywords in h1/h2/h3 (HEADING_WEIGHT = 1 per heading, break after first match)
 *   4. Table with score-column headers (TABLE_WEIGHT = 5 once)
 *
 * Body text is NOT scored — only URL, title, headings, and table headers.
 *
 * @param url   - The page URL (used for slug matching)
 * @param $     - CheerioAPI instance loaded with the page HTML
 * @returns     - { score: number, reasons: string[] }
 */
export function scorePageForCutoffs(
  url: string,
  $: CheerioAPI,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const urlLower = url.toLowerCase();

  // 1. URL slug signals (highest confidence)
  for (const kw of URL_SLUG_KEYWORDS) {
    if (urlLower.includes(kw)) {
      score += URL_SLUG_WEIGHT;
      reasons.push(`url:${kw}`);
    }
  }

  // 2. Page title signals
  const title = $('title').text().toLowerCase();
  for (const kw of PAGE_TITLE_KEYWORDS) {
    if (title.includes(kw)) {
      score += TITLE_WEIGHT;
      reasons.push(`title:${kw}`);
    }
  }

  // 3. Heading signals (h1, h2, h3) — break after first match per heading element
  $('h1, h2, h3').each((_, el) => {
    const text = $(el).text().toLowerCase();
    for (const kw of HEADING_KEYWORDS) {
      if (text.includes(kw)) {
        score += HEADING_WEIGHT;
        reasons.push(`heading:${kw}`);
        break;
      }
    }
  });

  // 4. Table presence with score-column headers (strong signal — added once)
  const hasScoreTable = $('table')
    .toArray()
    .some((table) => {
      const cellText = $(table).find('th, td').slice(0, 10).text().toLowerCase();
      return TABLE_HEADER_KEYWORDS.some((kw) => cellText.includes(kw));
    });

  if (hasScoreTable) {
    score += TABLE_WEIGHT;
    reasons.push('table:score-columns-detected');
  }

  return { score, reasons };
}
