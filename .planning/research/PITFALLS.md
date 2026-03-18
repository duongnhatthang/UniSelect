# Domain Pitfalls

**Domain:** Vietnamese university admissions PWA with web scraping (UniSelect)
**Researched:** 2026-03-17
**Confidence note:** WebSearch unavailable during this research session. Findings draw from training knowledge of web scraping engineering, Vietnamese web ecosystem, Vercel/Supabase free-tier constraints, and edu-tech failure patterns. Confidence levels are marked per finding. HIGH confidence = well-established engineering pattern. MEDIUM = domain reasoning from strong analogues. LOW = flag for further validation.

---

## Critical Pitfalls

Mistakes that cause rewrites, data integrity failures, or user harm.

---

### Pitfall 1: CSS Selector / DOM Structure Lock-In (Scraping Brittleness)

**What goes wrong:** Scrapers target specific CSS class names or DOM nesting paths (e.g., `table.diem-chuan > tbody > tr:nth-child(2) > td.score`). When a university redesigns its website — even cosmetically — every scraper targeting that site breaks silently or returns garbage data. With 78+ sites, at least several will change structure each year.

**Why it happens:** The path of least resistance when first writing a scraper is to copy the exact selector from browser DevTools. Nobody considers what happens when the site updates.

**Consequences:**
- Stale or missing cutoff scores with no alert to the user or operator
- If the scraper "succeeds" but returns wrong data (e.g., a sibling cell), scores are silently wrong — worst case because no error is raised
- Cascading: a broken scraper may write null or a previous value to the database, leaving no evidence of failure

**Prevention:**
- Target semantic/structural markers (table headers with known Vietnamese text like "Điểm chuẩn", "Tổ hợp", "Mã ngành") rather than positional selectors. If the header text is present, the data row is reliably adjacent regardless of style changes.
- Write a schema-level assertion after every scrape: score must be a float between 10.0 and 30.0 (THPT max), tổ hợp code must match a known regex (e.g., `[A-D]\d{2}`), major code must be 7 digits. Reject and alert on failure.
- Store the raw HTML snapshot alongside parsed data. If a parse fails later, you can re-parse from snapshot without re-scraping.
- Track a "last successful scrape" timestamp per university in the database. Surface staleness prominently in the UI ("Data last updated: 8 months ago").

**Detection (warning signs):**
- Score distribution suddenly shifts (e.g., 40 universities return null in a single run)
- A university's scores are unchanged for more than 12 months despite a new admissions cycle
- Parsed score is outside the 10.0–30.0 range

**Phase:** Address in Phase 1 (scraping infrastructure). Validation layer must ship before any data is written to the production database.

---

### Pitfall 2: Silent Data Corruption via Encoding Mismatch

**What goes wrong:** Vietnamese university websites use a mix of UTF-8, Windows-1258 (VISCII variant), and occasionally TCVN3 encodings. If the HTTP client assumes UTF-8 when the response is Windows-1258, Vietnamese characters are mangled — and the scraper may still "succeed" because it found a table. Major names like "Quản trị kinh doanh" become mojibake. These corrupt strings get stored in the database and displayed to students.

**Why it happens:** Modern HTTP libraries default to UTF-8. The `Content-Type` header may declare the wrong charset, or the HTML `<meta charset>` may be absent. Government and older university sites are the most likely offenders.

**Consequences:**
- Major names and university names appear garbled in the UI, destroying trust
- Search/filter breaks for affected records (normalized Vietnamese string won't match mojibake)
- Diacritics stripped during normalization may collapse distinct majors into the same string

**Prevention:**
- Always read the raw bytes first. Use `chardet` (Python) or equivalent to detect encoding before decoding.
- Cross-check: if detected encoding differs from declared charset, log a warning and use detected encoding.
- After parsing, run a sanity check: if more than 10% of characters in a name field fall outside the expected Vietnamese Unicode range (U+0000–U+024F plus Vietnamese-specific combining marks), treat the record as suspect.
- Canonicalize all Vietnamese text to NFC normalization form before storage. Do this once at write time, not at query time.

**Detection:**
- Any character like `Ã`, `â€`, `Â±` in a major or university name
- Tổ hợp codes containing non-ASCII characters
- Search returning zero results for a known university name

**Phase:** Phase 1 (scraping infrastructure). Encoding handling must be solved before the data pipeline is built.

---

### Pitfall 3: JS-Rendered Pages Treated as Static HTML

**What goes wrong:** Some university websites (and potentially the Ministry portal) render their cutoff score tables via JavaScript (React, Vue, or plain AJAX calls). A pure HTTP GET returns an empty `<div id="app"></div>` with no table data. The scraper sees no error, just an empty result set. This is silently treated as "no data" rather than "render failed."

**Why it happens:** The scraper developer tests on static sites first. When encountering a JS-rendered site, the empty parse result is not distinguished from "university has no published data."

**Consequences:**
- Entire universities or majors missing from the database
- No error raised, so the gap is never investigated
- Users see a university listed (from a static page) but with no score data

**Prevention:**
- For each university, document during initial mapping whether it is static or JS-rendered. This is a one-time audit.
- Add a "minimum rows expected" check per source: if a source previously returned 50 rows and now returns 0, flag it — don't write zero rows to the database.
- For JS-rendered sites, use Playwright or Puppeteer in headless mode. Isolate these into a separate scraping queue (they are slower and more resource-intensive). GitHub Actions can run a headed Chromium.
- Consider whether the underlying AJAX endpoint can be directly hit (inspect Network tab). Many "JS-rendered" pages actually call a JSON API; scraping the API is faster and more stable than rendering.

**Detection:**
- New scraper run for a university returns 0 rows when previous run returned N rows
- Raw HTML response body is under 5 KB for a page expected to contain tabular data

**Phase:** Phase 1 (scraping infrastructure). Must be identified in initial site audit before building per-university scrapers.

---

### Pitfall 4: Ministry Portal Structure Changes Destroying the Primary Data Source

**What goes wrong:** The Ministry portal (thisinh.thitotnghiepthpt.edu.vn) is the primary structured data source. If it changes its URL structure, moves data behind authentication, or adds CAPTCHA, the entire data pipeline fails. This happened to analogous national-exam portals in other countries after public attention.

**Why it happens:** Government portals are redesigned on political/budget cycles with no regard for downstream scrapers. There is no API contract.

**Consequences:**
- Total data loss for the Ministry-sourced records, which may be the majority
- Forces emergency re-scrape from 78 individual university sites under time pressure
- If this happens in July (peak period), students see no data during the highest-traffic window

**Prevention:**
- Treat the Ministry portal as unreliable by design. Archive a full snapshot to object storage (Supabase Storage or GitHub LFS) after every successful scrape cycle.
- Do not make the Ministry the sole source for any university. For each university, maintain a direct-scrape fallback URL even if the Ministry portal is currently working.
- Monitor the portal's HTML structure hash weekly. Alert if it changes.
- Maintain a manually-curated fallback dataset (CSV in the repository) for the previous year's scores. This is always better than showing nothing.

**Detection:**
- Ministry scraper returns 0 rows or HTTP errors for more than 3 consecutive runs
- HTML structure hash changes on the portal's main data page

**Phase:** Phase 1 (data pipeline design). The fallback strategy must be designed before the scraper is built, not retrofitted after the first outage.

---

### Pitfall 5: Data Accuracy Failures Causing Student Harm

**What goes wrong:** A student uses an incorrect cutoff score to decide their nguyện vọng ranking. They place a university too high (thinking they qualify) and get locked in, missing a better option. Or they place it too low unnecessarily. Given that the nguyện vọng submission is final and one incorrect ordering can determine a student's university path, this is the highest-severity failure mode.

**Why it happens:**
- Scraping error writes wrong data (see Pitfalls 1–4)
- University publishes a revised score (supplementary round cutoffs differ from main round)
- Tổ hợp codes scraped correctly but stored against the wrong major
- Previous year's data displayed when current year data hasn't been collected yet

**Consequences:** Direct harm to real students. Reputational destruction for a charity tool.

**Prevention:**
- Every score displayed must carry a "source" label (Ministry portal / University website / Manual entry) and a "last verified" timestamp.
- Display confidence tiers: "Verified from official source", "Scraped — verify directly", "Historical only — current year not yet published".
- Never show a score without showing the year it corresponds to. Scores from 2022 displayed as "current" is a data integrity failure.
- Multi-round cutoffs: explicitly capture round (đợt 1, đợt bổ sung). Only use the main round (đợt 1) score for ranking suggestions unless the user requests otherwise.
- For the suggestion algorithm, add a safety margin: if a student's score is within 0.5 points of a cutoff, place the university in the tier below (practical → safe). Surface this as "borderline — treat as safe."
- Add a clear disclaimer on every score: "Điểm chuẩn do cơ sở giáo dục công bố. UniSelect không chịu trách nhiệm về sai sót. Vui lòng xác minh trực tiếp với trường."

**Detection:**
- Score value outside 10.0–30.0 range (impossible for THPT)
- Tổ hợp code for a major doesn't match any standard combination
- Year field missing or older than 1 year before submission deadline

**Phase:** Phase 1 (data validation) + Phase 2 (UI trust signals). Both must ship together — data validation without UI disclosure is insufficient.

---

## Moderate Pitfalls

---

### Pitfall 6: Vietnamese String Normalization Failures in Search and Filter

**What goes wrong:** Vietnamese uses precomposed (NFC) and decomposed (NFD) Unicode representations of diacritical characters. "Hà Nội" in NFD is stored as 8 code points; in NFC it is 6. A search for "Ha Noi" (no diacritics) returns nothing because the app does naïve string matching. A search for "Hà Nội" may miss records stored in a different normalization form.

**Why it happens:** Developers without Vietnamese language experience treat text as ASCII. The issue is invisible when testing with sample data created by the developer, because they consistently use one input method.

**Prevention:**
- Normalize all stored strings to NFC at write time (one canonical form).
- For search, implement a Vietnamese diacritic-folding function that maps accented characters to their base form (ă→a, ơ→o, ư→u, đ→d, and all tonal variants). Store a pre-computed search slug for each name.
- Use Postgres `unaccent` extension or a custom trie-based implementation. Do not rely on collation alone — collation behavior varies by Postgres version and locale settings.
- Test with real student input patterns: "dai hoc bach khoa", "DHBK", abbreviations.

**Detection:**
- Search for a known university returns zero results
- Students reporting "can't find university" for clearly-listed schools

**Phase:** Phase 2 (search and filter UI). Build the normalization layer before the search feature, not as a patch after launch.

---

### Pitfall 7: Supabase Free Tier Row-Level and Connection Limits During July Spike

**What goes wrong:** Supabase free tier enforces: 500 MB database storage, 2 GB egress/month, 50,000 monthly active users (MAU) for Auth (not relevant here), and connection pooling at 60 simultaneous connections. In July, if thousands of students simultaneously query the app, connection pool exhaustion causes 500 errors. The 2 GB egress cap may be exceeded if the app fetches large payloads per request.

**Why it happens:** Free-tier limits are not tested under load during development. July spike is 10–50x normal traffic.

**Prevention:**
- Use connection pooling (PgBouncer) in transaction mode — Supabase provides this at the pooler endpoint. Never connect directly from serverless functions to the Postgres port (each cold-start function creates a new connection).
- Design queries to return minimal payloads: the initial list view should return only (university name, major, tổ hợp, score, year) — not full records with metadata.
- Add HTTP-level caching (Vercel Edge Cache) for the most common queries: "all scores for year 2025" is effectively static during peak period. Cache with a 1-hour TTL. This eliminates the majority of database reads.
- Monitor egress. If a single score lookup returns 50 KB of JSON when it should return 1 KB, that's a design flaw.
- Keep the total database size well under 200 MB by only storing the latest 3 years of cutoffs. Older data can be archived to a static JSON file in GitHub.

**Detection:**
- Query latency spikes above 2 seconds during load testing
- Supabase dashboard shows connection count approaching 60 during simulated concurrent load
- Monthly egress approaching 1.5 GB before peak season

**Phase:** Phase 3 (infrastructure hardening before July). Must be tested with load simulation before the July window.

---

### Pitfall 8: Vercel Serverless Function Cold Start Latency Perceived as Broken App

**What goes wrong:** Vercel hobby plan serverless functions go cold after inactivity. A cold start for a Node.js function that initializes a Supabase client can take 800ms–2000ms. For a student using the app at 11pm before a deadline, a 2-second blank screen with no loading indicator feels like the app is broken, leading to distrust.

**Why it happens:** Cold starts are invisible in development (local server is always warm). The issue only surfaces in production with real usage patterns.

**Prevention:**
- Add skeleton loading states and a loading spinner that appear within 100ms of navigation. The UX should signal "loading" immediately, not after the API responds.
- Pre-warm the most common routes with a lightweight cron ping (GitHub Actions can hit the API endpoint every 10 minutes during July to keep it warm).
- For the score lookup — which is the core query — consider serving it from a static JSON file (pre-generated at scrape time) via Vercel's CDN rather than a serverless function. CDN responses have no cold start.
- Implement stale-while-revalidate: serve cached data instantly, refresh in background.

**Detection:**
- Vercel function logs show initialization time > 500ms on first request
- User-reported "app feels slow on first load"

**Phase:** Phase 3 (performance). Address with static file strategy at data pipeline design time (Phase 1), implement loading states in Phase 2.

---

### Pitfall 9: Suggestion Algorithm Producing Legally or Ethically Problematic Output

**What goes wrong:** The tiered suggestion algorithm places a university in "safe" tier. A student trusts this classification and deprioritizes their application. If the score data is stale by even 1–2 points (cutoffs shift year-to-year), a "safe" school becomes a miss. Unlike other domains, a wrong prediction here forecloses a university option permanently.

**Why it happens:** Score-based classification is applied mechanically without accounting for year-over-year score volatility, which can be 2–5 points for competitive programs.

**Prevention:**
- The algorithm must use multi-year trend data, not just the most recent year. A school whose cutoff has risen 2 points per year for 3 years should be classified one tier higher than the raw score suggests.
- Display the standard deviation or range of cutoffs across years alongside the tier label. "Safe" schools should have narrow, stable score bands.
- Add explicit language in the UI: "Đây là gợi ý dựa trên dữ liệu lịch sử. UniSelect không đảm bảo kết quả trúng tuyển."
- Never use the word "guaranteed" (đảm bảo trúng tuyển) in any UI copy or algorithm output.
- The 2026 rule change (teacher training programs must be in top 5) must be enforced as a hard constraint, not a suggestion. If a student adds a teacher training program outside the top 5, surface a blocking warning.

**Detection:**
- Algorithm places a program with rising 3-year trend in "safe" when the trend delta exceeds the safety margin
- User feedback indicating they missed an expected-safe school

**Phase:** Phase 2 (algorithm design). Volatility modeling must be part of the core algorithm spec, not a v2 enhancement.

---

### Pitfall 10: GitHub Actions Rate Limits and Timeout Killing Scraping Jobs

**What goes wrong:** GitHub Actions free tier provides 2,000 minutes/month on public repos (unlimited for public). However, a single job has a 6-hour timeout. Scraping 78+ universities sequentially, with JS-rendered sites requiring Playwright (30–60s per site), can easily exceed 2–3 hours. If the job times out, partial results are written and there is no completion signal.

**Why it happens:** Developers design scraping as a single sequential job because it's simple. The job works fine in development with 5 test sites.

**Prevention:**
- Shard the scraping job: split 78 universities into 5–10 parallel matrix jobs. Each shard finishes in under 30 minutes.
- Use a write-at-end pattern: each shard writes results to a staging table. A final aggregation step promotes staging to production only if all shards complete successfully.
- Store intermediate state: if a shard fails, re-run only the failed shard (by tracking completion per university in the database).
- For the July high-frequency period, trigger scraping via a repository dispatch event from a lightweight cron ping, not a scheduled CRON string (cron schedule in GitHub Actions drifts and can be delayed up to 30 minutes during peak GitHub load).

**Detection:**
- GitHub Actions job logs show timeout at 6 hours
- Some universities have fresh scrape timestamps while others have stale ones from the same "run"

**Phase:** Phase 1 (scraping infrastructure). Sharding strategy must be designed before writing individual scrapers.

---

## Minor Pitfalls

---

### Pitfall 11: Major Code (Mã Ngành) Format Inconsistency Across Sources

**What goes wrong:** The Ministry portal uses 7-digit mã ngành codes (e.g., 7480201). Some universities list the same program with a 6-digit legacy code or a descriptive string instead of a code. Joining records across sources fails, leading to duplicate rows for the same program or missing matches.

**Prevention:**
- Build a canonical mã ngành reference table at the start. Map all variant formats to the canonical 7-digit code. Store the raw code alongside the canonical code.
- Flag any scraped record whose mã ngành doesn't match the canonical table as needing manual review.

**Phase:** Phase 1 (data model design).

---

### Pitfall 12: Tổ Hợp Code Proliferation and Non-Standard Codes

**What goes wrong:** Some universities define non-standard tổ hợp codes (e.g., D96 for Math/Literature/German) that are valid but rare. Scrapers that only recognize the common A00/B00/C00/D01 etc. codes silently drop these records.

**Prevention:**
- Seed the tổ hợp lookup table from the Ministry's official published list, not from what the developer knows from memory.
- Accept and store any 3-character alphanumeric code matching `[A-D]\d{2}` even if not in the seed list — flag unknowns for review rather than dropping them.

**Phase:** Phase 1 (data model).

---

### Pitfall 13: PWA Offline Behavior Confusing Users

**What goes wrong:** PWA service workers cache app shell and data. A student opens the app during the July peak while offline (e.g., in a rural area with poor signal). They see last-cached data, which may be from a previous year. No staleness indicator means they think the data is current.

**Prevention:**
- Display a clear "You are viewing offline/cached data from [date]" banner when the service worker is serving cached content.
- The offline cache should only cache UI shell and the most recent full dataset download. Do not serve partial stale data without attribution.

**Phase:** Phase 3 (PWA hardening).

---

### Pitfall 14: Anti-Scraping Measures on University Sites

**What goes wrong:** Some Vietnamese university sites (particularly private universities with competitive programs) use Cloudflare, rate-limiting, or IP blocks. A scraper hitting a site too frequently gets blocked with no warning — subsequent runs return Cloudflare challenge pages that are silently stored as "data."

**Prevention:**
- Implement exponential backoff with jitter: wait 2–10 seconds between requests to the same domain. Never scrape a single domain more than once per minute.
- Detect Cloudflare/CAPTCHA challenge pages: look for the string "Just a moment..." or HTTP 403/429 status codes. Abort and alert rather than storing the challenge page as data.
- For university sites requiring CAPTCHA bypass: escalate to manual data entry or contact the university's admissions office directly for a data export. Do not attempt automated CAPTCHA solving (legal and ToS risk).
- Rotate User-Agent headers to identify the scraper honestly (e.g., "UniSelectBot/1.0 (educational; contact@uniselect.vn)").

**Phase:** Phase 1 (scraper implementation). Politeness policies must be in the scraper base class, not added per site.

---

### Pitfall 15: No Audit Trail for Manual Data Corrections

**What goes wrong:** A volunteer corrects a wrong score by directly updating the database. Six months later, the scraper overwrites the correction with the original wrong value. The correction is lost with no record it was ever made.

**Prevention:**
- All database writes must go through the data pipeline, never direct SQL updates to production.
- Maintain a `data_overrides` table: manually-set values take precedence over scraped values and are never overwritten by the scraper. The scraper checks this table before writing.
- Log all data writes with source, timestamp, and previous value.

**Phase:** Phase 1 (data model) and Phase 2 (admin tooling).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Scraper implementation | CSS selector brittleness (P1) | Use semantic text anchors; add schema validation before DB write |
| Scraper implementation | JS-rendered page silent failure (P3) | Static/dynamic audit before writing scraper; minimum-row assertion |
| Scraper implementation | Encoding corruption (P2) | chardet on raw bytes; NFC normalization at write time |
| Data pipeline design | Ministry portal changes (P4) | Snapshot archive + per-university direct-scrape fallback |
| Data pipeline design | GitHub Actions timeout (P10) | Sharded parallel matrix jobs |
| Data model design | Mã ngành join failures (P11) | Canonical code table before any scraping |
| Algorithm design | Score volatility misclassification (P9) | Multi-year trend in tier calculation |
| UI implementation | Vietnamese search failing (P6) | Diacritic-folding + NFC normalization before search |
| Infrastructure | Supabase connection exhaustion (P7) | PgBouncer + edge caching for peak period |
| Infrastructure | Cold start latency (P8) | Static JSON serving via CDN for core data |
| Infrastructure hardening | Anti-scraping blocks (P14) | Politeness policies in base scraper class |
| PWA features | Offline stale data confusion (P13) | Staleness banner + cache-date attribution |
| Admin/ops | Manual correction overwritten by scraper (P15) | data_overrides table with precedence logic |

---

## Legal and Terms of Service Considerations

**Confidence: MEDIUM** — Vietnamese law specifics require legal review; general principles are well-established.

### Robots.txt Compliance
All scrapers must read and respect `robots.txt` for each target domain. If a government site disallows scraping in `robots.txt`, the scraper must not target it. Document which sites have explicit policies.

### Vietnamese Data Privacy Law (Nghị định 13/2023/NĐ-CP)
Vietnam's personal data protection decree (effective July 2023) governs collection and processing of personal data. Student score data is not personal data (it is aggregate/statistical), but if the app ever captures user-submitted scores for any reason, data handling policies must be implemented. For v1 (no user accounts, no score storage), this is low risk.

### Government Website Terms of Use
Vietnamese government portals (Ministry of Education) typically publish terms of service prohibiting commercial scraping. This project is open source and non-commercial (charity), which is a strong mitigating factor. However, terms should be reviewed and documented in the repository. Where possible, prefer official data download links or published PDFs over scraping the interactive UI.

### Copyright
Published điểm chuẩn data (cutoff scores) is factual/statistical information. Factual data is generally not copyrightable in Vietnamese law or under international norms. However, the arrangement and presentation of that data on a government portal may have copyright protection. Storing raw HTML is riskier than storing only extracted factual data.

**Recommendation:** Store only the extracted data (scores, codes, names), not the raw HTML in any user-visible form. Cite the source URL with each data point. Add attribution in the app footer.

---

## Sources

- Training knowledge: web scraping engineering patterns (HIGH confidence for established patterns like selector brittleness, encoding handling)
- Training knowledge: Vercel/Supabase free tier constraints as of mid-2025 (MEDIUM confidence — limits may have changed, verify current pricing pages)
- Training knowledge: Vietnamese Unicode handling and NFC normalization (HIGH confidence — Unicode Standard is authoritative)
- Training knowledge: GitHub Actions limits for public repositories (MEDIUM confidence — verify current docs)
- Training knowledge: Vietnamese THPT admissions system structure and nguyện vọng rules (MEDIUM confidence — 2026 rule changes cited from PROJECT.md, verify with Ministry publications)
- WebSearch unavailable during this session — all findings based on training knowledge and project context
- **Flag:** Supabase connection limits, Vercel function execution limits, and Ministry portal structure should be verified against current official documentation before Phase 1 begins
