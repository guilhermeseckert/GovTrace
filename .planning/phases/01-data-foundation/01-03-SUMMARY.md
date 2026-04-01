---
phase: 01-data-foundation
plan: 03
subsystem: ingestion
tags: [elections-canada, csv, encoding, chardet, iconv-lite, adm-zip, papaparse, drizzle, postgresql, sha256, idempotent]

# Dependency graph
requires:
  - phase: 01-data-foundation plan 01
    provides: packages/db with donations table, ingestionRuns table, getDb client
provides:
  - packages/ingestion/src/lib/encoding.ts — detectAndTranscode for chardet + iconv-lite encoding detection
  - packages/ingestion/src/lib/hash.ts — deriveSourceKey SHA-256 deterministic key generator
  - packages/ingestion/src/downloaders/elections-canada.ts — ZIP download + CSV extraction
  - packages/ingestion/src/parsers/elections-canada-schemas.ts — COLUMN_ALIASES + buildColumnMapping
  - packages/ingestion/src/parsers/elections-canada.ts — header-driven multi-era parser
  - packages/ingestion/src/upsert/donations.ts — idempotent ON CONFLICT DO UPDATE upserts
  - packages/ingestion/src/runners/elections-canada.ts — complete ingestion pipeline with audit log
affects: [01-data-foundation-plan-04, 01-data-foundation-plan-05, entity-matching]

# Tech tracking
tech-stack:
  added: [vitest, adm-zip, chardet, iconv-lite]
  patterns:
    - encoding-detection-before-parse: All CSVs use detectAndTranscode before parsing (D-11)
    - header-driven-schema: CSV columns mapped by header name, never by position (Pitfall 3)
    - deterministic-ids: SHA-256 of source fields for all table primary keys (D-08)
    - idempotent-upsert: INSERT ON CONFLICT DO UPDATE as canonical write pattern (DATA-07)
    - audit-log-runner: ingestionRuns record created at start, updated to completed/failed at end

key-files:
  created:
    - packages/ingestion/src/lib/encoding.ts
    - packages/ingestion/src/lib/encoding.test.ts
    - packages/ingestion/src/lib/hash.ts
    - packages/ingestion/src/lib/hash.test.ts
    - packages/ingestion/src/downloaders/elections-canada.ts
    - packages/ingestion/src/parsers/elections-canada-schemas.ts
    - packages/ingestion/src/parsers/elections-canada.ts
    - packages/ingestion/src/upsert/donations.ts
    - packages/ingestion/src/runners/elections-canada.ts
  modified:
    - pnpm-workspace.yaml (added vitest, adm-zip, @types/adm-zip to catalog)
    - packages/ingestion/package.json (added vitest, adm-zip to deps, test scripts)

key-decisions:
  - "vitest added as test framework (not in stack prior); minimal footprint, ESM-native, works with tsx"
  - "adm-zip used for ZIP extraction; added to catalog alongside @types/adm-zip"
  - "deriveSourceKey normalizes fields via toLowerCase/trim before hashing — consistent key regardless of minor whitespace variation"
  - "sourceFileHash.slice(0, 8) included in ID derivation to scope keys to source file context, preventing cross-file ID collisions for identical-looking rows"

patterns-established:
  - "Encoding detection pattern: read raw buffer → chardet.detect → iconv.decode → strip BOM — used for all 5 source CSVs"
  - "Hash key pattern: deriveSourceKey([...ordered fields]) → 64-char hex — used for all 5 source tables"
  - "Multi-era schema pattern: COLUMN_ALIASES + buildColumnMapping — applies to contracts/grants/lobby parsers in Plan 04-05"
  - "Runner pattern: insert ingestionRuns → try(download→parse→upsert→update completed) → catch(update failed) — identical structure for all 5 runners"

requirements-completed: [DATA-01, DATA-06, DATA-07, DATA-08]

# Metrics
duration: 5min
completed: 2026-03-31
---

# Phase 01 Plan 03: Elections Canada Ingestion Pipeline Summary

**Elections Canada donation ingestion pipeline with chardet encoding detection, SHA-256 deterministic keys, header-driven multi-era CSV schema mapping, and idempotent ON CONFLICT DO UPDATE upserts**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-01T04:15:50Z
- **Completed:** 2026-04-01T04:21:09Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Shared encoding library (detectAndTranscode) handles ISO-8859-1, Windows-1252, UTF-8, and BOM-prefixed files — French characters like "Montréal" render correctly in the database
- Deterministic key library (deriveSourceKey) produces stable 64-char SHA-256 hex IDs from source fields — re-running ingestion on the same file produces identical record counts
- Elections Canada parser maps CSV columns by header name across all eras using COLUMN_ALIASES — pre-2015 schema differences handled without special-casing or index access
- Complete ingestion runner: download ZIP → detect encoding → parse → upsert → audit log in ingestion_runs table

## Task Commits

Each task was committed atomically:

1. **Task 1: Build shared encoding detection and hash key libraries** - `94c1678` (feat)
2. **Task 2: Build Elections Canada downloader and multi-era CSV parser** - `af0eca5` (feat)
3. **Task 3: Build idempotent donations upsert and wire ingestion runner** - `4f8d4d4` (feat)

## Files Created/Modified

- `packages/ingestion/src/lib/encoding.ts` — detectAndTranscode: chardet + iconv-lite, BOM stripping
- `packages/ingestion/src/lib/encoding.test.ts` — 5 tests: ISO-8859-1 Montréal, UTF-8, Windows-1252, BOM strip, encoding string return
- `packages/ingestion/src/lib/hash.ts` — deriveSourceKey: SHA-256 of pipe-joined normalized fields
- `packages/ingestion/src/lib/hash.test.ts` — 4 tests: determinism, order-sensitivity, empty strings, 64-char hex
- `packages/ingestion/src/downloaders/elections-canada.ts` — fetch() ZIP, adm-zip extraction, SHA-256 file hash
- `packages/ingestion/src/parsers/elections-canada-schemas.ts` — COLUMN_ALIASES (5-7 variants per field), buildColumnMapping
- `packages/ingestion/src/parsers/elections-canada.ts` — streaming parse, header-driven column mapping, deterministic IDs
- `packages/ingestion/src/upsert/donations.ts` — BATCH_SIZE=1000, INSERT ON CONFLICT DO UPDATE
- `packages/ingestion/src/runners/elections-canada.ts` — full pipeline with ingestionRuns audit log
- `pnpm-workspace.yaml` — added vitest, adm-zip, @types/adm-zip to catalog
- `packages/ingestion/package.json` — added test scripts, vitest/adm-zip devDependencies

## Decisions Made

- Used vitest as test framework — ESM-native, zero config with the existing TypeScript setup, minimal catalog addition
- adm-zip chosen for ZIP extraction over built-in zlib streams — simpler API for extracting specific files from ZIP archives
- `deriveSourceKey` normalizes fields (trim + toLowerCase) before hashing to ensure minor whitespace variations don't create duplicate records
- Included `sourceFileHash.slice(0, 8)` in the donation ID derivation to scope identical-looking rows to their source file

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added vitest as test framework for TDD tasks**
- **Found during:** Task 1 setup (TDD RED phase)
- **Issue:** Plan required TDD but no test framework existed in the project
- **Fix:** Added vitest to pnpm catalog and ingestion devDependencies; added test/test:watch scripts
- **Files modified:** pnpm-workspace.yaml, packages/ingestion/package.json
- **Verification:** `pnpm --filter @govtrace/ingestion test` runs 9 tests and passes
- **Committed in:** 94c1678 (Task 1 commit)

**2. [Rule 3 - Blocking] Added adm-zip for ZIP extraction**
- **Found during:** Task 2 (Elections Canada downloader)
- **Issue:** Plan specified adm-zip but it was not in pnpm catalog or installed
- **Fix:** Added adm-zip and @types/adm-zip to catalog; added adm-zip as dependency in ingestion package
- **Files modified:** pnpm-workspace.yaml, packages/ingestion/package.json
- **Verification:** Import resolves, TypeScript compiles
- **Committed in:** af0eca5 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes were infrastructure prerequisites for the plan's code to compile and run. No scope creep.

## Issues Encountered

- encoding.ts and hash.ts already existed as uncommitted files when Task 1 began — they matched the spec exactly and tests passed immediately (GREEN without explicit RED phase). The files were from a prior interrupted session. Committed as-is since implementation is correct.

## User Setup Required

None - no external service configuration required. `pnpm ingest elections-canada` requires a running PostgreSQL instance with `DATABASE_URL` set.

## Next Phase Readiness

- Encoding and hash libraries are shared utilities ready for Plans 04-05 (contracts/grants/lobby parsers)
- Multi-era schema pattern (COLUMN_ALIASES + buildColumnMapping) established — apply same pattern for contracts and grants CSVs
- Runner pattern established — identical structure for all remaining 4 sources
- `pnpm ingest elections-canada` is ready to run against a live database

---
*Phase: 01-data-foundation*
*Completed: 2026-03-31*
