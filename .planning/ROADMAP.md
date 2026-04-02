# Roadmap: GovTrace

## Overview

GovTrace is built data-first: nothing can be searched, displayed, or visualized until five government data sources are ingested, normalized, and entity-matched. From that foundation, the search and entity profile core delivers the primary product loop — search a name, see the full picture. Visualizations then unlock the "aha moment" of seeing money flow visually. The newsletter adds distribution and return-visitor mechanics once the core is validated. The build order is strict and non-negotiable: each phase is a hard prerequisite for the next.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Data Foundation** - Ingestion pipeline, entity matching, and pre-computed graph table for all 5 federal data sources (completed 2026-04-01)
- [ ] **Phase 2: Search and Entity Profiles** - Full product loop: search → autocomplete → entity profile with tabbed data, AI summaries, and community flagging
- [ ] **Phase 3: Visualizations** - Force-directed relationship graph, Sankey money-flow diagram, activity timeline, and supporting API endpoints
- [ ] **Phase 4: Newsletter and Secondary Visualizations** - GovTrace Weekly AI newsletter, subscriber management, network heatmap, spending treemap, and donations trend chart

## Phase Details

### Phase 1: Data Foundation
**Goal**: All five federal government data sources are ingested, normalized, entity-matched, and pre-computed into a relationship graph — the database is ready for every user-facing feature
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07, DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, DATA-08, MATCH-01, MATCH-02, MATCH-03, MATCH-04, MATCH-05, MATCH-06
**Success Criteria** (what must be TRUE):
  1. Running the ingestion pipeline twice on the same source files produces identical record counts (idempotency verified)
  2. "Montréal" and "Québec" appear correctly in the database after ingesting pre-2015 ISO-8859-1 files
  3. Every entity match record has a confidence score, match method, and (for AI-routed matches) Claude reasoning stored in entity_matches_log
  4. The entity_connections table is populated with aggregated relationship data after a full ingestion run completes
  5. Local development environment starts with a single `docker compose up` and the web app can query all 5 source tables
**Plans**: 11 plans

Plans:
- [x] 01-01-PLAN.md — Monorepo scaffold, shared DB schema (10 tables), Docker Compose with pg_trgm
- [x] 01-02-PLAN.md — Docker production config: web Dockerfile, TanStack Start server wrapper, Coolify deployment security
- [x] 01-03-PLAN.md — Elections Canada ingestion: encoding detection, multi-era parser, idempotent upsert
- [x] 01-04-PLAN.md — Federal contracts and grants ingestion pipelines
- [x] 01-05-PLAN.md — Lobbyist registrations and communications ingestion pipelines
- [x] 01-06-PLAN.md — Entity normalizer + deterministic + fuzzy (pg_trgm) matching pipeline
- [x] 01-07-PLAN.md — Claude AI verification stage: Batch API with circuit breaker, full match provenance
- [x] 01-08-PLAN.md — entity_connections builder, pg-boss scheduler, Phase 1 end-to-end verification
- [x] 01-09-PLAN.md — Gap closure: fix broken onConflictDoUpdate conflict target in deterministic.ts
- [x] 01-10-PLAN.md — Gap closure: move packages/web → apps/web, add Turborepo, update all path references
- [x] 01-11-PLAN.md — Gap closure: TanStack Start web scaffold (vite.config.ts, routes, client.tsx), fix vinxi build scripts, .env.example

### Phase 2: Search and Entity Profiles
**Goal**: Users can search any name and immediately see their complete financial and lobbying picture across all government datasets
**Depends on**: Phase 1
**Requirements**: SRCH-01, SRCH-02, SRCH-03, SRCH-04, SRCH-05, PROF-01, PROF-02, PROF-03, PROF-04, PROF-05, PROF-06, AI-01, AI-02, AI-03, AI-04, AI-05, COMM-01, COMM-02, COMM-03, API-01, API-02, API-03, API-04, API-05, API-11, API-12, DSGN-01, DSGN-02, DSGN-03, DSGN-04, DSGN-05, DSGN-06
**Success Criteria** (what must be TRUE):
  1. User types a name into the search bar and sees autocomplete suggestions appear within 150ms
  2. User lands on an entity profile page and the first thing visible is a plain-language AI summary written in simple words with rounded numbers
  3. User can click through tabbed sections (Donations, Contracts, Grants, Lobbying, Connections) and sort/filter/paginate each table
  4. Every individual record shows a direct link to the original government data source
  5. User can click "Flag an error" on any entity match and submit a correction without creating an account
**Plans**: 7 plans

Plans:
- [x] 02-01-PLAN.md — shadcn init + Tailwind v4 design system, i18n file, cookie dark mode, root layout
- [x] 02-02-PLAN.md — Search and autocomplete server functions, stats server function, /api/search and /api/stats routes
- [ ] 02-03-PLAN.md — Landing page (hero search + stat chips) and search results page with filters
- [x] 02-04-PLAN.md — Entity profile + dataset server functions, AI summary generation, flag submission, /api/entity/:id/flag route
- [x] 02-05-PLAN.md — Entity profile route (/entity/:id), EntityHeader, AISummary, ConfidenceBadge, ProfileTabs
- [ ] 02-06-PLAN.md — Five data tables (Donations, Contracts, Grants, Lobbying, Connections) wired into ProfileTabs
- [ ] 02-07-PLAN.md — FlagModal (shadcn Dialog), AI summary explanation dialog, wire into entity profile

### Phase 3: Visualizations
**Goal**: Users can see entity relationships and money flows as interactive visual graphs — the patterns hidden in tabular data become immediately apparent
**Depends on**: Phase 2
**Requirements**: VIZ-01, VIZ-02, VIZ-03, VIZ-04, VIZ-05, VIZ-06, VIZ-07, VIZ-08, API-06, API-07, API-08, API-09, API-10
**Success Criteria** (what must be TRUE):
  1. User can see a force-directed network graph on an entity profile, click any node to expand its connections, and zoom/pan the graph
  2. User can see a Sankey diagram showing the flow from donors through parties to contracts and grants
  3. User can see a chronological timeline of all events (donations, contracts, lobbying) for an entity, color-coded by dataset source
  4. Graph filtering by relationship type and date range is available and updates the visualization without a page reload
**Plans**: TBD
**UI hint**: yes

### Phase 4: Newsletter and Secondary Visualizations
**Goal**: Users can subscribe to a weekly digest of new government connections, and power users can explore department-level spending and donation trend analytics
**Depends on**: Phase 3
**Requirements**: NEWS-01, NEWS-02, NEWS-03, NEWS-04, NEWS-05, NEWS-06, API-13, VIZ-06, VIZ-07, VIZ-08
**Success Criteria** (what must be TRUE):
  1. User can enter their email in the footer or landing page and receive a confirmation email before being subscribed
  2. User receives a weekly newsletter with AI-generated summaries of notable new government connections
  3. User can view a heatmap showing which departments have the densest contractor relationships
  4. User can view a spending treemap broken down by government department, and a donations trend line with federal election dates marked
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Foundation | 11/11 | Complete   | 2026-04-01 |
| 2. Search and Entity Profiles | 0/7 | Not started | - |
| 3. Visualizations | 0/TBD | Not started | - |
| 4. Newsletter and Secondary Visualizations | 0/TBD | Not started | - |
