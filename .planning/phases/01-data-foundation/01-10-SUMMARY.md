---
phase: 01-data-foundation
plan: 10
subsystem: infra
tags: [turborepo, monorepo, docker, pnpm-workspaces, apps-dir]

# Dependency graph
requires: []
provides:
  - apps/web/ directory with all web package files (package.json, server.ts, tsconfig.json, tsconfig.server.json, Dockerfile)
  - pnpm workspace includes both packages/* and apps/*
  - turbo.json pipeline config with build, dev, lint, test tasks
  - docker-compose.yml references apps/web/Dockerfile
  - Turborepo installed as root devDependency (v2.9.3)
affects: [01-11, web-scaffold, docker-deployment]

# Tech tracking
tech-stack:
  added: [turbo 2.9.3]
  patterns:
    - apps/ for application packages, packages/ for shared libraries
    - Turborepo pipeline coordinates builds with dependency ordering and caching
    - turbo run with --filter for targeted app builds/dev

key-files:
  created:
    - apps/web/package.json
    - apps/web/server.ts
    - apps/web/tsconfig.json
    - apps/web/tsconfig.server.json
    - apps/web/Dockerfile
    - turbo.json
  modified:
    - pnpm-workspace.yaml (added apps/*)
    - package.json (added turbo devDep, updated scripts to turbo run)
    - docker-compose.yml (web service Dockerfile path updated)
    - pnpm-lock.yaml (turbo added)

key-decisions:
  - "apps/ for applications, packages/ for shared libs — required monorepo split before web scaffold in Plan 01-11"
  - "packages/web renamed to packages/web-deprecated rather than deleted — preserves reference files, avoids duplicate @govtrace/web conflict"
  - "turbo run with --filter=@govtrace/web for targeted dev/build rather than running all workspace packages"

patterns-established:
  - "Turborepo pipeline: dependsOn ^build for dependency ordering, cache:false + persistent:true for dev"
  - "apps/* workspace glob added alongside packages/* in pnpm-workspace.yaml"

requirements-completed: [INFRA-01, INFRA-04, INFRA-05]

# Metrics
duration: 1min
completed: 2026-04-01
---

# Phase 01 Plan 10: Monorepo apps/packages split with Turborepo Summary

**pnpm workspace restructured: web moved from packages/web to apps/web, Turborepo 2.9.3 added with build/dev/lint/test pipelines, docker-compose updated to apps/web/Dockerfile**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-04-01T22:27:03Z
- **Completed:** 2026-04-01T22:28:36Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Created `apps/web/` with all web package files copied verbatim from `packages/web/`
- Updated `apps/web/Dockerfile` with corrected COPY paths referencing `apps/web/` instead of `packages/web/`
- Added `apps/*` to `pnpm-workspace.yaml` so pnpm recognizes `apps/web` as the `@govtrace/web` workspace package
- Renamed `packages/web` to `packages/web-deprecated` to prevent duplicate package name conflict
- Created `turbo.json` with build, dev, lint, test pipeline definitions
- Updated root `package.json` scripts to use `turbo run` for build/dev/lint/test and added `turbo ^2.5.0` devDependency (installed 2.9.3)
- Updated `docker-compose.yml` web service to reference `apps/web/Dockerfile`

## Task Commits

Each task was committed atomically:

1. **Task 1: Move packages/web to apps/web and update workspace config** - `196c57e` (chore)
2. **Task 2: Add Turborepo and update docker-compose + root scripts** - `6b6db86` (chore)

**Plan metadata:** `d38da9b` (docs: complete plan)

## Files Created/Modified

- `apps/web/package.json` - @govtrace/web package manifest (copied from packages/web verbatim)
- `apps/web/server.ts` - srvx/TanStack Start server wrapper (copied verbatim)
- `apps/web/tsconfig.json` - TypeScript config extending ../../tsconfig.base.json (copied verbatim)
- `apps/web/tsconfig.server.json` - TypeScript config for server.ts compilation (copied verbatim)
- `apps/web/Dockerfile` - Multi-stage production Dockerfile with updated COPY paths for apps/web/
- `turbo.json` - Turborepo pipeline config with build, dev, lint, test task definitions
- `pnpm-workspace.yaml` - Added apps/* to workspace packages list
- `package.json` - Added turbo devDependency, updated dev/build/lint/test scripts to use turbo run
- `docker-compose.yml` - Updated web service dockerfile path to apps/web/Dockerfile
- `pnpm-lock.yaml` - Updated with turbo 2.9.3 lockfile entries
- `packages/web-deprecated/` - Renamed from packages/web to preserve reference without conflict

## Decisions Made

- `packages/web` renamed to `packages/web-deprecated` rather than deleted: pnpm would see two `@govtrace/web` packages if both existed in workspace, causing conflicts. Renaming preserves files for reference while removing from workspace glob.
- `turbo run --filter=@govtrace/web` used in dev/build scripts: ensures only the web app builds (not ingestion or db packages) during normal dev workflow.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all operations completed without errors.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `apps/web/` is ready to receive the TanStack Start scaffold in Plan 01-11
- pnpm recognizes `apps/web` as `@govtrace/web` workspace package
- Turborepo coordinates builds with caching and dependency ordering
- Docker build context uses `apps/web/Dockerfile` — ready for Coolify deployment

---
*Phase: 01-data-foundation*
*Completed: 2026-04-01*
