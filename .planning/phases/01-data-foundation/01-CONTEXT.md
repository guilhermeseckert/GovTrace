# Phase 1: Data Foundation - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

All five federal government data sources (Elections Canada donations, federal contracts, grants, lobbyist registrations, lobbyist communications) are ingested, normalized, entity-matched, and pre-computed into a relationship graph. Infrastructure is set up: monorepo, database, Docker, Coolify deployment. The database is ready for every user-facing feature in Phase 2+.

</domain>

<decisions>
## Implementation Decisions

### Shared Database Package
- **D-01:** Create a dedicated `packages/db` package for Drizzle schema, migrations, and database connection. Both `packages/ingestion` and `packages/web` import from it.
- **D-02:** Use pnpm Catalogs to pin Drizzle ORM version across all packages — prevents the documented multi-instance TypeScript bug.

### Ingestion Orchestration
- **D-03:** Use pg-boss as the job queue for ingestion orchestration. Each data source is a separate job. Supports retries, scheduling, and parallel execution. No Redis needed — uses the existing PostgreSQL database.
- **D-04:** All 5 sources can run in parallel as independent pg-boss jobs. Each job: download → detect encoding → parse CSV → normalize → upsert.

### Entity Matching Pipeline
- **D-05:** Global matching pass — ingest all 5 sources first, then run one unified entity matching pass across all entities. Not per-source matching.
- **D-06:** Three-stage pipeline: (1) deterministic normalization (~70% of matches), (2) pg_trgm fuzzy matching with similarity > 0.6 (~25%), (3) Claude API verification for confidence 0.6–0.85 (~5%).
- **D-07:** Use Claude Batch API for the 20-year Elections Canada historical backfill. Ingest all data first, then submit medium-confidence matches as a batch. 50% cost savings over synchronous API calls.
- **D-08:** Source-derived keys for idempotent upserts — use composite keys from source fields (not auto-generated UUIDs) to enable safe re-runs. Each source needs its own natural key identified from CSV columns.

### Deployment & Infrastructure
- **D-09:** Single docker-compose.yml for both local dev and Coolify deployment. PostgreSQL + web + ingestion as services.
- **D-10:** PostgreSQL uses `expose:` not `ports:` in Docker Compose — prevents Docker DNAT from bypassing Hetzner firewall (research-identified security pitfall).
- **D-11:** Encoding detection per file — pre-2015 CSVs are ISO-8859-1 or Windows-1252, not UTF-8. Detect and transcode before parsing.

### Claude's Discretion
- Exact CSV parser library choice (papaparse, csv-parse, etc.)
- pg-boss job configuration (retry count, backoff, concurrency)
- Drizzle migration strategy (push vs generate+migrate)
- Docker Compose service naming and networking
- Exact natural key composition for each of the 5 data sources

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Full project vision, constraints, tech stack decisions, database schema spec
- `.planning/REQUIREMENTS.md` — DATA-01 through DATA-08, MATCH-01 through MATCH-06, INFRA-01 through INFRA-07

### Research Findings
- `.planning/research/STACK.md` — Validated stack choices, TanStack Start package rename, Drizzle pnpm Catalogs fix, pg-boss recommendation
- `.planning/research/ARCHITECTURE.md` — Component boundaries, data flow, build order
- `.planning/research/PITFALLS.md` — CSV encoding, idempotent ingestion, Docker port exposure, AI cost estimation, false-positive entity matching legal risk

### Data Source Documentation
- Elections Canada donations: `https://www.elections.ca/fin/oda/od_cntrbtn_audt_e.zip` (CSV in ZIP, weekly, 2004–present)
- Federal contracts: dataset `d8f85d91-7dec-4fd1-8055-483b77225d8b` on open.canada.ca (quarterly)
- Grants: `https://open.canada.ca/data/dataset/432527ab-7aac-45b5-81d6-7597107a7013/resource/1d15a62f-5656-49ad-8c88-f40ce689d831/download/grants.csv` (quarterly)
- Lobbyist registrations + communications: `https://lobbycanada.gc.ca/en/open-data/` (weekly)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None yet — this phase establishes the foundational patterns (monorepo structure, DB access, ingestion pipeline)

### Integration Points
- `packages/db` will be the shared integration point between ingestion and web
- pg-boss tables will live alongside application tables in the same PostgreSQL database
- entity_connections table is the pre-computed output that Phase 2 (search/profiles) consumes

</code_context>

<specifics>
## Specific Ideas

- User wants data-first approach — nothing visual until data pipeline is solid
- "How easy it is to get and understand the data flow, clear trace" — clarity of data lineage is a core value
- Docker deployment via Coolify on existing Hetzner server at https://coolify.lab.guilhermeseckert.dev/
- Raw source data preserved in jsonb column for every record (auditability)
- "Connections do not imply wrongdoing" disclaimer principle applies to entity matching decisions too — conservative matching is better than false positives

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-data-foundation*
*Context gathered: 2026-03-31*
