# Feature Landscape

**Domain:** Vietnamese University Admissions Helper — nguyện vọng strategy PWA
**Researched:** 2026-03-17
**Confidence note:** External web research tools were unavailable during this session. Findings are derived from the validated PROJECT.md requirements, training knowledge of the Vietnamese admissions ecosystem (MOET portal, diemchuan.com-class tools, báo Tuổi Trẻ/VnExpress counseling features), and general patterns from college search products globally. Confidence levels reflect this limitation.

---

## Table Stakes

Features users expect. Missing = product feels incomplete or users leave for existing tools.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Cutoff score (điểm chuẩn) lookup by university + major + tổ hợp | This is the single most-searched piece of data every admission season; existing tools like diemchuan.com already provide it | Low (display only) | Must include at least 2–3 prior years for trend context |
| Historical cutoff trend (3–5 years) per university/major | Score varies year-to-year; students must know direction of trend (rising/falling) to assess safety | Low (display only) | Surface as simple year-over-year delta, not just raw numbers |
| Filter by tổ hợp (subject combination) | Students only qualify for programs accepting their specific tổ hợp; non-filtered results are noise | Low | A00, A01, B00, D01, C00 are top 5 combos; full list ~30+ |
| Filter by major/ngành | Students often have a career direction; filtering by field of study is expected | Low | Use Bộ GD&ĐT major classification codes |
| Filter by region/location | Many students are constrained to a province or city (family, cost) | Low | Group by: Hà Nội, TP.HCM, Đà Nẵng, other provinces |
| Score entry → "which majors can I get?" result list | Core product promise; this is the primary user flow | Medium | Must handle both quick (total score) and per-subject input |
| Per-subject score input (Math, Physics, etc.) | Students know individual subject scores before final total is known; more precise than total-only | Medium | Auto-calculate totals per applicable tổ hợp |
| Result list sorted by probability (safe/match/reach) | Students need a relative ranking, not just raw data; this is the counseling frame they already use | Medium | Threshold logic: >cutoff+1 = safe, ±1 = match, <cutoff-2 = reach |
| Mobile-optimized UI | Target users are 17–18 year olds on Android phones; desktop is secondary; 70%+ Vietnamese mobile web traffic | Medium | Touch-first, fast load on 4G/LTE, minimal JS payload |
| Vietnamese-language UI | Target users are Vietnamese students; English-only would be a disqualifying barrier | Low | All labels, prompts, help text in Vietnamese; English toggle acceptable as secondary |
| University information card | Students need school identity (logo, location, type, website) to confirm they know what they're selecting | Low | Name, location, school type (public/private/foreign-invested), link to official site |

---

## Differentiators

Features that set this product apart from raw data lookup sites. Not expected by default, but valued once discovered.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Tiered 15-choice nguyện vọng list generator (5 dream / 5 practical / 5 safe) | Translates data into a submission-ready action; no existing free tool does this well | High | Core differentiator; must respect 2026 rule (teacher training only in top 5 slots) |
| Strategic ordering logic within tiers | Not just bucketing — the order within safe/practical/dream matters for the matching algorithm; most students get this wrong | High | Explain WHY a choice is ordered where it is; show delta to cutoff |
| Score range simulation ("if I score 24–27, what changes?") | Students don't know their final score yet; scenario planning is high-value during prep season (Jan–June) | Medium | Simple slider or range input; re-runs matching across a score band |
| "One click to add to my list" from any result card | Friction-free list building; direct path from discovery to decision | Low | Session-state only (no account); max 15 items enforced |
| Reorder/drag-and-drop nguyện vọng list | Students iterate on ordering; drag-and-drop makes it tactile and clear | Medium | Show strategic warnings when ordering looks wrong (e.g., safe choice ranked above match) |
| Visual safety indicator per list item | Color-coded (green/yellow/red) probability based on score vs cutoff delta | Low | Computationally trivial once matching logic exists |
| Year-over-year cutoff trend sparkline | Shows at a glance whether a school is getting harder to enter; differentiates from static data dumps | Low-Medium | Small inline chart; 3–5 data points per major |
| Tổ hợp auto-detection from subject scores | If student enters per-subject scores, auto-identify which tổ hợp combos they qualify for | Low | Pure lookup table; no ambiguity |
| "Teacher training top-5 rule" guardrail | Automatically warns if a sư phạm program is placed outside top 5 slots | Low | Hard rule from 2026 MOET regulations; students frequently unaware |
| Export/share nguyện vọng list | Students consult parents, teachers; shareable link or screenshot-ready view is high value | Low-Medium | Session URL with encoded state is simplest; no backend storage needed |
| Offline access to last-fetched data | PWA service worker cache; students may access data in low-connectivity exam environments | Medium | Cache cutoff data on first load; show staleness indicator |
| Score benchmark context ("top X% of test-takers") | Helps students calibrate ambition; reduces both under- and over-confidence | Medium | Requires national score distribution data from MOET; available post-exam |

---

## Anti-Features

Features to deliberately NOT build in v1. Including these would dilute focus, increase maintenance burden, or require data not yet available.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| User accounts / login | Adds auth infrastructure, security surface, GDPR/PDPA obligations; core flow needs none of it | Session state only; encode list in URL for sharing |
| Học bạ (GPA) pathway matching | Different data model, different cutoff format, different evaluation criteria; significantly expands scope | Mark as "coming soon" in UI; architecture must allow adding later |
| Aptitude test pathways (VNU TSA, HUST TSA, etc.) | Each exam has its own score scale and cutoff data; separate scraping effort | Out of scope v1 per PROJECT.md |
| Real-time seat / quota tracking | Quota data is not reliably published mid-cycle; creates false precision | Show historical quota (chỉ tiêu) as informational context only |
| University "reviews" or ratings from students | UGC content requires moderation, auth, spam handling; not core to admissions decision | Link out to external review sites (e.g., ĐHQG's official pages) |
| College comparison table (side-by-side) | High implementation complexity for moderate incremental value in v1; users can mentally compare 2 schools | Phase 2 candidate once core flow is validated |
| Scholarship / financial aid search | Different data domain, different scraping targets; distracts from core | Link to MOET scholarship portal |
| Notification / alert on cutoff updates | Requires push notification infra, user opt-in flow, backend jobs beyond scraping | Nice-to-have v2; scraping pipeline is enough for v1 |
| AI chat / counseling bot | Requires LLM API cost, prompt engineering, hallucination risk on high-stakes decisions | The algorithm-driven list generator IS the counselor; no chat needed |
| Native iOS/Android app | Per PROJECT.md constraint; PWA is sufficient; app store friction eliminates fast iteration | PWA with Add to Home Screen prompt |
| Ad-dense layout | Drives away users; damages trust on a high-stakes tool | Single, unobtrusive banner or footer ad only |
| Gamification (badges, streaks) | Inappropriate for an anxiety-inducing, time-sensitive decision context | Clean, task-focused UX only |

---

## Feature Dependencies

```
Per-subject score entry
  → Tổ hợp auto-detection
    → Score total calculation
      → Cutoff matching (core)
        → Probability tier assignment (safe/match/reach)
          → Result list display
            → Add-to-list (session state)
              → Nguyện vọng list view
                → Drag-to-reorder
                  → Strategic ordering warnings
                    → Teacher training top-5 guardrail
                      → Export/share list

Cutoff data store (scraped)
  → Historical trend calculation
    → Trend sparkline display
    → Year-over-year delta display

Cutoff matching (core)
  → Score range simulation (runs matching multiple times across a range)

Cutoff matching (core)
  → Score benchmark context (requires national distribution data — post-exam only)
```

**Critical path:** Cutoff data store → Cutoff matching → Result list. Everything else builds on these three.

---

## MVP Recommendation

Prioritize these features for v1 launch:

1. **Cutoff score lookup** — University + major + tổ hợp filter, 3 years of history, trend delta (table stakes, core data product)
2. **Per-subject + total score entry** — Both input modes, tổ hợp auto-detection, score calculation (core flow)
3. **Result list with probability tiers** — Safe/match/reach bucketing with color indicators (makes data actionable)
4. **15-choice nguyện vọng list builder** — Add from results, drag to reorder, teacher training guardrail (core differentiator)
5. **Score range simulation** — Slider across a ±3 point band (highest-value differentiator for pre-exam planning season)
6. **Export/share list** — URL encoding of session state (zero backend cost, high shareability)

Defer to v2:
- University comparison table — needs validated user demand first
- Offline PWA caching — add after core data flow is stable
- Score benchmark / national distribution context — data available only post-July exam; add for 2027 cycle
- Học bạ and aptitude test pathways — per PROJECT.md explicit deferral

---

## Notes on Mobile UX for Vietnamese Students

- **Screen size:** Majority of target users are on mid-range Android phones (5–6" screens, 1080p); design for 390px–430px viewport width as primary
- **Input method:** Vietnamese keyboard input for search is required; avoid relying on autocomplete that only works for Roman characters
- **Data density:** Students want dense information (Vietnamese news/app conventions favor more data per screen than Western norms); don't over-whitespace
- **Trust signals:** Ministry/MOET branding references and official data source citations increase credibility significantly for this demographic
- **Sharing pattern:** Zalo (not WhatsApp/iMessage) is primary sharing channel; Zalo link preview support matters for the share feature
- **Load performance:** Target <3s TTI on 4G; large JavaScript bundles will hurt on mid-range devices

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Table stakes features | MEDIUM | Based on known Vietnamese admissions tool conventions and PROJECT.md requirements; not validated against live competitor feature audits (tools unavailable) |
| Differentiators | MEDIUM | Based on gap analysis between raw-data tools and counseling needs; score simulation and list generator are well-grounded in domain knowledge |
| Anti-features | HIGH | Based on explicit PROJECT.md out-of-scope list plus domain reasoning; these exclusions are well-justified |
| Feature dependencies | HIGH | Logic dependencies are deterministic; no external data source needed to verify |
| Mobile UX notes | MEDIUM | Based on known Vietnamese mobile usage patterns; not verified with current analytics data |

## Sources

- `/Users/thangduong/Desktop/UniSelect/.planning/PROJECT.md` — primary requirements source (HIGH confidence)
- Training knowledge: Vietnamese MOET nguyện vọng system mechanics, THPT score structure, tổ hợp codes, diemchuan.com-class tool patterns, Zalo as primary sharing channel (MEDIUM confidence — training cutoff August 2025)
- External research tools (WebSearch, WebFetch, Brave Search) were unavailable during this session; competitor feature audit is a gap that should be filled manually or in a follow-up research pass
