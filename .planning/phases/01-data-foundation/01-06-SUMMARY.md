---
phase: "01"
plan: "06"
subsystem: ingestion/entity-matching
tags:
  - entity-resolution
  - normalization
  - fuzzy-matching
  - pg_trgm
  - tdd
dependency_graph:
  requires:
    - "01-01: entities, entityAliases, entityMatchesLog schema tables"
    - "01-03: donations source table with contributor_name"
    - "01-04: contracts and grants source tables"
    - "01-05: lobby_registrations and lobby_communications source tables"
  provides:
    - "normalizeName() — canonical name form for all entity matching"
    - "findDeterministicMatch() — exact normalized_name lookup"
    - "findFuzzyMatches() — pg_trgm similarity candidates"
    - "runMatchingPipeline() — two-stage orchestration across all 5 source tables"
  affects:
    - "01-07: AI verification stage consumes 'uncertain' entityMatchesLog entries"
    - "01-08: entity_connections pre-computation depends on entity_id columns being populated"
tech_stack:
  added: []
  patterns:
    - "TDD Red-Green cycle for normalizer with 15 test cases"
    - "Drizzle select() instead of db.query relational API (avoids type inference issue)"
    - "postgres.RowList cast via unknown for raw SQL execute results"
    - "Iterative suffix stripping (repeat until stable) for chained suffixes"
key_files:
  created:
    - packages/ingestion/src/normalizer/strip-suffixes.ts
    - packages/ingestion/src/normalizer/acronyms.ts
    - packages/ingestion/src/normalizer/normalize.ts
    - packages/ingestion/src/normalizer/normalize.test.ts
    - packages/ingestion/src/matcher/deterministic.ts
    - packages/ingestion/src/matcher/fuzzy.ts
    - packages/ingestion/src/matcher/run-matching.ts
  modified: []
decisions:
  - "Strip only true legal registration suffixes (Inc/Ltd/Corp/Ltée) — not generic words like 'group' or 'services' or 'canada' which are meaningful parts of names"
  - "Use Drizzle select() API instead of db.query relational API — avoids type inference issue with merged schema export"
  - "Cast postgres.RowList via unknown for raw SQL execute() results — drizzle-orm with postgres-js returns array directly, not {rows:[]}"
  - "Acronym expansion applied before suffix stripping — whole-name only, not substring replacement"
metrics:
  duration: "10 minutes"
  completed_date: "2026-04-01"
  tasks_completed: 2
  files_created: 7
  files_modified: 0
---

# Phase 01 Plan 06: Entity Normalization and Two-Stage Matching Pipeline Summary

**One-liner:** Entity name normalizer with legal suffix stripping and 19 Canadian acronym expansions, plus deterministic exact-match and pg_trgm fuzzy-match pipeline using CERTAIN_THRESHOLD=0.85 and FUZZY_MIN=0.60.

## What Was Built

### Task 1: Entity Name Normalizer (TDD)

Built a three-file normalizer library with 15 test cases following TDD (RED → GREEN):

- **strip-suffixes.ts**: Strips true legal registration forms (Inc/Ltd/Corp/Ltée/etc.) only. Handles parenthetical removal `(Canada)`, leading "The/La/Le" stripping, and comma-separated suffixes. Iterates until stable to handle chained suffixes. Critical decision: excludes generic business words like "group", "services", "canada" which are meaningful name parts — initial implementation stripped them causing "Mining Association of Canada" → "Mining Association of" failure.

- **acronyms.ts**: 19 known Canadian organization acronym expansions. Applied whole-name only (not substring). Covers lobbying registry systematic inconsistencies (Pitfall 7): MAC, CBA, CFIB, CPA, CRTC, etc.

- **normalize.ts**: Unified pipeline: (1) try whole-name acronym expansion, (2) lowercase, (3) strip legal suffixes, (4) collapse whitespace. Returns empty string safely for empty/whitespace input.

**Key verification:**
- `normalizeName("CGI Group Inc.")` → `"cgi group"`
- `normalizeName("MAC")` → `"mining association of canada"`
- `normalizeName("Services de Santé Ltée")` → `"services de santé"` (French accents preserved)

### Task 2: Deterministic and Fuzzy Matchers

Three files implementing the first two stages of the three-stage entity resolution pipeline:

- **deterministic.ts**: Exact `normalized_name` match using `select().from(entities)`. On match: creates `entityAliases` record with `matchMethod='deterministic'` + `confidenceScore=1.0` and logs to `entityMatchesLog`. Also exports `createNewEntity()` with entity type inference heuristics (company indicators, department indicators, source-table defaults).

- **fuzzy.ts**: Raw SQL `similarity(normalized_name, ...)` pg_trgm query returning top 5 candidates above `FUZZY_MIN=0.60`. `CERTAIN_THRESHOLD=0.85` determines `isHighConfidence` flag. `storeHighConfidenceMatch()` stores alias + logs decision for ≥0.85 scores immediately (no AI needed).

- **run-matching.ts**: Orchestrates both stages across 7 name fields in 5 source tables. For each unmatched record: deterministic first → fuzzy second. HIGH confidence fuzzy matched immediately. MEDIUM confidence (0.60-0.84) logged as `decision='uncertain'` in `entityMatchesLog` for Plan 07 AI verification. After any match: updates source table `entity_id` and `normalized_name` columns.

**SOURCE_CONFIGS covers all 7 name fields:**
- `donations.contributor_name`
- `contracts.vendor_name`
- `grants.recipient_name`
- `lobby_registrations.lobbyist_name`
- `lobby_registrations.client_name`
- `lobby_communications.lobbyist_name`
- `lobby_communications.public_official_name`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] LEGAL_SUFFIXES list over-stripped meaningful name parts**
- **Found during:** Task 1, TDD GREEN phase — tests for "CGI Group Inc." and "Mining Association of Canada" failed
- **Issue:** Initial LEGAL_SUFFIXES included 'group', 'services', 'solutions', 'canada', 'international' — these are meaningful parts of real entity names, not legal registration forms
- **Fix:** Narrowed LEGAL_SUFFIXES to only true legal registration suffixes: Inc, Ltd, Corp, Ltée, SAS, SNC, SARL, LLP, LP
- **Files modified:** packages/ingestion/src/normalizer/strip-suffixes.ts
- **Commit:** f85c03f (included in same commit)

**2. [Rule 1 - Bug] `db.query.entities.findFirst()` TypeScript error**
- **Found during:** Task 2, TypeScript type check
- **Issue:** `getDb()` returns `ReturnType<typeof drizzle>` without schema type param, so `db.query` has type `{}` — relational API not typed
- **Fix:** Replaced `db.query.entities.findFirst()` with `db.select().from(entities).where(eq(...)).limit(1)` — works correctly and avoids relational API
- **Files modified:** packages/ingestion/src/matcher/deterministic.ts
- **Commit:** dff43c2

**3. [Rule 1 - Bug] `db.execute()` result `.rows` property doesn't exist**
- **Found during:** Task 2, TypeScript type check
- **Issue:** Drizzle with postgres-js driver returns `postgres.RowList` (which IS the array) from `execute()`, not `{rows: T[]}` — plan code used `.rows` incorrectly
- **Fix:** Cast results via `unknown` to correct array type in both fuzzy.ts and run-matching.ts
- **Files modified:** packages/ingestion/src/matcher/fuzzy.ts, packages/ingestion/src/matcher/run-matching.ts
- **Commit:** dff43c2

**4. [Rule 2 - Missing safety] `candidates[0]` possibly undefined in strict TypeScript**
- **Found during:** Task 2, TypeScript type check
- **Issue:** `candidates.length > 0` guards runtime but TypeScript strict mode requires explicit undefined guard for array element access
- **Fix:** Extracted `const top = candidates[0]` and checked `if (top !== undefined)` instead of `if (candidates.length > 0)`
- **Files modified:** packages/ingestion/src/matcher/run-matching.ts
- **Commit:** dff43c2

## Test Results

All 24 tests pass:
- `src/normalizer/normalize.test.ts` — 15 tests (all passing)
- `src/lib/hash.test.ts` — 4 tests (pre-existing, unaffected)
- `src/lib/encoding.test.ts` — 5 tests (pre-existing, unaffected)

## Known Stubs

None — all functionality is fully implemented. The pipeline is designed to run against a live database; no hardcoded mock data flows to any output.

## Commits

| Hash | Message |
|------|---------|
| 10fbf5a | test(01-06): add failing tests for entity name normalizer |
| f85c03f | feat(01-06): implement entity name normalizer with suffix stripping and acronym expansion |
| dff43c2 | feat(01-06): build deterministic and fuzzy matchers with entity creation |

## Self-Check: PASSED

All 7 created files confirmed present on disk. All 3 task commits confirmed in git log.
