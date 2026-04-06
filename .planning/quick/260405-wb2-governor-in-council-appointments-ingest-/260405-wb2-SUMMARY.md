---
phase: quick
plan: 260405-wb2
subsystem: ingestion + web
tags: [gic-appointments, scraping, entity-matching, pattern-detection, civic-transparency]
dependency_graph:
  requires: [packages/db, apps/ingestion/matcher]
  provides: [gic_appointments table, runGicAppointmentsIngestion, AppointmentsTable, donation_before_appointment pattern]
  affects: [entity profiles, pattern_flags, entity_connections, build-connections]
tech_stack:
  added: [cheerio@1.2.0]
  patterns: [html-scraping, sha256-deterministic-ids, entity-matching-pipeline, mark-stale-rebuild]
key_files:
  created:
    - packages/db/src/schema/appointments.ts
    - packages/db/drizzle/0004_curious_blue_blade.sql
    - apps/ingestion/src/downloaders/gic-appointments.ts
    - apps/ingestion/src/parsers/gic-appointments.ts
    - apps/ingestion/src/upsert/gic-appointments.ts
    - apps/ingestion/src/runners/gic-appointments.ts
    - apps/web/src/components/entity/AppointmentsTable.tsx
  modified:
    - packages/db/package.json
    - apps/ingestion/package.json
    - apps/ingestion/src/index.ts
    - apps/ingestion/src/graph/build-connections.ts
    - apps/web/src/server-fns/datasets.ts
    - apps/web/src/server-fns/entity.ts
    - apps/web/src/components/entity/ProfileTabs.tsx
    - apps/web/src/routes/entity/$id.tsx
    - apps/web/src/server-fns/detect-patterns.ts
decisions:
  - SHA256(orgCode + appointeeName + positionTitle) as deterministic PK — same pattern as other raw tables
  - Cheerio for HTML parsing — standard Node.js choice, handles malformed government HTML gracefully
  - 200ms delay between org profile requests — polite scraping for ~290 orgs (~1 minute total)
  - Parser stores raw HTML in rawData.sourceFileHash for debugging — idempotent re-ingestion
  - "LastName, FirstName" -> "FirstName LastName" transform before normalizeName() — follows research pitfall 2
  - isVacant=true rows skip entity matching entirely — avoids creating false "Vacant" entities
  - donation_before_appointment uses 365-day window, high severity if >$1000 and within 90 days
  - appointee_to_organization connection type uses organization normalized_name JOIN — matches entities table pattern
  - Fixed broken drizzle snapshot chain (snapshots 0001/0003 had same ID, 0002 had orphaned prevId)
metrics:
  duration: 18min
  completed: 2026-04-05
  tasks: 2
  files: 19
---

# Quick Task 260405-wb2: Governor in Council Appointments Ingest Summary

**One-liner:** Full GIC appointments ingestion pipeline — cheerio HTML scraper for ~290 federal org profiles, entity matching, AppointmentsTable UI tab, and donation-before-appointment pattern detection with CAUSATION_CAVEAT.

## What Was Built

### Task 1: Schema, Scraper, Parser, and Ingestion Runner

**Schema** (`packages/db/src/schema/appointments.ts`): New `gic_appointments` table with deterministic SHA256 ID from `orgCode + appointeeName + positionTitle`. 17 columns including all research-specified fields. 5 indexes: normalized_appointee_name, entity_id, organization_code, appointment_date, and unique composite on (organization_code, appointee_name, position_title).

**Migration** (`packages/db/drizzle/0004_curious_blue_blade.sql`): Drizzle-kit generated migration for the new table.

**Downloader** (`apps/ingestion/src/downloaders/gic-appointments.ts`): Two functions:
- `fetchOrganizationIndex()`: scrapes `/orgs.php?lang=en&t=1` for all OrgID codes via cheerio
- `fetchOrganizationProfile(orgCode)`: fetches raw HTML for one org profile page

**Parser** (`apps/ingestion/src/parsers/gic-appointments.ts`): `parseOrganizationProfile(html, orgCode)` iterates HTML tables, extracts appointee name/position/type/tenure/dates. Handles: vacant positions (isVacant=true), "LastName, FirstName" parsing, malformed HTML (try/catch per row, warns and skips). Normalizes appointment type and tenure type to canonical values.

**Upsert** (`apps/ingestion/src/upsert/gic-appointments.ts`): `upsertGicAppointments()` with BATCH_SIZE=500, onConflictDoUpdate on composite unique index. Updates mutable fields (dates, type, tenure, rawData) on conflict.

**Runner** (`apps/ingestion/src/runners/gic-appointments.ts`): Three-phase pipeline following parliament.ts pattern:
- Phase A: fetch org index
- Phase B: scrape all org profiles with 200ms delay, parse, upsert (logs every 25 orgs)
- Phase C: entity matching for non-vacant appointees via deterministic → fuzzy → AI → new entity

**CLI** (`apps/ingestion/src/index.ts`): Added `case 'gic-appointments'` — run with `pnpm ingest gic-appointments`.

### Task 2: Entity Connections, UI Tab, and Pattern Detection

**build-connections.ts**: Added `appointee_to_organization` INSERT block using `JOIN entities e ON e.normalized_name = LOWER(TRIM(ga.organization_name))`. Updated `ConnectionBuildResult` interface to include `appointeeToOrganization`.

**getAppointments server function** (`apps/web/src/server-fns/datasets.ts`): Simple query on gic_appointments WHERE entity_id = entityId, ordered by appointment_date DESC.

**getEntityStats** (`apps/web/src/server-fns/entity.ts`): Added appointments count query (parallel with existing counts).

**AppointmentsTable** (`apps/web/src/components/entity/AppointmentsTable.tsx`): useQuery component with desktop Table and mobile card views. Columns: Organization (linked to org page), Position, Type (badge), Tenure, Appointed date, Expires date, Source link. Vacant rows shown with muted/italic styling.

**ProfileTabs** (`apps/web/src/components/entity/ProfileTabs.tsx`): Added `'appointments'` to TabKey union, TabCounts type, TABS array (after 'aid'), and TAB_DESCRIPTIONS.

**Entity route** (`apps/web/src/routes/entity/$id.tsx`): Imported AppointmentsTable, added `case 'appointments'` to renderTab switch.

**detect-patterns.ts**: Added `detectDonationBeforeAppointment(db)` algorithm — temporal JOIN between donations and gic_appointments for the same entity within 365 days. High severity when amount > $1000 and within 90 days. Wired into `detectPatterns` server function.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed broken Drizzle snapshot chain**
- **Found during:** Task 1 — drizzle-kit generate failed with "collision" error
- **Issue:** Snapshots 0001 and 0003 had the same `id` UUID; snapshot 0002 had a `prevId` pointing to a non-existent snapshot. The chain was 0000→0001→(orphan 0002), (orphan 0003)
- **Fix:** Updated 0002's `prevId` to point to 0001's ID, updated 0003's `prevId` to point to 0002's ID, and assigned 0003 a new unique UUID to avoid collision with 0001
- **Files modified:** `packages/db/drizzle/meta/0002_snapshot.json`, `packages/db/drizzle/meta/0003_snapshot.json`

**2. [Rule 3 - Blocking] Added `@govtrace/db/schema/appointments` export to db package.json**
- **Found during:** Task 1 TypeScript check
- **Issue:** Schema file created but package.json exports map missing the new path — caused TS2307 "Cannot find module" errors
- **Fix:** Added `"./schema/appointments": "./src/schema/appointments.ts"` to exports map
- **Files modified:** `packages/db/package.json`

## Known Stubs

None — all data flows from gic_appointments table to UI. The AppointmentsTable will show an empty state message if no appointments are ingested yet, which is correct pre-ingestion behavior.

## Self-Check: PASSED

Created files verified:
- packages/db/src/schema/appointments.ts — exists
- packages/db/drizzle/0004_curious_blue_blade.sql — exists
- apps/ingestion/src/downloaders/gic-appointments.ts — exists
- apps/ingestion/src/parsers/gic-appointments.ts — exists
- apps/ingestion/src/upsert/gic-appointments.ts — exists
- apps/ingestion/src/runners/gic-appointments.ts — exists
- apps/web/src/components/entity/AppointmentsTable.tsx — exists

Commits verified:
- b3e05d8 — Task 1 (schema, scraper, parser, upsert, runner, CLI)
- ff96596 — Task 2 (UI tab, connections, pattern detection)
