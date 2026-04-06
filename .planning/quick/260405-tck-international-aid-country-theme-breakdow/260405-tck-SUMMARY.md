---
phase: quick
plan: 260405-tck
subsystem: dashboard
tags: [international-aid, dashboard, schema, IATI, country-breakdown, sector-breakdown]
dependency_graph:
  requires: [packages/db/schema/raw.ts, apps/web/src/server-fns/dashboard.ts, apps/web/src/components/dashboard/DepartmentBreakdown.tsx]
  provides: [country-breakdown section, sector-breakdown section, sectorCode schema column, IATI sector parser]
  affects: [apps/web/src/routes/dashboard.tsx, apps/ingestion/src/upsert/international-aid.ts]
tech_stack:
  added: []
  patterns: [cached server fn, useQuery + Skeleton, horizontal bar chart with pctOfTotal, ISO flag emoji via regional indicator symbols]
key_files:
  created:
    - apps/web/src/lib/country-codes.ts
    - apps/web/src/components/dashboard/CountryBreakdown.tsx
    - apps/web/src/components/dashboard/SectorBreakdown.tsx
    - packages/db/drizzle/0002_dizzy_shiver_man.sql
  modified:
    - packages/db/src/schema/raw.ts
    - apps/ingestion/src/parsers/international-aid.ts
    - apps/ingestion/src/upsert/international-aid.ts
    - apps/web/src/server-fns/dashboard.ts
    - apps/web/src/routes/dashboard.tsx
decisions:
  - getFlag() uses regional indicator Unicode codepoints (0x1F1E6 base) — no external library needed
  - getSectorBreakdown merges multiple 5-digit DAC codes to the same theme label before returning — avoids per-code fragmentation in the UI
  - sectorCode persisted in rawData under key "sector" for debuggability without re-ingestion
  - Existing NULL sectorCode records handled gracefully — WHERE IS NOT NULL in query, empty state in SectorBreakdown
metrics:
  duration: 328s
  completed_date: "2026-04-05"
  tasks_completed: 2
  files_changed: 9
---

# Quick Task 260405-tck: International Aid Country & Theme Breakdown

**One-liner:** Country and DAC sector breakdown sections added to the dashboard with ranked horizontal bars; sectorCode column added to internationalAid schema and IATI parser for future sector population.

## What Was Built

Two new dashboard sections on `/dashboard` showing where Canadian international aid goes:

1. **Aid by Recipient Country** — horizontal bar chart of top 15 recipient countries, each showing flag emoji, human-readable country name (ISO alpha-2 resolved via `COUNTRY_NAMES` map), committed CAD, percentage of total, and project count. Populated from existing `recipient_country` data.

2. **Aid by Theme** — horizontal bar chart of top 10 DAC sector themes, showing thematic label, committed CAD, percentage of total, and project count. Displays graceful empty state until IATI XML is re-ingested with `sectorCode` populated.

Both sections follow the exact visual pattern of the existing `DepartmentBreakdown` component — same bar style, same overflow label, same source link footer.

## Schema & Parser Changes

- `sectorCode text('sector_code')` column added to `internationalAid` table with a btree index
- Migration `0002_dizzy_shiver_man.sql` generated (ALTER TABLE + CREATE INDEX)
- `extractSectorCode()` helper added to IATI parser — filters vocabulary="1" (OECD DAC) or absent vocabulary
- `IatiActivityRecord` interface updated with `sectorCode: string | null`
- Upsert function updated to persist and update `sectorCode` on conflict

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Functionality] Added sectorCode to upsert function**
- **Found during:** Task 1
- **Issue:** The plan specified updating the parser, schema, and interface — but the upsert function also needed updating to actually write `sectorCode` to the database on ingestion.
- **Fix:** Added `sectorCode: r.sectorCode` to values map and `sectorCode: sql\`excluded.sector_code\`` to the onConflictDoUpdate set.
- **Files modified:** `apps/ingestion/src/upsert/international-aid.ts`
- **Commit:** ece41ee

**2. [Rule 1 - Bug] Removed duplicate key '60010' in DAC_SECTORS map**
- **Found during:** Task 2 code review
- **Issue:** DAC_SECTORS had both `'60010': 'Humanitarian Aid'` and `'60010': 'Debt Relief'` — the latter would silently shadow the former in the JavaScript object.
- **Fix:** Removed the duplicate "Debt Relief" entry (debt relief uses different 6xxx codes in practice).
- **Files modified:** `apps/web/src/lib/country-codes.ts`
- **Commit:** 015948b

### Committed Pending Migration

The existing `0001_regular_valeria_richards.sql` (which was staged for deletion in git status) was replaced by the properly-named `0001_gifted_wendell_rand.sql` from the parliamentary voting phase. That migration plus its snapshot were committed as part of Task 1 cleanup.

## Known Stubs

**SectorBreakdown — empty until re-ingestion:**
- `apps/web/src/components/dashboard/SectorBreakdown.tsx` will show the "No sector data available yet" empty state for all existing `international_aid` records because `sectorCode` is NULL for them (they were ingested before this column existed). This is **intentional and documented** — the next IATI XML re-ingestion will populate the column and the component will automatically show data.
- This does NOT prevent the plan's goal: the component and server function are correctly wired; the data gap is a migration timing issue, not a code gap.

**CountryBreakdown — populated from existing data:**
- `recipientCountry` was already being parsed and stored, so `CountryBreakdown` will show real data immediately after this deploy.

## Self-Check: PASSED

Files verified:
- FOUND: apps/web/src/lib/country-codes.ts
- FOUND: apps/web/src/components/dashboard/CountryBreakdown.tsx
- FOUND: apps/web/src/components/dashboard/SectorBreakdown.tsx
- FOUND: packages/db/drizzle/0002_dizzy_shiver_man.sql

Commits verified:
- FOUND: ece41ee (Task 1 - schema + parser)
- FOUND: 015948b (Task 2 - server fns + UI)
