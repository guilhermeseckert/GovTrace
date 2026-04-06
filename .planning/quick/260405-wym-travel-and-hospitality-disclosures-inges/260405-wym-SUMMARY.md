---
phase: quick
plan: 260405-wym
subsystem: ingestion, web, db
tags: [ingestion, travel, hospitality, proactive-disclosure, schema, ui, entity-profile]
dependency_graph:
  requires: [packages/db/schema/raw.ts, apps/ingestion downloader/parser/upsert/runner patterns, apps/web AidTable pattern]
  provides: [travelDisclosures table, hospitalityDisclosures table, runTravelIngestion, runHospitalityIngestion, TravelTable, HospitalityTable, entity profile travel/hospitality tabs]
  affects: [entity profile pages, getEntityStats, getEntityProvenance, ProfileTabs, ingestion job scheduler]
tech_stack:
  added: []
  patterns: [streaming PapaParse CSV ingestion, INSERT ON CONFLICT DO UPDATE, TanStack Query paginated table, shadcn/ui table + pagination]
key_files:
  created:
    - packages/db/drizzle/0005_furry_strong_guy.sql
    - packages/db/drizzle/meta/0005_snapshot.json
    - apps/ingestion/src/downloaders/travel.ts
    - apps/ingestion/src/downloaders/hospitality.ts
    - apps/ingestion/src/parsers/travel.ts
    - apps/ingestion/src/parsers/hospitality.ts
    - apps/ingestion/src/upsert/travel.ts
    - apps/ingestion/src/upsert/hospitality.ts
    - apps/ingestion/src/runners/travel.ts
    - apps/ingestion/src/runners/hospitality.ts
    - apps/web/src/components/tables/TravelTable.tsx
    - apps/web/src/components/tables/HospitalityTable.tsx
  modified:
    - packages/db/src/schema/raw.ts
    - packages/db/drizzle/meta/_journal.json
    - apps/web/src/server-fns/datasets.ts
    - apps/web/src/server-fns/entity.ts
    - apps/web/src/components/entity/ProfileTabs.tsx
    - apps/web/src/routes/entity/$id.tsx
decisions:
  - "SHA256(ref_number + owner_org) composite ID — ref_number is unique per department only, not globally"
  - "name normalization: 'Last, First' -> 'first last' via comma detection and swap"
  - "English-only typed columns; French text preserved in rawData JSONB"
  - "Separate Travel and Hospitality tabs (not merged) matching plan spec"
  - "BATCH_SIZE=500 matching contracts/grants for upsert; streaming batch size 5000 matching contracts runner"
metrics:
  duration: "411s (~7 min)"
  completed: "2026-04-06"
  tasks: 2
  files: 18
---

# Quick Task 260405-wym: Travel and Hospitality Disclosures Ingestion

**One-liner:** Full end-to-end ingestion pipeline for federal travel (~159K records) and hospitality (~69K records) proactive disclosure CSVs from open.canada.ca, with two new Drizzle schema tables, migration, streaming parsers with name normalization, and paginated UI tables wired into entity profile pages as Travel and Hospitality tabs.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Schema, migration, and ingestion pipeline | 1d940a4 | raw.ts, 0005_furry_strong_guy.sql, 10 ingestion files |
| 2 | Server functions, UI tables, profile tab wiring | 82602aa | datasets.ts, entity.ts, ProfileTabs.tsx, TravelTable.tsx, HospitalityTable.tsx, $id.tsx |

## What Was Built

### Schema (packages/db/src/schema/raw.ts)
- `travelDisclosures` table: 25 columns, 5 indexes (normalizedName, entityId, department, departmentCode, startDate)
- `hospitalityDisclosures` table: 21 columns, 5 indexes (same index set)
- Both use `text('id').primaryKey()` with `deriveSourceKey([ref_number, owner_org])` for idempotent re-ingestion

### Migration
- `0005_furry_strong_guy.sql` — creates both tables with all indexes

### Ingestion Pipeline (apps/ingestion/)
- **Downloaders:** Stream ~65MB travel CSV and ~26MB hospitality CSV from open.canada.ca to disk with SHA256 hashing
- **Parsers:** BOM stripping on first header row, iconv encoding detection, column alias mapping, name normalization ("Last, First" -> "first last"), department extraction from bilingual `owner_org_title` field (split on ` | `), empty cost field -> null (not 0)
- **Upsert:** `INSERT ON CONFLICT DO UPDATE` with BATCH_SIZE=500, dedup via Set
- **Runners:** Create `ingestionRuns` row, download, stream parse+upsert, update run status; source names `travel-disclosures` and `hospitality-disclosures`

### Server Functions (apps/web/src/server-fns/)
- `getTravel` — paginated query on travelDisclosures by entityId, ordered by startDate desc
- `getHospitality` — paginated query on hospitalityDisclosures by entityId, ordered by startDate desc
- `getEntityStats` — added travel + hospitality count queries
- `getEntityProvenance` — added travel + hospitality max(ingestedAt) queries; `EntityProvenance` type extended

### UI (apps/web/)
- `TravelTable`: paginated, sortable table with date range, name/title, department, purpose, destination, airfare/lodging/meals columns, CSV download, mobile card view
- `HospitalityTable`: paginated, sortable table with date range, name/title, department, description, location, vendor, employee/guest attendee counts, total, CSV download, mobile card view
- `ProfileTabs`: added `travel` and `hospitality` to `TabCounts`, `TabKey`, `TABS`, and `TAB_DESCRIPTIONS`
- Entity route: imports TravelTable and HospitalityTable, adds `case 'travel'` and `case 'hospitality'` to renderTab switch, adds provenance display for both datasets

## Deviations from Plan

None — plan executed exactly as written. All patterns matched the contracts/AidTable reference implementations.

## Known Stubs

None. TravelTable and HospitalityTable query live data from the database via server functions. Entity stats and provenance are wired to real count/max queries. The tables will show empty states until `runTravelIngestion()` and `runHospitalityIngestion()` are executed — this is expected behavior, not a stub.

Note: Travel and hospitality `entityId` FKs will remain NULL until the entity matching pipeline is run against the new tables. The UI handles this gracefully (empty state shown on entity profiles until matching runs).
