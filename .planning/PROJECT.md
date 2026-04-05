# GovTrace

## What This Is

GovTrace (govtrace.ca) is an open-source civic tech platform that connects Canadian federal government political donations, lobbying activity, government contracts, and grants into a single searchable interface. Type a name — politician, company, person — and instantly see all their connections across public government datasets, told as plain English stories. Canada's answer to OpenSecrets.

## Core Value

Anyone can search a name and instantly trace the flow of money and influence across all public government datasets — donations, contracts, lobbying, grants — with clarity a 9-year-old could follow.

## Requirements

### Validated

- ✓ Download and parse all 5 federal data sources (Elections Canada donations, federal contracts, grants, lobbyist registrations, lobbyist communications) — v1.0
- ✓ Normalize entity names across datasets (strip suffixes, fuzzy match, AI verification) — v1.0
- ✓ Build unified entity graph linking people, companies, politicians, and departments — v1.0
- ✓ Full-text search across all entities with autocomplete — v1.0
- ✓ Entity profile pages showing donations, contracts, lobbying, and grants with sortable tables — v1.0
- ✓ Plain-language AI-generated summaries that make data accessible to non-experts — v1.0
- ✓ Relationship network graph (D3.js force-directed) showing entity connections — v1.0
- ✓ Money flow Sankey diagram showing donation → party → contract flows — v1.0
- ✓ Activity timeline showing chronological events across all datasets — v1.0
- ✓ AI match transparency badges showing confidence scores and reasoning — v1.0
- ✓ "Flag an error" community correction system — v1.0
- ✓ Source links back to original government data on every record — v1.0
- ✓ Professional civic design with dark mode, mobile responsive, bilingual-ready (EN/FR structure) — v1.0
- ✓ How It Works explainer page with data source transparency and AI disclosure — v1.0
- ✓ Story-first entity profiles with plain English connection cards and pattern callouts — v1.0

### Active

- [ ] Weekly newsletter ("The GovTrace Weekly") with AI-generated digest of new data (deferred from v1.0)
- [ ] Newsletter subscriber management with email confirmation (deferred from v1.0)
- [ ] Network heatmap showing politician/company relationship density (deferred from v1.0)
- [ ] Spending by department visualization (deferred from v1.0)
- [ ] Donations trend chart with election date overlays (deferred from v1.0)

### Out of Scope

- Real-time chat or social features — not a social platform
- Video content — storage/bandwidth costs, not core to mission
- OAuth login for end users — public data, no user accounts needed for v1
- Native mobile app — web-first, responsive design sufficient
- Editorializing or implying wrongdoing — present connections, let users decide
- French translations for v1 — structure for i18n but English-only initially

## Current Milestone: v2.0 International Money Tracking

**Goal:** Expand GovTrace beyond domestic data to track international aid spending, compare it against national debt, and cross-reference parliamentary voting records with donors and lobbyists.

**Target features:**
- International aid ingestion (IATI Activity Files from Global Affairs Canada)
- Debt vs spending dashboard (national debt tracker alongside overseas aid)
- Parliamentary voting records (how MPs voted, cross-referenced with donors/lobbyists)

## Context

Shipped v1.0 with 46,755 lines of TypeScript across 248 files in 5 days (2026-03-31 → 2026-04-04).

- **Monorepo**: pnpm workspaces — `apps/web` (TanStack Start), `packages/ingestion` (data pipeline), `packages/db` (shared Drizzle schema)
- **Database**: PostgreSQL 16 with pg_trgm, 12 tables, pre-computed entity_connections graph
- **Data**: 6M+ donations, 500K contracts, 1.2M grants, 169K lobby registrations, 359K lobby communications
- **Search**: pg_trgm GIN indexes, ~60-80ms autocomplete
- **AI**: Claude Haiku for entity matching and summary generation with full provenance
- **Deployment**: Docker on Hetzner via Coolify, ingestion running as separate container
- **Ingestion**: Currently running first production sync on server (entity matching in progress)

## Constraints

- **Tech stack**: TanStack Start (latest RC), shadcn/ui, Tailwind CSS, D3.js, PostgreSQL 16, Drizzle ORM, Claude API, pnpm workspaces monorepo, TypeScript strict mode
- **Infrastructure**: Docker containers deployed via Coolify on Hetzner (https://coolify.lab.guilhermeseckert.dev/)
- **Database**: PostgreSQL 16 self-hosted on Hetzner, pg_trgm extension required
- **AI**: Claude API via @anthropic-ai/sdk for entity matching verification and summary generation
- **Email**: Resend (resend.com) for newsletter delivery
- **License**: MIT open source
- **Data ethics**: Never editorialize, always link to source, always show AI confidence, always caveat connections
- **Package manager**: pnpm
- **Monorepo structure**: packages/ingestion (data pipeline) + apps/web (TanStack Start app)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Data-first approach | Nothing works without data; ingestion pipeline must be solid before building UI | ✓ Good — all 5 sources ingested before any UI work |
| Docker/Coolify deployment | User has existing Hetzner server with Coolify; simplifies ops | ✓ Good — deployed and running |
| TanStack Start over Next.js | User choice; full-stack React with SSR, file-based routing, server functions | ✓ Good — server functions eliminated need for API layer |
| pg_trgm for fuzzy matching | PostgreSQL-native, no external search service needed | ✓ Good — 60-80ms search, no extra infrastructure |
| Claude API for entity verification | Medium-confidence matches (0.6–0.85) get AI reasoning; transparent to users | ✓ Good — circuit breaker prevents cost runaway |
| Pre-computed entity_connections table | Fast graph queries without joining all data tables at query time | ✓ Good — enables instant graph/sankey rendering |
| Plain-language summaries as hero feature | Accessibility is the core differentiator; data is useless if people can't understand it | ✓ Good — story-first profile is the standout UX |
| Newsletter deferred to backlog | Core product loop complete without it; user wants to ship v1.0 first | — Pending review |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-04 after v2.0 milestone start*
