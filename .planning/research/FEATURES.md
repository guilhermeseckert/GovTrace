# Feature Research

**Domain:** Government transparency / "follow the money" civic data platform
**Researched:** 2026-03-31
**Confidence:** HIGH (cross-referenced OpenSecrets, FollowTheMoney, LittleSis, CanadaGPT, Code for America patterns)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Global entity search with autocomplete | Every platform from OpenSecrets to CanadaGPT leads with search; it is the product entry point | MEDIUM | pg_trgm + prefix-indexed search; autocomplete must be fast (<150ms perceived) or users abandon |
| Entity profile pages (politician, company, person) | OpenSecrets, FollowTheMoney, LittleSis all anchor data to entity pages; users need a canonical home for each subject | HIGH | Tabbed layout: donations, contracts, lobbying, grants; sortable tables per tab |
| Source links on every record | Transparency platforms live or die on source credibility; users need to verify original data | LOW | Link directly to Elections Canada, open.canada.ca, lobbycanada.gc.ca per record |
| Data provenance / last-updated timestamps | Users need to know if data is stale; civic trust is broken by outdated numbers presented as current | LOW | Show data vintage per dataset: Elections Canada (weekly), contracts/grants (quarterly) |
| Sortable, filterable data tables | OpenSecrets FEC Itemizer and FollowTheMoney both offer this; users expect to slice and sort contributions by amount, date, party | MEDIUM | shadcn/ui Table + TanStack Table; server-side sort/filter for large datasets |
| Mobile-responsive layout | Over 50% of users will arrive via mobile (social shares, news links); a broken mobile experience destroys credibility | MEDIUM | Tailwind responsive breakpoints; tables collapse to cards on small viewports |
| "Connections do not imply wrongdoing" disclaimer | Critical for civic trust; absence invites legal and reputational risk; Code for America explicitly flags "Focus on the Negative" as anti-pattern | LOW | Persistent banner or per-page footer text; must be present on all relationship views |
| Clear explanation of data sources | Users unfamiliar with Elections Canada or lobbycanada.gc.ca need context on what the underlying data is | LOW | About/Sources page + inline tooltips on data field labels |

### Differentiators (Competitive Advantage)

Features that set GovTrace apart. CanadaGPT covers Parliament; no Canadian platform unifies donations + contracts + lobbying + grants into a single searchable graph.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Cross-dataset entity unification | Canada has no equivalent of OpenSecrets; no existing platform joins all 5 federal datasets on a single entity | HIGH | The pg_trgm + Claude verification pipeline is the core IP; entity_connections pre-compute table is essential for query speed |
| AI plain-language summaries | Most transparency data is incomprehensible to non-experts; CanadaGPT has AI chat but not narrative summaries per entity profile | HIGH | Claude API; generated per entity on profile load or pre-generated on ingest; must be clearly labelled as AI-generated |
| AI match transparency badges | Users need to trust entity matches; showing confidence score + reasoning builds trust instead of hiding uncertainty | MEDIUM | Inline badge per matched record: "95% confident — same CRA number" vs "72% confident — name similarity, AI verified" |
| Money-flow Sankey diagram | No Canadian platform visualises the donation → party → contract flow graphically; this is the "aha moment" in visual form | HIGH | D3.js Sankey; entity-scoped (show flows for one company across all datasets); needs pre-computed edge weights |
| Force-directed relationship network graph | Shows second-degree connections (Company A → Politician B → Company C contract) that tables cannot reveal | HIGH | D3.js force-directed; must be bounded (cap node count at ~50 for performance); zoom + click-to-navigate |
| Activity timeline across all datasets | Chronological view of all events for an entity across datasets reveals patterns (lobbying before contract, donation before policy change) | MEDIUM | D3.js timeline or CSS-based; events from all 5 datasets merged by date, colour-coded by type |
| Community error-flagging system | Government source data contains errors (wrong names, duplicate entries, outdated records); crowd-sourced corrections improve data quality | MEDIUM | Simple flag-and-comment form; admin review queue; no user accounts needed (anonymous flags accepted, email optional) |
| Weekly AI-generated newsletter | OpenSecrets runs a 54,000-subscriber newsletter; a Canada-specific digest has no equivalent; drives retention and return visits | HIGH | Resend + Claude API; digest format: top entities by recent activity, notable new contracts/donations, data freshness summary |
| Network density heatmap | Visualises which politicians/departments have the densest relationship networks across datasets — impossible to see in tabular form | HIGH | D3.js heatmap; x-axis departments, y-axis companies; colour intensity = connection count |
| Spending-by-department chart | Shows aggregate government spending per federal department with breakdown by vendor; gives context for contract data | MEDIUM | Bar or treemap chart; D3.js or recharts; computed from contracts + grants tables |
| Donations trend line with election overlays | Visualises contribution volume over time with federal election dates marked; surfaces pre-election donation spikes | MEDIUM | D3.js line chart; election dates hard-coded or from Elections Canada calendar |
| Bilingual-ready structure (EN/FR) | Canada is officially bilingual; structure for i18n from day one avoids a painful retrofit; French translations deferred but architecture must support them | LOW | i18next or similar; all strings externalised; French content deferred to post-launch |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create harm, scope creep, or trust problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| User accounts / login for public browsing | "Personalization", saved searches, alerts | Public data should be radically accessible; login friction drops 60-80% of casual users; creates PII liability; violates open-data spirit | Anonymous newsletter signup only; no login required for any read operation |
| "Investigate this entity" editorial framing | Journalists want it; makes platform feel impactful | Violates core neutrality principle; creates legal risk; Code for America explicitly identifies "Focus on the Negative" as a civic anti-pattern | Present connections neutrally; users draw their own conclusions |
| Real-time data streaming | Feels impressive | Government data updates weekly/quarterly at best; streaming adds infrastructure cost with zero UX benefit | Show last-updated timestamp; scheduled ingest on government update cadence |
| User-submitted data (beyond error flags) | Community wants to contribute new records | Unverified user data mixed with government sources destroys the trust model; moderation overhead is unsustainable | Accept error flags on existing records only; link to official sources for corrections |
| Social sharing / comment threads | Community engagement | Turns civic data platform into social media; attracts coordinated harassment of named individuals; unmoderable at small-team scale | Newsletter for engagement; GitHub issues for platform feedback |
| Native mobile app | Polished feel | Responsive web covers 95% of mobile use cases; app stores add distribution friction and update overhead; diverts from core data work | Mobile-first responsive design; PWA if needed |
| French content for v1 | Canada is bilingual | Translation requires ongoing editorial maintenance for AI summaries and newsletter; delays launch significantly | Ship in English with i18n structure in place; add French in v2 |
| Predictive / "risk score" features | "Which companies are likely to get contracts?" | Algorithmic judgment on entities creates serious harm potential; conflates correlation with causation (Code for America anti-pattern); regulatory risk | Historical data only; no predictive scoring ever |
| Video content | Richer storytelling | Storage and bandwidth cost; distracts from data product; not core to mission | Partner with journalists who embed GovTrace data; link to external video |

---

## Feature Dependencies

```
Data Ingestion Pipeline
    └──requires──> Everything else
                       (No entity profiles, search, or visualizations
                        exist without parsed, normalized data)

Entity Normalization + Matching
    └──requires──> Data Ingestion Pipeline
    └──enables──> Entity Profile Pages
    └──enables──> Relationship Graph
    └──enables──> Sankey Diagram
    └──enables──> AI Summaries

Entity Profile Pages
    └──requires──> Entity Normalization
    └──enables──> AI Summaries (need entity context)
    └──enables──> Community Error Flagging (need entity to flag against)
    └──enables──> All Visualizations (scoped to entity)

Search + Autocomplete
    └──requires──> Entity Normalization
    └──enhances──> Entity Profile Pages (entry point)

AI Plain-Language Summaries
    └──requires──> Entity Profile Pages
    └──requires──> Claude API integration
    └──enhances──> Accessibility for non-expert users

AI Match Transparency Badges
    └──requires──> Entity Normalization (confidence scores come from matching pipeline)
    └──enhances──> Entity Profile Pages (trust signal per record)

Relationship Network Graph
    └──requires──> entity_connections pre-computed table
    └──requires──> Entity Normalization (edges are between matched entities)

Sankey Diagram
    └──requires──> entity_connections pre-computed table
    └──requires──> Cross-dataset joins (donations + contracts + grants)

Activity Timeline
    └──requires──> Entity Profile Pages
    └──requires──> Unified event model across all 5 datasets

Community Error Flagging
    └──requires──> Entity Profile Pages
    └──enables──> Data quality improvement loop

Weekly Newsletter
    └──requires──> Data Ingestion Pipeline (needs fresh data to report on)
    └──requires──> Claude API integration
    └──requires──> Resend email integration

Newsletter Subscriber Management
    └──requires──> Resend integration
    └──enables──> Weekly Newsletter delivery
```

### Dependency Notes

- **Everything requires Data Ingestion Pipeline:** Zero UI features are buildable without parsed, normalized data from all 5 sources. This is the correct Phase 1 priority.
- **Entity Normalization enables all entity-scoped features:** Profiles, graphs, and AI summaries all depend on entities being correctly identified across datasets. Normalization quality directly determines product quality.
- **Visualizations require pre-computed tables:** D3.js graphs queried live over raw tables will time out at production data volumes. The entity_connections pre-computed table is an architectural prerequisite, not an optimization.
- **AI Summaries require profile pages:** Summaries need entity context (what datasets they appear in, aggregated stats) before Claude can generate a coherent narrative.
- **Community Flagging requires entity profiles:** Users flag specific records on specific entity pages; the flagging system is meaningless without the entity context it operates on.
- **Newsletter conflicts with real-time expectation:** Newsletter sets a "weekly cadence" expectation; never promise real-time alerts when government data updates at weekly/quarterly intervals.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the "aha moment" (search a name, see the full picture).

- [ ] Data ingestion for all 5 federal sources — without data, nothing else matters
- [ ] Entity normalization pipeline — deterministic + pg_trgm + Claude verification for medium-confidence matches
- [ ] Global search with autocomplete — the entry point; must feel instant
- [ ] Entity profile pages with tabbed data tables (donations, contracts, lobbying, grants) — the product core
- [ ] Source links on every record — non-negotiable for credibility
- [ ] AI plain-language summaries — the hero accessibility feature; core differentiator
- [ ] AI match transparency badges — trust signal for the normalization pipeline
- [ ] "Connections do not imply wrongdoing" disclaimer — legal and ethical requirement
- [ ] D3.js relationship network graph — the visual "aha moment"
- [ ] D3.js Sankey money-flow diagram — makes donation → contract flows tangible
- [ ] Activity timeline — chronological view across all datasets
- [ ] Community error-flagging system — data quality feedback loop from day one
- [ ] Mobile-responsive layout — over half of users will be on mobile
- [ ] Dark mode — standard civic tech expectation in 2026

### Add After Validation (v1.x)

Add once core search + entity profiles + visualizations are confirmed working.

- [ ] Weekly newsletter ("GovTrace Weekly") — triggers when: confirmed return visitor behaviour; needs Claude + Resend wired up
- [ ] Newsletter subscriber management — triggers with: newsletter launch
- [ ] Network heatmap — triggers when: relationship graph usage data suggests users want density views
- [ ] Spending-by-department treemap — triggers when: contracts/grants data is confirmed high quality
- [ ] Donations trend chart with election overlays — triggers when: timeline is live and confirming user engagement

### Future Consideration (v2+)

Defer until product-market fit is established and editorial capacity exists.

- [ ] French content translations — defer: requires ongoing translation of AI summaries and newsletter; structure for i18n must be in place at v1 but content is English-only
- [ ] Public API for bulk data access — defer: significant documentation and rate-limiting overhead; validate researcher demand first
- [ ] Embeddable widgets for journalists — defer: partnership development needed; validate journalist use case first
- [ ] Provincial data integration — defer: 10 provincial + 3 territorial datasets multiplies ingestion complexity by 13x; validate federal-only use case first

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Data ingestion pipeline | HIGH | HIGH | P1 |
| Entity normalization + matching | HIGH | HIGH | P1 |
| Global search + autocomplete | HIGH | MEDIUM | P1 |
| Entity profile pages | HIGH | HIGH | P1 |
| Source links on every record | HIGH | LOW | P1 |
| AI plain-language summaries | HIGH | MEDIUM | P1 |
| AI match transparency badges | HIGH | LOW | P1 |
| "No wrongdoing implied" disclaimer | HIGH | LOW | P1 |
| Relationship network graph (D3.js) | HIGH | HIGH | P1 |
| Sankey money-flow diagram (D3.js) | HIGH | HIGH | P1 |
| Activity timeline | MEDIUM | MEDIUM | P1 |
| Mobile-responsive layout | HIGH | MEDIUM | P1 |
| Dark mode | MEDIUM | LOW | P1 |
| Community error-flagging | MEDIUM | MEDIUM | P1 |
| Weekly AI newsletter | HIGH | HIGH | P2 |
| Newsletter subscriber management | MEDIUM | LOW | P2 |
| Network density heatmap | MEDIUM | HIGH | P2 |
| Spending-by-department chart | MEDIUM | MEDIUM | P2 |
| Donations trend with election overlays | MEDIUM | MEDIUM | P2 |
| French content (i18n structure) | LOW | LOW | P1 (structure only) |
| French content (translations) | MEDIUM | HIGH | P3 |
| Public API | MEDIUM | HIGH | P3 |
| Embeddable journalist widgets | MEDIUM | HIGH | P3 |
| Provincial data integration | HIGH | VERY HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | OpenSecrets (US) | CanadaGPT (CA) | FollowTheMoney (US states) | LittleSis (US) | GovTrace (Our Approach) |
|---------|-----------------|----------------|---------------------------|----------------|------------------------|
| Unified entity search | Yes — full-text across all datasets | Yes — MPs, bills, lobbying | Yes — statewide elections | Yes — people + orgs | Yes — all 5 federal CA datasets |
| Entity profile pages | Yes — org + politician profiles | Yes — MP profiles | Yes — candidate profiles | Yes — person + org profiles | Yes — politician, company, person |
| Campaign finance data | Yes | No | Yes | No | Yes (Elections Canada donations) |
| Lobbying data | Yes | Yes | Partial | No | Yes (lobbycanada.gc.ca) |
| Government contracts | No | Partial | No | No | Yes (open.canada.ca) |
| Grants data | No | No | No | No | Yes (open.canada.ca) |
| Relationship network graph | No | No | Power Mapping (limited) | Yes — core feature | Yes — D3.js force-directed |
| Money-flow visualization | No | No | No | No | Yes — D3.js Sankey |
| AI plain-language summaries | No | Yes — AI chat | No | No | Yes — per-entity narrative |
| AI match transparency | No | No | No | No | Yes — confidence badges |
| Community error flagging | No | No | No | Yes — contribution model | Yes — anonymous flag + admin review |
| Source links on records | Yes | Yes | Yes | Yes | Yes |
| Weekly newsletter | Yes — 54K subscribers | No | No | No | Yes — AI-generated digest |
| Canadian federal data | No | Partial (Parliament only) | No | No | Yes — all 5 datasets |
| Bilingual (EN/FR) | No | Yes | No | No | Structured for v2 |
| Open source | No | No | No | Yes | Yes — MIT |
| Mobile responsive | Yes | Yes | Partial | Partial | Yes |

**Key gap GovTrace fills:** No existing Canadian platform joins donations + contracts + lobbying + grants into a unified searchable graph. CanadaGPT covers Parliament (Hansard, bills, votes); GovTrace covers money flow. These are complementary, not competing.

---

## Sources

- [OpenSecrets — Research Tools and Features](https://www.opensecrets.org/research-tools)
- [OpenSecrets — Open Data and Bulk Downloads](https://www.opensecrets.org/open-data)
- [OpenSecrets — Newsletter Signup (54K subscribers noted)](https://www.opensecrets.org/newsletter/signup-form)
- [OpenSecrets — 2024 Website Redesign Press Release](https://www.opensecrets.org/news/2024/10/press-release-opensecrets-launches-upgraded-website-and-new-look)
- [FollowTheMoney.org — Tools and Data Categories](https://www.followthemoney.org/)
- [LittleSis — Relationship Research Platform](https://littlesis.org/)
- [CanadaGPT — Canadian Government Accountability Platform](https://canadagpt.ca/en)
- [The Tech Lobby — Canadian Tech Lobbying Data](https://thetechlobby.ca/our-data/)
- [Code for America — Civic Tech Patterns and Anti-Patterns](http://codeforamerica.github.io/civic-tech-patterns/)
- [Harvard Ash Center — Transparency is Insufficient: Lessons from Civic Technology](https://ash.harvard.edu/articles/transparency-is-insufficient-lessons-from-civic-technology-for-anticorruption/)
- [Civic Tech Guide — Government Transparency Projects Directory](https://directory.civictech.guide/listing-category/government-transparency)
- [OECD — AI in Civic Participation and Open Government (2025)](https://www.oecd.org/en/publications/2025/06/governing-with-artificial-intelligence_398fa287/)
- [PLOS One — Improving Citizen-Government Interactions with Generative AI](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0311410)

---
*Feature research for: Government transparency / civic data platform (Canadian federal)*
*Researched: 2026-03-31*
