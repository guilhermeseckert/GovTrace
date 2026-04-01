# GovTrace

## What This Is

GovTrace (govtrace.ca) is an open-source civic tech platform that connects Canadian federal government political donations, lobbying activity, government contracts, and grants into a single searchable interface. Type a name — politician, company, person — and instantly see all their connections across public government datasets. Canada's answer to OpenSecrets.

## Core Value

Anyone can search a name and instantly trace the flow of money and influence across all public government datasets — donations, contracts, lobbying, grants — with clarity a 9-year-old could follow.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Download and parse all 5 federal data sources (Elections Canada donations, federal contracts, grants, lobbyist registrations, lobbyist communications)
- [ ] Normalize entity names across datasets (strip suffixes, fuzzy match, AI verification)
- [ ] Build unified entity graph linking people, companies, politicians, and departments
- [ ] Full-text search across all entities with autocomplete
- [ ] Entity profile pages showing donations, contracts, lobbying, and grants with sortable tables
- [ ] Plain-language AI-generated summaries that make data accessible to non-experts
- [ ] Relationship network graph (D3.js force-directed) showing entity connections
- [ ] Money flow Sankey diagram showing donation → party → contract flows
- [ ] Activity timeline showing chronological events across all datasets
- [ ] Network heatmap showing politician/company relationship density
- [ ] Spending by department visualization
- [ ] Donations trend chart with election date overlays
- [ ] AI match transparency badges showing confidence scores and reasoning
- [ ] "Flag an error" community correction system
- [ ] Source links back to original government data on every record
- [ ] Weekly newsletter ("The GovTrace Weekly") with AI-generated digest of new data
- [ ] Newsletter subscriber management with email confirmation
- [ ] Professional civic design with dark mode, mobile responsive, bilingual-ready (EN/FR structure)

### Out of Scope

- Real-time chat or social features — not a social platform
- Video content — storage/bandwidth costs, not core to mission
- OAuth login for end users — public data, no user accounts needed for v1
- Native mobile app — web-first, responsive design sufficient
- Editorializing or implying wrongdoing — present connections, let users decide
- French translations for v1 — structure for i18n but English-only initially

## Context

- All data is public, published under the Open Government Licence – Canada
- Elections Canada donations CSV: weekly updates, 2004–present
- Federal contracts CSV: quarterly updates via open.canada.ca
- Grants CSV: quarterly updates via open.canada.ca
- Lobbyist registrations and communications: weekly updates via lobbycanada.gc.ca
- Entity matching is the core technical challenge — same entity appears differently across datasets (e.g., "CGI Information Systems" vs "CGI Inc." vs "CGI Group Inc.")
- Matching pipeline: deterministic normalization → pg_trgm fuzzy matching → Claude API verification for medium-confidence matches → community flagging
- The "aha moment" is searching a name and seeing the full picture instantly
- Plain-language summaries are the most important UX feature — data must be accessible to everyone, not just policy wonks
- Disclaimer on every connection: "Connections shown do not imply wrongdoing"

## Constraints

- **Tech stack**: TanStack Start (latest RC), shadcn/ui, Tailwind CSS, D3.js, PostgreSQL 16, Drizzle ORM, Claude API, pnpm workspaces monorepo, TypeScript strict mode
- **Infrastructure**: Docker containers deployed via Coolify on Hetzner (https://coolify.lab.guilhermeseckert.dev/)
- **Database**: PostgreSQL 16 self-hosted on Hetzner, pg_trgm extension required
- **AI**: Claude API via @anthropic-ai/sdk for entity matching verification and summary generation
- **Email**: Resend (resend.com) for newsletter delivery
- **License**: MIT open source
- **Data ethics**: Never editorialize, always link to source, always show AI confidence, always caveat connections
- **Package manager**: pnpm
- **Monorepo structure**: packages/ingestion (data pipeline) + packages/web (TanStack Start app)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Data-first approach | Nothing works without data; ingestion pipeline must be solid before building UI | — Pending |
| Docker/Coolify deployment | User has existing Hetzner server with Coolify; simplifies ops | — Pending |
| TanStack Start over Next.js | User choice; full-stack React with SSR, file-based routing, server functions | — Pending |
| pg_trgm for fuzzy matching | PostgreSQL-native, no external search service needed | — Pending |
| Claude API for entity verification | Medium-confidence matches (0.6–0.85) get AI reasoning; transparent to users | — Pending |
| Pre-computed entity_connections table | Fast graph queries without joining all data tables at query time | — Pending |
| Plain-language summaries as hero feature | Accessibility is the core differentiator; data is useless if people can't understand it | — Pending |

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
*Last updated: 2026-03-31 after initialization*
