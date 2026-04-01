---
phase: 01-data-foundation
plan: "01"
subsystem: infra
tags: [pnpm, drizzle-orm, postgresql, pg_trgm, docker, monorepo, typescript]

# Dependency graph
requires: []
provides:
  - pnpm workspace monorepo with packages/db, packages/ingestion, packages/web
  - Drizzle schema for all 12 tables (5 raw source, 4 entity resolution, 1 connections graph, 1 jobs, 1 ai_summaries, 1 flags)
  - GIN trigram index on entities.normalized_name for pg_trgm fuzzy search
  - Docker Compose with PostgreSQL 16 and pg_trgm extension auto-enabled
  - pnpm Catalogs pinning drizzle-orm version across all packages (prevents multi-instance bug)
  - Lazy singleton DB client pattern in packages/db/src/client.ts
  - Generated migration SQL in packages/db/drizzle/

affects:
  - 01-02: Elections Canada parser writes to donations table
  - 01-03: Contracts parser writes to contracts table
  - 01-04: Grants parser writes to grants table
  - 01-05: Lobbyist parsers write to lobby_registrations and lobby_communications tables
  - 01-06: Entity normalization uses entities, entityAliases, entityMatchesLog tables
  - 01-07: Entity matching uses pg_trgm GIN index on entities.normalizedName
  - 01-08: Connection graph builder writes to entityConnections table
  - All subsequent phases: web app imports from packages/db via workspace:*

# Tech tracking
tech-stack:
  added:
    - drizzle-orm ^0.45.2 (via pnpm catalog)
    - drizzle-kit ^0.30.0 (via pnpm catalog)
    - postgres ^3.4.5 (via pnpm catalog)
    - zod ^3.24.0 (via pnpm catalog)
    - papaparse ^5.4.1 (via pnpm catalog)
    - pg-boss ^9.0.0 (via pnpm catalog)
    - chardet ^2.0.0 (via pnpm catalog)
    - iconv-lite ^0.6.3 (via pnpm catalog)
    - "@anthropic-ai/sdk" ^0.80.0 (via pnpm catalog)
    - "@tanstack/react-start" ^1.167.0
    - tailwindcss ^4.0.0
    - PostgreSQL 16-alpine via Docker
  patterns:
    - pnpm Catalogs for monorepo dependency version pinning
    - Lazy DB singleton (let _db = null) to prevent module-load-time connection initialization
    - Deterministic hash IDs (text primaryKey) for idempotent CSV re-ingestion
    - pg_trgm GIN index using sql template literal for custom operator class
    - Pre-computed entity_connections table (no runtime JOINs for graph queries)
    - JSONB rawData column on all source tables for full row preservation

key-files:
  created:
    - package.json
    - pnpm-workspace.yaml
    - .npmrc
    - tsconfig.base.json
    - .env.example
    - .gitignore
    - pnpm-lock.yaml
    - packages/db/package.json
    - packages/db/tsconfig.json
    - packages/db/drizzle.config.ts
    - packages/db/src/schema/raw.ts
    - packages/db/src/schema/entities.ts
    - packages/db/src/schema/connections.ts
    - packages/db/src/schema/jobs.ts
    - packages/db/src/client.ts
    - packages/db/drizzle/0000_tidy_tusk.sql
    - packages/ingestion/package.json
    - packages/ingestion/tsconfig.json
    - packages/ingestion/src/index.ts
    - packages/ingestion/Dockerfile
    - packages/web/package.json
    - packages/web/tsconfig.json
    - docker-compose.yml
    - docker/postgres-init.sql
  modified: []

key-decisions:
  - "pnpm Catalog enforces single drizzle-orm version across all packages — prevents the known pnpm multi-instance bug"
  - "Lazy DB init (let _db = null) pattern required — eager module-load init causes connection pool exhaustion in Next.js/TanStack Start HMR"
  - "Deterministic text IDs for all raw tables (SHA256 of source key fields) — enables idempotent re-ingestion without duplicates"
  - "Pre-computed entity_connections table avoids runtime JOIN overhead for graph queries on Canadian federal data scale"
  - "pg_trgm GIN index must be created after pg_trgm extension in postgres-init.sql — order matters"
  - "Docker port bound to 127.0.0.1:5432, not 0.0.0.0 — prevents Docker DNAT from bypassing Hetzner firewall on production server"

patterns-established:
  - "Catalog pattern: all shared library versions defined in pnpm-workspace.yaml catalog, packages reference with 'catalog:'"
  - "Lazy singleton: let _db: ReturnType<typeof drizzle> | null = null; export function getDb() { if (_db !== null) return _db; ... }"
  - "Deterministic IDs: all raw source tables use text('id').primaryKey() with SHA256 hash keys, not auto-increment or random UUIDs"
  - "rawData: jsonb('raw_data').notNull() on every raw source table — preserve full original CSV row for audit trail"

requirements-completed:
  - INFRA-01
  - INFRA-02
  - INFRA-03
  - INFRA-04
  - INFRA-07

# Metrics
duration: 39min
completed: 2026-03-31
---

# Phase 01 Plan 01: Monorepo Bootstrap Summary

**pnpm monorepo with Drizzle-ORM schema for 12 PostgreSQL tables, GIN trigram index, pg_trgm Docker init, and pnpm Catalogs preventing drizzle multi-instance version drift**

## Performance

- **Duration:** 39 min
- **Started:** 2026-04-01T03:33:28Z
- **Completed:** 2026-04-01T04:12:35Z
- **Tasks:** 3
- **Files modified:** 24

## Accomplishments

- Complete pnpm workspace monorepo with packages/db (shared schema), packages/ingestion (data pipeline), packages/web (TanStack Start app)
- Drizzle schema covering all 12 tables: 5 raw source tables (donations, contracts, grants, lobby_registrations, lobby_communications), 4 entity resolution tables (entities, entityAliases, entityMatchesLog, ai_summaries), plus flags, entityConnections, and ingestion_runs
- `pnpm db:generate` successfully produces migration SQL — 12 tables with all indexes including GIN trigram on entities.normalized_name
- Docker Compose ready for `docker compose up -d postgres` once Docker daemon is running; pg_trgm auto-enabled via postgres-init.sql

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold monorepo with pnpm Catalogs and root config** - `ac8ccfe` (chore)
2. **Task 2: Create packages/db with complete Drizzle schema for all 10 tables** - `91df4fc` (feat)
3. **Task 3: Create packages/ingestion and packages/web skeletons, Docker Compose** - `8c5e38b` (feat)
4. **Auto-fixes: root script names, vite peer dep, gitignore, migrations** - `dbbb7da` (fix)

## Files Created/Modified

- `package.json` - Root workspace scripts (dev, build, db:generate, db:migrate, db:studio, ingest)
- `pnpm-workspace.yaml` - Workspace definition with pnpm Catalogs for 12 shared dependencies
- `.npmrc` - Non-hoisted, strict peer deps off, auto-install-peers on
- `tsconfig.base.json` - Strict TypeScript with noUncheckedIndexedAccess and exactOptionalPropertyTypes
- `.env.example` - DATABASE_URL and ANTHROPIC_API_KEY template
- `.gitignore` - Excludes node_modules, dist, .env, .DS_Store
- `packages/db/package.json` - @govtrace/db package with catalog: references
- `packages/db/drizzle.config.ts` - Drizzle config pointing to ./src/schema
- `packages/db/src/schema/raw.ts` - 5 raw source tables with deterministic hash IDs and rawData JSONB
- `packages/db/src/schema/entities.ts` - entities, entityAliases, entityMatchesLog, aiSummaries, flags tables
- `packages/db/src/schema/connections.ts` - entityConnections pre-computed graph table
- `packages/db/src/schema/jobs.ts` - ingestionRuns audit log table
- `packages/db/src/client.ts` - Lazy singleton DB init, exports getDb(), schema, Db type
- `packages/db/drizzle/0000_tidy_tusk.sql` - Generated migration with all 12 tables and GIN index
- `packages/ingestion/package.json` - All data pipeline deps from catalog
- `packages/ingestion/src/index.ts` - Stub entry point for ingestion commands
- `packages/ingestion/Dockerfile` - node:20-alpine with pnpm@9
- `packages/web/package.json` - TanStack Start 1.167.x, React 19, Tailwind v4, vite ^7.0.0
- `docker-compose.yml` - PostgreSQL 16 on 127.0.0.1:5432, ingestion behind profiles:[ingestion]
- `docker/postgres-init.sql` - CREATE EXTENSION IF NOT EXISTS pg_trgm

## Decisions Made

- pnpm Catalogs enforce single drizzle-orm version across all packages — prevents known pnpm multi-instance bug where Drizzle schema types become incompatible
- Lazy DB singleton (let _db = null) prevents connection pool exhaustion during TanStack Start HMR/dev reload
- Deterministic text IDs for raw source tables allow idempotent CSV re-ingestion without duplicate detection queries
- Pre-computed entityConnections table allows graph queries without joining 5 raw tables at query time

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Root db:generate/migrate/studio scripts had wrong pnpm filter syntax**
- **Found during:** Task 3 verification (`pnpm db:generate` failed)
- **Issue:** Plan specified `pnpm --filter @govtrace/db drizzle-kit generate` but packages/db scripts are named `generate`, `migrate`, `studio` — the filter command runs package scripts by name
- **Fix:** Changed to `pnpm --filter @govtrace/db generate` (and same for migrate/studio)
- **Files modified:** `package.json`
- **Verification:** `pnpm db:generate` successfully generated migration SQL with 12 tables
- **Committed in:** dbbb7da

**2. [Rule 2 - Missing Critical] vite version incompatible with @tanstack/react-start 1.167.x**
- **Found during:** Task 3 (`pnpm install` peer dependency warnings)
- **Issue:** Plan specified vite `^6.0.0` but @tanstack/react-start 1.167.16 requires vite `>=7.0.0`; peer dependency unmet
- **Fix:** Bumped vite to `^7.0.0` in packages/web/package.json
- **Files modified:** `packages/web/package.json`
- **Verification:** `pnpm install` completed with no peer dependency warnings
- **Committed in:** dbbb7da

---

**Total deviations:** 2 auto-fixed (1 Rule 1 bug, 1 Rule 2 missing critical peer dependency)
**Impact on plan:** Both fixes required for `pnpm db:generate` and `pnpm install` to work correctly. No scope creep.

## Issues Encountered

- Docker daemon not running on dev machine — Docker Compose verification steps skipped. Migration generation (`pnpm db:generate`) confirmed schema validity without requiring Docker. Full end-to-end verification (docker compose up, pnpm db:migrate, pg_trgm verification) requires Docker daemon to be started.

## User Setup Required

Before running the database:
1. Start Docker Desktop or OrbStack
2. Run `docker compose up -d postgres` from project root
3. Wait for health: `docker compose exec postgres pg_isready -U govtrace`
4. Apply migrations: `pnpm db:migrate`
5. Verify pg_trgm: `docker compose exec postgres psql -U govtrace -d govtrace -c "SELECT extname FROM pg_extension WHERE extname = 'pg_trgm';"`
6. Verify tables: `docker compose exec postgres psql -U govtrace -d govtrace -c "\dt"`

## Next Phase Readiness

- All schema tables defined and migration SQL generated — parsers (Plans 02–05) have a stable target schema
- Both packages/ingestion and packages/web reference packages/db via workspace:* — schema import works immediately
- pnpm Catalogs ensure consistent drizzle-orm version across all packages
- Blocker: Docker daemon must be running before database-dependent tasks in Plans 02–05 can be fully verified

---
*Phase: 01-data-foundation*
*Completed: 2026-03-31*
