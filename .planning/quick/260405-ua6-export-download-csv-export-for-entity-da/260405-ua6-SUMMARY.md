---
phase: quick
plan: 260405-ua6
subsystem: web/export
tags: [csv-export, data-tables, journalist-tools, accessibility]
dependency_graph:
  requires: []
  provides: [csv-export-utility, download-csv-button]
  affects: [DonationsTable, ContractsTable, GrantsTable, LobbyingTable, AidTable, VotesTable, ConnectionsTable, search-route]
tech_stack:
  added: []
  patterns: [blob-download, rfc4180-csv, bom-prefix-excel-compat]
key_files:
  created:
    - apps/web/src/lib/csv-export.ts
    - apps/web/src/components/tables/DownloadCSVButton.tsx
  modified:
    - apps/web/src/i18n/en.ts
    - apps/web/src/server-fns/datasets.ts
    - apps/web/src/components/tables/DonationsTable.tsx
    - apps/web/src/components/tables/ContractsTable.tsx
    - apps/web/src/components/tables/GrantsTable.tsx
    - apps/web/src/components/tables/LobbyingTable.tsx
    - apps/web/src/components/tables/AidTable.tsx
    - apps/web/src/components/tables/VotesTable.tsx
    - apps/web/src/components/tables/ConnectionsTable.tsx
    - apps/web/src/routes/search.tsx
decisions:
  - "pageSize max raised from 50 to 10000 on DatasetInputSchema to support bulk CSV exports without a separate endpoint"
  - "VotingRecordInputSchema gets optional pageSize param (default 25) so existing VotesTable pagination is unaffected while exports can request 10000 rows"
  - "LobbyingTable fetchAllRows merges registrations + communications into a single flat array matching the existing LobbyRow pattern"
  - "BOM prefix added to CSV output for Excel/Numbers compatibility with French characters in government data"
metrics:
  duration: "242s"
  completed: "2026-04-05"
  tasks_completed: 2
  files_modified: 10
---

# Phase quick Plan 260405-ua6: CSV Export for Entity Data Tables Summary

CSV export added to all 7 entity data table tabs and the search results page, fetching all records client-side via server functions with pageSize 10000, converting to RFC 4180 CSV with BOM prefix, and triggering a browser download.

## What Was Built

- `objectsToCsv()` utility: RFC 4180-compliant CSV generation with BOM prefix for Excel/French character compatibility. Accepts optional column definitions for custom header names and ordering. Excludes `rawData` and `id` by default.
- `downloadCsv()` utility: Blob/object URL browser download trigger with cleanup.
- `DownloadCSVButton` component: Reusable outline button with Download icon, Loader2 spinner during fetch, aria-label, and try/catch error handling.
- All 7 data tables (Donations, Contracts, Grants, Lobbying, Aid, Votes, Connections) have a right-aligned Download CSV button with human-readable column headers.
- Search results page has a Download CSV button visible when results exist, exporting the current result list.
- `datasets.ts` DatasetInputSchema pageSize max raised from 50 to 10000.
- `VotingRecordInputSchema` gets optional `pageSize` param; handler uses `data.pageSize ?? PAGE_SIZE` for backward compatibility.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 0c12da4 | feat(quick-260405-ua6): add CSV export utility and DownloadCSVButton component |
| Task 2 | bfde843 | feat(quick-260405-ua6): wire DownloadCSVButton into all 7 data tables and search results |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all buttons are fully wired to live server functions.

## Self-Check: PASSED
