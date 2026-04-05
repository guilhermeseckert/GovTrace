# Roadmap: GovTrace

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4.2 (shipped 2026-04-04)
- 📋 **v2.0 International Money Tracking** — Phases 5-7 (planned)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4.2) — SHIPPED 2026-04-04</summary>

- [x] Phase 1: Data Foundation (11/11 plans) — completed 2026-04-01
- [x] Phase 2: Search and Entity Profiles (7/7 plans) — completed 2026-04-02
- [x] Phase 3: Visualizations (4/4 plans) — completed 2026-04-04
- [x] Phase 4.1: How It Works (2/2 plans) — completed 2026-04-03
- [x] Phase 4.2: Entity Profile Storytelling (3/3 plans) — completed 2026-04-04

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

### 📋 v2.0 International Money Tracking (Planned)

- [ ] **Phase 5: International Aid Ingestion** - Ingest IATI Activity Files from Global Affairs Canada (overseas aid projects, recipient countries, amounts, funding departments), entity-match aid recipients against existing domestic entities
- [ ] **Phase 6: Debt vs Spending Dashboard** - Real-time national debt tracker alongside overseas aid spending, timeline visualization comparing aid commitments against debt growth, department-level spending breakdown
- [ ] **Phase 7: Parliamentary Voting Records** - Ingest House of Commons voting records and bill positions, show how each politician voted on every bill, cross-reference voting patterns with their donors and lobbyists

## Phase Details

### Phase 5: International Aid Ingestion
**Goal**: All international aid spending data from Global Affairs Canada is ingested, entity-matched, and cross-referenced with domestic datasets — revealing which companies/organizations receive both domestic contracts and overseas aid
**Depends on**: v1.0 complete
**Requirements**: INTL-01, INTL-02, INTL-03, INTL-04, INTL-05
**Success Criteria** (what must be TRUE):
  1. IATI Activity Files (XML/CSV) from open.canada.ca are parsed and stored with project name, recipient country, amount, funding department, and authorization
  2. Aid recipient organizations are entity-matched against existing domestic entities (companies, lobbyists, contractors)
  3. Entity profile pages show international aid alongside domestic data ("This company received $X in overseas aid contracts AND donated $Y to political parties")
  4. Search results include international aid data in entity counts
  5. The "How it Works" page is updated to explain the 6th dataset
**Plans**: 2 plans

Plans:
- [x] 05-01-PLAN.md — Ingestion pipeline: schema, XML parser, downloader, upsert, runner, entity matching, connections
- [x] 05-02-PLAN.md — Web UI: search counts, entity profile aid tab, How It Works 6th dataset

### Phase 6: Debt vs Spending Dashboard
**Goal**: Citizens can see at a glance how much Canada sends overseas relative to the national debt, with timeline context showing trends over election cycles
**Depends on**: Phase 5
**Requirements**: DEBT-01, DEBT-02, DEBT-03, DEBT-04
**Success Criteria** (what must be TRUE):
  1. Dashboard page shows current national debt (from Fiscal Monitor / Statistics Canada) alongside total overseas aid spending
  2. Timeline visualization compares annual aid commitments against debt growth, with federal election year markers
  3. Department-level breakdown shows which departments authorize the most international spending
  4. All numbers link to source data (Statistics Canada, Global Affairs, Dept of Finance)
**Plans**: 2 plans
**UI hint**: yes

Plans:
- [x] 06-01-PLAN.md — Data layer: fiscal_snapshots schema, Stats Canada ingestion pipeline, server functions, election constants
- [ ] 06-02-PLAN.md — Dashboard page: hero stats, D3 debt-vs-aid chart with election markers, department breakdown

### Phase 7: Parliamentary Voting Records
**Goal**: Search a politician and instantly see how they voted on every bill — then cross-reference those votes with who donated to them and who lobbied them on that topic
**Depends on**: Phase 5
**Requirements**: PARL-01, PARL-02, PARL-03, PARL-04, PARL-05
**Success Criteria** (what must be TRUE):
  1. Voting records from House of Commons Open Data (XML/JSON) are ingested for all parliaments since 2001
  2. Politician entity profiles show a "Votes" tab listing every bill they voted on (Yea/Nay/Absent) with bill title and date
  3. Bills are searchable — search "Bill C-69" and see all MPs who voted, grouped by party and position
  4. AI summary for politicians includes voting pattern insights: "Voted in favour of 3 bills related to energy — received $12K from oil & gas donors"
  5. Every bill has an AI-generated plain-language summary explaining what it actually does — no legalese, grandpa-readable
**Plans**: 2 plans

Plans:
- [ ] 07-01-PLAN.md — Ingestion pipeline: schema, parsers, downloaders, upsert, runner, MP entity matching, bill summaries, scheduler
- [ ] 07-02-PLAN.md — Web UI: Votes tab, bill pages, search integration, AI summary voting insights, How It Works 7th dataset

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Data Foundation | v1.0 | 11/11 | Complete | 2026-04-01 |
| 2. Search and Entity Profiles | v1.0 | 7/7 | Complete | 2026-04-02 |
| 3. Visualizations | v1.0 | 4/4 | Complete | 2026-04-04 |
| 4.1 How It Works | v1.0 | 2/2 | Complete | 2026-04-03 |
| 4.2 Entity Profile Storytelling | v1.0 | 3/3 | Complete | 2026-04-04 |
| 5. International Aid Ingestion | v2.0 | 1/2 | In Progress|  |
| 6. Debt vs Spending Dashboard | v2.0 | 1/2 | In Progress|  |
| 7. Parliamentary Voting Records | v2.0 | 0/2 | Not started | - |

---

## Backlog

Ideas captured for future planning. Not sequenced, not prioritized. Promote with `/gsd:review-backlog` when ready.

### Phase 999.2: Newsletter and Secondary Visualizations (BACKLOG)
**Goal**: Users can subscribe to a weekly digest of new government connections, and power users can explore department-level spending and donation trend analytics
**Requirements**: NEWS-01, NEWS-02, NEWS-03, NEWS-04, NEWS-05, NEWS-06, API-13, VIZ-06, VIZ-07, VIZ-08
**Plans**: 0 plans

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)

### Phase 999.1: Ingestion Hash-Check Optimization (BACKLOG)
**Goal**: Skip re-parsing CSV files when the source file hash matches the previous `ingestion_runs.source_file_hash` — the table already tracks hashes, just needs a check before parsing. Saves ~1 hour of weekly CPU when government data hasn't changed.
**Requirements**: TBD
**Plans**: 0 plans

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)
