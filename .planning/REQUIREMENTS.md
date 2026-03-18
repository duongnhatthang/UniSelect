# Requirements: UniSelect

**Defined:** 2026-03-17
**Core Value:** Give every Vietnamese student the data and strategy to order their nguyện vọng list correctly — because getting the ranking wrong means being locked out of better options permanently.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Data Pipeline

- [x] **PIPE-01**: System maintains a list of Vietnamese universities and their websites, updated via infrequent automated discovery (to add newly created or remove defunct institutions)
- [x] **PIPE-02**: System scrapes cutoff scores (điểm chuẩn) from university websites and Ministry portal on a schedule
- [x] **PIPE-03**: Scraped data stores historical cutoff scores per university, per major, per tổ hợp (subject combination), and per year
- [ ] **PIPE-04**: Scraping schedule runs at low frequency during the year and automatically increases frequency during July (peak registration period)
- [ ] **PIPE-05**: User can see data staleness (age and source) for every cutoff score displayed

### Search & Browse

- [x] **SRCH-01**: User can search universities by name (Vietnamese diacritic-aware search)
- [x] **SRCH-02**: User can filter search results by tổ hợp code (e.g. A00, D01, B00)

### Score Matching

- [x] **SCOR-01**: User can select a tổ hợp and enter a total score to see a ranked list of universities and majors they qualify for (quick mode)
- [x] **SCOR-02**: User can enter individual subject scores; app calculates totals per applicable tổ hợp combinations and shows matched universities (detailed mode)

### Nguyện Vọng Builder

- [x] **NGVG-01**: App generates a tiered 15-choice nguyện vọng list (dream / practical / safe) based on student score and tổ hợp using historical cutoff data

### Internationalization

- [ ] **I18N-01**: App defaults to Vietnamese language throughout
- [ ] **I18N-02**: User can toggle to English language

### Infrastructure

- [x] **INFRA-01**: App is deployable on free-tier serverless infrastructure (Vercel + Supabase or equivalent)
- [ ] **INFRA-02**: App handles July traffic spike without manual intervention (serverless auto-scaling)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Admission Pathways

- **PATH-01**: Học bạ (GPA-based) pathway — separate cutoff scores per admission method
- **PATH-02**: Aptitude test pathways (VNU TSA, HUST TSA) — dedicated test score input and matching
- **PATH-03**: Direct admission (xét tuyển thẳng) — eligibility checker for competition winners

### Advanced Features

- **ADV-01**: User can view multi-year historical cutoff score chart per university/major
- **ADV-02**: Score range simulation — slider to see how results shift across a score range
- **ADV-03**: User can manually reorder the generated nguyện vọng list
- **ADV-04**: User can share or export their nguyện vọng list via link or clipboard
- **ADV-05**: Teacher training program (sư phạm) guardrail — enforce 2026 rule: programs only counted if in top 5 choices
- **ADV-06**: University detail page — full info per school: all majors, all tổ hợp, scores, methods
- **ADV-07**: National score distribution benchmark — show student's estimated percentile rank

### User Accounts

- **USR-01**: Optional user profile to save score inputs and nguyện vọng lists across sessions

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Native iOS/Android app | PWA sufficient for v1; app store overhead unjustified for charity project |
| User authentication / login | Core lookup flow requires no account; adds complexity and privacy obligations |
| Real-time seat availability | Not published by universities; not part of điểm chuẩn data model |
| LLM/OCR as primary scraping method | Cost; pure HTML parsing covers majority of sites |
| Monetization beyond non-intrusive ads | Charity project; complex monetization out of scope |
| Paid infrastructure in v1 | Open source / charity constraint |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PIPE-01 | Phase 1 | Complete |
| PIPE-02 | Phase 1 | Complete |
| PIPE-03 | Phase 1 | Complete |
| PIPE-04 | Phase 4 | Pending |
| PIPE-05 | Phase 3 | Pending |
| SRCH-01 | Phase 3 | Complete |
| SRCH-02 | Phase 3 | Complete |
| SCOR-01 | Phase 3 | Complete |
| SCOR-02 | Phase 3 | Complete |
| NGVG-01 | Phase 3 | Complete |
| I18N-01 | Phase 3 | Pending |
| I18N-02 | Phase 3 | Pending |
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0

---
*Requirements defined: 2026-03-17*
*Last updated: 2026-03-17 after roadmap creation — all 14 requirements mapped*
