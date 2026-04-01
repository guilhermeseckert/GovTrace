---
phase: 01-data-foundation
plan: 05
subsystem: ingestion
tags: [lobby, ingestion, csv-parsing, idempotent-upsert, encoding-detection]
dependency_graph:
  requires:
    - 01-01 (schema: lobbyRegistrations and lobbyCommunications tables in raw.ts)
    - 01-03 (lib/encoding.ts and lib/hash.ts — shared utilities, also independently created here)
  provides:
    - parseLobbyRegistrationsFile (parsers/lobby-registrations.ts)
    - parseLobbyCommunicationsFile (parsers/lobby-communications.ts)
    - upsertLobbyRegistrations (upsert/lobby-registrations.ts)
    - upsertLobbyCommunications (upsert/lobby-communications.ts)
    - runLobbyRegistrationsIngestion (runners/lobby-registrations.ts)
    - runLobbyCommunicationsIngestion (runners/lobby-communications.ts)
  affects:
    - packages/ingestion/src/index.ts (all 5 sources now wired)
    - 01-06 (entity matching — consumes all 5 raw tables, now complete)
tech_stack:
  added: []
  patterns:
    - header-driven CSV parsing with multi-variant column aliases (same as contracts/grants)
    - registration_number used directly as stable government ID (no hash needed for registrations)
    - deriveSourceKey([regNum, date, lobbyist, official]) for communications (no government key)
    - onConflictDoUpdate targeting id for idempotent re-ingestion
    - normalized fields left null at ingestion time (Plan 06 normalizer fills them)
key_files:
  created:
    - packages/ingestion/src/downloaders/lobby-registrations.ts
    - packages/ingestion/src/parsers/lobby-registrations.ts
    - packages/ingestion/src/upsert/lobby-registrations.ts
    - packages/ingestion/src/runners/lobby-registrations.ts
    - packages/ingestion/src/downloaders/lobby-communications.ts
    - packages/ingestion/src/parsers/lobby-communications.ts
    - packages/ingestion/src/upsert/lobby-communications.ts
    - packages/ingestion/src/runners/lobby-communications.ts
  modified:
    - packages/ingestion/src/index.ts (added lobby-registrations, lobby-communications cases and completed all case)
    - packages/ingestion/src/lib/encoding.ts (recommitted — identical to Plan 03 version)
    - packages/ingestion/src/lib/hash.ts (recommitted — identical to Plan 03 version)
decisions:
  - registration_number used directly as record ID (stable government key); no SHA-256 hash needed for registrations
  - communications use deriveSourceKey([registrationNumber, date, lobbyistName, officialName]) — no stable government key exists
  - clientName absence in lobby registrations triggers a console.warn but does not skip the row (in-house registrations have no client)
  - communicationDate, lobbyistName, and publicOfficialName are required for communications — rows missing any are skipped
  - normalizedLobbyistName, normalizedClientName, normalizedOfficialName all set to null at ingestion — Plan 06 normalizer fills them
  - Sequential all-source execution (not parallel) to avoid lobbycanada.gc.ca rate limits and maintain readable audit log
metrics:
  duration: 5 minutes
  completed_date: 2026-04-01
  tasks_completed: 3
  files_created: 10
  files_modified: 1
---

# Phase 01 Plan 05: Lobby Registrations and Communications Ingestion Summary

**One-liner:** Lobby registrations and communications ingestion pipelines with header-driven parsing, government registration_number as stable ID, and deterministic composite ID for communications — completing all 5 data sources.

## What Was Built

### Task 1: Lobby Registrations Pipeline

- **packages/ingestion/src/downloaders/lobby-registrations.ts** — Downloads bulk CSV from `lobbycanada.gc.ca/app/secure/ocl/lrs/do/clntSmmry`. Follows 302 redirects via fetch, returns `{ localPath, fileHash, fileSizeBytes }`.
- **packages/ingestion/src/parsers/lobby-registrations.ts** — `LobbyRegistrationRecord` type and `parseLobbyRegistrationsFile` function. Uses `detectAndTranscode` for encoding detection. Header-driven with `resolveColumn()` helper that checks multiple column name variants. Logs a warning (not error) when `client_name` is absent — valid for in-house registrations. Uses `registrationNumber` directly as `id` (stable government key — no hash needed).
- **packages/ingestion/src/upsert/lobby-registrations.ts** — `upsertLobbyRegistrations` function. BATCH_SIZE=500. `onConflictDoUpdate` targeting `lobbyRegistrations.id`. Preserves all fields except normalized names (set to null for Plan 06).
- **packages/ingestion/src/runners/lobby-registrations.ts** — `runLobbyRegistrationsIngestion` orchestrator. Creates `ingestionRuns` record with `source: 'lobby_registrations'`. Full error handling with failed status on exception.

### Task 2: Lobby Communications Pipeline

- **packages/ingestion/src/downloaders/lobby-communications.ts** — Downloads bulk CSV from `lobbycanada.gc.ca/app/secure/ocl/lrs/do/cmmnctnSrch`. Same pattern as registrations downloader.
- **packages/ingestion/src/parsers/lobby-communications.ts** — `LobbyCommunicationRecord` type and `parseLobbyCommunicationsFile` function. Uses `detectAndTranscode` and `deriveSourceKey`. Three required fields: `communicationDate`, `lobbyistName`, `publicOfficialName` — rows missing any are skipped. Deterministic ID = `deriveSourceKey([registrationNumber, communicationDate, lobbyistName, publicOfficialName])`.
- **packages/ingestion/src/upsert/lobby-communications.ts** — `upsertLobbyCommunications`. BATCH_SIZE=500. `onConflictDoUpdate` on `lobbyCommunications.id`.
- **packages/ingestion/src/runners/lobby-communications.ts** — `runLobbyCommunicationsIngestion` orchestrator. `source: 'lobby_communications'` in audit log.

### Task 3: Complete 5-Source CLI

- **packages/ingestion/src/index.ts** — Added `lobby-registrations` and `lobby-communications` individual cases. Updated `all` case to run all 5 sources sequentially: `elections-canada → contracts → grants → lobby-registrations → lobby-communications`.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| `registration_number` as direct ID for registrations | Government-issued stable key; no hashing needed unlike other sources |
| Composite hash for communications | No stable government key exists for communications; hash ensures idempotency |
| `clientName` absence is a warning, not skip | In-house lobbyists have no client — absence is valid business logic |
| `communicationDate` required for communications | Without a date, a communication record has no temporal context — skip is correct |
| Sequential `all` execution | Avoids lobbycanada.gc.ca rate limits; audit log is easier to read chronologically |

## Deviations from Plan

### Auto-created Dependencies

**[Rule 3 - Blocking] Created lib/encoding.ts and lib/hash.ts**
- **Found during:** Task 1 setup — files referenced in plan interfaces but Plan 03 (Wave 2 parallel) had already executed
- **Issue:** Since Plans 03, 04, and 05 run in parallel (Wave 2), encoding.ts and hash.ts already existed from Plan 03. My initial creation was redundant — the files are identical. They were included in the Task 1 commit but do not conflict with Plan 03's versions.
- **Fix:** Files created were identical to Plan 03 versions; no functional impact
- **Files modified:** packages/ingestion/src/lib/encoding.ts, packages/ingestion/src/lib/hash.ts
- **Commit:** b5353cf

### Auto-fixed Bug

**[Rule 1 - Bug] Fixed incorrect @govtrace/db import paths**
- **Found during:** Task 1/2 review against existing pattern in contracts.ts upsert
- **Issue:** Initially wrote imports as `@govtrace/db/src/client.ts` and `@govtrace/db/src/schema/raw.ts` — incorrect. The packages/db/package.json exports map uses `@govtrace/db/client` and `@govtrace/db/schema/raw` (no `/src/` prefix, no `.ts` extension)
- **Fix:** Updated lobby-registrations upsert and runner to use correct export paths matching contracts.ts pattern
- **Files modified:** packages/ingestion/src/upsert/lobby-registrations.ts, packages/ingestion/src/runners/lobby-registrations.ts
- **Commit:** fce3bbf

## Known Stubs

None — all lobby ingestion fields are wired to the CSV source data. The `normalizedLobbyistName`, `normalizedClientName`, and `normalizedOfficialName` fields are intentionally null at ingestion time — this is documented behavior, not a stub. They will be populated by the Plan 06 entity normalizer.

## Self-Check: PASSED

### Created files exist:
- packages/ingestion/src/downloaders/lobby-registrations.ts: FOUND
- packages/ingestion/src/parsers/lobby-registrations.ts: FOUND
- packages/ingestion/src/upsert/lobby-registrations.ts: FOUND
- packages/ingestion/src/runners/lobby-registrations.ts: FOUND
- packages/ingestion/src/downloaders/lobby-communications.ts: FOUND
- packages/ingestion/src/parsers/lobby-communications.ts: FOUND
- packages/ingestion/src/upsert/lobby-communications.ts: FOUND
- packages/ingestion/src/runners/lobby-communications.ts: FOUND

### Commits exist:
- b5353cf feat(01-05): build lobby registrations ingestion pipeline
- a9dc957 feat(01-05): build lobby communications ingestion pipeline
- 2f3e19a feat(01-05): wire all 5 sources into ingestion CLI
- fce3bbf fix(01-05): correct import paths to use @govtrace/db package exports
