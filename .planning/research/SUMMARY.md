# Project Research Summary

**Project:** GovTrace — Canadian Government Transparency Data Platform
**Domain:** Civic tech / government transparency (multi-source entity graph)
**Researched:** 2026-03-31
**Confidence:** HIGH

## Executive Summary

GovTrace occupies a genuine gap in the Canadian civic tech landscape: no existing platform unifies Elections Canada donation records, federal contracts, grants, lobbyist registrations, and lobbyist communications into a single searchable entity graph. The product pattern is well-understood — OpenSecrets, FollowTheMoney, and LittleSis have established the playbook — but GovTrace layers in differentiators that those platforms lack: AI-assisted entity resolution with transparent confidence scoring, D3.js money-flow visualizations, and cross-dataset relationship graphs. The chosen stack (TanStack Start, PostgreSQL, Drizzle ORM, Claude API, D3.js) is validated for this use case, with one significant deployment gotcha requiring a custom server wrapper for Coolify.

The single most important architectural decision is to treat the data ingestion pipeline and entity normalization as Phase 1 prerequisites for everything else. Every user-facing feature — search, entity profiles, visualizations, AI summaries — depends on correctly resolved entities. Entity matching quality is the product quality. The three-stage matching pipeline (deterministic → pg_trgm fuzzy → Claude API verification) is the right approach, but it carries real risks: false-positive merges that publicly link the wrong people can cause legal exposure and reputational harm. These risks must be designed against from day one, not treated as post-launch polish.

The project should be built data-first, then search and profiles, then visualizations, then newsletters and community features. Rushing to build UI before the ingestion pipeline is validated is the most common mistake civic tech projects make and the one most likely to produce a platform that looks done but silently contains corrupted data. Given the weekly/quarterly government data cadence, real-time features add no value; the architecture appropriately leans on pre-computed tables and scheduled jobs. The product's core value proposition — "search any name, see the full financial picture" — can be validated with a focused MVP before adding the newsletter, heatmap, and secondary visualizations.

## Key Findings

### Recommended Stack

The project's chosen stack is sound and validated by research. TanStack Start v1 (package: `@tanstack/react-start`) provides SSR, file-based routing, and server functions that replace a separate API layer entirely, with full type safety end-to-end through Drizzle ORM to the database. The critical package rename gotcha (`@tanstack/start` is deprecated; only `@tanstack/react-start` is maintained) must be observed. PostgreSQL 16 with `pg_trgm` is sufficient for entity search at the scale of Canadian federal data — no external search engine is needed. The pnpm monorepo with a shared `packages/db` schema package is the correct structure to avoid Drizzle multi-instance bugs that occur when both `packages/ingestion` and `packages/web` define separate schema instances.

For deployment, TanStack Start's build output requires a custom Express or Bun server wrapper before Coolify can run it — this is a known issue (GitHub #5476) with a documented workaround. This must be addressed during infrastructure setup, not discovered at deploy time.

**Core technologies:**
- `@tanstack/react-start` 1.167.x: Full-stack framework with SSR + server functions — eliminates separate API server
- `@tanstack/react-router` (bundled): Type-safe routing — tightly coupled to Start; always install matching versions
- PostgreSQL 16: Primary data store — JSONB for semi-structured data, `pg_trgm` for fuzzy search, proven at analytic scale
- `drizzle-orm` 0.45.x: ORM — TypeScript-native schema, SQL-close query API, no N+1 surprises, designed for pnpm monorepos
- `@anthropic-ai/sdk` 0.80.x: Claude API — entity matching verification and AI summaries; use Batch API for bulk matching
- `resend` 6.10.x: Email delivery — best TypeScript SDK; native React Email integration
- `d3` 7.9.x + `d3-sankey` 0.12.x: Bespoke visualizations — no viable alternative for force-directed graphs and Sankey diagrams
- `pg-boss` 9.x: Background job queue — PostgreSQL-backed, no Redis needed; ideal for weekly ingestion scheduling
- `papaparse` 5.x: CSV parsing — streaming, handles encoding issues and malformed rows
- `tailwindcss` 4.x + shadcn/ui CLI v4: Styling — full v4 compatibility confirmed March 2026; CSS-first config

**Critical version pins (via pnpm Catalogs):**
- `drizzle-orm` and `drizzle-kit` must be version-compatible (0.45.x / 0.30.x)
- `@tanstack/react-start` and `@tanstack/react-router` must always match
- `tailwindcss` v4 requires `tw-animate-css`, not `tailwindcss-animate` (deprecated)

### Expected Features

GovTrace's MVP is larger than a typical product because the "aha moment" — see all a name's connections in one view — requires the full data pipeline and at minimum the relationship graph and Sankey diagram to be present. The research confirms no existing Canadian platform does this, which means GovTrace has no direct domestic competitor to undercut, but also means there is no shortcut: the data unification is the product.

**Must have (table stakes) — ship at launch:**
- Global entity search with autocomplete (<150ms perceived latency)
- Entity profile pages with tabbed data tables (donations, contracts, lobbying, grants)
- Source links on every record — non-negotiable for credibility
- Data provenance and last-updated timestamps per dataset
- "Connections do not imply wrongdoing" disclaimer on every connection view
- Mobile-responsive layout (50%+ of users arrive via mobile shares/news links)
- Clear data source explanations (about/sources page + inline tooltips)
- AI match transparency badges with confidence scores and reasoning

**Should have (differentiators) — the product's competitive edge:**
- Cross-dataset entity unification via three-stage matching pipeline
- AI plain-language summaries per entity profile (clearly labelled as AI-generated)
- D3.js money-flow Sankey diagram (the visual "aha moment")
- D3.js force-directed relationship network graph
- Activity timeline across all datasets
- Community error-flagging system (data quality feedback; must launch with v1)
- Dark mode (civic tech standard expectation in 2026)

**Defer to v1.x (post-validation):**
- Weekly AI-generated newsletter ("GovTrace Weekly") via Resend + Claude
- Network density heatmap
- Spending-by-department treemap
- Donations trend line with election overlays

**Defer to v2+ (future consideration):**
- French content translations (i18n structure must be in place at v1; content English-only)
- Public API for bulk data access
- Embeddable journalist widgets
- Provincial data integration (multiplies ingestion complexity by 13x)

**Hard anti-features — never build:**
- User accounts / login for public browsing (PII liability, drops 60-80% of casual users)
- Predictive "risk score" features (algorithmic harm, correlation ≠ causation)
- Editorial framing ("investigate this entity") — legal risk, neutrality violation
- Real-time data streaming (government data updates weekly/quarterly; adds cost for zero UX benefit)

### Architecture Approach

The architecture is a pnpm monorepo with three packages: `packages/db` (shared Drizzle schema — no code, only table definitions), `packages/ingestion` (standalone Node.js pipeline with pg-boss scheduler), and `packages/web` (TanStack Start SSR app). The packages communicate only through PostgreSQL — the ingestion package owns all writes; the web package is read-only. This separation allows the ingestion pipeline to be developed, tested, and run independently of the web app.

The two most important architectural constraints are: (1) all database queries must live in `.server.ts` files accessed only through `createServerFn()` wrappers — never in client code — and (2) graph queries must be served from the pre-computed `entity_connections` table, never from runtime JOINs across the five source tables. The pre-computed connections table is an architectural prerequisite for acceptable query performance, not an optimization to add later.

**Major components:**
1. **Ingestion Pipeline** (`packages/ingestion`) — downloads, parses, normalizes, and matches entities from 5 government sources; runs as a separate Docker container; writes to shared PostgreSQL
2. **Shared Schema** (`packages/db`) — Drizzle table definitions shared by both ingestion and web; prevents schema drift across packages
3. **Entity Matcher** — three-stage pipeline: deterministic (exact match) → pg_trgm fuzzy (0.6–0.85 confidence band) → Claude Batch API verification; stores reasoning and confidence with every match
4. **`entity_connections` Table** — pre-computed relationship graph rebuilt after each ingestion run; powers all graph queries with O(1) indexed lookups
5. **TanStack Start Web App** (`packages/web`) — server functions as data access layer; SSR for entity profiles; TanStack Query for client-side autocomplete caching
6. **D3.js Visualization Layer** — client-only; receives pre-shaped nodes/edges arrays from server functions; never fetches data directly; force graph capped at 100-150 nodes
7. **AI Summary Cache** — generated by Claude on first entity profile view; stored in `ai_summaries` table; invalidated when source data changes via ingestion
8. **Community Flags System** — anonymous form submissions → `flags` table → manual review queue; triggers `entity_connections` rebuild when correction is confirmed

### Critical Pitfalls

1. **False-positive entity merges** — Publicly connecting the wrong people (same name, different individuals) is a defamation liability. Prevention: require corroborating evidence beyond name similarity; display AI reasoning publicly on every matched connection; community flagging is not optional. The "Flag an error" system must ship with v1, not be deferred.

2. **Non-idempotent ingestion pipeline** — Government sources publish full historical datasets, not deltas. A naive pipeline will silently double-count records on every run (a $500 donation becomes $1,000). Prevention: derive deterministic source keys from source fields (never auto-increment); use `INSERT ... ON CONFLICT DO UPDATE` everywhere; assert that running the pipeline twice on the same file produces identical counts.

3. **Elections Canada CSV schema changes across historical eras** — Files from 2004-2007 use different column names and field ordering than 2019+ files. A parser written for recent data silently fails on historical data, undermining the "follow money across decades" value proposition. Prevention: inspect files from 3+ eras before writing parsers; parse by header name, never column index position.

4. **Claude API cost runaway during historical backfill** — Initial ingestion of 20 years of Elections Canada data can generate millions of medium-confidence candidate pairs. At $3/million tokens, an unsupervised batch run costs hundreds of dollars and may hit rate limits mid-run. Prevention: always use Claude Batch API (50% cost reduction); implement circuit breaker requiring manual approval above 10,000 candidates; process one year first, measure actual cost, then extrapolate.

5. **Canadian government CSV encoding inconsistencies** — Pre-2015 files are often ISO-8859-1 or Windows-1252; newer files are UTF-8. Assuming UTF-8 produces garbled French characters ("MontrÃ©al"), which breaks entity matching specifically for Quebec-based entities — the most politically interesting cohort in the dataset. Prevention: detect encoding on every file using `chardet`; test that "Montréal" and "Québec" render correctly after ingestion.

6. **Pre-computed graph staleness after corrections** — When a community flag corrects a false entity merge, the `entity_connections` table continues serving the wrong data until the next scheduled ingestion run. Prevention: corrections must trigger an async rebuild of affected connections, not wait for the weekly ingestion cycle; add a `stale` flag to connections; never serve stale connections on profile pages.

7. **Docker port exposure bypassing Hetzner firewall** — Using `ports:` instead of `expose:` in Docker config puts PostgreSQL on a public IP. Docker bypasses UFW and Hetzner's firewall rules. Prevention: always use `expose:` for internal services; verify port 5432 is unreachable from outside the Docker network during infrastructure setup.

## Implications for Roadmap

All research converges on a clear build order: data foundation first, then search and profiles, then visualizations, then community and distribution features. The feature dependency tree is strict — nothing works without ingested, normalized data, and visualization performance depends on the pre-computed connections table being built as part of ingestion.

### Phase 1: Data Foundation and Ingestion Pipeline

**Rationale:** Every user-facing feature has a hard dependency on parsed, normalized, entity-matched data. This is not optional groundwork — it is the product core. The most important data quality decisions (idempotent upserts, encoding detection, schema versioning, entity matching thresholds) must be made correctly here because fixing them post-launch requires re-ingesting 20 years of data.

**Delivers:** A fully populated PostgreSQL database with raw records from all 5 federal sources, normalized entities, entity aliases with confidence scores and AI reasoning, and a populated `entity_connections` table. Ingestion pipeline runs idempotently on a weekly/quarterly schedule.

**Implements:**
- `packages/db` shared schema (donations, contracts, grants, lobby_registrations, lobby_communications, entities, entity_aliases, entity_connections, flags, ai_summaries)
- `packages/ingestion` downloaders and parsers for all 5 sources (with schema version detection and encoding detection)
- Entity normalization (suffix stripping, canonical forms, acronym expansion for lobbying data)
- Three-stage entity matcher (deterministic → pg_trgm → Claude Batch API)
- `entity_connections` builder (post-matching step)
- pg-boss scheduler (weekly/quarterly per source cadence)
- Ingestion audit reporting (record counts by year; encoding log; match confidence distribution)

**Avoids:** Non-idempotent ingestion (Pitfall 2), Elections Canada schema version failures (Pitfall 3), Claude API cost runaway (Pitfall 4), CSV encoding corruption (Pitfall 5), false-positive merges without provenance (Pitfall 1).

**Research flag:** NEEDS PHASE RESEARCH — Historical Elections Canada CSV schema archaeology (2004–2026), lobbycanada.gc.ca bulk export location (open.canada.ca dataset d70ef2117), and Claude Batch API throughput limits need verification before implementation.

---

### Phase 2: Search and Entity Profile Core

**Rationale:** Once data exists and entities are resolved, the primary product loop — "search a name, see their full picture" — can be built. Search and entity profiles are the entry point for all other features; they must be solid before adding visualizations.

**Delivers:** A working civic data web application with global entity search (autocomplete, fuzzy suggestions on zero results), entity profile pages with tabbed data tables, source links on every record, AI plain-language summaries, AI match transparency badges, and "no wrongdoing implied" disclaimer. Mobile-responsive. Dark mode. Data provenance timestamps.

**Implements:**
- TanStack Start web app scaffolding with shadcn/ui + Tailwind v4
- pg_trgm GIN index on `normalized_name`; search server function with <150ms target
- Entity profile route (`/entity/[id]`) with tabbed layout: donations, contracts, lobbying, grants
- AI summary server function (Claude API, cached in `ai_summaries` table, lazy-generated)
- Match transparency badge component (confidence score + reasoning, with explanation tooltip)
- Persistent disclaimer component (every connection view, every profile page)
- Community error-flagging form (anonymous; persists to `flags` table; admin review queue)
- Coolify deployment setup with custom server wrapper (TanStack Start Coolify gotcha)

**Avoids:** Eager DB connection anti-pattern (lazy `getDb()` pattern); editorializing through data presentation (neutral labels, source-attributed AI summary language); raw government field names exposed without plain English labels (UX pitfall).

**Research flag:** STANDARD PATTERNS — TanStack Start server functions, shadcn/ui component setup, and Drizzle query patterns are all well-documented. Coolify deployment workaround is documented in GitHub issue #5476 and the `coolify-examples` repo.

---

### Phase 3: Visualizations

**Rationale:** The D3.js visualizations are the product's "aha moment" — they reveal patterns that tabular data cannot. However, they depend on the `entity_connections` pre-computed table (Phase 1) and entity profile infrastructure (Phase 2). They are also the most technically complex deliverables and should be scoped tightly.

**Delivers:** Force-directed relationship network graph (1-hop by default, capped at 100-150 nodes), Sankey money-flow diagram (donation → party → contract), activity timeline across all datasets, and the node-count fallback for densely connected entities.

**Implements:**
- `ForceGraph.tsx` — D3 force simulation; receives nodes/edges from server function; 1-hop default; expand control; hard cap with table-view fallback
- `SankeyDiagram.tsx` — D3 Sankey layout + `d3-sankey`; entity-scoped; pre-computed edge weights from `entity_connections`
- `Timeline.tsx` — chronological union of events across all 5 datasets; color-coded by source type
- Graph API server function (entity_connections lookup → D3-ready nodes/links shape)
- Timeline API server function (UNION across raw tables, filtered by entity_id, ordered by date)

**Avoids:** D3 force simulation with full dataset (Pitfall — O(n²) per tick; cap at 150 nodes); D3 DOM manipulation inside React (use "D3 for math, React for rendering" pattern); graph queries at runtime via cross-table JOINs (use `entity_connections` exclusively).

**Research flag:** NEEDS PHASE RESEARCH — D3 force-directed graph performance profiling at the node counts expected for well-connected Canadian political entities (federal ministers, major contractors like CGI Group) needs validation. Canvas renderer fallback threshold requires benchmarking.

---

### Phase 4: Newsletter and Distribution

**Rationale:** The newsletter deferred from v1 MVP until core search + entity profiles + visualizations are confirmed working and returning users. Triggers when: confirmed return visitor behavior in analytics, Resend and Claude API already wired up from earlier phases.

**Delivers:** "GovTrace Weekly" AI-generated newsletter digest (top entities by recent activity, notable new connections, data freshness summary); subscriber management (opt-in with confirmed tokens stored in DB); newsletter subscribe/unsubscribe routes.

**Implements:**
- React Email templates for weekly digest
- Claude API digest generation (summarize notable new entity_connections from the past week)
- Resend bulk send integration
- Subscriber table with opt-in confirmation tokens (Resend does not manage opt-in state)
- Newsletter route (`/newsletter`) with subscribe form
- pg-boss job for weekly newsletter generation and dispatch

**Avoids:** Setting real-time update expectations (newsletter reinforces weekly cadence); unconfirmed opt-in sending (CAN-SPAM / CASL compliance requires explicit confirmation token tracking).

**Research flag:** STANDARD PATTERNS — Resend + React Email integration is well-documented. CASL opt-in requirements are straightforward.

---

### Phase 5: Secondary Visualizations and Analytics

**Rationale:** These features add analytical depth once the core product is validated. They serve power users and journalists rather than casual visitors.

**Delivers:** Network density heatmap (departments × companies, color intensity = connection count), spending-by-department treemap, donations trend line with federal election date overlays.

**Implements:**
- `Heatmap.tsx` — D3 heatmap; aggregated from entity_connections grouped by department and entity type
- Spending treemap — D3 or shadcn chart; computed from contracts + grants tables
- Donations trend chart — D3 line chart; election dates hard-coded from Elections Canada calendar

**Avoids:** Building secondary visualizations before primary graph usage data confirms demand.

**Research flag:** STANDARD PATTERNS — Well-documented D3 patterns; no novel integration challenges.

---

### Phase Ordering Rationale

- **Data before UI** is the hardest constraint. FEATURES.md explicitly states: "Building UI before ingestion pipeline is validated" is the most common anti-pattern in civic tech. Zero UI features are buildable without parsed, normalized data. This is why Phase 1 stands alone and gates all other phases.
- **Search before graphs** because the search → entity profile path is the minimum product loop. Visualizations enhance a working product; they cannot substitute for it.
- **Visualizations before newsletter** because the newsletter's value proposition ("notable new connections") requires the graph to exist and be trusted. A newsletter pointing to broken or incomplete profiles destroys credibility.
- **Newsletter before secondary visualizations** because the newsletter drives return traffic and validates that the core product has product-market fit before investing in advanced analytical features.
- **Community flagging ships with Phase 2**, not deferred. Pitfall 1 (false-positive merges) and Pitfall 6 (stale graph after corrections) both require the flagging system as a defect recovery mechanism. Launching without it means discovered errors cannot be corrected without a developer manually editing the database.

### Research Flags Summary

Needs `/gsd:research-phase` during planning:
- **Phase 1:** Historical Elections Canada CSV schema archaeology across 2004–2026 eras; lobbycanada.gc.ca bulk export dataset ID verification; Claude Batch API throughput and result polling patterns
- **Phase 3:** D3 force-directed graph performance profiling at realistic Canadian entity network densities; canvas renderer threshold benchmarking

Standard patterns (skip research-phase):
- **Phase 2:** TanStack Start server functions, Drizzle queries, shadcn/ui setup, Coolify deployment workaround — all well-documented
- **Phase 4:** Resend + React Email integration — well-documented; CASL opt-in requirements are straightforward
- **Phase 5:** D3 heatmap, treemap, and line chart — standard patterns; no novel integration challenges

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All core libraries verified against official sources (npm, GitHub releases, official docs). One MEDIUM item: Coolify deployment workaround is community-documented, not officially resolved. |
| Features | HIGH | Cross-referenced against 5 established civic transparency platforms (OpenSecrets, FollowTheMoney, LittleSis, CanadaGPT, Code for America patterns). Feature dependency tree is explicit. |
| Architecture | HIGH | Patterns sourced from TanStack Start official docs, PostgreSQL 16 official docs, entity resolution research, and D3.js documentation. Three-stage matching pipeline is validated by OpenSecrets case study. |
| Pitfalls | HIGH (critical) / MEDIUM (integration gotchas) | Critical pitfalls sourced from: LexisNexis entity resolution research (95% false positive rates), Airbyte idempotency patterns, government data encoding documentation, Anthropic Batch API docs. Integration gotchas (Coolify, Elections Canada URL changes) are MEDIUM — community-sourced. |

**Overall confidence:** HIGH

### Gaps to Address

- **Elections Canada historical CSV schema:** Actual column layouts for 2004-2007, 2008-2011, 2012-2015, 2016-2019, 2020-present eras need to be verified by downloading real files before the parser is written. Do not write parsers speculatively.
- **lobbycanada.gc.ca bulk export:** Research identifies open.canada.ca dataset `d70ef2117` as the correct bulk CSV source. Verify the dataset ID and download URL are still current before building the downloader.
- **Claude API entity matching cost estimate:** The actual ratio of deterministic : fuzzy : AI-routed records in Elections Canada data is unknown until the first test run. Budget the initial historical backfill conservatively and measure before proceeding to full 20-year ingestion.
- **Coolify TanStack Start deployment:** GitHub issue #5476 has community workarounds but no official resolution. Verify the Express wrapper or Bun native approach works before deploying to production; have the Railway/Fly.io fallback ready if Coolify proves unstable for this use case.
- **pg_trgm performance at full data scale:** The research projects 60-80ms autocomplete at "tens of thousands of entities." Actual Canadian federal entity count across all 5 datasets is unknown until ingested. Benchmark before launch; have Meilisearch as a fallback option if GIN index proves insufficient.

## Sources

### Primary (HIGH confidence)
- [TanStack Start v1 Release Blog](https://tanstack.com/blog/announcing-tanstack-start-v1) — v1 stable status confirmed
- [NPM @tanstack/react-start](https://www.npmjs.com/package/@tanstack/react-start) — package rename confirmed
- [shadcn/ui Changelog March 2026](https://ui.shadcn.com/docs/changelog/2026-03-cli-v4) — CLI v4 + TanStack Start template confirmed
- [NPM drizzle-orm](https://www.npmjs.com/package/drizzle-orm) — 0.45.2 latest confirmed
- [NPM @anthropic-ai/sdk](https://www.npmjs.com/package/@anthropic-ai/sdk) — 0.80.0, Node 18+ requirement confirmed
- [Claude Batch Processing — Anthropic Docs](https://platform.claude.com/docs/en/build-with-claude/batch-processing) — 50% cost reduction, batch mechanics
- [OpenSecrets AWS Entity Matching Case Study](https://aws.amazon.com/blogs/publicsector/opensecrets-uses-aws-to-transform-political-transparency-through-enhanced-data-matching/) — deterministic-first matching validated
- [LexisNexis Entity Resolution Research](https://risk.lexisnexis.com/insights-resources/article/entity-resolution-redefining-false-positive-problem) — 95%+ false positive rates with name-only matching
- [Airbyte — Idempotency in Data Pipelines](https://airbyte.com/data-engineering-resources/idempotency-in-data-pipelines) — upsert patterns, deduplication keys
- [TanStack Start Server Functions docs](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions) — server function patterns confirmed
- [pg_trgm autocomplete (2024)](https://benwilber.github.io/programming/2024/08/21/pg-trgm-autocomplete.html) — GIN index requirement at scale
- [The IJF Lobbying Databases Methodology](https://theijf.org/lobbying-databases-methodology) — systematic naming inconsistencies in Canadian lobby registries documented
- [Multilingual Datasets — Government of Canada (CKAN Wiki)](https://github.com/ckan/ckan/wiki/Multilingual-Datasets,-the-Government-of-Canada-approach) — ISO-8859-1 in older Canadian government files confirmed
- [Code for America — Civic Tech Patterns and Anti-Patterns](http://codeforamerica.github.io/civic-tech-patterns/) — "Focus on the Negative" anti-pattern and neutrality requirements
- [Harvard Ash Center — Transparency is Insufficient](https://ash.harvard.edu/articles/transparency-is-insufficient-lessons-from-civic-technology-for-anticorruption/) — design for non-expert users; transparency alone is insufficient

### Secondary (MEDIUM confidence)
- [TanStack Start Coolify issue #5476](https://github.com/TanStack/router/issues/5476) — deployment workaround, community-documented
- [Marcel Wolf Coolify + TanStack Start guide](https://marcelwolf.dev/blog/how-to-host-tanstackstart-on-coolify/) — nixpacks deployment workaround confirmed working
- [Hetzner + Coolify self-hosting reality](https://ceaksan.com/en/hetzner-coolify-self-hosting-reality) — Docker bypasses Hetzner firewall; build cache issues
- [PNPM Drizzle workspace issue #8163](https://github.com/pnpm/pnpm/issues/8163) — multiple drizzle-orm instances bug in pnpm workspaces
- [Entity resolution pipeline overview](https://faingezicht.com/articles/2024/09/03/entity-resolution/) — three-stage pipeline pattern validated
- [Semantic entity resolution with LLMs](https://towardsdatascience.com/the-rise-of-semantic-entity-resolution/) — AI verification stage design

### Tertiary (LOW confidence)
- [TanStack Start vs Next.js 2026](https://dev.to/alexcloudstar/tanstack-start-vs-nextjs-in-2026-should-you-actually-switch-4b2l) — ecosystem comparison (community blog, needs independent validation)

---
*Research completed: 2026-03-31*
*Ready for roadmap: yes*
