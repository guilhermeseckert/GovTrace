---
phase: 05-international-aid-ingestion
plan: 02
subsystem: web-ui
tags: [iati, international-aid, entity-profile, search, how-it-works]
dependency_graph:
  requires: [packages/db/src/schema/raw.ts (internationalAid table from 05-01), apps/web/src/server-fns/datasets.ts, apps/web/src/components/entity/ProfileTabs.tsx]
  provides: [AidTable, getInternationalAid, aid tab in entity profiles, aid counts in search results, IATI card in How It Works]
  affects: [entity profile page, search results, how-it-works page, entity provenance footer]
tech_stack:
  added: []
  patterns: [getSourceUrl with IATI identifier last-segment URL construction, STATUS_CONFIG as const map for aid status badges, same paginated table pattern as GrantsTable]
key_files:
  created:
    - apps/web/src/components/tables/AidTable.tsx
  modified:
    - apps/web/src/server-fns/search.ts (internationalAid import, aid count in getEntityCounts)
    - apps/web/src/server-fns/entity.ts (internationalAid import, aid in EntityProvenance type, getEntityProvenance, getEntityStats)
    - apps/web/src/server-fns/datasets.ts (internationalAid import, getInternationalAid server function)
    - apps/web/src/components/entity/ProfileTabs.tsx (TabKey+TabCounts extended with aid, TABS+TAB_DESCRIPTIONS updated)
    - apps/web/src/routes/entity/$id.tsx (AidTable import, case 'aid' in renderTab, aid provenance display)
    - apps/web/src/routes/how-it-works.tsx (6th data source card for IATI, FAQ updated to 6 sources)
decisions:
  - IATI identifier last segment used to construct Global Affairs Canada project browser URL (no rawData source_url stored, identifier is globally stable)
  - STATUS_CONFIG as const map with 5 IATI activity statuses (1=Pipeline, 2=Active, 3=Finalisation, 4=Closed, 5=Cancelled) matches IATI spec
  - AidTable follows GrantsTable pattern exactly for consistency — no new abstractions introduced
  - i18n not extended — tab descriptions use hardcoded strings in ProfileTabs matching existing pattern; table headers are inline in component
metrics:
  duration: "4 minutes"
  completed_date: "2026-04-05"
  tasks: 2
  files: 7
---

# Phase 05 Plan 02: International Aid UI Layer Summary

**One-liner:** International aid wired into entity profiles with paginated AidTable component, aid counts in search results, provenance tracking, and IATI Activity Files added as the 6th data source card on How It Works.

## What Was Built

Complete user-facing layer for international aid data. Anyone searching an entity now sees aid project counts alongside donations, contracts, grants, and lobbying. Entity profiles have a new "International Aid" tab showing paginated project data with status badges and source links. The How It Works page now lists all 6 data sources.

### New Files

- **`apps/web/src/components/tables/AidTable.tsx`** — Paginated table of international aid projects. Columns: Project Title (truncated with tooltip), Funding Department, Recipient Country (falls back to recipientRegion), Status badge (Pipeline/Active/Finalisation/Closed/Cancelled with colour coding), Disbursed (CAD), Budget (CAD), Start Date, End Date, Source link. Mobile card view included. Source URL constructed from IATI identifier last segment pointing to Global Affairs Canada project browser.

### Modified Files

- **`apps/web/src/server-fns/search.ts`** — Added `internationalAid` import, `aid: number` field to `getEntityCounts` return type, aid count query in Promise.all loop, and `aid: 0` to the default fallback in `searchEntities`.

- **`apps/web/src/server-fns/entity.ts`** — Added `internationalAid` import, `aid: string | null` to `EntityProvenance` type, aid `max(ingestedAt)` query in `getEntityProvenance`, and aid `count()` query in `getEntityStats`.

- **`apps/web/src/server-fns/datasets.ts`** — Added `internationalAid` import and new `getInternationalAid` server function following `getGrants` pattern: queries by entityId, paginates with offset, orders by startDate DESC, selects all display fields including rawData.

- **`apps/web/src/components/entity/ProfileTabs.tsx`** — Extended `TabCounts` with `aid: number`, `TabKey` union with `'aid'`, added `'aid'` entry to `TAB_DESCRIPTIONS`, added `{ key: 'aid', label: 'International Aid', count: 0 }` to `TABS` array (positioned between lobbying and connections).

- **`apps/web/src/routes/entity/$id.tsx`** — Imported `AidTable`, added `case 'aid': return <AidTable entityId={profile.id} />` to renderTab switch, and added aid provenance timestamp display in the footer section.

- **`apps/web/src/routes/how-it-works.tsx`** — Added 6th entry to `DATA_SOURCES` array: International Aid (IATI) with rose colour, Heart icon, Global Affairs Canada IATI dataset URL. Updated FAQ "Where does the data come from?" answer from "Five" to "Six" datasets.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| IATI identifier last segment for source URL | Identifier format `CA-3-D000123456` — last segment after final `-` maps to Global Affairs project browser URL; no separate source_url field is stored in rawData |
| STATUS_CONFIG as const map | Same 3-state badge pattern used for ConfidenceBadge; type-safe with IATI activity status codes 1-5 |
| AidTable mirrors GrantsTable exactly | Consistency over abstraction; any future shared DataTable refactor can be applied uniformly |
| i18n not extended | ProfileTabs TAB_DESCRIPTIONS and table column headers use hardcoded strings matching pre-existing pattern in the codebase |

## Verification Results

- `grep -c 'internationalAid' apps/web/src/server-fns/search.ts` → 2
- `grep -c 'getInternationalAid' apps/web/src/server-fns/datasets.ts` → 1
- `grep -c 'International Aid' apps/web/src/routes/how-it-works.tsx` → 1
- `grep -c "'aid'" apps/web/src/components/entity/ProfileTabs.tsx` → 2
- TypeScript compiles with same pre-existing errors as before our changes (rawData: unknown pattern in all table server functions is project-wide)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data fields are wired to real queries against the `international_aid` table. The `getSourceUrl` function constructs a real Global Affairs Canada project browser URL from the IATI identifier (or falls back to the open.canada.ca dataset page). The aid tab count badge will show 0 for entities with no matched aid records, which is semantically correct.

## Self-Check: PASSED
