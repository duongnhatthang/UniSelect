# UniSelect

## What This Is

UniSelect is a Vietnamese-first PWA (Progressive Web App) that helps high school students navigate Vietnam's university admissions system (nguyện vọng). Students enter their estimated national exam score and subject combination (tổ hợp), and the app returns a ranked list of universities they are likely to be accepted to — plus a strategically-ordered 15-choice nguyện vọng list ready to submit to the government portal. University cutoff data is collected via automated web scraping of official portals and individual university websites.

## Core Value

Give every Vietnamese student the data and strategy to order their nguyện vọng list correctly — because getting the ranking wrong means being locked out of better options permanently.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Scrape and store university acceptance cutoff scores (điểm chuẩn) from official sources
- [ ] Display historical and current cutoff data per university, per major, per tổ hợp
- [ ] Student can enter estimated score and tổ hợp → see ranked list of achievable universities/majors
- [ ] Student can enter per-subject scores → app calculates totals per combo for more precise matching
- [ ] App generates a suggested 15-choice nguyện vọng list (tiered: dream / practical / safe)
- [ ] Scraping runs at low frequency during the year, high frequency during peak period (July)
- [ ] Vietnamese-first UI with English language toggle
- [ ] Deployable on serverless/free-tier infrastructure (Vercel + Supabase or equivalent)

### Out of Scope

- Học bạ (GPA-based) admission pathway — defer to v2
- Aptitude test pathways (VNU TSA, HUST TSA) — defer to v2
- Direct admission (xét tuyển thẳng) — defer to v2
- Native iOS/Android apps — PWA is sufficient for v1
- Account/user profiles — no login required for core lookup flow
- Real-time seat availability tracking — cutoff scores are the core data

## Context

- Vietnam's nguyện vọng system is a centralized matching algorithm: students rank up to 15 university-major choices, and the system locks them into the highest-ranked match. Getting order wrong is permanently costly.
- 2026 rules: max 15 nguyện vọng; teacher training programs only considered within top 5.
- Data sources: Ministry portal (thisinh.thitotnghiepthpt.edu.vn / thptquocgia) for structured data where available; individual university websites as fallback (~78+ universities in the initial list).
- Scraping preference: pure HTTP/HTML parsing without LLM/OCR; use these services sparingly only for highly non-standard pages.
- Traffic pattern: very low most of the year, large spike in July (registration period). Serverless auto-scaling is a natural fit.
- Subject combinations (tổ hợp): standard codes like A00 (Math/Physics/Chemistry), A01 (Math/Physics/English), B00 (Math/Biology/Chemistry), D01 (Math/Literature/English), C00 (Literature/History/Geography), etc.
- Open source / charity project — monetization via non-intrusive ad placement only; minimize all recurring costs.
- Developer uses Claude agents in ~/.claude/agents/ for parallel research and design tasks.

## Constraints

- **Cost**: Free-tier hosting only (Vercel, Supabase free plan, GitHub Actions) — no paid infrastructure in v1
- **Admission method**: National exam (THPT) scores only in v1; architecture must allow extending to học bạ / aptitude test pathways later
- **Scraping**: No LLM/OCR as primary scraping method — pure HTTP/DOM parsing preferred; sparingly acceptable as fallback for difficult sites
- **Language**: Vietnamese default, English toggle; development codebase in English
- **Scale**: Must handle July traffic spike gracefully — stateless/serverless architecture required
- **Tech stack**: React (PWA); backend API serverless functions; scheduled scraping via GitHub Actions or equivalent cron

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| PWA over native app | Single codebase, zero app store friction, lowest maintenance cost | — Pending |
| THPT-only for v1 | Covers ~80%+ of student use cases; other pathways add significant data complexity | — Pending |
| Both quick (tổ hợp + total) and detailed (per-subject) score input | Accommodates different stages of exam prep; quick for early planning, detailed for final decisions | — Pending |
| Suggestion algorithm: tiered 5+5+5 (dream/practical/safe) | Mirrors expert advice from Ministry and counselors; leaves room for algorithm customization | — Pending |
| Serverless-first infrastructure | Handles extreme seasonality cheaply; scales to zero when unused | — Pending |

---
*Last updated: 2026-03-17 after initialization*
