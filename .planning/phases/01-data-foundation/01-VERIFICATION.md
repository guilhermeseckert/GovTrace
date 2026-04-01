---
phase: 01-data-foundation
verified: 2026-03-31T00:00:00Z
status: gaps_found
score: 3/5 success criteria verified
re_verification: false
gaps:
  - truth: "Local development environment starts with a single docker compose up and the web app can query all 5 source tables"
    status: failed
    reason: "packages/web/src/ is empty (no TanStack Start source files) and build scripts reference vinxi (deprecated, not installed). The web container Dockerfile runs pnpm --filter @govtrace/web build which invokes vinxi build — this will fail at build time."
    artifacts:
      - path: "packages/web/src/"
        issue: "Directory is empty — no app source files, no routes, no server functions"
      - path: "packages/web/package.json"
        issue: "Scripts use 'vinxi dev/build/start' — vinxi is not installed and TanStack Start v1.167.x uses Vite, not Vinxi (deprecated at v1.121.0 per STACK.md)"
    missing:
      - "At minimum a minimal TanStack Start app.config.ts and routes/index.tsx so the Docker build succeeds"
      - "Replace vinxi scripts with correct TanStack Start v1.167 build commands (using @tanstack/react-start vite plugin)"
  - truth: "Entity matching pipeline runs without runtime errors (createNewEntity idempotency)"
    status: failed
    reason: "packages/ingestion/src/matcher/deterministic.ts line 85 uses onConflictDoUpdate({ target: entities.normalizedName }) but the entities table has no unique index on normalized_name. The only unique index is on (canonical_name, entity_type). PostgreSQL will throw 'there is no unique or exclusion constraint matching the ON CONFLICT specification' at runtime, crashing every entity creation attempt."
    artifacts:
      - path: "packages/ingestion/src/matcher/deterministic.ts"
        issue: "Line 85: onConflictDoUpdate({ target: entities.normalizedName, ... }) — normalized_name has no unique constraint (verified against migration SQL 0000_tidy_tusk.sql and schema definition)"
    missing:
      - "Fix conflict target to match the actual unique index: change target to [entities.canonicalName, entities.entityType] (matching the 'entities_canonical_name_type_idx' unique index)"
      - "OR add a uniqueIndex on normalizedName in entities schema (with corresponding migration) if that constraint is truly intended"
human_verification:
  - test: "Run full ingestion end-to-end with a real Elections Canada CSV file"
    expected: "Second run on the same file produces identical record counts (idempotency)"
    why_human: "Requires PostgreSQL running and real or sample CSV data — cannot verify without a live database"
  - test: "Ingest a pre-2015 Elections Canada file with ISO-8859-1 encoding"
    expected: "French characters like 'Montréal' and 'Québec' appear correctly in the database"
    why_human: "Encoding detection and transcoding can only be validated against actual files with non-UTF-8 content"
---

# Phase 1: Data Foundation Verification Report

**Phase Goal:** All five federal government data sources are ingested, normalized, entity-matched, and pre-computed into a relationship graph — the database is ready for every user-facing feature
**Verified:** 2026-03-31
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Success Criteria (from ROADMAP.md)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running the ingestion pipeline twice on the same source files produces identical record counts (idempotency verified) | ? UNCERTAIN | All 5 upsert files use `onConflictDoUpdate` with correct conflict targets on `id` — design is correct. BUT `createNewEntity` in `deterministic.ts` has a broken conflict target (see Gap 2) that would crash matching runs. Cannot fully verify without a live DB. |
| 2 | "Montréal" and "Québec" appear correctly in the database after ingesting pre-2015 ISO-8859-1 files | ? UNCERTAIN | `encoding.ts` uses `chardet` + `iconv-lite` with BOM stripping. Design is correct and substantive. Needs live data to confirm. |
| 3 | Every entity match record has a confidence score, match method, and (for AI-routed matches) Claude reasoning stored in entity_matches_log | ✓ VERIFIED | `entityMatchesLog` schema has `matchMethod`, `similarityScore`, `aiModel`, `aiConfidence`, `aiReasoning` columns. `process-batch-results.ts` populates all three AI fields. `deterministic.ts` and `fuzzy.ts` populate method and similarity. |
| 4 | The entity_connections table is populated with aggregated relationship data after a full ingestion run completes | ✓ VERIFIED | `build-connections.ts` implements full `ON CONFLICT DO UPDATE` SQL for all 5 source types. `entityConnections` schema has `totalValue`, `transactionCount`, `firstSeen`, `lastSeen`, `connectionType`. CLI `pnpm ingest build-connections` is wired in `index.ts`. |
| 5 | Local development environment starts with a single `docker compose up` and the web app can query all 5 source tables | ✗ FAILED | `packages/web/src/` is empty. Web Dockerfile runs `pnpm --filter @govtrace/web build` which calls `vinxi build` — vinxi is not installed and is deprecated in TanStack Start v1.121+. The web container cannot be built. |

**Score:** 2/5 success criteria fully verified, 2/5 uncertain (need live DB), 1/5 failed

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `pnpm-workspace.yaml` | ✓ VERIFIED | Contains `catalog:` with all required packages: drizzle-orm, drizzle-kit, postgres, zod, @anthropic-ai/sdk, papaparse, pg-boss, chardet, iconv-lite |
| `packages/db/src/schema/raw.ts` | ✓ VERIFIED | Exports `donations`, `contracts`, `grants`, `lobbyRegistrations`, `lobbyCommunications` — all 5 source tables with correct `rawData jsonb` and `normalizedXName` columns |
| `packages/db/src/schema/entities.ts` | ✓ VERIFIED | Exports `entities`, `entityAliases`, `entityMatchesLog`, `aiSummaries`, `flags` — all required entity resolution tables |
| `packages/db/src/schema/connections.ts` | ✓ VERIFIED | Exports `entityConnections` with `totalValue`, `transactionCount`, `firstSeen`, `lastSeen`, `connectionType`, unique composite index on `(entityAId, entityBId, connectionType)` |
| `docker-compose.yml` | ✓ VERIFIED | Uses `expose:` not `ports:` on postgres. Contains INFRA-06 security comment. Web and ingestion services present. |

### Plan 02 Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `packages/web/Dockerfile` | ✓ VERIFIED | Multi-stage build (base/deps/builder/runner), `HEALTHCHECK`, `EXPOSE 3000`, `CMD ["node", "server.js"]` |
| `packages/web/server.ts` | ✓ VERIFIED | Contains `toNodeHandler` from srvx, dynamic import of TanStack build output, configurable `PORT` |
| `docker-compose.yml` | ✓ VERIFIED | `expose:` on postgres. Comment block explains INFRA-06. |
| `docker-compose.override.yml` | ✓ VERIFIED | Exists with `127.0.0.1:5432:5432` binding |
| `.gitignore` | ✓ VERIFIED | Contains `docker-compose.override.yml` |

### Plan 03 Artifacts (Elections Canada)

| Artifact | Status | Details |
|----------|--------|---------|
| `packages/ingestion/src/lib/encoding.ts` | ✓ VERIFIED | Exports `detectAndTranscode`. Uses `chardet` + `iconv-lite`, strips BOM. |
| `packages/ingestion/src/lib/hash.ts` | ✓ VERIFIED | Exports `deriveSourceKey`. SHA-256 of pipe-joined fields. |
| `packages/ingestion/src/downloaders/elections-canada.ts` | ✓ VERIFIED | File exists and is substantive. |
| `packages/ingestion/src/parsers/elections-canada.ts` | ✓ VERIFIED | Exports `parseElectionsCanadaFile`. Calls `detectAndTranscode` before parsing. Column mapping by header name. |
| `packages/ingestion/src/upsert/donations.ts` | ✓ VERIFIED | Exports `upsertDonations`. Uses `onConflictDoUpdate` on `donations.id`. Populates `rawData`. |

### Plan 04 Artifacts (Contracts + Grants)

| Artifact | Status | Details |
|----------|--------|---------|
| `packages/ingestion/src/parsers/contracts.ts` | ✓ VERIFIED | Exports `parseContractsFile`. Calls `detectAndTranscode`. Multi-alias column mapping. |
| `packages/ingestion/src/parsers/grants.ts` | ✓ VERIFIED | File exists and is substantive. |
| `packages/ingestion/src/upsert/contracts.ts` | ✓ VERIFIED | Exports `upsertContracts`. `onConflictDoUpdate` on `contracts.id`. |
| `packages/ingestion/src/upsert/grants.ts` | ✓ VERIFIED | File exists and is substantive. |

### Plan 05 Artifacts (Lobby)

| Artifact | Status | Details |
|----------|--------|---------|
| `packages/ingestion/src/parsers/lobby-registrations.ts` | ✓ VERIFIED | Exports `parseLobbyRegistrationsFile`. Uses `registration_number` as stable ID. Calls `detectAndTranscode`. |
| `packages/ingestion/src/parsers/lobby-communications.ts` | ✓ VERIFIED | File exists and is substantive. |
| `packages/ingestion/src/upsert/lobby-registrations.ts` | ✓ VERIFIED | Exports `upsertLobbyRegistrations`. `onConflictDoUpdate` on `lobbyRegistrations.id`. |
| `packages/ingestion/src/upsert/lobby-communications.ts` | ✓ VERIFIED | File exists and is substantive. |

### Plan 06 Artifacts (Normalizer + Deterministic + Fuzzy)

| Artifact | Status | Details |
|----------|--------|---------|
| `packages/ingestion/src/normalizer/normalize.ts` | ✓ VERIFIED | Exports `normalizeName`. Pipeline: acronym expand → lowercase → strip suffixes → collapse whitespace. |
| `packages/ingestion/src/normalizer/strip-suffixes.ts` | ✓ VERIFIED | Strips Inc./Ltd./Corp./ltée and French equivalents. |
| `packages/ingestion/src/normalizer/acronyms.ts` | ✓ VERIFIED | `MAC` → `mining association of canada` and 20+ other Canadian acronyms. Exports `expandAcronym`. |
| `packages/ingestion/src/matcher/deterministic.ts` | ✗ STUB (runtime bug) | Exports `findDeterministicMatch` and `createNewEntity`. `createNewEntity` has broken `onConflictDoUpdate({ target: entities.normalizedName })` — no unique constraint on `normalized_name` in schema or migration SQL. |
| `packages/ingestion/src/matcher/fuzzy.ts` | ✓ VERIFIED | Exports `findFuzzyMatches`. Uses `similarity()` pg_trgm SQL. Thresholds 0.85/0.60 correctly applied. Logs to `entityMatchesLog`. |
| `packages/ingestion/src/matcher/run-matching.ts` | ✓ VERIFIED | Exports `runMatchingPipeline`. Iterates all 7 source configs across 5 tables. Calls both deterministic and fuzzy matchers. |

### Plan 07 Artifacts (AI Verification)

| Artifact | Status | Details |
|----------|--------|---------|
| `packages/ingestion/src/matcher/ai-verify.ts` | ✓ VERIFIED | Exports `verifyMatchWithAI`. API key from env. Structured JSON prompt. Model selection (haiku/sonnet). |
| `packages/ingestion/src/matcher/batch-queue.ts` | ✓ VERIFIED | Exports `submitMatchingBatch`. Circuit breaker at 10,000 candidates. `client.beta.messages.batches.create()` Batch API used. |
| `packages/ingestion/src/matcher/process-batch-results.ts` | ✓ VERIFIED | Exports `processBatchResults`. Polls batch, stores `aiModel`, `aiConfidence`, `aiReasoning` to `entityMatchesLog`. Creates `entityAliases` on match verdicts. |

### Plan 08 Artifacts (Connection Builder + Scheduler)

| Artifact | Status | Details |
|----------|--------|---------|
| `packages/ingestion/src/graph/build-connections.ts` | ✓ VERIFIED | Exports `buildEntityConnections`. Mark-stale → upsert all 5 connection types → delete-stale pattern. Returns counts per type. |
| `packages/ingestion/src/scheduler/jobs.ts` | ✓ VERIFIED | Exports `registerIngestionJobs`. pg-boss `boss.schedule()` for all 5 sources + build-connections with correct cron cadences. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/ingestion/package.json` | `packages/db` | `@govtrace/db: workspace:*` | ✓ WIRED | Confirmed in package.json dependencies |
| `packages/web/package.json` | `packages/db` | `@govtrace/db: workspace:*` | ✓ WIRED | Confirmed in package.json dependencies |
| `docker-compose.yml` | PostgreSQL init script | volumes mount + `postgres-init.sql` | ✓ WIRED | `./docker/postgres-init.sql` mounts correctly; SQL contains `CREATE EXTENSION IF NOT EXISTS pg_trgm` |
| `parsers/elections-canada.ts` | `lib/encoding.ts` | `detectAndTranscode` call | ✓ WIRED | Import and call on line 3 and 37 |
| `upsert/donations.ts` | `schema/raw.ts` | `onConflictDoUpdate` on donations | ✓ WIRED | Imports `donations` from `@govtrace/db/schema/raw`, uses `onConflictDoUpdate` |
| `parsers/contracts.ts` | `lib/encoding.ts` | `detectAndTranscode` call | ✓ WIRED | Import confirmed |
| `upsert/contracts.ts` | `schema/raw.ts` | `onConflictDoUpdate` on contracts | ✓ WIRED | Import and usage confirmed |
| `parsers/lobby-registrations.ts` | `lib/encoding.ts` | `detectAndTranscode` call | ✓ WIRED | Import confirmed |
| `upsert/lobby-registrations.ts` | `schema/raw.ts` | `onConflictDoUpdate` on lobby_registrations | ✓ WIRED | Import and usage confirmed |
| `matcher/fuzzy.ts` | entities `normalized_name` | `similarity()` SQL function | ✓ WIRED | SQL template literal uses `similarity(normalized_name, ...)` |
| `matcher/run-matching.ts` | `schema/entities.ts` | INSERT into entityMatchesLog | ✓ WIRED | Imports and uses `entityMatchesLog` |
| `matcher/deterministic.ts` | `schema/entities.ts` | `onConflictDoUpdate` on entities | ✗ BROKEN | Conflict target `entities.normalizedName` has no unique constraint — will throw PostgreSQL error at runtime |
| `batch-queue.ts` | Anthropic Batch API | `client.beta.messages.batches.create()` | ✓ WIRED | Confirmed on line 77 |
| `process-batch-results.ts` | `schema/entities.ts` | INSERT into entityAliases + UPDATE entityMatchesLog | ✓ WIRED | Both confirmed |
| `build-connections.ts` | `schema/connections.ts` | `ON CONFLICT DO UPDATE` into entity_connections | ✓ WIRED | Raw SQL with correct conflict target `(entity_a_id, entity_b_id, connection_type)` |
| `scheduler/jobs.ts` | pg-boss | `boss.schedule()` cron expressions | ✓ WIRED | 6 schedules registered for all sources + build-connections |
| `packages/web/Dockerfile` | `packages/web/server.ts` | `CMD node server.js` | ✓ WIRED | Dockerfile CMD matches server wrapper |
| `docker-compose.yml` | postgres service | `expose:` not `ports:` | ✓ WIRED | `expose: - "5432"` confirmed, no `ports:` at top level |

---

## Data-Flow Trace (Level 4)

Level 4 data-flow tracing is not applicable for Phase 1 — this phase produces no rendering components. All artifacts are pipeline processors (ingest → normalize → match → aggregate). The functional equivalent (data pipeline flows) is covered by the key link verification above.

---

## Behavioral Spot-Checks

Step 7b: SKIPPED for database/pipeline artifacts — no runnable entry points that can be tested without a live PostgreSQL instance. The ingestion CLI requires `DATABASE_URL` and actual CSV files.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| INFRA-01 | 01-01 | Monorepo with pnpm workspaces | ✓ SATISFIED | `pnpm-workspace.yaml` with `packages/*`, three packages present |
| INFRA-02 | 01-01 | PostgreSQL 16 with pg_trgm enabled | ✓ SATISFIED | `docker-compose.yml` uses `postgres:16-alpine`; `docker/postgres-init.sql` enables pg_trgm |
| INFRA-03 | 01-01 | Drizzle ORM with pnpm Catalogs | ✓ SATISFIED | `catalog:` entries in `pnpm-workspace.yaml`; all packages reference `drizzle-orm: catalog:` |
| INFRA-04 | 01-01 | Docker Compose for local development | ✓ SATISFIED | `docker-compose.yml` exists with postgres service and healthcheck |
| INFRA-05 | 01-02 | Docker deployment config for Coolify | ✓ SATISFIED | `packages/web/Dockerfile` exists with multi-stage build and HEALTHCHECK |
| INFRA-06 | 01-02 | PostgreSQL not exposed to internet | ✓ SATISFIED | `expose:` not `ports:` on postgres in `docker-compose.yml`; security comment present |
| INFRA-07 | 01-01 | Database indexes: GIN on normalized_name, FKs, composite, pg_trgm | ✓ SATISFIED | All indexes confirmed in schema and migration SQL: GIN on entities.normalizedName, uniqueIndex on entity_connections (a,b,type), FKs, normalized_name indexes on all 5 raw tables |
| DATA-01 | 01-03 | Elections Canada CSV parse (2004–present) | ✓ SATISFIED | `parsers/elections-canada.ts` with multi-era schema detection via `buildColumnMapping` |
| DATA-02 | 01-04 | Federal contracts CSV parse | ✓ SATISFIED | `parsers/contracts.ts` with multi-alias column mapping |
| DATA-03 | 01-04 | Federal grants CSV parse | ✓ SATISFIED | `parsers/grants.ts` exists and is substantive |
| DATA-04 | 01-05 | Lobbyist registrations parse | ✓ SATISFIED | `parsers/lobby-registrations.ts` with registration_number as stable ID |
| DATA-05 | 01-05 | Lobbyist communications parse | ✓ SATISFIED | `parsers/lobby-communications.ts` exists and is substantive |
| DATA-06 | 01-03 | Encoding detection per file | ✓ SATISFIED | `lib/encoding.ts` with chardet + iconv-lite; called by all 5 parsers |
| DATA-07 | 01-03, 01-08 | Idempotent ingestion (no duplicates) | ✓ PARTIALLY SATISFIED | All 5 upsert files use `onConflictDoUpdate` on deterministic IDs. `build-connections.ts` uses mark-stale/rebuild pattern. BUT `createNewEntity` in `deterministic.ts` has broken conflict target — entity creation will fail at runtime |
| DATA-08 | 01-03 | Raw source data preserved in jsonb | ✓ SATISFIED | All 5 raw tables have `rawData: jsonb('raw_data').notNull()`. All parsers populate `rawData` from full CSV row. |
| MATCH-01 | 01-06 | Name normalization pipeline | ✓ SATISFIED | `normalizer/normalize.ts` implements lowercase + strip suffixes + acronym expansion + whitespace collapse |
| MATCH-02 | 01-06 | pg_trgm fuzzy matching (> 0.6 threshold) | ✓ SATISFIED | `matcher/fuzzy.ts` uses `similarity()` with `FUZZY_MIN = 0.60` threshold |
| MATCH-03 | 01-07 | Medium-confidence matches (0.6–0.85) sent to Claude | ✓ SATISFIED | `batch-queue.ts` queries `entityMatchesLog` for `decision = 'uncertain'` and submits to Batch API |
| MATCH-04 | 01-06, 01-07 | Match decisions stored with method, confidence, AI reasoning | ✓ SATISFIED | `entityMatchesLog` schema has all required columns; `process-batch-results.ts` stores `aiModel`, `aiConfidence`, `aiReasoning` |
| MATCH-05 | 01-08 | entity_connections pre-computed with aggregated data | ✓ SATISFIED | `build-connections.ts` aggregates `totalValue`, `transactionCount`, `firstSeen`, `lastSeen` per entity pair per type |
| MATCH-06 | 01-07 | Claude Batch API for historical backfill | ✓ SATISFIED | `batch-queue.ts` uses `client.beta.messages.batches.create()` exclusively; circuit breaker at 10,000 candidates |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/ingestion/src/matcher/deterministic.ts` | 85 | `onConflictDoUpdate({ target: entities.normalizedName })` — no unique constraint on `normalized_name` in migration SQL | Blocker | PostgreSQL will throw at runtime: "there is no unique or exclusion constraint matching the ON CONFLICT specification". Every call to `createNewEntity()` crashes. This breaks all entity creation during the matching pipeline. |
| `packages/web/package.json` | 7–9 | Scripts use `vinxi dev/build/start` — Vinxi is deprecated as of TanStack Start v1.121.0 and is not installed | Blocker | `pnpm --filter @govtrace/web build` in Dockerfile will fail. Web container cannot be built. Success Criterion 5 cannot be met. |
| `packages/web/src/` | — | Empty directory — no TanStack Start source files | Blocker | Web app has no routes, no server functions, no app entry point. Even after fixing the build tool, there is no app to serve. |
| Root | — | `.env.example` missing | Warning | Plan 01 listed `.env.example` in `files_modified` but it was not created. Developers cannot discover required environment variables without reading the code. |

---

## Human Verification Required

### 1. Encoding Correctness

**Test:** Download a pre-2015 Elections Canada ZIP from elections.ca (e.g., the 2004 or 2008 file). Run `pnpm ingest elections-canada` against it. Query the database: `SELECT contributor_name FROM donations WHERE contributor_name LIKE '%éal%' LIMIT 5;`
**Expected:** "Montréal" appears with correct accented characters, not mojibake like "MontrÃ©al"
**Why human:** Requires a live PostgreSQL instance and real government CSV files to verify encoding transcoding end-to-end.

### 2. Ingestion Idempotency

**Test:** Run `pnpm ingest all` once, record row counts for all 5 tables. Run again on the same files. Compare counts.
**Expected:** Identical row counts. No duplicate rows. `updatedAt` timestamps may differ but row count must be identical.
**Why human:** Requires a running database and real or representative CSV files.

---

## Gaps Summary

Phase 1 has strong implementation for the ingestion pipeline (Plans 03–05), entity matching design (Plans 06–07), and connection graph builder (Plan 08). The schema is comprehensive and correctly indexed. The Claude AI integration is properly implemented with circuit breaker, Batch API, and full match provenance.

**Two blockers prevent full goal achievement:**

**Blocker 1: Broken `onConflictDoUpdate` in `deterministic.ts`**
The `createNewEntity` function (called every time an unrecognized entity name is encountered) uses a conflict target on `entities.normalizedName`, but there is no unique constraint on that column. The only unique index on the `entities` table is the composite `(canonical_name, entity_type)`. At runtime, PostgreSQL will reject every entity INSERT with a conflict specification error. The entire matching pipeline — which creates new entity records for every unrecognized name — will fail. This breaks MATCH-01 through MATCH-05 in practice.

**Fix:** Change `target: entities.normalizedName` to `target: [entities.canonicalName, entities.entityType]` to match the actual unique index. Or, if `normalizedName` uniqueness is the intended constraint, add a `uniqueIndex` on `normalizedName` to the `entities` schema and generate a new migration.

**Blocker 2: Web app has no source code and uses deprecated build tool**
`packages/web/src/` is empty and the build scripts use `vinxi` (not installed; deprecated since TanStack Start v1.121.0). The web container Dockerfile will fail during `pnpm --filter @govtrace/web build`. Success Criterion 5 ("web app can query all 5 source tables") cannot be met because the web app does not exist. Phase 2 depends on this web scaffold — this must be addressed before or alongside Phase 2 planning.

---

_Verified: 2026-03-31_
_Verifier: Claude (gsd-verifier)_
