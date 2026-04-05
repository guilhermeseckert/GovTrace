---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: International Money Tracking
status: verifying
stopped_at: Completed 07-02-PLAN.md
last_updated: "2026-04-05T05:50:20.132Z"
last_activity: 2026-04-05
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 6
  completed_plans: 6
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-31)

**Core value:** Anyone can search a name and instantly trace the flow of money and influence across all public government datasets — with clarity a 9-year-old could follow.
**Current focus:** Phase 07 — parliamentary-voting-records

## Current Position

Phase: 999.1
Plan: Not started
Status: Phase complete — ready for verification
Last activity: 2026-04-05

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
| Phase 02-search-and-entity-profiles P01 | 6min | 2 tasks | 18 files |
| Phase 02-search-and-entity-profiles P04 | 6min | 2 tasks | 7 files |
| Phase 02-search-and-entity-profiles P05 | 2min | 2 tasks | 6 files |
| Phase 02-search-and-entity-profiles P03 | 3min | 2 tasks | 7 files |
| Phase 02-search-and-entity-profiles P07 | 6min | 2 tasks | 4 files |
| Phase 02-search-and-entity-profiles P06 | 4min | 2 tasks | 7 files |
| Phase 03-visualizations P01 | 4min | 3 tasks | 5 files |
| Phase 03-visualizations P02 | 2min | 1 tasks | 1 files |
| Phase 03-visualizations P03 | 4min | 2 tasks | 4 files |
| Phase 03-visualizations P04 | 3min | 1 tasks | 2 files |
| Phase 04.1-how-it-works P01 | 3min | 1 tasks | 2 files |
| Phase 04.1-how-it-works P02 | 2min | 2 tasks | 1 files |
| Phase 04.2-entity-profile-storytelling P01 | 4min | 2 tasks | 4 files |
| Phase 04.2-entity-profile-storytelling P02 | 3min | 2 tasks | 3 files |
| Phase 04.2-entity-profile-storytelling P03 | 1min | 1 tasks | 2 files |
| Phase 05-international-aid-ingestion P01 | 6min | 2 tasks | 12 files |
| Phase 05 P02 | 4 minutes | 2 tasks | 7 files |
| Phase 06-debt-vs-spending-dashboard P01 | 8 minutes | 2 tasks | 8 files |
| Phase 07-parliamentary-voting-records P01 | 642s | 3 tasks | 19 files |
| Phase 07-parliamentary-voting-records P02 | 626s | 2 tasks | 9 files |

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
- [Phase 02-search-and-entity-profiles]: getCookie from @tanstack/react-start/server replaces getWebRequest — not exported in TanStack Start v1.167.16
- [Phase 02-search-and-entity-profiles]: Vite resolve.alias required for @/* path resolution in addition to tsconfig.json paths — tsconfig paths alone insufficient for Rollup bundling
- [Phase 02-search-and-entity-profiles]: shadcn CLI v4 uses oklch colors by default; overridden to HSL CSS variables for government blue #1a3a5c compatibility
- [Phase 02-search-and-entity-profiles]: getCookie from @tanstack/react-start/server replaces getWebRequest (removed in v1.167) for SSR cookie reads
- [Phase 02-search-and-entity-profiles]: Lobby tables use dual-FK pattern (lobbyistEntityId OR clientEntityId) — no single entityId FK; queries must use OR
- [Phase 02-search-and-entity-profiles]: ProfileTabs accepts optional ReactNode slot props (donationsTable etc.) so Plan 06 can inject DataTable components without modifying tab structure
- [Phase 02-search-and-entity-profiles]: 3-state badge pattern: getState() pure function + STATE_CONFIG as const map for type-safe color/icon/label selection (ConfidenceBadge)
- [Phase 02-search-and-entity-profiles]: loaderDeps pattern in search.tsx instead of context.location.search — avoids TypeScript type inference issues with TanStack Start v1.167 loader context shape
- [Phase 02-search-and-entity-profiles]: SearchResults seenLabels Set deduplicates Companies/Organizations group label across company and organization entity type keys
- [Phase 02-search-and-entity-profiles]: FlagModal copy strings all sourced from en.ts (en.flag.*) — never hardcoded, ensuring DSGN-04 compliance and i18n readiness
- [Phase 02-search-and-entity-profiles]: Confirmation-replace pattern for FlagModal: after submit success, modal body replaced with confirmation paragraph and single Close button
- [Phase 02-search-and-entity-profiles]: LobbyingTable merges getLobbying nested {registrations, communications} response into flat LobbyRow[] before useReactTable — avoids dual-table pagination complexity
- [Phase 02-search-and-entity-profiles]: getEntityProvenance uses Drizzle max() aggregation in parallel Promise.all across 5 tables — called in route loader not lazily on client
- [Phase 02-search-and-entity-profiles]: ContractsTable constructs buyandsell.gc.ca fallback URL from contractId when rawData.source_url absent
- [Phase 03-visualizations]: Array.from(db.execute()) not .rows — postgres RowList<T[]> extends T[] directly, no .rows property; use Array.from() to iterate
- [Phase 03-visualizations]: db.execute(sql WITH RECURSIVE ... CYCLE) for graph traversal — Drizzle has no WITH RECURSIVE support (issue #209 unresolved)
- [Phase 03-visualizations]: getMoneyFlow queries donations + contracts tables directly, not entity_connections — Pitfall 7: no direct donor->contract link exists in entity_connections
- [Phase 03-visualizations]: useNetworkGraph hook isolates simulation/loading state from rendering; nodes.length deps prevent stale closures; position map preserved on expandNode; stable SVG for zoom stability
- [Phase 03-visualizations]: @types/d3-sankey separate install required — @types/d3 v7.4.3 does not bundle d3-sankey types despite d3-sankey being a companion package
- [Phase 03-visualizations]: d3.select on containerRef used exclusively to attach zoom handler in ActivityTimeline — not for SVG rendering; aligns with research Pattern 2
- [Phase 03-visualizations]: d3.timeYear.every(2) may return TimeInterval | undefined — guard with ternary before passing to xScale.ticks() to avoid TypeScript overload mismatch
- [Phase 03-visualizations]: hidden attribute (not conditional rendering) for viz sub-tab switching — keeps D3 SVG mounted and zoom listeners intact
- [Phase 03-visualizations]: VisualizationsPanel defined inline in entity route file — no barrel file, co-located with only consumer
- [Phase 03-visualizations]: vizContent slot prop pattern in ProfileTabs follows existing donationsTable/connectionsTable pattern for decoupled wiring
- [Phase 04.1-how-it-works]: Static const arrays with as const for page content — no server functions needed for purely static explainer pages
- [Phase 04.1-how-it-works]: BookOpen icon for How it works NavLink — conveys learn semantics matching the explainer page purpose
- [Phase 04.2-entity-profile-storytelling]: PROMPT_VERSION suffix on model field (-v2) invalidates old cached summaries without DB migration
- [Phase 04.2-entity-profile-storytelling]: getTopConnections queries both entityAId and entityBId directions, merges and sorts by totalValue desc
- [Phase 04.2-entity-profile-storytelling]: Shared connection-labels.ts is single source of truth for CONNECTION_LABELS and formatAmount
- [Phase 04.2-entity-profile-storytelling]: BORDER_COLORS separate from CONNECTION_LABELS — border-l-* classes differ from badge bg/text classes
- [Phase 04.2-entity-profile-storytelling]: HIGH_VALUE_THRESHOLD=500K as top-1% proxy; TEMPORAL_CLUSTER_DAYS=90 for lobbying-near-contract pattern
- [Phase 04.2-entity-profile-storytelling]: db.execute raw SQL for temporal clustering self-join — Drizzle ORM lacks support for this query shape
- [Phase 04.2-entity-profile-storytelling]: Story-first layout promotes NetworkGraph from viz sub-tab to inline story mode; ProfileTabs conditionally rendered (not CSS hidden) behind toggle
- [Phase 05-international-aid-ingestion]: fast-xml-parser chosen over node-xml-stream-parser: 9-29MB files acceptable for full-document parse; simpler API
- [Phase 05-international-aid-ingestion]: iati-identifier used as PK directly (no hash) — globally unique and stable by IATI standard
- [Phase 05-international-aid-ingestion]: isArray callback forces array mode for all repeated IATI elements to prevent single-element collapse
- [Phase 05]: IATI identifier last segment used to construct Global Affairs Canada project browser URL in AidTable
- [Phase 05]: AidTable mirrors GrantsTable pattern for consistency; i18n not extended as tab descriptions use hardcoded strings matching existing pattern
- [Phase 06-debt-vs-spending-dashboard]: SHA256(series+refDate) as fiscal_snapshots PK for idempotent re-ingestion; SCALAR_FACTOR normalised to millions in parser; annual debt uses latest-month-per-year subquery (avoids partial-year dip); FEDERAL_ELECTION_DATES hardcoded as const
- [Phase 07-parliamentary-voting-records]: PersonId-anchored mp_profiles as stable ground truth for MP entity matching — prevents same-name MP merging across eras
- [Phase 07-parliamentary-voting-records]: Bills not added to entity_connections — bills are not entities; PARL-04 cross-reference is query-time via vote_ballots + donations join
- [Phase 07-parliamentary-voting-records]: PROMPT_VERSION -v3 invalidates existing politician AI summaries to regenerate with PARL-04 voting pattern context
- [Phase 07-parliamentary-voting-records]: DivisionCard MP list collapsed by default — bills have up to 338 ballots which would create poor UX if all expanded

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 1 NEEDS PHASE RESEARCH: Historical Elections Canada CSV schemas (2004–2026 eras) and lobbycanada.gc.ca bulk export dataset ID need verification before parsers are written
- Phase 3 NEEDS PHASE RESEARCH: D3 force-directed graph performance at realistic Canadian entity network densities needs benchmarking

## Session Continuity

Last session: 2026-04-05T05:44:55.716Z
Stopped at: Completed 07-02-PLAN.md
Resume file: None
