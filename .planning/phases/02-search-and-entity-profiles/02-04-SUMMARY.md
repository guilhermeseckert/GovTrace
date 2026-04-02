---
phase: 02-search-and-entity-profiles
plan: "04"
subsystem: api
tags: [drizzle-orm, tanstack-start, anthropic, claude-haiku-4-5, pg-boss, server-functions, api-routes]

# Dependency graph
requires:
  - phase: 01-data-foundation
    provides: DB schema (entities, entityAliases, entityMatchesLog, aiSummaries, flags, donations, contracts, grants, lobbyRegistrations, lobbyCommunications, entityConnections)
provides:
  - getEntityProfile server function with best-alias confidence data
  - getEntityStats server function with per-dataset count badges
  - getDonations, getContracts, getGrants server-paginated functions with rawData
  - getLobbying server function (queries lobbyistEntityId/clientEntityId/officialEntityId FKs)
  - getConnections server function (bidirectional join with canonical entity names)
  - getOrGenerateSummary cache-first AI summary with claude-haiku-4-5
  - submitFlag server function with matchLogId FK support
  - POST /api/entity/:id/flag HTTP route for anonymous submissions
  - GET /api/entity/:id/summary HTTP route
  - Weekly pg-boss job marking ai_summaries stale (Sunday 22:00 UTC)
affects: [02-05, 02-06, 02-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cache-first AI summary pattern: check ai_summaries WHERE isStale=false → return; else generate via claude-haiku-4-5 → upsert"
    - "Bidirectional entity connections query: query entityAId + entityBId, join entities for canonical names"
    - "Lobby dual-FK pattern: lobbyRegistrations has lobbyistEntityId+clientEntityId, lobbyCommunications has lobbyistEntityId+officialEntityId"

key-files:
  created:
    - apps/web/src/server-fns/entity.ts
    - apps/web/src/server-fns/datasets.ts
    - apps/web/src/server-fns/summary.ts
    - apps/web/src/server-fns/flag.ts
    - apps/web/src/routes/api/entity/$id/flag.ts
    - apps/web/src/routes/api/entity/$id/summary.ts
  modified:
    - packages/ingestion/src/scheduler/jobs.ts

key-decisions:
  - "getCookie from @tanstack/react-start/server replaces getWebRequest (removed in v1.167) for SSR cookie reads"
  - "Lobbying queries use dual-FK pattern (lobbyistEntityId OR clientEntityId) — no single entityId FK on lobby tables"
  - "getConnections executes two separate paginated queries (entityAId + entityBId direction) and merges results"
  - "Weekly mark-summaries-stale job uses static import for getDb/aiSummaries (not dynamic import) — mirrors ingestion package pattern"

patterns-established:
  - "Server functions use .validator() with Zod parse — not .inputValidator()"
  - "DatasetInputSchema: entityId, page, pageSize (10-50), sortBy optional, sortDir asc|desc"
  - "All dataset functions return { rows, total, page, pageSize } shape for TanStack Table compatibility"

requirements-completed:
  - PROF-01
  - PROF-02
  - PROF-03
  - PROF-04
  - PROF-05
  - PROF-06
  - AI-01
  - AI-02
  - AI-03
  - COMM-01
  - COMM-02
  - COMM-03
  - API-02
  - API-03
  - API-04
  - API-05
  - API-12

# Metrics
duration: 6min
completed: 2026-04-02
---

# Phase 02 Plan 04: Entity Server Functions Summary

**Six server functions and two API routes providing the complete entity data layer: profile with AI confidence badge, five paginated dataset tabs, claude-haiku-4-5 AI summaries with cache-first storage, and anonymous flag submission with weekly summary staleness.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-02T00:55:40Z
- **Completed:** 2026-04-02T01:02:37Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- getEntityProfile fetches entity + best confidence alias (for AI transparency badge, AI-04) + matchLogId (for FlagModal, COMM-03)
- Five dataset server functions (getDonations, getContracts, getGrants, getLobbying, getConnections) with server-side pagination and rawData for source links (PROF-04, PROF-05)
- getOrGenerateSummary with cache-first lookup against ai_summaries, generates via claude-haiku-4-5, upserts result (AI-01, AI-02, AI-03)
- submitFlag and POST /api/entity/:id/flag for anonymous community correction submissions (COMM-01, COMM-02, COMM-03, API-12)
- Weekly pg-boss job at 22:00 UTC Sunday marks all ai_summaries stale for fresh generation after ingestion

## Task Commits

Each task was committed atomically:

1. **Task 1: Entity profile and dataset server functions** - `8d83bbd` (feat)
2. **Task 2: AI summary server function + flag server function + API routes** - `01977e5` (feat)

**Plan metadata:** (created in this step)

## Files Created/Modified

- `apps/web/src/server-fns/entity.ts` - getEntityProfile (entity + best alias + matchLogId) and getEntityStats (parallel counts)
- `apps/web/src/server-fns/datasets.ts` - getDonations, getContracts, getGrants (paginated with rawData), getLobbying (dual-FK lobby tables), getConnections (bidirectional with entity name join)
- `apps/web/src/server-fns/summary.ts` - getOrGenerateSummary, cache-first + claude-haiku-4-5 generation + upsert
- `apps/web/src/server-fns/flag.ts` - submitFlag POST server function with matchLogId support
- `apps/web/src/routes/api/entity/$id/flag.ts` - POST /api/entity/:id/flag HTTP route (201/400)
- `apps/web/src/routes/api/entity/$id/summary.ts` - GET /api/entity/:id/summary HTTP route (404 on missing)
- `packages/ingestion/src/scheduler/jobs.ts` - Added MARK_SUMMARIES_STALE job name + weekly boss.work + boss.schedule

## Decisions Made

- `getCookie` from `@tanstack/react-start/server` is the correct SSR cookie API in v1.167 — `getWebRequest` was removed and caused build failure in pre-existing theme.ts (auto-fixed)
- Lobby tables (lobbyRegistrations, lobbyCommunications) use dual-FK pattern — no single `entityId` column, queries must use OR across both FK columns
- Connections queries split into two separate paginated queries per direction for simplicity vs CTE approach; results merged in memory
- Static imports for getDb/aiSummaries in jobs.ts to mirror existing ingestion patterns (dynamic imports only for lazy runner loading)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed broken `getWebRequest` import in pre-existing theme.ts**
- **Found during:** Task 2 (build verification)
- **Issue:** `apps/web/src/server-fns/theme.ts` imported `getWebRequest` from `@tanstack/react-start/server` but this function does not exist in v1.167; `getCookie` is the correct API
- **Fix:** Replaced `getWebRequest` import + manual cookie parsing with `getCookie('theme')` — already auto-applied by the time the fix was needed (linter/autoformat had fixed it)
- **Files modified:** apps/web/src/server-fns/theme.ts
- **Verification:** Build passes with 0 errors after fix
- **Committed in:** Pre-existing file; already corrected before Task 2 commit

---

**Total deviations:** 1 auto-fixed (1 bug in pre-existing code outside plan scope but blocking build)
**Impact on plan:** Auto-fix necessary for build to pass. No scope creep.

## Issues Encountered

- Drizzle CTE approach (`db.$with`) for connections query was abandoned in favour of two separate queries — simpler and avoids potential type inference issues with chained CTEs
- `db.$count` helper does not exist on Drizzle 0.45.x — removed erroneous usage from initial lobby query draft

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Complete data layer for entity profile page is ready for UI consumption (Plans 02-05, 02-06)
- All server functions follow DatasetInputSchema shape compatible with TanStack Table manualPagination
- AI summary generation requires `ANTHROPIC_API_KEY` env var at runtime
- Build passes: `pnpm --filter @govtrace/web build` exits 0

## Self-Check: PASSED

All files verified:
- FOUND: entity.ts, datasets.ts, summary.ts, flag.ts, flag route, summary route
All commits verified:
- FOUND: 8d83bbd (Task 1), 01977e5 (Task 2)

---
*Phase: 02-search-and-entity-profiles*
*Completed: 2026-04-02*
