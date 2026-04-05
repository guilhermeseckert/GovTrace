---
phase: 05-international-aid-ingestion
plan: 01
subsystem: ingestion
tags: [iati, xml, international-aid, entity-matching, graph]
dependency_graph:
  requires: [packages/db/src/schema/raw.ts, apps/ingestion/src/matcher/run-matching.ts, apps/ingestion/src/graph/build-connections.ts]
  provides: [internationalAid table, parseIatiFile, downloadInternationalAid, upsertInternationalAid, runInternationalAidIngestion]
  affects: [entity_connections graph, SOURCE_CONFIGS matching pipeline, pg-boss scheduler, CLI ingest command]
tech_stack:
  added: [fast-xml-parser@^5.5.10]
  patterns: [isArray callback for XML array forcing, #text extraction for mixed-content elements, BOM stripping at byte 0]
key_files:
  created:
    - packages/db/src/schema/raw.ts (internationalAid table added)
    - apps/ingestion/src/parsers/international-aid.ts
    - apps/ingestion/src/parsers/__fixtures__/iati-sample.xml
    - apps/ingestion/src/parsers/international-aid.test.ts
    - apps/ingestion/src/downloaders/international-aid.ts
    - apps/ingestion/src/upsert/international-aid.ts
    - apps/ingestion/src/runners/international-aid.ts
  modified:
    - apps/ingestion/src/matcher/run-matching.ts (SOURCE_CONFIGS entry)
    - apps/ingestion/src/graph/build-connections.ts (aid_recipient_to_department)
    - apps/ingestion/src/scheduler/jobs.ts (monthly job)
    - apps/ingestion/src/index.ts (CLI case)
    - apps/ingestion/package.json (fast-xml-parser catalog reference)
    - pnpm-workspace.yaml (fast-xml-parser in catalog)
decisions:
  - fast-xml-parser over node-xml-stream-parser: files are 9-29MB, full-document parse is simpler and memory is acceptable
  - isArray callback forces array mode for all repeated IATI elements, preventing single-element collapse
  - iati-identifier used directly as PK (globally unique and stable by IATI standard, no hash needed)
  - rawData JSONB stores only 5 key fields (title, implementer, funder, country, status), NOT full XML
  - One ingestion_runs record for entire run (not per file), concatenated file hashes as sourceFileHash
metrics:
  duration: "6 minutes"
  completed_date: "2026-04-05"
  tasks: 2
  files: 12
---

# Phase 05 Plan 01: International Aid Ingestion Pipeline Summary

**One-liner:** IATI XML ingestion pipeline using fast-xml-parser with isArray config and #text handling to parse 4 Global Affairs Canada files into internationalAid table wired to entity matching and entity_connections graph.

## What Was Built

Complete international aid ingestion pipeline that downloads 4 IATI Activity XML files from Global Affairs Canada (w05.international.gc.ca), parses each `<iati-activity>` element into a structured record, upserts into a new `international_aid` PostgreSQL table, and wires into the existing entity matching and entity_connections graph infrastructure.

### New Files

- **`packages/db/src/schema/raw.ts`** — Added `internationalAid` table with 20 columns including `implementerName`, `normalizedImplementerName`, `entityId` for matching, and JSONB `rawData`. Indexes on normalizedImplementerName, entityId, recipientCountry, startDate, activityStatus.

- **`apps/ingestion/src/parsers/international-aid.ts`** — `parseIatiFile(filePath, sourceFileHash)` using fast-xml-parser. Handles 3 IATI XML pitfalls: (1) isArray callback prevents single-element collapse, (2) `#text` extraction for mixed-content `<value>` elements, (4) BOM stripping. Extracts all fields per activity including summed budgets/transactions by type code.

- **`apps/ingestion/src/parsers/international-aid.test.ts`** — 12 TDD tests covering all extraction paths including edge cases: FR-only title fallback, missing implementer (null), negative disbursement values, single-element budget arrays, recipient-region fallback.

- **`apps/ingestion/src/parsers/__fixtures__/iati-sample.xml`** — 2-activity fixture: Activity 1 has full data (EN+FR narratives, role=4 implementer, role=3 funder, recipient-country, 2 budgets, 3 transactions including negative); Activity 2 has minimal data (FR-only title, no implementer, recipient-region only).

- **`apps/ingestion/src/downloaders/international-aid.ts`** — Downloads 4 IATI files (status_2_3, 4, 4a, 4b), optionally checks for status_4c via HEAD request. Follows grants.ts streaming download + SHA-256 hash pattern.

- **`apps/ingestion/src/upsert/international-aid.ts`** — INSERT ON CONFLICT DO UPDATE on iati-identifier PK, BATCH_SIZE=500, deduplication within batch.

- **`apps/ingestion/src/runners/international-aid.ts`** — Orchestrates download → parse → upsert → log. One `ingestion_runs` record for the whole run; concatenated 8-char file hashes as sourceFileHash.

### Modified Files

- **`apps/ingestion/src/matcher/run-matching.ts`** — Added `{ table: 'international_aid', nameField: 'implementer_name', normalizedField: 'normalized_implementer_name', entityIdField: 'entity_id' }` to SOURCE_CONFIGS, wiring international aid implementers into the existing 3-stage matching pipeline.

- **`apps/ingestion/src/graph/build-connections.ts`** — Added `aid_recipient_to_department` SQL block (implementer entity → funding department entity via `LOWER(TRIM(funding_department))`). Added `aidRecipientToDepartment: number` to ConnectionBuildResult interface.

- **`apps/ingestion/src/scheduler/jobs.ts`** — Added `INGEST_INTERNATIONAL_AID` job name, worker, and monthly schedule (`30 5 1-7 * 0` — first Sunday of each month at 5:30am UTC).

- **`apps/ingestion/src/index.ts`** — Added `case 'international-aid':` switch case.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| fast-xml-parser over node-xml-stream-parser | Files are 9-29MB; full-document parse peaks at ~145MB, acceptable for ingestion worker; simpler API than SAX |
| isArray callback for all repeated IATI elements | Without it, single `<budget>` or `<transaction>` collapses to object, breaking `.map()` |
| iati-identifier as PK directly | Globally unique and stable by IATI standard; no hash needed unlike other sources |
| rawData stores 5 key fields only | Activity descriptions can be 5KB+; full XML would cause row bloat; 5 fields sufficient for profile display |
| One ingestion_runs record for whole run | Consistent with other single-source runners; simpler to query run status |

## Verification Results

- All 40 ingestion tests pass (12 new + 28 pre-existing)
- No new TypeScript errors in created/modified files (pre-existing TS5097 extension errors are project-wide)
- `grep -c 'international_aid' apps/ingestion/src/matcher/run-matching.ts` → 1
- `grep -c 'aid_recipient_to_department' apps/ingestion/src/graph/build-connections.ts` → 2

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all data fields are wired to real IATI XML extraction logic. The `totalDisbursedCad` returns `'0.00'` for activities with no disbursement transactions (not null), which is semantically correct.

## Self-Check: PASSED
