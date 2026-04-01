---
phase: 01-data-foundation
plan: 09
subsystem: database
tags: [drizzle-orm, postgresql, entity-matching, upsert, unique-constraint]

# Dependency graph
requires:
  - phase: 01-data-foundation
    provides: entities table schema with uniqueIndex('entities_canonical_name_type_idx') on (canonical_name, entity_type)
provides:
  - Fixed createNewEntity with correct onConflictDoUpdate target matching actual unique index
  - Entity matching pipeline no longer crashes on every entity creation attempt
affects:
  - matching pipeline (deterministic, fuzzy, ai-verify)
  - ingestion runners that call createNewEntity

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Drizzle onConflictDoUpdate target must be an array of columns matching an existing uniqueIndex

key-files:
  created:
    - packages/ingestion/src/matcher/deterministic.test.ts
  modified:
    - packages/ingestion/src/matcher/deterministic.ts

key-decisions:
  - "onConflictDoUpdate conflict target must match the composite uniqueIndex (canonical_name, entity_type) — not normalized_name which only has a GIN index for pg_trgm search"
  - "set clause on conflict updates normalizedName (in case normalization logic changed) since canonicalName and entityType are already correct by definition of the conflict"

patterns-established:
  - "Pattern: When using Drizzle onConflictDoUpdate with composite indexes, target must be an array [col1, col2] matching the exact uniqueIndex definition"

requirements-completed:
  - DATA-07
  - MATCH-01
  - MATCH-02
  - MATCH-03
  - MATCH-04
  - MATCH-05

# Metrics
duration: 3min
completed: 2026-03-31
---

# Phase 01 Plan 09: Fix createNewEntity onConflictDoUpdate Conflict Target Summary

**Fixed Drizzle onConflictDoUpdate target from non-existent `entities.normalizedName` unique constraint to composite `[entities.canonicalName, entities.entityType]` matching the actual `entities_canonical_name_type_idx` unique index**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-01T22:26:51Z
- **Completed:** 2026-04-01T22:29:30Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments

- Removed broken `target: entities.normalizedName` conflict target that caused PostgreSQL runtime error "there is no unique or exclusion constraint matching the ON CONFLICT specification"
- Added correct composite `target: [entities.canonicalName, entities.entityType]` matching the `entities_canonical_name_type_idx` unique index
- Updated `set` clause to update `normalizedName` on conflict (meaningful update — canonicalName and entityType are already identical on conflict)
- Added 4 TDD tests verifying the correct conflict target and schema structure

## Task Commits

1. **RED — Failing tests** - `fa11181` (test)
2. **GREEN — Apply fix** - `6932ab5` (fix)

**Plan metadata:** (created in this step)

_Note: TDD task had two commits (test → fix)_

## Files Created/Modified

- `packages/ingestion/src/matcher/deterministic.ts` - Fixed onConflictDoUpdate target (line 85)
- `packages/ingestion/src/matcher/deterministic.test.ts` - 4 TDD tests verifying conflict target and schema

## Decisions Made

- **Conflict target**: Use `[entities.canonicalName, entities.entityType]` — the only unique index on the entities table; `normalized_name` only has a GIN index for pg_trgm fuzzy search, not a unique constraint
- **Set clause**: Update `normalizedName` on conflict instead of `canonicalName` — when a conflict fires, the canonical name and type are already identical; updating normalizedName handles the case where normalization logic changed since the entity was first created

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript `TS5097` errors across the ingestion package (`allowImportingTsExtensions` not enabled in tsconfig) — not introduced by this plan, not in scope to fix. The specific file changed (`deterministic.ts`) has no errors beyond this pre-existing project-wide configuration issue.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Entity creation pipeline unblocked — `createNewEntity` will no longer crash with PostgreSQL constraint errors
- MATCH-01 through MATCH-05 requirements unblocked
- All 28 tests pass in the ingestion package

## Self-Check: PASSED

- `packages/ingestion/src/matcher/deterministic.ts` — FOUND
- `packages/ingestion/src/matcher/deterministic.test.ts` — FOUND
- `.planning/phases/01-data-foundation/01-09-SUMMARY.md` — FOUND
- Commit `fa11181` (RED: failing tests) — FOUND
- Commit `6932ab5` (GREEN: apply fix) — FOUND

---
*Phase: 01-data-foundation*
*Completed: 2026-03-31*
