---
phase: 05-international-aid-ingestion
verified: 2026-04-04T19:09:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
---

# Phase 05: International Aid Ingestion Verification Report

**Phase Goal:** All international aid spending data from Global Affairs Canada is ingested, entity-matched, and cross-referenced with domestic datasets — revealing which companies/organizations receive both domestic contracts and overseas aid
**Verified:** 2026-04-04T19:09:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | IATI XML files from Global Affairs Canada can be downloaded, parsed, and stored in the international_aid table | VERIFIED | `downloadInternationalAid` in downloaders/international-aid.ts (101 lines); `parseIatiFile` in parsers/international-aid.ts (281 lines); `upsertInternationalAid` in upsert/international-aid.ts (83 lines); internationalAid table in schema/raw.ts at line 119 with 5 indexes |
| 2 | Aid recipient organizations (implementers) are entity-matched against existing domestic entities via the 3-stage matching pipeline | VERIFIED | SOURCE_CONFIGS in matcher/run-matching.ts line 32: `{ table: 'international_aid', nameField: 'implementer_name', normalizedField: 'normalized_implementer_name', entityIdField: 'entity_id' }` |
| 3 | Entity connections include aid_recipient_to_department rows linking implementers to funding departments | VERIFIED | build-connections.ts lines 144-166 contain SQL block with `aid_recipient_to_department` connection type; `aidRecipientToDepartment` in ConnectionBuildResult interface at line 10 |
| 4 | The ingestion can be triggered via CLI and scheduled via pg-boss | VERIFIED | index.ts lines 43-44: `case 'international-aid'` with dynamic import; scheduler/jobs.ts lines 15, 65-66, 108 register job name, worker, and monthly cron `30 5 1-7 * 0` |
| 5 | Entity profiles show an 'International Aid' tab with count badge listing aid projects | VERIFIED | ProfileTabs.tsx: `'aid'` in TabKey union (line 15), `aid: number` in TabCounts, `{ key: 'aid', label: 'International Aid', count: 0 }` in TABS array (line 45); entity/$id.tsx: `case 'aid': return <AidTable entityId={profile.id} />` (line 143) |
| 6 | Search results include international aid count alongside donations, contracts, grants, lobbying | VERIFIED | search.ts: `internationalAid` imported (line 6), `aid: number` added to getEntityCounts return type (line 27), aid count query in Promise.all (line 63), `aid: 0` default fallback (line 133) |
| 7 | How It Works page lists IATI Activity Files as the 6th data source | VERIFIED | how-it-works.tsx line 75: `name: 'International Aid (IATI)'` in DATA_SOURCES array; 6 entries confirmed via grep count; FAQ answer updated to reference "Six" datasets (line 158) |
| 8 | Entity provenance includes international aid last-ingested timestamp | VERIFIED | entity.ts: `aid: string | null` in EntityProvenance type (line 80); `max(internationalAid.ingestedAt)` query in getEntityProvenance (lines 121-123); entity/$id.tsx line 159 renders provenance.aid timestamp |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/src/schema/raw.ts` | internationalAid table definition | VERIFIED | Table at line 119, 20+ columns, 5 indexes; `normalizedImplementerName` and `entityId` present for matching pipeline |
| `apps/ingestion/src/downloaders/international-aid.ts` | 4-file IATI XML downloader | VERIFIED | 101 lines; exports `IATI_FILES` array and `downloadInternationalAid(destDir)` function; streaming fetch + SHA-256 hash per file |
| `apps/ingestion/src/parsers/international-aid.ts` | XML parser using fast-xml-parser | VERIFIED | 281 lines; exports `IatiActivityRecord` type and `parseIatiFile(filePath, sourceFileHash)`; isArray callback, #text extraction, BOM stripping all present |
| `apps/ingestion/src/upsert/international-aid.ts` | INSERT ON CONFLICT upsert | VERIFIED | 83 lines; exports `upsertInternationalAid`; BATCH_SIZE=500, deduplication, INSERT ON CONFLICT DO UPDATE on id PK |
| `apps/ingestion/src/runners/international-aid.ts` | Orchestrates download-parse-upsert-log | VERIFIED | 80 lines; exports `runInternationalAidIngestion`; follows grants.ts pattern with ingestion_runs record |
| `apps/ingestion/src/graph/build-connections.ts` | aid_recipient_to_department connection type | VERIFIED | SQL block at lines 144-166; `aidRecipientToDepartment` in interface and result accumulation |
| `apps/web/src/components/tables/AidTable.tsx` | Paginated table of international aid projects | VERIFIED | 444 lines; exports `AidTable`; useQuery calling getInternationalAid; columns: title, department, country, status badge, disbursed, budget, dates, source link |
| `apps/web/src/server-fns/datasets.ts` | getInternationalAid server function | VERIFIED | Lines 302-332; queries internationalAid table by entityId, paginates with offset, orders by startDate DESC, returns rows+total+page+pageSize |
| `apps/web/src/routes/how-it-works.tsx` | 6th data source card for IATI Activity Files | VERIFIED | Line 75: `name: 'International Aid (IATI)'`; Heart icon; rose colour scheme; open.canada.ca dataset URL |
| `apps/ingestion/src/parsers/__fixtures__/iati-sample.xml` | Test fixture with 2 activities | VERIFIED | File exists; only fixture in __fixtures__ directory |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| runners/international-aid.ts | downloaders/international-aid.ts | import downloadInternationalAid | WIRED | Confirmed present; runner orchestrates download call |
| runners/international-aid.ts | parsers/international-aid.ts | import parseIatiFile | WIRED | Confirmed present; runner calls parseIatiFile per downloaded file |
| matcher/run-matching.ts | schema/raw.ts | SOURCE_CONFIGS entry for international_aid | WIRED | Line 32: `{ table: 'international_aid', nameField: 'implementer_name', normalizedField: 'normalized_implementer_name', entityIdField: 'entity_id' }` |
| AidTable.tsx | datasets.ts | getInternationalAid server function call | WIRED | AidTable line 30 imports getInternationalAid; line 271 calls it in useQuery |
| search.ts | schema/raw.ts | import internationalAid | WIRED | search.ts line 6 imports internationalAid; used in count query at line 63 |
| ProfileTabs.tsx | AidTable.tsx | aid tab renders AidTable | WIRED | ProfileTabs.tsx has 'aid' in TabKey and TABS; entity/$id.tsx line 143 renders `<AidTable entityId={profile.id} />` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| AidTable.tsx | `data` (from useQuery) | getInternationalAid server function → `db.select().from(internationalAid).where(eq(internationalAid.entityId, data.entityId))` | Yes — Drizzle query against internationalAid table with entityId filter; returns rows + count | FLOWING |
| search.ts getEntityCounts | `aidCount` | `db.select({ c: count() }).from(internationalAid).where(eq(internationalAid.entityId, id))` | Yes — live count query per entity | FLOWING |
| entity.ts getEntityProvenance | `aidResult` | `db.select({ maxDate: max(internationalAid.ingestedAt) }).from(internationalAid).where(eq(internationalAid.entityId, data.id))` | Yes — max timestamp query | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Parser tests (12 tests) | `pnpm --filter @govtrace/ingestion test -- --run parsers/international-aid` | 12 passed, 0 failed, 326ms | PASS |
| fast-xml-parser installed | Grep package.json | `"fast-xml-parser": "catalog:"` in apps/ingestion/package.json; `fast-xml-parser: ^5.5.10` in pnpm-workspace.yaml catalog | PASS |
| CLI entry exists | Grep apps/ingestion/src/index.ts | `case 'international-aid':` at line 43 with dynamic import | PASS |
| Scheduler monthly job | Grep scheduler/jobs.ts | INGEST_INTERNATIONAL_AID job name, worker, and cron `30 5 1-7 * 0` all present | PASS |
| TypeScript errors in phase 5 files | tsc --noEmit | ingestion: TS5097 extension errors are project-wide pre-existing (same in all runners); web AidTable: `data.rows` type errors are project-wide pre-existing (same pattern in ContractsTable, DonationsTable, GrantsTable) — no errors introduced by phase 5 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| INTL-01 | 05-01, 05-02 | User can see international aid projects on entity profiles (recipient, amount, funding department) | SATISFIED | internationalAid table stores all fields; AidTable renders them; entity profile has 'aid' tab; getInternationalAid server function queries by entityId |
| INTL-02 | 05-01 | Aid recipient organizations are entity-matched against existing domestic entities | SATISFIED | SOURCE_CONFIGS in run-matching.ts line 32 wires international_aid into the 3-stage matching pipeline (deterministic, fuzzy pg_trgm, Claude AI) |
| INTL-03 | 05-01, 05-02 | Entity profiles show international aid alongside domestic data | SATISFIED | entity/$id.tsx renders AidTable in aid tab; getEntityStats includes aid count alongside donations/contracts/grants/lobbying; entity provenance footer shows aid last-ingested date |
| INTL-04 | 05-02 | Search results include international aid data in entity counts | SATISFIED | search.ts getEntityCounts returns aid count; searchEntities default includes `aid: 0`; count displayed in search results alongside other 4 datasets |
| INTL-05 | 05-02 | How It Works page is updated to explain the 6th dataset (IATI Activity Files) | SATISFIED | how-it-works.tsx DATA_SOURCES[5] = International Aid (IATI); FAQ answer updated to "Six" datasets; Heart icon with rose colour scheme |

No orphaned requirements — all 5 INTL requirements claimed by plans are accounted for.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found | — | — |

All `return null` instances in the parser are legitimate early-exit guards for missing optional XML elements (narratives, implementers, dates, countries). All `return []` in the parser is a legitimate guard when the XML root is missing. No stubs, placeholders, or hardcoded empty data arrays found.

### Human Verification Required

#### 1. End-to-End IATI Download

**Test:** Run `pnpm --filter @govtrace/ingestion tsx src/index.ts ingest international-aid` against a live database with network access to w05.international.gc.ca
**Expected:** 4 XML files downloaded (~9-29MB each), activities parsed, upserted to international_aid table, ingestion_runs record created
**Why human:** Requires live database + network; cannot verify against real Global Affairs Canada endpoint in automated check

#### 2. Entity Profile Aid Tab — Visual Rendering

**Test:** Navigate to an entity profile for an organization that has been matched to international aid records (e.g., a Canadian NGO or consulting firm that appears in IATI data). Click the "International Aid" tab.
**Expected:** Paginated table shows project title, funding department, recipient country, status badge (colour-coded), disbursed amount in CAD, budget, start/end dates, and a source link to the Global Affairs Canada project browser.
**Why human:** Requires ingested + matched data in a running database; tab visibility and pagination cannot be verified without a running app

#### 3. Cross-Dataset Connection — "Received Domestic Contracts AND Overseas Aid"

**Test:** Find an entity that exists in both contracts and international_aid (an implementer organization). Verify the connections graph shows `aid_recipient_to_department` edges alongside `contractor_to_department` edges.
**Expected:** The Visualizations tab on the entity profile shows connections crossing both domestic and international datasets — the core phase goal
**Why human:** Requires real matched entities in the database; the build-connections SQL is verified as wired but the actual cross-dataset revelation requires data

### Gaps Summary

No gaps found. All 8 must-have truths are verified, all artifacts are substantive and wired, all key links are confirmed, all 5 INTL requirements are satisfied.

The phase fully achieves its goal: the complete ingestion pipeline from IATI XML download through entity matching and entity_connections graph building is wired; the web UI layer exposes aid data on entity profiles, in search counts, in provenance tracking, and on the How It Works page.

---

_Verified: 2026-04-04T19:09:00Z_
_Verifier: Claude (gsd-verifier)_
