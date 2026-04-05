---
phase: 06-debt-vs-spending-dashboard
plan: 01
subsystem: data-layer
tags: [fiscal, ingestion, statistics-canada, server-functions, drizzle, schema]
dependency_graph:
  requires: [Phase 05 international_aid table populated]
  provides: [fiscal_snapshots table, runFiscalIngestion, getDebtTimeline, getDepartmentBreakdown, getDebtHeroStats, FEDERAL_ELECTION_DATES]
  affects: [apps/web dashboard page (Plan 02), ingestion scheduler]
tech_stack:
  added: []
  patterns: [createServerFn GET handler, Drizzle insert.onConflictDoUpdate, Stats Canada WDS REST API, adm-zip extraction, papaparse CSV parsing]
key_files:
  created:
    - packages/db/drizzle/0001_regular_valeria_richards.sql
    - apps/ingestion/src/downloaders/fiscal.ts
    - apps/ingestion/src/parsers/fiscal.ts
    - apps/ingestion/src/upsert/fiscal.ts
    - apps/ingestion/src/runners/ingest-fiscal.ts
    - apps/web/src/lib/constants/elections.ts
    - apps/web/src/server-fns/dashboard.ts
  modified:
    - packages/db/src/schema/raw.ts
decisions:
  - SHA256(series + refDate) as fiscal_snapshots primary key for idempotent re-ingestion
  - Filter StatsCan CSV to only accumulated_deficit and federal_net_debt series (avoids 29+ mixed series, Research Pitfall 1)
  - SCALAR_FACTOR normalisation to millions CAD in parser layer (not query layer)
  - Annual debt uses latest-month-per-year subquery to handle partial-year data (Research Pitfall 4)
  - FEDERAL_ELECTION_DATES hardcoded as TypeScript const — no DB table needed for immutable historical data
metrics:
  duration: "~8 minutes"
  completed: "2026-04-05T03:19:45Z"
  tasks: 2
  files: 8
---

# Phase 06 Plan 01: Fiscal Data Layer — Summary

**One-liner:** Statistics Canada WDS ingestion pipeline + three createServerFn handlers providing typed debt/aid/department data for the dashboard page.

## What Was Built

### Task 1: Schema + Ingestion Pipeline

**fiscalSnapshots table** added to `packages/db/src/schema/raw.ts` with columns: `id` (SHA256 PK), `series`, `ref_date`, `value_millions_cad`, `source_table`, `source_url`, `ingested_at`. Two indexes: unique composite on (series, ref_date) and a standalone ref_date index.

**Drizzle migration** generated at `packages/db/drizzle/0001_regular_valeria_richards.sql`.

**Downloader** (`apps/ingestion/src/downloaders/fiscal.ts`): calls the WDS envelope endpoint to get the ZIP URL, downloads the ZIP, extracts the data CSV (the entry ending in `-eng.csv` excluding `_MetaData`), computes SHA-256 hash, writes to disk.

**Parser** (`apps/ingestion/src/parsers/fiscal.ts`): uses papaparse to parse the StatsCan long-format CSV, filters rows where `Central government debt` column matches `'A. Federal debt (accumulated deficit)'` or `'B. Net debt'`, normalises SCALAR_FACTOR to millions CAD, derives deterministic SHA-256 IDs.

**Upsert** (`apps/ingestion/src/upsert/fiscal.ts`): batch-upserts in groups of 500 using `onConflictDoUpdate` on the primary key. Returns total count processed.

**Runner** (`apps/ingestion/src/runners/ingest-fiscal.ts`): mirrors `runInternationalAidIngestion` exactly — creates an `ingestion_runs` record, downloads, parses, upserts, updates run status on success or failure.

### Task 2: Server Functions + Election Constants

**`FEDERAL_ELECTION_DATES`** (`apps/web/src/lib/constants/elections.ts`): 11 elections from 35th (1993) to 45th (2025), typed `as const`, with `election`, `date`, `year`, and `winner` fields.

**`getDebtTimeline`**: queries `fiscal_snapshots` for the latest debt value per year (using a correlated subquery to get the most recent month, avoiding partial-year dips), queries `international_aid` for annual committed/disbursed totals, joins by calendar year, returns `DebtAidDataPoint[]`.

**`getDepartmentBreakdown`**: raw SQL `GROUP BY funding_department` on `international_aid`, computes `pctOfTotal` as each department's share of grand total, returns `DeptSpendingRow[]` ordered by committed DESC.

**`getDebtHeroStats`**: latest accumulated deficit from `fiscal_snapshots`, total all-time aid committed from `international_aid`, computes `aidAsPercentOfDebt`, returns `DebtHeroStats` with source URLs for DEBT-04 traceability.

## Deviations from Plan

None — plan executed exactly as written.

The pre-existing TS5097 errors (`allowImportingTsExtensions`) across the ingestion package are project-wide and pre-date this plan. All new files compile cleanly with no new TypeScript errors.

## Known Stubs

None. This plan is a pure data layer — no UI rendering and no hardcoded placeholders. The `fiscal_snapshots` table will be empty until `runFiscalIngestion()` is executed against a live database; the `getDebtTimeline` and `getDebtHeroStats` server functions will return empty arrays / zero values until then. This is expected and correct — the UI (Plan 02) handles empty-state gracefully.

## Self-Check: PASSED

- packages/db/src/schema/raw.ts — fiscalSnapshots table appended: VERIFIED
- packages/db/drizzle/0001_regular_valeria_richards.sql — migration file exists: VERIFIED
- apps/ingestion/src/downloaders/fiscal.ts — created: VERIFIED
- apps/ingestion/src/parsers/fiscal.ts — created: VERIFIED
- apps/ingestion/src/upsert/fiscal.ts — created: VERIFIED
- apps/ingestion/src/runners/ingest-fiscal.ts — created: VERIFIED
- apps/web/src/lib/constants/elections.ts — 11 entries as const: VERIFIED
- apps/web/src/server-fns/dashboard.ts — 3 server functions + 3 exported types: VERIFIED
- Commit 76397cf (Task 1): VERIFIED
- Commit 1001819 (Task 2): VERIFIED
