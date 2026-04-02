---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 02-02-PLAN.md (search server functions)
last_updated: "2026-04-02T00:59:00.247Z"
last_activity: 2026-04-02
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 18
  completed_plans: 12
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-31)

**Core value:** Anyone can search a name and instantly trace the flow of money and influence across all public government datasets — with clarity a 9-year-old could follow.
**Current focus:** Phase 02 — search-and-entity-profiles

## Current Position

Phase: 02 (search-and-entity-profiles) — EXECUTING
Plan: 2 of 7
Status: Ready to execute
Last activity: 2026-04-02

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| — | — | — | — |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01-data-foundation P01 | 39 | 3 tasks | 24 files |
| Phase 01-data-foundation P02 | 2 | 2 tasks | 6 files |
| Phase 01-data-foundation P04 | 15 | 3 tasks | 9 files |
| Phase 01-data-foundation P03 | 5 | 3 tasks | 11 files |
| Phase 01-data-foundation P05 | 5 minutes | 3 tasks | 10 files |
| Phase 01-data-foundation P06 | 10 minutes | 2 tasks | 7 files |
| Phase 01-data-foundation P07 | 2 minutes | 2 tasks | 3 files |
| Phase 01-data-foundation P08 | 3 minutes | 2 tasks | 3 files |
| Phase 01-data-foundation P09 | 3 minutes | 1 tasks | 2 files |
| Phase 01-data-foundation P10 | 1 minute | 2 tasks | 9 files |
| Phase 01-data-foundation P11 | 25min | 2 tasks | 9 files |
| Phase 02-search-and-entity-profiles P02 | 5min | 2 tasks | 4 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Data-first approach: ingestion pipeline must be solid before any UI work begins
- pg_trgm extension required on PostgreSQL 16 — must be enabled during infra setup
- Claude Batch API for historical backfill — circuit breaker required above 10,000 candidates
- TanStack Start requires custom server wrapper for Coolify deployment (GitHub issue #5476)
- [Phase 01-data-foundation]: pnpm Catalogs enforce single drizzle-orm version across packages — prevents multi-instance bug
- [Phase 01-data-foundation]: Lazy DB singleton (let _db = null) in packages/db/src/client.ts prevents HMR connection pool exhaustion
- [Phase 01-data-foundation]: Deterministic text IDs (SHA256 hash) for all raw source tables enables idempotent CSV re-ingestion
- [Phase 01-data-foundation]: Pre-computed entityConnections table — no runtime JOINs across 5 raw tables for graph queries
- [Phase 01-data-foundation]: srvx toNodeHandler wraps TanStack Start handler for Coolify Node.js HTTP compatibility (GitHub issue #5476 workaround)
- [Phase 01-data-foundation]: expose: not ports: for postgres in docker-compose.yml — Docker DNAT bypasses Hetzner firewall with ports: mapping (INFRA-06)
- [Phase 01-data-foundation]: docker-compose.override.yml gitignored pattern for local dev DB port access — never committed to production compose
- [Phase 01-data-foundation]: Contracts use contract_id as primary key when available; grants always use SHA-256 hash (no government ID in public CSV)
- [Phase 01-data-foundation]: BATCH_SIZE=500 for contracts and grants (smaller than donations due to larger description fields)
- [Phase 01-data-foundation]: vitest added as test framework for ingestion package TDD
- [Phase 01-data-foundation]: deriveSourceKey normalizes fields (trim+toLowerCase) before hashing for consistent IDs despite whitespace variation
- [Phase 01-data-foundation]: sourceFileHash.slice(0,8) included in donation ID derivation to scope keys to source file, preventing cross-file ID collisions
- [Phase 01-data-foundation]: Lobby registrations use government registration_number directly as ID (stable key, no hash); communications use deriveSourceKey([regNum, date, lobbyist, official]) since no government key exists
- [Phase 01-data-foundation]: LEGAL_SUFFIXES contains only true legal registration forms (Inc/Ltd/Corp/Ltée) — not generic business words like 'group', 'services', 'canada' which are meaningful name parts
- [Phase 01-data-foundation]: Drizzle select() API used instead of db.query relational API in matcher — avoids TypeScript type inference issue with merged schema export in getDb()
- [Phase 01-data-foundation]: claude-haiku-3-5 as default model for cost-efficient AI entity verification; SONNET_MODEL exported for caller escalation to stronger model
- [Phase 01-data-foundation]: Circuit breaker at 10,000 uncertain candidates with cost estimate in error message — prevents AI cost runaway during historical backfill (D-07, Pitfall 4)
- [Phase 01-data-foundation]: Claude Batch API flow: collect uncertain records → circuit breaker → batches.create → store batchId in matchMethod → poll until ended → stream results; every decision logged with aiModel/aiConfidence/aiReasoning
- [Phase 01-data-foundation]: Mark-stale/rebuild/cleanup pattern for idempotent entity_connections rebuild — no empty-table window during rebuild vs DELETE+INSERT
- [Phase 01-data-foundation]: pg-boss scheduler: weekly cadence for elections-canada and lobbying sources, quarterly first-Sunday for contracts and grants, build-connections at 8am Sunday after all other jobs
- [Phase 01-data-foundation]: onConflictDoUpdate conflict target must match composite uniqueIndex (canonical_name, entity_type) — normalized_name only has GIN index for pg_trgm, not a unique constraint
- [Phase 01-data-foundation]: apps/ for applications, packages/ for shared libs — required monorepo split before web scaffold in Plan 01-11
- [Phase 01-data-foundation]: packages/web renamed to packages/web-deprecated rather than deleted — preserves reference files, avoids duplicate @govtrace/web conflict
- [Phase 01-data-foundation]: Turborepo turbo run with --filter=@govtrace/web for targeted dev/build rather than running all workspace packages
- [Phase 01-data-foundation]: HeadContent from @tanstack/react-router replaces Meta from @tanstack/react-start in TanStack Start v1.167 (Meta not exported in v1.167)
- [Phase 01-data-foundation]: router.tsx exports getRouter() not createRouter() — TanStack Start plugin aliases it as #tanstack-router-entry and imports { getRouter } in hydrateStart
- [Phase 01-data-foundation]: client.tsx uses @tanstack/react-start/client for StartClient with no router prop — StartClient hydrates from SSR context in v1.167
- [Phase 01-data-foundation]: packages/web-deprecated renamed to @govtrace/web-deprecated package name to prevent pnpm --filter @govtrace/web conflict with apps/web
- [Phase 02-search-and-entity-profiles]: lobbyRegistrations uses lobbyistEntityId and clientEntityId FKs (not entityId) — lobby count uses OR across both columns to capture entity in both lobbyist and client roles
- [Phase 02-search-and-entity-profiles]: createAPIFileRoute routes do not appear in routeTree.gen.ts — correct TanStack Start v1.167 behavior; API routes handled separately from page routes by Vite plugin

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 1 NEEDS PHASE RESEARCH: Historical Elections Canada CSV schemas (2004–2026 eras) and lobbycanada.gc.ca bulk export dataset ID need verification before parsers are written
- Phase 3 NEEDS PHASE RESEARCH: D3 force-directed graph performance at realistic Canadian entity network densities needs benchmarking

## Session Continuity

Last session: 2026-04-02T00:59:00.244Z
Stopped at: Completed 02-02-PLAN.md (search server functions)
Resume file: None
