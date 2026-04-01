---
phase: 01-data-foundation
plan: 02
subsystem: infra
tags: [docker, coolify, hetzner, tanstack-start, srvx, postgresql, security]

# Dependency graph
requires:
  - phase: 01-data-foundation/01-01
    provides: monorepo scaffold with packages/web, packages/ingestion, packages/db, pnpm workspace

provides:
  - Production Docker image for the web service (packages/web/Dockerfile, multi-stage)
  - Custom server wrapper for TanStack Start Coolify deployment (packages/web/server.ts)
  - Security-hardened docker-compose.yml with expose: (not ports:) for PostgreSQL
  - Local dev override pattern for DB access (docker-compose.override.yml, gitignored)

affects:
  - 01-data-foundation/01-03 (ingestion worker)
  - phase-02-search-profiles (web deployment)
  - any future Coolify deployment configuration

# Tech tracking
tech-stack:
  added:
    - srvx ^0.6.0 (Node.js HTTP server adapter for TanStack Start's fetch-based handler)
  patterns:
    - TanStack Start requires custom server wrapper — build output exports a handler, not a runnable server (GitHub #5476 workaround)
    - Docker expose: vs ports: — use expose: in production to prevent Docker DNAT from bypassing Hetzner firewall
    - docker-compose.override.yml pattern for local dev DB access (gitignored, never committed)
    - Multi-stage Docker build: base → deps → builder → runner for minimal production image

key-files:
  created:
    - packages/web/server.ts
    - packages/web/Dockerfile
    - packages/web/tsconfig.server.json
    - docker-compose.override.yml
  modified:
    - docker-compose.yml
    - packages/web/package.json
    - .gitignore

key-decisions:
  - "srvx toNodeHandler wraps TanStack Start's fetch-based handler for Node.js HTTP compatibility (Coolify gotcha #1)"
  - "expose: not ports: for postgres and web in docker-compose.yml — Docker bypasses Hetzner firewall/UFW with ports: mapping (INFRA-06)"
  - "docker-compose.override.yml pattern for local dev port binding — gitignored, never affects production"
  - "ENV DATABASE_URL=placeholder in Dockerfile builder stage is intentional — satisfies Drizzle schema import at build time; actual URL injected at runtime"

patterns-established:
  - "Pattern 1: TanStack Start server wrapper — import handler via dynamic import, wrap with srvx createApp + toNodeHandler"
  - "Pattern 2: Docker security — expose: for internal services, ports: only in gitignored override for local dev"
  - "Pattern 3: build:server tsc compilation separate from vinxi build — server.ts compiled to server.js for node execution"

requirements-completed:
  - INFRA-05
  - INFRA-06

# Metrics
duration: 2min
completed: 2026-04-01
---

# Phase 01 Plan 02: Docker Production Configuration Summary

**TanStack Start custom server wrapper (srvx + toNodeHandler) and security-hardened docker-compose.yml using expose: for PostgreSQL to prevent Docker DNAT bypass of Hetzner firewall**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-01T04:15:45Z
- **Completed:** 2026-04-01T04:18:20Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Created `packages/web/server.ts` wrapping TanStack Start's SSR handler with srvx — the required workaround for Coolify deployment (GitHub issue #5476)
- Created `packages/web/Dockerfile` with 4-stage build (base/deps/builder/runner), HEALTHCHECK, EXPOSE 3000, and `CMD node server.js`
- Replaced `ports:` with `expose:` for PostgreSQL in docker-compose.yml (INFRA-06 security fix), added web service, and established gitignored override pattern for local dev DB access

## Task Commits

Each task was committed atomically:

1. **Task 1: Add TanStack Start custom server wrapper for Coolify** - `761de37` (feat)
2. **Task 2: Create web Dockerfile and update docker-compose.yml for production security** - `bd38f23` (feat)

**Plan metadata:** `4779c08` (docs)

## Files Created/Modified

- `packages/web/server.ts` - Custom server wrapper: dynamic imports TanStack Start handler, wraps with srvx createApp + toNodeHandler, serves static assets, listens on PORT env var (default 3000)
- `packages/web/Dockerfile` - Multi-stage production Docker image: installs deps, builds app + server wrapper, produces minimal runner with only prod dependencies
- `packages/web/tsconfig.server.json` - TypeScript config for compiling server.ts to server.js (ESNext module, no emit restrictions)
- `packages/web/package.json` - Added srvx dependency, start:prod and build:server scripts
- `docker-compose.yml` - PostgreSQL changed from ports: to expose:, web service added, ingestion service updated with ANTHROPIC_API_KEY, security comment block added
- `docker-compose.override.yml` - Local dev only: exposes 127.0.0.1:5432:5432 for drizzle-kit studio / TablePlus (gitignored)
- `.gitignore` - Added docker-compose.override.yml entry

## Decisions Made

- **srvx as server adapter:** TanStack Start v1 builds produce a fetch-based handler, not a runnable server. srvx's `toNodeHandler` bridges to Node.js `http.createServer`. This resolves GitHub issue #5476 which affects all Coolify/self-hosted TanStack Start deployments.
- **expose: vs ports: for production:** Docker's `ports:` creates a DNAT rule that routes around Hetzner's firewall and UFW — PostgreSQL becomes reachable from the internet. `expose:` makes the port available only within the Docker network. The `docker-compose.override.yml` pattern allows local dev access without ever committing `ports:` to the production compose file.
- **ENV DATABASE_URL=placeholder in builder stage:** Drizzle ORM imports the DB schema during the Vite build. The placeholder value satisfies the module import without a real DB connection at build time. Actual URL is injected at runtime by Coolify.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The verification grep for "no ports: on postgres" initially matched comment lines containing the word "ports:" in the security note — confirmed with a more precise `grep "^    ports:"` that no actual service-level `ports:` directives exist in the main compose file.

## Known Stubs

- `ENV DATABASE_URL=placeholder` in `packages/web/Dockerfile` line 18 (builder stage) — intentional build-time placeholder. Drizzle schema imports require a DATABASE_URL at build time. The placeholder is never used at runtime; Coolify injects the real value. This does not affect any UI rendering or data flow.

## User Setup Required

None - no external service configuration required for this plan. Coolify port mapping and environment variable injection are handled via the Coolify UI at deployment time (documented in docker-compose.yml comments).

## Next Phase Readiness

- Web service is fully deployable to Coolify — `node server.js` works after `vinxi build` + `build:server`
- PostgreSQL is production-secure — no risk of firewall bypass on Hetzner deployment
- Local dev DB access pattern established (docker-compose.override.yml, gitignored)
- Ingestion worker Dockerfile not yet created (packages/ingestion/Dockerfile was referenced in compose but not built in this plan — required for next ingestion plans)

## Self-Check: PASSED

- packages/web/server.ts: FOUND
- packages/web/Dockerfile: FOUND
- packages/web/tsconfig.server.json: FOUND
- docker-compose.override.yml: FOUND
- .planning/phases/01-data-foundation/01-02-SUMMARY.md: FOUND
- Commit 761de37 (Task 1): FOUND
- Commit bd38f23 (Task 2): FOUND
- Commit 4779c08 (metadata): FOUND

---
*Phase: 01-data-foundation*
*Completed: 2026-04-01*
