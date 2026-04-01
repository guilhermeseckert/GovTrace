---
phase: 01-data-foundation
plan: 08
subsystem: database
tags: [postgresql, drizzle-orm, pg-boss, entity-connections, graph, scheduler]

requires:
  - phase: 01-data-foundation plan 01
    provides: entity_connections table schema with uniqueIndex on (entityAId, entityBId, connectionType)
  - phase: 01-data-foundation plan 07
    provides: entity matching pipeline that populates entity_id on all 5 source tables

provides:
  - buildEntityConnections function that rebuilds entity_connections from all 5 source tables
  - pg-boss scheduler with correct weekly/quarterly cadences for all 5 sources plus build-connections
  - build-connections and scheduler commands in the ingestion CLI

affects:
  - phase-02-search (entity_connections is the prerequisite for all graph queries)
  - phase-03-visualizations (connection graph, Sankey diagram, network heatmap all read entity_connections)

tech-stack:
  added:
    - pg-boss (catalog ^9.0.0) — PostgreSQL-backed job queue, no Redis needed
  patterns:
    - Mark-stale/rebuild/cleanup pattern for idempotent table rebuilds (Pitfall 6)
    - ON CONFLICT DO UPDATE for idempotent inserts (DATA-07)
    - Dynamic imports in pg-boss handlers for lazy runner loading
    - SIGINT handler for graceful scheduler shutdown

key-files:
  created:
    - packages/ingestion/src/graph/build-connections.ts
    - packages/ingestion/src/scheduler/jobs.ts
  modified:
    - packages/ingestion/src/index.ts

key-decisions:
  - "Mark-stale first then rebuild prevents any window where entity_connections is empty (vs DELETE + INSERT)"
  - "All 5 connection types covered including lobbyist_client_to_official via JOIN on registration_number"
  - "Weekly Sunday cadence for elections-canada and lobbying; quarterly first-Sunday for contracts and grants"
  - "build-connections scheduled at 8am Sunday — after all Sunday ingestion jobs complete"

patterns-established:
  - "Pattern 1: Full replace via mark-stale/upsert/delete-stale — use for any pre-computed aggregate table"
  - "Pattern 2: Dynamic imports inside pg-boss handlers prevent all runners loading at scheduler startup"

requirements-completed:
  - MATCH-05
  - DATA-07

duration: 3min
completed: 2026-04-01
---

# Phase 01 Plan 08: Entity Connections Builder and Scheduler Summary

**Pre-computed entity_connections table builder with mark-stale/rebuild/cleanup pattern and pg-boss weekly/quarterly scheduler wiring all 5 ingestion sources**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-01T04:43:07Z
- **Completed:** 2026-04-01T04:45:52Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `buildEntityConnections` rebuilds entity_connections from all 5 source tables using an idempotent mark-stale/upsert/cleanup pattern — running twice on the same data produces identical rows
- All 5 connection types covered: donor_to_party, vendor_to_department, grant_recipient_to_department, lobbyist_to_official, lobbyist_client_to_official (the 5th type added beyond the plan minimum of 4)
- pg-boss scheduler registered with correct cron schedules: weekly for elections-canada and lobbying, quarterly first-Sunday for contracts and grants, build-connections at 8am Sunday after all other jobs complete
- CLI updated with `build-connections` and `scheduler` commands plus updated help text

## Task Commits

1. **Task 1: Build entity_connections table builder** - `d7bc00c` (feat)
2. **Task 2: Add pg-boss scheduler and wire CLI commands** - `3981ee6` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified

- `packages/ingestion/src/graph/build-connections.ts` - buildEntityConnections: mark-stale/upsert/delete-stale rebuild across all 5 source tables
- `packages/ingestion/src/scheduler/jobs.ts` - registerIngestionJobs: pg-boss with 6 scheduled jobs (5 sources + build-connections)
- `packages/ingestion/src/index.ts` - CLI entry point updated with build-connections and scheduler commands

## Decisions Made

- Added `lobbyist_client_to_official` connection type by joining `lobby_registrations` to `lobby_communications` via `registration_number` — the plan showed this type in the schema comments but didn't include it in the SQL samples; adding it gives complete Phase 2 graph coverage
- `mark-stale` strategy (UPDATE is_stale=true → upsert new with is_stale=false → DELETE WHERE is_stale=true) preferred over DELETE-all + INSERT because it handles the case where ON CONFLICT updates existing rows cleanly

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added lobbyist_client_to_official connection type**
- **Found during:** Task 1 (build-connections implementation)
- **Issue:** Plan SQL samples covered 4 types but the connections schema explicitly listed 5 types including `lobbyist_client_to_official`. Without this type, the graph would be incomplete for Phase 2 queries.
- **Fix:** Added a 5th SQL block that joins `lobby_communications` to `lobby_registrations` via `registration_number` to link `client_entity_id` → `official_entity_id`
- **Files modified:** packages/ingestion/src/graph/build-connections.ts
- **Verification:** All 5 connection types present and using correct ON CONFLICT pattern
- **Committed in:** d7bc00c (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Adds complete coverage of the 5th connection type explicitly listed in the schema. No scope creep — this was always part of the schema design.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required beyond the existing DATABASE_URL already needed for ingestion.

## Next Phase Readiness

Phase 1 (data-foundation) is complete. The full pipeline is now runnable end-to-end:
1. `pnpm ingest all` — ingests all 5 sources
2. `pnpm ingest build-connections` — populates entity_connections table
3. `pnpm ingest scheduler` — starts pg-boss for automated recurring runs

Phase 2 (search + entity profiles) can now build against a populated entity_connections table with aggregated relationship data ready for graph queries without runtime JOINs.

---
*Phase: 01-data-foundation*
*Completed: 2026-04-01*
