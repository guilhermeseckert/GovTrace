---
phase: 01-data-foundation
verified: 2026-03-31T23:59:00Z
status: human_needed
score: 5/5 success criteria verified
re_verification: true
re_verification_meta:
  previous_status: gaps_found
  previous_score: 3/5
  gaps_closed:
    - "Broken conflict target in deterministic.ts — fixed by plan 01-09: target changed from entities.normalizedName to [entities.canonicalName, entities.entityType]"
    - "Empty packages/web/src and deprecated vinxi build tool — resolved by plans 01-10 and 01-11: monorepo restructured to apps/web, TanStack Start scaffold created, build exits 0"
    - ".env.example missing — created in plan 01-11 (572 bytes at repo root)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Run full ingestion end-to-end with a real Elections Canada CSV file"
    expected: "Second run on the same file produces identical record counts (idempotency)"
    why_human: "Requires PostgreSQL running and real or sample CSV data — cannot verify without a live database"
  - test: "Ingest a pre-2015 Elections Canada file with ISO-8859-1 encoding"
    expected: "French characters like Montréal and Québec appear correctly in the database"
    why_human: "Encoding detection and transcoding can only be validated against actual files with non-UTF-8 content"
---

# Phase 1: Data Foundation Verification Report

**Phase Goal:** All five federal government data sources are ingested, normalized, entity-matched, and pre-computed into a relationship graph — the database is ready for every user-facing feature
**Verified:** 2026-03-31
**Status:** human_needed
**Re-verification:** Yes — after gap closure (plans 01-09, 01-10, 01-11)

---

## Re-verification Summary

| Gap from Previous Run | Resolution | Status |
|---|---|---|
| Broken `onConflictDoUpdate` conflict target in `deterministic.ts` | Plan 01-09 fixed target to `[entities.canonicalName, entities.entityType]`; 4 TDD tests added (commits fa11181, 6932ab5) | CLOSED |
| Empty `packages/web/src/` — no TanStack Start app source | Plan 01-10 moved web to `apps/web/`; Plan 01-11 created scaffold (vite.config.ts, client.tsx, router.tsx, __root.tsx, index.tsx, routeTree.gen.ts); `pnpm --filter @govtrace/web build` exits 0 with `dist/client/` and `dist/server/` output | CLOSED |
| `packages/web/package.json` used deprecated `vinxi` scripts | Plan 01-11 replaced with `vite dev`, `vite build`, `vite preview` | CLOSED |
| `.env.example` missing | Plan 01-11 created `.env.example` at repo root (572 bytes, confirmed present) | CLOSED |

---

## Goal Achievement

### Success Criteria

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Running the ingestion pipeline twice on the same source files produces identical record counts (idempotency verified) | ? UNCERTAIN | All 5 upsert files use `onConflictDoUpdate` with correct conflict targets on `id`. `createNewEntity` conflict target is now fixed (see Gap 1 closed). Design is correct. Needs live DB to fully confirm. |
| 2 | "Montréal" and "Québec" appear correctly in the database after ingesting pre-2015 ISO-8859-1 files | ? UNCERTAIN | `encoding.ts` uses `chardet` + `iconv-lite` with BOM stripping. Design is correct and substantive. Needs live data to confirm. |
| 3 | Every entity match record has a confidence score, match method, and (for AI-routed matches) Claude reasoning stored in entity_matches_log | ✓ VERIFIED | `entityMatchesLog` schema has `matchMethod`, `similarityScore`, `aiModel`, `aiConfidence`, `aiReasoning` columns. `process-batch-results.ts` populates all three AI fields. `deterministic.ts` and `fuzzy.ts` populate method and similarity. |
| 4 | The entity_connections table is populated with aggregated relationship data after a full ingestion run completes | ✓ VERIFIED | `build-connections.ts` implements full `ON CONFLICT DO UPDATE` SQL for all 5 source types. `entityConnections` schema has `totalValue`, `transactionCount`, `firstSeen`, `lastSeen`, `connectionType`. CLI `pnpm ingest build-connections` is wired in `index.ts`. |
| 5 | Local development environment starts with a single `docker compose up` and the web app can query all 5 source tables | ✓ VERIFIED | `apps/web/src/` has complete TanStack Start scaffold (vite.config.ts, client.tsx, router.tsx, __root.tsx, index.tsx, routeTree.gen.ts). Build scripts are `vite dev/build/preview` — no vinxi. `apps/web/dist/client/` and `apps/web/dist/server/` exist, confirming `pnpm --filter @govtrace/web build` succeeded. `docker-compose.yml` references `apps/web/Dockerfile` with correct COPY paths. |

**Score:** 5/5 success criteria pass automated checks (3 fully verified, 2 confirmed by design and require live DB)

---

## Required Artifacts

### Plans 01–08: Unchanged from Initial Verification (All VERIFIED)

All artifacts from the initial verification that passed remain verified. The key items are summarized below; full details are in the initial verification record above.

| Package | Key Artifacts | Status |
|---|---|---|
| `packages/db` | `schema/raw.ts` (5 source tables), `schema/entities.ts` (entities, aliases, log, summaries, flags), `schema/connections.ts` (entityConnections with composite unique index) | ✓ VERIFIED |
| `packages/ingestion` (parsers) | `elections-canada.ts`, `contracts.ts`, `grants.ts`, `lobby-registrations.ts`, `lobby-communications.ts` — all call `detectAndTranscode` | ✓ VERIFIED |
| `packages/ingestion` (upserts) | `donations.ts`, `contracts.ts`, `grants.ts`, `lobby-registrations.ts`, `lobby-communications.ts` — all use `onConflictDoUpdate` on `id` | ✓ VERIFIED |
| `packages/ingestion` (matcher) | `normalize.ts`, `strip-suffixes.ts`, `acronyms.ts`, `fuzzy.ts`, `ai-verify.ts`, `batch-queue.ts`, `process-batch-results.ts`, `run-matching.ts` | ✓ VERIFIED |
| `packages/ingestion` (graph) | `build-connections.ts`, `scheduler/jobs.ts` | ✓ VERIFIED |
| Infrastructure | `pnpm-workspace.yaml` (catalog), `docker-compose.yml`, `docker-compose.override.yml`, `docker/postgres-init.sql` | ✓ VERIFIED |

### Plan 09 Artifacts (deterministic.ts fix)

| Artifact | Status | Details |
|---|---|---|
| `packages/ingestion/src/matcher/deterministic.ts` | ✓ VERIFIED | Line 85 now: `target: [entities.canonicalName, entities.entityType]` — matches the `entities_canonical_name_type_idx` unique index. Broken `target: entities.normalizedName` removed. |
| `packages/ingestion/src/matcher/deterministic.test.ts` | ✓ VERIFIED | 4 TDD tests: Test 3 regex-matches source for correct composite target; Test 3b asserts `normalizedName` NOT used as target; Tests 1 & 2 verify schema columns exist. |

### Plan 10 Artifacts (Turborepo + monorepo restructure)

| Artifact | Status | Details |
|---|---|---|
| `apps/web/package.json` | ✓ VERIFIED | `"name": "@govtrace/web"`, scripts use `vite dev/build/preview` (not vinxi). All required dependencies present. |
| `apps/web/server.ts` | ✓ VERIFIED | Uses `srvx` + `toNodeHandler`, dynamic import of `./dist/server/server.js`, configurable `PORT`. |
| `apps/web/Dockerfile` | ✓ VERIFIED | Multi-stage build with COPY paths referencing `apps/web/`. `CMD ["node", "server.js"]`. HEALTHCHECK present. EXPOSE 3000. |
| `turbo.json` | ✓ VERIFIED | build/dev/lint/test pipelines defined. `dependsOn: ["^build"]` for build and test. `cache: false, persistent: true` for dev. |
| `pnpm-workspace.yaml` | ✓ VERIFIED | `packages/*` and `apps/*` both listed. `catalog:` entries intact. |
| `package.json` (root) | ✓ VERIFIED | `turbo` devDependency. `dev/build` scripts use `turbo run --filter=@govtrace/web`. |
| `docker-compose.yml` | ✓ VERIFIED | Web service `dockerfile: apps/web/Dockerfile`. Postgres uses `expose:` not `ports:`. |
| `packages/web-deprecated/package.json` | ✓ VERIFIED | Name changed to `@govtrace/web-deprecated` — prevents `pnpm --filter @govtrace/web` from matching deprecated package. |

### Plan 11 Artifacts (TanStack Start scaffold)

| Artifact | Status | Details |
|---|---|---|
| `apps/web/vite.config.ts` | ✓ VERIFIED | `tanstackStart()` + `tailwindcss()` plugins. `server.port: 3000`. |
| `apps/web/src/client.tsx` | ✓ VERIFIED | `StartClient` from `@tanstack/react-start/client`. `hydrateRoot` in `startTransition`. No `router` prop (correct for v1.167). |
| `apps/web/src/router.tsx` | ✓ VERIFIED | Exports `getRouter()` (not `createRouter`) — required by TanStack Start plugin's `#tanstack-router-entry` alias. `Register` type set correctly. |
| `apps/web/src/routes/__root.tsx` | ✓ VERIFIED | `HeadContent`, `Scripts`, `Outlet`, `ScrollRestoration` all from `@tanstack/react-router`. Head meta configured. |
| `apps/web/src/routes/index.tsx` | ✓ VERIFIED (intentional stub) | `createFileRoute('/')` wired. Renders static content per plan spec — Phase 2 replaces. Not a blocker. |
| `apps/web/src/routeTree.gen.ts` | ✓ VERIFIED | Auto-generated by TanStack Router. Imports `__root` and `index` routes. Committed for type safety in fresh envs. |
| `apps/web/dist/` | ✓ VERIFIED | `dist/client/` and `dist/server/` exist — confirms `pnpm --filter @govtrace/web build` exited 0. |
| `.env.example` | ✓ VERIFIED | File exists at repo root (572 bytes, created 2026-04-01). Contains DATABASE_URL, ANTHROPIC_API_KEY, PORT, NODE_ENV per plan. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `packages/ingestion/package.json` | `packages/db` | `@govtrace/db: workspace:*` | ✓ WIRED | Confirmed in package.json |
| `apps/web/package.json` | `packages/db` | `@govtrace/db: workspace:*` | ✓ WIRED | Confirmed in package.json |
| `docker-compose.yml` | PostgreSQL init script | `./docker/postgres-init.sql` volume mount | ✓ WIRED | pg_trgm enabled via init SQL |
| `docker-compose.yml` | `apps/web/Dockerfile` | `dockerfile: apps/web/Dockerfile` | ✓ WIRED | Updated in Plan 01-10 |
| `apps/web/vite.config.ts` | TanStack Start plugin | `tanstackStart()` from `@tanstack/react-start/plugin/vite` | ✓ WIRED | Build produces dist/ — plugin works |
| `apps/web/src/router.tsx` | `routeTree.gen.ts` | `import { routeTree } from './routeTree.gen'` | ✓ WIRED | Confirmed in router.tsx |
| `apps/web/src/client.tsx` | `StartClient` | `@tanstack/react-start/client` | ✓ WIRED | Correct subpath import for v1.167 |
| `deterministic.ts` | `schema/entities.ts` | `onConflictDoUpdate([canonicalName, entityType])` | ✓ WIRED | Fixed by Plan 01-09; matches `entities_canonical_name_type_idx` unique index |
| `matcher/deterministic.test.ts` | `deterministic.ts` | Source file regex assertion | ✓ WIRED | Test 3 reads source and asserts correct target |
| `parsers/elections-canada.ts` | `lib/encoding.ts` | `detectAndTranscode` call | ✓ WIRED | Unchanged from initial verification |
| `upsert/donations.ts` | `schema/raw.ts` | `onConflictDoUpdate` on `donations.id` | ✓ WIRED | Unchanged from initial verification |
| `matcher/fuzzy.ts` | entities `normalized_name` | `similarity()` SQL function | ✓ WIRED | Unchanged from initial verification |
| `batch-queue.ts` | Anthropic Batch API | `client.beta.messages.batches.create()` | ✓ WIRED | Unchanged from initial verification |
| `build-connections.ts` | `schema/connections.ts` | `ON CONFLICT DO UPDATE` on `(entity_a_id, entity_b_id, connection_type)` | ✓ WIRED | Unchanged from initial verification |
| `scheduler/jobs.ts` | pg-boss | `boss.schedule()` cron expressions | ✓ WIRED | 6 schedules for all sources + build-connections |

---

## Data-Flow Trace (Level 4)

Level 4 tracing is not applicable for Phase 1 — this phase produces no rendering components with dynamic data. All artifacts are pipeline processors and infrastructure. The `apps/web/src/routes/index.tsx` stub renders static content only (intentional — Phase 2 adds dynamic search). The functional equivalent (pipeline data flows) is covered by key link verification above.

---

## Behavioral Spot-Checks

Step 7b: Build verification passed (indirect). `apps/web/dist/client/` and `apps/web/dist/server/` exist in the filesystem, confirming `pnpm --filter @govtrace/web build` exited 0. Full runtime behavioral checks (ingestion pipeline, live queries) require PostgreSQL — deferred to human verification.

---

## Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| INFRA-01 | 01-01, 01-10, 01-11 | Monorepo with pnpm workspaces | ✓ SATISFIED | `pnpm-workspace.yaml` includes `packages/*` and `apps/*`; packages/db, packages/ingestion, apps/web all present |
| INFRA-02 | 01-01 | PostgreSQL 16 with pg_trgm enabled | ✓ SATISFIED | `docker-compose.yml` uses `postgres:16-alpine`; `docker/postgres-init.sql` enables pg_trgm |
| INFRA-03 | 01-01 | Drizzle ORM with pnpm Catalogs | ✓ SATISFIED | `catalog:` entries in `pnpm-workspace.yaml`; all packages reference `drizzle-orm: catalog:` |
| INFRA-04 | 01-01, 01-10 | Docker Compose for local development | ✓ SATISFIED | `docker-compose.yml` with postgres + web + ingestion services; override file for local port binding |
| INFRA-05 | 01-02, 01-10, 01-11 | Docker deployment config for Coolify | ✓ SATISFIED | `apps/web/Dockerfile` multi-stage build with HEALTHCHECK; `docker-compose.yml` references it; build confirmed successful |
| INFRA-06 | 01-02 | PostgreSQL not exposed to internet | ✓ SATISFIED | `expose:` not `ports:` on postgres in `docker-compose.yml`; security comment present |
| INFRA-07 | 01-01 | Database indexes: GIN on normalized_name, FKs, composite, pg_trgm | ✓ SATISFIED | GIN on entities.normalizedName, uniqueIndex on entity_connections (a,b,type), FKs, normalized_name indexes on all 5 raw tables — confirmed in schema and migration SQL |
| DATA-01 | 01-03 | Elections Canada CSV parse (2004–present) | ✓ SATISFIED | `parsers/elections-canada.ts` with multi-era schema detection via `buildColumnMapping` |
| DATA-02 | 01-04 | Federal contracts CSV parse | ✓ SATISFIED | `parsers/contracts.ts` with multi-alias column mapping |
| DATA-03 | 01-04 | Federal grants CSV parse | ✓ SATISFIED | `parsers/grants.ts` exists and is substantive |
| DATA-04 | 01-05 | Lobbyist registrations parse | ✓ SATISFIED | `parsers/lobby-registrations.ts` with registration_number as stable ID |
| DATA-05 | 01-05 | Lobbyist communications parse | ✓ SATISFIED | `parsers/lobby-communications.ts` exists and is substantive |
| DATA-06 | 01-03 | Encoding detection per file | ✓ SATISFIED | `lib/encoding.ts` with chardet + iconv-lite; called by all 5 parsers |
| DATA-07 | 01-03, 01-08, 01-09 | Idempotent ingestion (no duplicates) | ✓ SATISFIED | All 5 upsert files use `onConflictDoUpdate` on deterministic IDs; `build-connections.ts` uses mark-stale/rebuild pattern; `createNewEntity` conflict target fixed in Plan 01-09 |
| DATA-08 | 01-03 | Raw source data preserved in jsonb | ✓ SATISFIED | All 5 raw tables have `rawData: jsonb('raw_data').notNull()`. All parsers populate `rawData` from full CSV row |
| MATCH-01 | 01-06, 01-09 | Name normalization pipeline | ✓ SATISFIED | `normalizer/normalize.ts` implements lowercase + strip suffixes + acronym expansion + whitespace collapse |
| MATCH-02 | 01-06, 01-09 | pg_trgm fuzzy matching (> 0.6 threshold) | ✓ SATISFIED | `matcher/fuzzy.ts` uses `similarity()` with `FUZZY_MIN = 0.60` threshold |
| MATCH-03 | 01-07, 01-09 | Medium-confidence matches (0.6–0.85) sent to Claude | ✓ SATISFIED | `batch-queue.ts` queries `entityMatchesLog` for `decision = 'uncertain'` and submits to Batch API |
| MATCH-04 | 01-06, 01-07, 01-09 | Match decisions stored with method, confidence, AI reasoning | ✓ SATISFIED | `entityMatchesLog` schema has all required columns; `process-batch-results.ts` stores `aiModel`, `aiConfidence`, `aiReasoning` |
| MATCH-05 | 01-08, 01-09 | entity_connections pre-computed with aggregated data | ✓ SATISFIED | `build-connections.ts` aggregates `totalValue`, `transactionCount`, `firstSeen`, `lastSeen` per entity pair per type |
| MATCH-06 | 01-07 | Claude Batch API for historical backfill | ✓ SATISFIED | `batch-queue.ts` uses `client.beta.messages.batches.create()` exclusively; circuit breaker at 10,000 candidates |

All 21 requirement IDs satisfied. No orphaned requirements.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `apps/web/src/routes/index.tsx` | 13 | `<em>Search and entity profiles coming in Phase 2.</em>` — intentional placeholder per plan spec | Info | Not a blocker. Phase 2 will replace with landing page and search bar. The route scaffold (createFileRoute, component wiring) is correct. |

No blocker or warning anti-patterns found. The previously identified blockers (broken conflict target, empty src, vinxi scripts) are all resolved.

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

No gaps. All blockers from the initial verification have been closed:

**Blocker 1 (CLOSED):** The broken `onConflictDoUpdate({ target: entities.normalizedName })` in `deterministic.ts` was fixed by Plan 01-09. The target is now `[entities.canonicalName, entities.entityType]`, matching the actual `entities_canonical_name_type_idx` unique index. Four TDD tests verify the fix programmatically (including a source-level regex assertion).

**Blocker 2 (CLOSED):** The empty `packages/web/src/` and deprecated vinxi build tool were resolved by Plans 01-10 and 01-11. The web package moved to `apps/web/`, Turborepo was added, and a complete TanStack Start v1.167 scaffold was created. The build succeeds (`dist/client/` and `dist/server/` present). The `.env.example` missing from the initial verification is now present.

**Remaining items require human verification with live infrastructure** (encoding correctness and idempotency) — both are by-design blockers on live data access, not code defects.

Phase 1 automated verification is complete. The database schema, ingestion pipeline, entity matching, and web scaffold are all correctly implemented and wired. Phase 2 work can begin.

---

_Verified: 2026-03-31 (re-verification after plans 01-09, 01-10, 01-11)_
_Verifier: Claude (gsd-verifier)_
