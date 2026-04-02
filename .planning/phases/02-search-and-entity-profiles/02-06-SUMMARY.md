---
phase: 02-search-and-entity-profiles
plan: 06
subsystem: ui
tags: [tanstack-table, react-query, shadcn, tailwind, typescript, drizzle]

requires:
  - phase: 02-search-and-entity-profiles
    provides: ProfileTabs slot props (Plan 05), dataset server functions with manualPagination shape (Plan 04)
  - phase: 01-data-foundation
    provides: Raw schema tables (donations, contracts, grants, lobbyRegistrations, lobbyCommunications) with ingestedAt column

provides:
  - Five DataTable components: DonationsTable, ContractsTable, GrantsTable, LobbyingTable, ConnectionsTable
  - TanStack Table v8 server-side pagination pattern with manualPagination and manualSorting
  - getEntityProvenance server function with parallel max(ingestedAt) per dataset
  - Per-dataset provenance footer with Open Government Licence attribution
  - Mobile card collapse pattern (hidden md:block / md:hidden) for all tables

affects:
  - 02-07 (FlagModal plan — uses entity route which now has all tables wired)
  - Phase 03 (visualizations — connections data now exposed via ConnectionsTable)

tech-stack:
  added: []
  patterns:
    - "TanStack Table v8 manualPagination + manualSorting pattern for server-paginated tables"
    - "SortableHeader sub-component extracted to avoid inline JSX duplication"
    - "getLobbying returns nested { registrations, communications } — LobbyingTable merges into unified LobbyRow array before passing to useReactTable"
    - "getEntityProvenance uses Drizzle max() aggregation in parallel Promise.all across 5 tables"

key-files:
  created:
    - apps/web/src/components/tables/DonationsTable.tsx
    - apps/web/src/components/tables/ContractsTable.tsx
    - apps/web/src/components/tables/GrantsTable.tsx
    - apps/web/src/components/tables/LobbyingTable.tsx
    - apps/web/src/components/tables/ConnectionsTable.tsx
  modified:
    - apps/web/src/server-fns/entity.ts
    - apps/web/src/routes/entity/$id.tsx

key-decisions:
  - "LobbyingTable merges getLobbying's nested { registrations, communications } response into a flat LobbyRow[] before useReactTable — avoids dual-table pagination complexity"
  - "getEntityProvenance uses Drizzle max() (not raw SQL) for type-safe ingestedAt aggregation per dataset"
  - "ContractsTable constructs buyandsell.gc.ca fallback URL from contractId when rawData.source_url absent"
  - "ConnectionsTable uses TanStack Link not <a> for /entity/:id navigation to preserve router state"
  - "getEntityProvenance added to entity route loader in parallel Promise.all — not a lazy client-side fetch"

patterns-established:
  - "SortableHeader: reusable sub-component inside each table file (not shared) — avoids barrel file prohibition"
  - "Mobile card view: md:hidden div mirrors desktop table columns as stacked key/value pairs"
  - "Pagination controls: rows-per-page Select on left, page counter + Prev/Next on right"
  - "Source URL resolution: rawData fields first, then constructed government URL fallback, then null (no dead links)"

requirements-completed: [PROF-03, PROF-04, PROF-05, PROF-06]

duration: 4min
completed: 2026-03-31
---

# Phase 02 Plan 06: Data Tables Summary

**Five TanStack Table v8 DataTable components with server-side pagination, CAD currency, source links, mobile card collapse, and per-dataset provenance footer wired into entity profile**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-02T01:11:37Z
- **Completed:** 2026-04-02T01:16:56Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Built DonationsTable and ContractsTable with `manualPagination: true`, `manualSorting: true`, tabular-nums CAD currency, ExternalLink source column, mobile card view
- Built GrantsTable, LobbyingTable (merging registrations + communications), ConnectionsTable (linked to /entity/:id)
- Added `getEntityProvenance` server function performing parallel `max(ingestedAt)` queries across all 5 raw dataset tables
- Wired all 5 tables into ProfileTabs slot props and replaced placeholder provenance footer with per-dataset timestamps (PROF-06)

## Task Commits

1. **Task 1: DonationsTable and ContractsTable** - `f2b30b9` (feat)
2. **Task 2: GrantsTable, LobbyingTable, ConnectionsTable, entity route wiring** - `18d27e3` (feat)

## Files Created/Modified

- `apps/web/src/components/tables/DonationsTable.tsx` - Elections Canada donations table with sortable amount/date columns, source URL from rawData
- `apps/web/src/components/tables/ContractsTable.tsx` - Federal contracts table with buyandsell.gc.ca source URL construction from contractId
- `apps/web/src/components/tables/GrantsTable.tsx` - Federal grants table (agreementDate column, program name, CAD value)
- `apps/web/src/components/tables/LobbyingTable.tsx` - Lobby table merging registrations + communications into unified row shape
- `apps/web/src/components/tables/ConnectionsTable.tsx` - Entity connections table with TanStack Link to /entity/:id, connection type badge
- `apps/web/src/server-fns/entity.ts` - Added getEntityProvenance with parallel max(ingestedAt) per dataset, added lobbyCommunications/lobbyRegistrations imports
- `apps/web/src/routes/entity/$id.tsx` - Loader fetches provenance, ProfileTabs receives all 5 table slot props, footer shows per-dataset dates

## Decisions Made

- LobbyingTable merges the nested `{ registrations, communications }` response from `getLobbying` into a flat `LobbyRow[]` array before passing to `useReactTable` — this avoids building two separate TanStack table instances with combined pagination, which is complex and hard to reason about
- `getEntityProvenance` is called in the route loader's `Promise.all` (not lazily on the client) so the provenance footer is immediately populated on page load without a client-side waterfall
- `ContractsTable.getSourceUrl()` falls back to constructing a `buyandsell.gc.ca/procurement-data/contract-history/{id}` URL when rawData has no `source_url` field — provides a useful government link even when the ingestor didn't extract one

## Deviations from Plan

None — plan executed exactly as written. The LobbyingTable merge approach was specified in the plan ("If getLobbying returns nested rows, merge for display") and the getEntityProvenance Drizzle `max()` approach matched the plan's SQL pattern.

## Issues Encountered

None — build passed on first attempt for both tasks.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All 5 entity profile tabs now show real sortable paginated data (PROF-03, PROF-04)
- Every record row has an ExternalLink source reference (PROF-05)
- Per-dataset provenance footer complete with Open Government Licence attribution (PROF-06)
- Ready for Plan 07: FlagModal wiring (entity route already imports FlagModal from previous plan run)
- Ready for Phase 03 visualizations: ConnectionsTable exposes entity graph data

---
*Phase: 02-search-and-entity-profiles*
*Completed: 2026-03-31*
