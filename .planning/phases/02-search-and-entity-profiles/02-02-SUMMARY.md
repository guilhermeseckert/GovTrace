---
phase: 02-search-and-entity-profiles
plan: "02"
subsystem: api
tags: [tanstack-start, drizzle-orm, pg_trgm, zod, server-functions]

# Dependency graph
requires:
  - phase: 01-data-foundation
    provides: "@govtrace/db schema (entities, donations, contracts, grants, lobbyRegistrations), getDb() client"
provides:
  - "searchEntities server function: paginated pg_trgm similarity search with type/province/date filters and per-entity dataset counts"
  - "getAutocomplete server function: fast pg_trgm % operator query returning max 8 suggestions"
  - "getPlatformStats server function: parallel count queries across all 5 source tables"
  - "GET /api/search HTTP route for external consumers"
  - "GET /api/stats HTTP route for external consumers"
affects: [search-results-page, landing-page, entity-profile, external-api-consumers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TanStack Start server functions using .validator() with zod for input validation"
    - "pg_trgm % operator in raw SQL via db.execute(sql`...`) for GIN index utilization"
    - "createAPIFileRoute for external HTTP routes wrapping server functions"

key-files:
  created:
    - apps/web/src/server-fns/search.ts
    - apps/web/src/server-fns/stats.ts
    - apps/web/src/routes/api/search.ts
    - apps/web/src/routes/api/stats.ts
  modified: []

key-decisions:
  - "lobbyRegistrations uses lobbyistEntityId and clientEntityId (not entityId) — lobby count uses OR condition across both FK columns"
  - "API routes use createAPIFileRoute (not createFileRoute) so they do not appear in routeTree.gen.ts — this is correct TanStack Start behavior for HTTP-only endpoints"
  - "lobbying count in searchEntities counts lobbyRegistrations rows where entity appears as either lobbyist or client — captures full lobbying footprint"

patterns-established:
  - "Pattern: Server functions use .validator((data: unknown) => Schema.parse(data)) — not .inputValidator()"
  - "Pattern: pg_trgm % operator requires db.execute(sql`...`) because Drizzle ORM has no direct binding for the % operator"
  - "Pattern: getEntityCounts loops with Promise.all per entity for parallel count queries"

requirements-completed: [SRCH-01, SRCH-02, SRCH-03, SRCH-04, SRCH-05, API-01, API-11]

# Metrics
duration: 5min
completed: 2026-04-02
---

# Phase 02 Plan 02: Search and Stats Server Functions Summary

**pg_trgm-powered searchEntities/getAutocomplete server functions with per-entity dataset counts plus getPlatformStats and external GET /api/search, /api/stats HTTP routes**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-02T00:55:40Z
- **Completed:** 2026-04-02T01:02:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- searchEntities server function: paginated pg_trgm fuzzy search across entities table with type, province, and date range filters; per-entity counts for donations, contracts, grants, and lobbying (via lobbyRegistrations)
- getAutocomplete server function: fast pg_trgm % operator query using GIN index, max 8 results, no count overhead
- getPlatformStats server function: parallel Promise.all count queries across all 5 source tables (entities, donations, contracts, grants, lobbyRegistrations)
- External HTTP routes GET /api/search and GET /api/stats via createAPIFileRoute for non-browser consumers

## Task Commits

Each task was committed atomically:

1. **Task 1: Search and autocomplete server functions** - `197db29` (feat)
2. **Task 2: Stats server function + external API routes** - `271bcb0` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified

- `apps/web/src/server-fns/search.ts` - searchEntities and getAutocomplete server functions with pg_trgm queries
- `apps/web/src/server-fns/stats.ts` - getPlatformStats server function with parallel counts + PlatformStats type
- `apps/web/src/routes/api/search.ts` - GET /api/search HTTP route wrapping searchEntities
- `apps/web/src/routes/api/stats.ts` - GET /api/stats HTTP route wrapping getPlatformStats

## Decisions Made

- **lobbyRegistrations FK columns:** The schema uses `lobbyistEntityId` and `clientEntityId` rather than a single `entityId`. The lobbying count in searchEntities uses an OR condition across both FK columns to capture all lobbying activity for an entity regardless of role (lobbyist or client).
- **API route behavior:** createAPIFileRoute routes do not appear in routeTree.gen.ts — this is correct TanStack Start v1.167 behavior. The router only tracks page routes; API routes are handled separately by the Vite plugin. The build warning ("If this file is not intended to be a route...") is expected and non-fatal.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected lobbyRegistrations entity FK columns**
- **Found during:** Task 1 (Search and autocomplete server functions)
- **Issue:** Plan template assumed `lobbyRegistrations.entityId` but the actual schema exports `lobbyistEntityId` and `clientEntityId` (lobby entities appear in two roles). Using a non-existent column would cause a runtime error.
- **Fix:** Added `or(eq(lobbyistEntityId, id), eq(clientEntityId, id))` in getEntityCounts, imported `or` from drizzle-orm.
- **Files modified:** apps/web/src/server-fns/search.ts
- **Verification:** Build passes with correct column references.
- **Committed in:** 197db29 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — incorrect FK column assumption in plan template)
**Impact on plan:** Essential correctness fix. No scope creep.

## Issues Encountered

None beyond the FK column correction above.

## Known Stubs

None — all server functions return real database query results. No hardcoded empty values or placeholder text.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- searchEntities and getAutocomplete are ready for use in search results page (Plan 03) and landing page hero search bar
- getPlatformStats is ready for use in landing page StatChips component
- GET /api/search and GET /api/stats are live for external API consumers
- No blockers for Phase 02 continuation plans

---
*Phase: 02-search-and-entity-profiles*
*Completed: 2026-04-02*
