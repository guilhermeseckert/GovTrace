# Requirements: GovTrace

**Defined:** 2026-03-31
**Core Value:** Anyone can search a name and instantly trace the flow of money and influence across all public government datasets — with clarity a 9-year-old could follow.

## v1 Requirements

### Data Ingestion

- [x] **DATA-01**: System downloads and parses Elections Canada political contributions CSV (2004–present)
- [x] **DATA-02**: System downloads and parses federal contracts CSV from open.canada.ca
- [x] **DATA-03**: System downloads and parses federal grants CSV from open.canada.ca
- [x] **DATA-04**: System downloads and parses lobbyist registrations from lobbycanada.gc.ca
- [x] **DATA-05**: System downloads and parses lobbyist communication reports from lobbycanada.gc.ca
- [x] **DATA-06**: System detects and handles CSV encoding (UTF-8, ISO-8859-1, Windows-1252) per file
- [x] **DATA-07**: Ingestion is idempotent — re-running with same data produces no duplicates (upsert on source-derived keys)
- [x] **DATA-08**: Raw source data preserved in jsonb column for every record

### Entity Matching

- [x] **MATCH-01**: System normalizes entity names (lowercase, strip legal suffixes, remove filler words, normalize whitespace)
- [x] **MATCH-02**: System performs fuzzy matching using PostgreSQL pg_trgm (trigram similarity > 0.6)
- [x] **MATCH-03**: System sends medium-confidence matches (0.6–0.85) to Claude API for verification with reasoning
- [x] **MATCH-04**: System stores match decisions in entity_matches_log with method, confidence, and AI reasoning
- [x] **MATCH-05**: System pre-computes entity_connections table with aggregated relationship data (type, total value, transaction count, date range)
- [x] **MATCH-06**: Entity matching uses Claude Batch API for historical backfill (cost efficiency)

### Search

- [x] **SRCH-01**: User can search for any entity (person, company, politician) from a prominent search bar
- [x] **SRCH-02**: Search provides autocomplete suggestions as user types (< 150ms perceived latency)
- [x] **SRCH-03**: Search results are grouped by entity type (Politicians, Companies/Organizations, People)
- [x] **SRCH-04**: Each search result shows summary counts (donations, contracts, lobbying, grants)
- [x] **SRCH-05**: User can filter search results by entity type, date range, and province

### Entity Profiles

- [x] **PROF-01**: User can view an entity profile page with name, type, and AI match confidence badge
- [x] **PROF-02**: Profile shows plain-language AI-generated summary as the first thing visible
- [x] **PROF-03**: Profile has tabbed/sectioned views for Donations, Contracts, Grants, Lobbying, and Connections
- [x] **PROF-04**: Each data section shows a sortable, filterable table with pagination
- [x] **PROF-05**: Every record links back to the original government data source
- [x] **PROF-06**: Profile shows data provenance timestamps (when each dataset was last updated)

### AI Features

- [x] **AI-01**: System generates plain-language summaries using Claude API (simple words, rounded numbers, emoji icons)
- [x] **AI-02**: Summaries include "connections do not imply wrongdoing" caveat when showing relationships
- [x] **AI-03**: Summaries are cached and regenerated weekly on data refresh
- [x] **AI-04**: AI match transparency badge shows confidence score, match method, and expandable AI reasoning
- [x] **AI-05**: "How do we write this summary?" link explains AI generation from public data

### Community

- [x] **COMM-01**: User can flag an incorrect entity match via "Flag an error" button
- [x] **COMM-02**: Flags are stored with optional email for follow-up
- [x] **COMM-03**: Flagged matches are visible in entity_matches_log for review

### Visualizations

- [x] **VIZ-01**: Relationship network graph (D3.js force-directed) with color-coded node types and edge styles
- [x] **VIZ-02**: Graph supports click-to-expand (drill into a node's connections), hover tooltips, zoom/pan
- [x] **VIZ-03**: Graph supports filtering by relationship type and date range
- [x] **VIZ-04**: Money flow Sankey diagram showing donor → party → contract/grant flows
- [x] **VIZ-05**: Activity timeline showing all events chronologically across datasets with type-coded markers
- [ ] **VIZ-06**: Network heatmap showing politician/department vs company relationship density
- [ ] **VIZ-07**: Spending by department chart (treemap or bar chart with drill-down)
- [ ] **VIZ-08**: Donations trend chart with election date overlays and stacking by top donors

### Newsletter

- [ ] **NEWS-01**: User can subscribe to weekly newsletter via email input (footer + landing page + dedicated page)
- [ ] **NEWS-02**: Subscriber receives email confirmation before being added
- [ ] **NEWS-03**: Subscriber can unsubscribe via link in email
- [ ] **NEWS-04**: System generates weekly newsletter content using Claude API from new data
- [ ] **NEWS-05**: Newsletter sent via Resend with plain-text and HTML versions
- [ ] **NEWS-06**: Newsletter archive page shows all past issues

### API

- [x] **API-01**: GET /api/search with query, type filter, and pagination
- [x] **API-02**: GET /api/entity/:id returns full entity profile with all related data
- [x] **API-03**: GET /api/entity/:id/donations, /contracts, /lobbying, /grants with pagination
- [x] **API-04**: GET /api/entity/:id/connections returns related entities
- [x] **API-05**: GET /api/entity/:id/summary returns AI-generated plain-language summary
- [x] **API-06**: GET /api/entity/:id/graph returns nodes and edges for D3 (depth parameter)
- [x] **API-07**: GET /api/entity/:id/money-flow returns Sankey diagram data
- [x] **API-08**: GET /api/entity/:id/timeline returns chronological events
- [ ] **API-09**: GET /api/entity/:id/heatmap returns relationship intensity matrix
- [ ] **API-10**: GET /api/entity/:id/spending-breakdown returns department spending data
- [x] **API-11**: GET /api/stats returns platform-wide statistics
- [x] **API-12**: POST /api/entity/:id/flag submits an error flag
- [ ] **API-13**: Newsletter API endpoints (subscribe, confirm, unsubscribe, latest, archive)

### Infrastructure

- [x] **INFRA-01**: Monorepo with pnpm workspaces (packages/ingestion, packages/web)
- [x] **INFRA-02**: PostgreSQL 16 with pg_trgm extension enabled
- [x] **INFRA-03**: Drizzle ORM with shared schema, pnpm Catalogs for single instance
- [x] **INFRA-04**: Docker Compose for local development (PostgreSQL)
- [x] **INFRA-05**: Docker deployment configuration for Coolify on Hetzner
- [x] **INFRA-06**: PostgreSQL not exposed to internet (use expose: not ports: in Docker)
- [x] **INFRA-07**: Database indexes: GIN on normalized_name, FKs, composite on entity_connections, pg_trgm

### Design

- [x] **DSGN-01**: Professional civic design with clean typography, data-dense but readable
- [x] **DSGN-02**: Dark mode support
- [x] **DSGN-03**: Mobile responsive (tables collapse to cards on small viewports)
- [x] **DSGN-04**: Bilingual-ready structure (i18n keys externalized, English-only content for v1)
- [x] **DSGN-05**: Landing page with prominent search bar, tagline, and platform statistics
- [x] **DSGN-06**: "Connections do not imply wrongdoing" disclaimer visible on all relationship views

## v2 Requirements

### Internationalization

- **I18N-01**: Full French translation of UI and static content
- **I18N-02**: French AI-generated summaries and newsletter

### Data Expansion

- **EXPN-01**: Provincial political donation data (13 jurisdictions)
- **EXPN-02**: Parliamentary voting records and bill sponsorship
- **EXPN-03**: Senate appointments and expenses

### Advanced Features

- **ADV-01**: Saved searches and email alerts (requires user accounts)
- **ADV-02**: Comparative analysis (compare two entities side-by-side)
- **ADV-03**: Embeddable widgets for journalists
- **ADV-04**: Public API with rate limiting for third-party developers

## Out of Scope

| Feature | Reason |
|---------|--------|
| User accounts / login for browsing | Public data must be radically accessible; login friction kills casual use |
| Editorial framing / "investigate" features | Violates core neutrality; legal risk; Code for America anti-pattern |
| Real-time data streaming | Government data updates weekly/quarterly; streaming adds cost with zero benefit |
| User-submitted data (beyond flags) | Mixing unverified data with government sources destroys trust model |
| Social features / comments | Turns civic data into social media; attracts harassment of named individuals |
| Native mobile app | Responsive web covers 95% of use cases; app stores add friction |
| French translations for v1 | Delays launch; i18n structure in place for v2 |
| Predictive / risk scoring | Algorithmic judgment creates serious harm; conflates correlation with causation |
| Video content | Storage/bandwidth cost; not core to mission |
| OAuth / SSO | No user accounts needed for v1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 1 | Complete |
| DATA-02 | Phase 1 | Complete |
| DATA-03 | Phase 1 | Complete |
| DATA-04 | Phase 1 | Complete |
| DATA-05 | Phase 1 | Complete |
| DATA-06 | Phase 1 | Complete |
| DATA-07 | Phase 1 | Complete |
| DATA-08 | Phase 1 | Complete |
| MATCH-01 | Phase 1 | Complete |
| MATCH-02 | Phase 1 | Complete |
| MATCH-03 | Phase 1 | Complete |
| MATCH-04 | Phase 1 | Complete |
| MATCH-05 | Phase 1 | Complete |
| MATCH-06 | Phase 1 | Complete |
| SRCH-01 | Phase 2 | Complete |
| SRCH-02 | Phase 2 | Complete |
| SRCH-03 | Phase 2 | Complete |
| SRCH-04 | Phase 2 | Complete |
| SRCH-05 | Phase 2 | Complete |
| PROF-01 | Phase 2 | Complete |
| PROF-02 | Phase 2 | Complete |
| PROF-03 | Phase 2 | Complete |
| PROF-04 | Phase 2 | Complete |
| PROF-05 | Phase 2 | Complete |
| PROF-06 | Phase 2 | Complete |
| AI-01 | Phase 2 | Complete |
| AI-02 | Phase 2 | Complete |
| AI-03 | Phase 2 | Complete |
| AI-04 | Phase 2 | Complete |
| AI-05 | Phase 2 | Complete |
| COMM-01 | Phase 2 | Complete |
| COMM-02 | Phase 2 | Complete |
| COMM-03 | Phase 2 | Complete |
| VIZ-01 | Phase 3 | Complete |
| VIZ-02 | Phase 3 | Complete |
| VIZ-03 | Phase 3 | Complete |
| VIZ-04 | Phase 3 | Complete |
| VIZ-05 | Phase 3 | Complete |
| VIZ-06 | Phase 4 | Pending |
| VIZ-07 | Phase 4 | Pending |
| VIZ-08 | Phase 4 | Pending |
| NEWS-01 | Phase 4 | Pending |
| NEWS-02 | Phase 4 | Pending |
| NEWS-03 | Phase 4 | Pending |
| NEWS-04 | Phase 4 | Pending |
| NEWS-05 | Phase 4 | Pending |
| NEWS-06 | Phase 4 | Pending |
| API-01 | Phase 2 | Complete |
| API-02 | Phase 2 | Complete |
| API-03 | Phase 2 | Complete |
| API-04 | Phase 2 | Complete |
| API-05 | Phase 2 | Complete |
| API-06 | Phase 3 | Complete |
| API-07 | Phase 3 | Complete |
| API-08 | Phase 3 | Complete |
| API-09 | Phase 4 | Pending |
| API-10 | Phase 4 | Pending |
| API-11 | Phase 2 | Complete |
| API-12 | Phase 2 | Complete |
| API-13 | Phase 4 | Pending |
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 1 | Complete |
| INFRA-04 | Phase 1 | Complete |
| INFRA-05 | Phase 1 | Complete |
| INFRA-06 | Phase 1 | Complete |
| INFRA-07 | Phase 1 | Complete |
| DSGN-01 | Phase 2 | Complete |
| DSGN-02 | Phase 2 | Complete |
| DSGN-03 | Phase 2 | Complete |
| DSGN-04 | Phase 2 | Complete |
| DSGN-05 | Phase 2 | Complete |
| DSGN-06 | Phase 2 | Complete |

**Coverage:**
- v1 requirements: 66 total
- Mapped to phases: 66
- Unmapped: 0 ✓

---

## v2 Requirements

### International Aid Ingestion

- [ ] **INTL-01**: System downloads and parses IATI Activity Files (XML/CSV) from Global Affairs Canada via open.canada.ca
- [ ] **INTL-02**: Each aid record stores: project name, recipient country, amount, funding department, authorization, start/end dates, and IATI identifier
- [ ] **INTL-03**: Aid recipient organizations are entity-matched against existing domestic entities using the same normalization + fuzzy + AI pipeline
- [ ] **INTL-04**: Entity profiles show international aid alongside domestic data (donations, contracts, grants, lobbying)
- [ ] **INTL-05**: Cross-dataset patterns surface: "Company X received overseas aid AND donated to political parties AND has registered lobbyists"

### Debt vs Spending Dashboard

- [ ] **DEBT-01**: Dashboard shows current national debt sourced from Statistics Canada / Dept of Finance Fiscal Monitor
- [ ] **DEBT-02**: Timeline visualization compares annual overseas aid spending against national debt growth, with federal election year markers
- [ ] **DEBT-03**: Department-level breakdown shows which departments authorize the most international spending
- [ ] **DEBT-04**: All figures link to original government data sources (Statistics Canada, Global Affairs, Dept of Finance)

## v2 Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INTL-01 | Phase 5 | Not started |
| INTL-02 | Phase 5 | Not started |
| INTL-03 | Phase 5 | Not started |
| INTL-04 | Phase 5 | Not started |
| INTL-05 | Phase 5 | Not started |
| DEBT-01 | Phase 6 | Not started |
| DEBT-02 | Phase 6 | Not started |
| DEBT-03 | Phase 6 | Not started |
| DEBT-04 | Phase 6 | Not started |

---
*Requirements defined: 2026-03-31*
*Last updated: 2026-04-04 — added v2 milestone (international aid + debt tracking)*
