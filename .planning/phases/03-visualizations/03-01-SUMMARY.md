---
phase: 03-visualizations
plan: 01
subsystem: api
tags: [d3, d3-sankey, visualization, server-functions, react-hooks, graph, sankey, timeline]

requires:
  - phase: 02-search-and-entity-profiles
    provides: createServerFn pattern, getDb() usage, entity/connections/donations/contracts/grants/lobby schema

provides:
  - getGraphData server function (API-06): recursive CTE depth-1/2 graph traversal with 150-node cap and truncated flag
  - getMoneyFlow server function (API-07): Sankey data from donations→parties→departments via direct table queries
  - getTimeline server function (API-08): UNION across all 5 datasets ordered by date, limit 500
  - GraphResponse, MoneyFlowResponse, TimelineResponse exported TypeScript types
  - useChartColors hook: reads live CSS vars at call time for D3 dark/light mode colors
  - useResizeObserver hook: ResizeObserver wrapper returning responsive {width, height} dimensions
  - d3@7.9.0, d3-sankey@0.12.3, @types/d3@7.4.3 installed in apps/web
  - en.viz.* i18n keys (graph, sankey, timeline, tabs)

affects: [03-02, 03-03, 03-04, NetworkGraph, MoneyFlowSankey, ActivityTimeline]

tech-stack:
  added:
    - d3@7.9.0
    - d3-sankey@0.12.3
    - "@types/d3@7.4.3 (devDependency)"
  patterns:
    - db.execute(sql`WITH RECURSIVE ... CYCLE`) for graph traversal (Drizzle has no WITH RECURSIVE)
    - Array.from(db.execute<T>()) to iterate RowList results (postgres RowList is array-like, not { rows })
    - useCallback wrapping for getColor in useChartColors to avoid re-creating function on every render
    - CYCLE clause for PostgreSQL 14+ cycle detection in bidirectional graph CTEs

key-files:
  created:
    - apps/web/src/server-fns/visualizations.ts
    - apps/web/src/components/visualizations/shared/useChartColors.ts
    - apps/web/src/components/visualizations/shared/useResizeObserver.ts
  modified:
    - apps/web/package.json
    - apps/web/src/i18n/en.ts

key-decisions:
  - "Array.from(db.execute<T>()) instead of .rows — postgres RowList<T[]> IS the array (extends T[]), no .rows property"
  - "db.execute(sql`...`) with raw SQL for recursive CTEs — Drizzle has no WITH RECURSIVE support (issue #209)"
  - "Two-query approach for getMoneyFlow: donations grouped by recipientName, then contracts grouped by department for resolved party entities — entity_connections alone cannot satisfy Pitfall 7"
  - "max depth 2 (not 3) in getGraphData — Pitfall 3 warns depth-3 can cause CTE explosion on hub nodes with 1M+ rows"

patterns-established:
  - "Pattern: Array.from(db.execute<RowType>(...)) for iterating raw SQL results"
  - "Pattern: useChartColors with useCallback — call getColor() inside effects/renders, never at module level"
  - "Pattern: CYCLE connected_id SET is_cycle USING path in all bidirectional CTEs"

requirements-completed:
  - API-06
  - API-07
  - API-08

duration: 4min
completed: 2026-04-03
---

# Phase 03 Plan 01: Visualization Foundation Summary

**D3 v7 + d3-sankey installed; three server functions (graph/sankey/timeline) and two shared hooks established as Wave 1 foundation for all visualization components**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-03T01:47:46Z
- **Completed:** 2026-04-03T01:52:02Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Installed d3@7.9.0, d3-sankey@0.12.3, @types/d3@7.4.3 and added en.viz.* i18n keys
- Created useChartColors (CSS variable reader for D3 dark mode) and useResizeObserver (responsive dimensions hook)
- Created visualizations.ts with all three server functions exporting typed GraphResponse, MoneyFlowResponse, TimelineResponse

## Task Commits

1. **Task 1: Install D3 packages and add i18n visualization keys** - `9400d07` (chore)
2. **Task 2: Create shared visualization hooks** - `0a70404` (feat)
3. **Task 3: Create visualization server functions** - `9e3175e` (feat)

## Files Created/Modified

- `apps/web/package.json` - added d3@7.9.0, d3-sankey@0.12.3, @types/d3@7.4.3
- `apps/web/src/i18n/en.ts` - added en.viz.graph, en.viz.sankey, en.viz.timeline, en.viz.tabs keys
- `apps/web/src/components/visualizations/shared/useChartColors.ts` - reads live CSS vars with useCallback; nodeColors map for all 5 entity types
- `apps/web/src/components/visualizations/shared/useResizeObserver.ts` - ResizeObserver wrapper returning {width, height}, cleans up on unmount
- `apps/web/src/server-fns/visualizations.ts` - getGraphData, getMoneyFlow, getTimeline server functions + exported response types

## Decisions Made

- **Array.from(db.execute()) not .rows**: The postgres `RowList<T[]>` type extends `T[]` directly — it IS the array. Attempting `.rows` fails TypeScript. Use `Array.from(result)` to iterate. This pattern affects all raw SQL execute calls in this codebase.
- **Raw SQL for recursive CTE**: Drizzle ORM issue #209 (WITH RECURSIVE) is unresolved. All graph traversal uses `db.execute(sql`WITH RECURSIVE ... CYCLE`)`.
- **Two-query approach for Sankey**: Per research Pitfall 7, `entity_connections` only has `donor_to_party` and `grant_recipient_to_department` — no direct donor→contract link. getMoneyFlow queries `donations` + `contracts` tables directly, matching by entity name resolution.
- **Max depth 2**: Research Pitfall 3 warns depth-3 on hub nodes with 1M+ entity_connections rows can cause CTE explosion. Cap at 2.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed RowList.rows TypeScript error in all db.execute() calls**
- **Found during:** Task 3 (visualization server functions)
- **Issue:** Plan template used `result.rows` but postgres `RowList<T[]>` has no `.rows` property — the result IS the array
- **Fix:** Changed all `result.rows` to `Array.from(result)` throughout the file
- **Files modified:** apps/web/src/server-fns/visualizations.ts
- **Verification:** `pnpm tsc --noEmit` shows no errors in visualizations.ts
- **Committed in:** 9e3175e (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — TypeScript RowList access pattern)
**Impact on plan:** Essential fix for correctness; same pattern used in build-connections.ts confirms the codebase approach. No scope creep.

## Issues Encountered

- Recursive CTE count query required a simplified form (only `connected_id` and `depth` columns) to avoid column reference issues in the pre-check query before the main fetch.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 2 plans (03-02 NetworkGraph, 03-03 MoneyFlowSankey, 03-04 ActivityTimeline) can now import from `visualizations.ts` and use the shared hooks
- All three server functions return typed data matching the shapes documented in research API-06, API-07, API-08
- useChartColors and useResizeObserver are ready to drop into any SVG chart component

---
*Phase: 03-visualizations*
*Completed: 2026-04-03*
