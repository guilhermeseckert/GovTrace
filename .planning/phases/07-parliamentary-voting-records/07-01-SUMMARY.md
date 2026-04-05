---
phase: 07-parliamentary-voting-records
plan: "01"
subsystem: ingestion-pipeline
tags: [parliament, voting-records, ingestion, xml-parsing, entity-matching, ai-summaries]
dependency_graph:
  requires:
    - packages/db/src/schema/entities.ts (entity table for MP matching)
    - apps/ingestion/src/matcher/deterministic.ts (entity matching pipeline)
    - apps/ingestion/src/matcher/fuzzy.ts (pg_trgm fuzzy matching)
    - apps/ingestion/src/matcher/ai-verify.ts (Claude AI verification)
  provides:
    - packages/db/src/schema/parliament.ts (5 new tables)
    - apps/ingestion/src/parsers/parliament-votes.ts (parseVotesXml)
    - apps/ingestion/src/parsers/parliament-ballots.ts (parseVoteBallotsXml)
    - apps/ingestion/src/parsers/parliament-bills.ts (parseBillsJson)
    - apps/ingestion/src/runners/parliament.ts (runParliamentIngestion)
  affects:
    - apps/ingestion/src/scheduler/jobs.ts (new INGEST_PARLIAMENT job)
    - apps/ingestion/src/index.ts (new 'parliament' CLI command)
    - packages/db/package.json (new parliament schema export)
tech_stack:
  added: []
  patterns:
    - fast-xml-parser isArray config for single-element XML array safety
    - PersonId-anchored mp_profiles table as stable cross-session MP anchor
    - Resumable ballot ingestion via ballotsIngested flag on parliamentVotes
    - Bill AI summaries via Claude Haiku with grandpa-readable prompt (PARL-05)
    - 5-phase orchestrator: bills → votes → MP matching → ballots → summaries
key_files:
  created:
    - packages/db/src/schema/parliament.ts
    - apps/ingestion/src/parsers/parliament-votes.ts
    - apps/ingestion/src/parsers/parliament-votes.test.ts
    - apps/ingestion/src/parsers/parliament-ballots.ts
    - apps/ingestion/src/parsers/parliament-ballots.test.ts
    - apps/ingestion/src/parsers/parliament-bills.ts
    - apps/ingestion/src/parsers/parliament-bills.test.ts
    - apps/ingestion/src/parsers/__fixtures__/parliament-votes-sample.xml
    - apps/ingestion/src/parsers/__fixtures__/parliament-ballots-sample.xml
    - apps/ingestion/src/parsers/__fixtures__/parliament-bills-sample.json
    - apps/ingestion/src/downloaders/parliament.ts
    - apps/ingestion/src/upsert/parliament-bills.ts
    - apps/ingestion/src/upsert/parliament-votes.ts
    - apps/ingestion/src/upsert/parliament-ballots.ts
    - apps/ingestion/src/runners/parliament.ts
  modified:
    - apps/ingestion/src/scheduler/jobs.ts
    - apps/ingestion/src/index.ts
    - apps/ingestion/src/matcher/run-matching.ts
    - packages/db/package.json
decisions:
  - PersonId-anchored mp_profiles as stable ground truth for MP entity matching across sessions
  - Bills not added to entity_connections — bills are not entities; cross-reference is query-time (PARL-04)
  - Resumable ballot ingestion via ballotsIngested boolean flag on parliamentVotes rows
  - PARLIAMENT_SESSIONS includes 37th Parliament sessions with confirmed:false flag for graceful skip on HTTP 500
  - 5000-bill circuit breaker for AI summaries with cost estimate in warning log
  - upsertBallots uses ON CONFLICT DO NOTHING (immutable historical records)
  - upsertVotes uses unique index on (parlSessionCode, divisionNumber) as conflict target
metrics:
  duration: ~8 minutes
  completed: "2026-04-05"
  tasks: 3
  files: 19
---

# Phase 7 Plan 1: Parliamentary Voting Records Ingestion Summary

**One-liner:** Parliament schema with 5 tables + XML/JSON parsers + PersonId-anchored MP matching + Claude Haiku bill summaries + 5-phase ingestion runner for all 16 sessions from 38th to 45th Parliament.

## What Was Built

### Database Schema (packages/db/src/schema/parliament.ts)

5 new tables with correct PKs, FKs, and indexes:

1. **parliamentBills** — LEGISinfo bills, PK `"{parliament}-{session}-{billNumberFormatted}"`, pg_trgm GIN index on billNumberFormatted for PARL-03 search
2. **parliamentVotes** — Division-level summaries, PK `"{parliament}-{session}-{divisionNumber}"`, unique index on `(parlSessionCode, divisionNumber)`, nullable billId FK, `ballotsIngested` flag for resumable ingestion
3. **parliamentVoteBallots** — 1.8–2.4M individual MP ballot rows, PK `"{voteId}-{personId}"`, entityId FK for profile-to-ballots lookup
4. **mpProfiles** — PersonId-anchored entity matching cache, PK is personId integer (stable across sessions), stores matchMethod and matchConfidence for provenance
5. **billSummaries** — Claude-generated bill summaries, UUID PK, unique billId FK with cascade delete, model field for version tracking

### Parsers + Tests (TDD)

All parsers use `fast-xml-parser` with `isArray` config to prevent single-element XML collapse (Pitfall 6):

- **parseVotesXml**: `ArrayOfVote` XML → `VoteRecord[]`, handles empty BillNumberCode as null (Pitfall 4)
- **parseVoteBallotsXml**: `ArrayOfVoteParticipant` XML → `BallotRecord[]`, handles French-accented names
- **parseBillsJson**: LEGISinfo JSON array → `BillRecord[]`, handles null ShortTitleEn and null RoyalAssentDateTime

12 new tests, 52 total passing.

### Downloaders (apps/ingestion/src/downloaders/parliament.ts)

- `PARLIAMENT_SESSIONS` const: all 16 sessions (37-1 through 45-1), 37th Parliament flagged `confirmed: false`
- `fetchVotesXml`, `fetchBallotsXml`, `fetchMembersXml`, `fetchBillsJson` — plain `fetch()` with error handling

### Upsert Functions

- `upsertBills`: INSERT ON CONFLICT DO UPDATE, updates mutable status fields, batch 500
- `upsertVotes`: ON CONFLICT DO UPDATE on unique `(parlSessionCode, divisionNumber)` index; links billId via BillNumberCode lookup, batch 500
- `upsertBallots`: ON CONFLICT DO NOTHING (immutable), sets entityId from PersonId lookup map, batch 1000
- `markBallotsIngested`: flags divisions complete for resumable ingestion

### Runner: 5-Phase Orchestrator

**Phase A (Bills):** Fetches LEGISinfo JSON per session, parses, upserts. Skips gracefully on HTTP error (37th Parliament).

**Phase B (Aggregate votes):** Fetches ourcommons.ca XML per session, parses, upserts with bill linking.

**Phase C (MP entity matching):** For each session's members, checks mp_profiles cache by PersonId — if not matched, runs deterministic → fuzzy (0.85+ auto-accept, 0.60–0.85 AI verify) → new entity fallback. Upserts to mp_profiles. This is NOT in SOURCE_CONFIGS pipeline — PersonId is the ground truth.

**Phase D (Ballots):** Queries parliamentVotes where `ballotsIngested = false` (resumable). Fetches per-division XML with 100ms courteous delay. Applies entityLookup Map from mp_profiles. Logs progress every 100 divisions.

**Phase E (Bill summaries):** Queries bills without summaries. Circuit breaker at 5000 bills. Claude Haiku with grandpa-readable prompt. Batch 50 with 200ms between batches.

### Scheduler + CLI

- `INGEST_PARLIAMENT` job registered in pg-boss, scheduled weekly Sunday 2am UTC
- `parliament` CLI case added: `pnpm ingest parliament`

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Bills are NOT added to entity_connections | Bills are not entities — the PARL-04 cross-reference (voted Yea on bill + received donations) is computed at AI summary time by querying vote_ballots + donations together, not via entity_connections graph |
| PersonId-anchored mp_profiles | Same-name disambiguation: two MPs named "Paul Martin" have different PersonIds — without this anchor, voting records from different eras would be merged incorrectly |
| Resumable ballot ingestion | At 100ms/request, 7,000 divisions = ~12 minutes. `ballotsIngested` flag allows restart without re-fetching already-ingested divisions |
| 37th Parliament flagged `confirmed: false` | XML endpoint returns HTTP 500 for 37th Parliament — confirmed behavior per research. Graceful skip allows pipeline to continue processing 38th–45th |
| 5000-bill circuit breaker | Prevents unexpected AI cost runaway; 3,000 bills total at ~$0.80 is within budget but circuit breaker logs warning and continues |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added `@govtrace/db/schema/parliament` package export**
- **Found during:** Task 2 TypeScript compilation
- **Issue:** packages/db/package.json did not export the new parliament schema, causing TS2307 module-not-found errors in all upsert files
- **Fix:** Added `"./schema/parliament": "./src/schema/parliament.ts"` to package.json exports
- **Files modified:** packages/db/package.json

**2. [Rule 1 - Bug] Fixed TypeScript strict mode array index access in test files**
- **Found during:** Task 2 TypeScript compilation check
- **Issue:** `records[0]` returns `T | undefined` in strict mode — direct property access on possibly-undefined value
- **Fix:** Added null guard `if (!first) throw new Error(...)` before all array index accesses in test files
- **Files modified:** parliament-votes.test.ts, parliament-ballots.test.ts

**3. [Rule 1 - Bug] Fixed `split('T')[0]` returning `string | undefined`**
- **Found during:** Task 2 TypeScript compilation
- **Issue:** `String.split()[0]` has return type `string | undefined` in TypeScript strict mode
- **Fix:** Added nullish coalescing: `split('T')[0] ?? ''`
- **Files modified:** parliament-votes.ts, parliament-votes upsert

**4. [Rule 1 - Bug] Fixed FuzzyCandidate field name mismatch in runner**
- **Found during:** Task 3 TypeScript compilation
- **Issue:** Runner used `best.similarity` and `best.canonicalName` but FuzzyCandidate has `similarityScore` and `entityName`
- **Fix:** Updated field references to match the actual interface; `storeHighConfidenceMatch` takes `FuzzyCandidate` object not string
- **Files modified:** runners/parliament.ts

**5. [Rule 1 - Bug] Fixed ingestionRuns `rawData` → `auditData` field name**
- **Found during:** Task 3 TypeScript compilation
- **Issue:** Runner used `rawData` but ingestionRuns table has `auditData` field for JSONB stats
- **Fix:** Changed to `auditData`
- **Files modified:** runners/parliament.ts

## Known Stubs

None — all parser types are fully typed, all DB references are wired. The runner requires a live database and `ANTHROPIC_API_KEY` at runtime, which is expected for an ingestion pipeline.

## Self-Check: PASSED
