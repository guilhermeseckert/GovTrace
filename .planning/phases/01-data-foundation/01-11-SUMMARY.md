---
phase: 01-data-foundation
plan: 11
subsystem: infra
tags: [tanstack-start, vite, react, tailwindcss, typescript, monorepo]

# Dependency graph
requires:
  - phase: 01-data-foundation plan 10
    provides: apps/web directory created via monorepo restructure, apps/web/package.json with correct deps

provides:
  - apps/web/vite.config.ts with tanstackStart() + tailwindcss() plugins
  - apps/web/src/client.tsx (StartClient hydration entry using @tanstack/react-start/client)
  - apps/web/src/router.tsx (getRouter factory for TanStack Start plugin integration)
  - apps/web/src/routes/__root.tsx (root route with HeadContent, Scripts, Outlet)
  - apps/web/src/routes/index.tsx (landing page stub for Phase 2 content)
  - apps/web/src/routeTree.gen.ts (auto-generated route tree from first build)
  - .env.example documenting DATABASE_URL, ANTHROPIC_API_KEY, PORT, NODE_ENV
  - pnpm --filter @govtrace/web build exits 0 — web Docker build now succeeds

affects:
  - phase-02 (UI phase builds full landing page on top of this scaffold)
  - docker-build (Dockerfile pnpm build step now succeeds)
  - developer-onboarding (.env.example provides setup guidance)

# Tech tracking
tech-stack:
  added:
    - "@tanstack/react-start/plugin/vite (tanstackStart() plugin) for SSR build"
    - "@tailwindcss/vite for Tailwind v4 Vite integration"
  patterns:
    - "router.tsx exports getRouter() — TanStack Start plugin expects this export name for #tanstack-router-entry alias"
    - "client.tsx uses startTransition(() => hydrateRoot()) per TanStack Start default entry pattern"
    - "HeadContent + Scripts from @tanstack/react-router (not @tanstack/react-start) for head injection in v1.167"
    - "routeTree.gen.ts committed to repo — provides TypeScript types before first build in fresh environments"

key-files:
  created:
    - apps/web/vite.config.ts
    - apps/web/src/client.tsx
    - apps/web/src/router.tsx
    - apps/web/src/routes/__root.tsx
    - apps/web/src/routes/index.tsx
    - apps/web/src/routeTree.gen.ts
    - .env.example
  modified:
    - apps/web/package.json (vinxi scripts replaced with vite)
    - packages/web-deprecated/package.json (name changed to avoid pnpm filter conflict)

key-decisions:
  - "HeadContent from @tanstack/react-router replaces Meta from @tanstack/react-start (Meta not exported in v1.167)"
  - "router.tsx exports getRouter() not createRouter() — TanStack Start plugin aliases it as #tanstack-router-entry and imports getRouter"
  - "client.tsx uses @tanstack/react-start/client for StartClient and drops router prop (StartClient hydrates from SSR context, not prop)"
  - "packages/web-deprecated renamed from @govtrace/web to @govtrace/web-deprecated to prevent pnpm --filter @govtrace/web matching both packages"
  - "routeTree.gen.ts committed to repo as it provides TypeScript types needed in fresh environments before first build"

patterns-established:
  - "TanStack Start v1.167 file entry conventions: src/router.tsx exports getRouter, src/client.tsx imports StartClient from @tanstack/react-start/client"
  - "Phase 2 will replace IndexPage stub in src/routes/index.tsx with full landing page and search bar"

requirements-completed:
  - INFRA-01
  - INFRA-04
  - INFRA-05

# Metrics
duration: 25min
completed: 2026-04-01
---

# Phase 01 Plan 11: TanStack Start Web Scaffold Summary

**Minimal TanStack Start v1.167 scaffold in apps/web/src/ with vite build scripts, resolving all three API divergences from plan (Meta, StartClient, getRouter) to achieve a passing pnpm --filter @govtrace/web build**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-01T22:30:34Z
- **Completed:** 2026-04-01T22:55:00Z
- **Tasks:** 2 planned + 1 auto-fix round
- **Files modified:** 9

## Accomplishments

- Replaced deprecated `vinxi dev/build/start` scripts with `vite dev/build/preview` in apps/web/package.json
- Created vite.config.ts using `tanstackStart()` and `tailwindcss()` plugins
- Created all 4 required TanStack Start source files (client.tsx, router.tsx, __root.tsx, index.tsx)
- Resolved 3 API divergences between plan's assumed API and actual v1.167 installed package API
- `pnpm --filter @govtrace/web build` exits 0; dist/ created with client and server bundles
- Created .env.example documenting all required environment variables at repo root

## Task Commits

1. **Task 1: Fix build scripts and create vite.config.ts** - `bf3df8e` (feat)
2. **Task 2: Create minimal TanStack Start source files and .env.example** - `d805d08` (feat)
3. **Auto-fix: TanStack Start v1.167 API corrections + package name conflict** - `0821ce9` (fix)
4. **Chore: Commit auto-generated routeTree.gen.ts** - `b4708ef` (chore)

## Files Created/Modified

- `apps/web/package.json` - Scripts changed from vinxi to vite dev/build/preview
- `apps/web/vite.config.ts` - TanStack Start vite plugin config with Tailwind v4 and port 3000
- `apps/web/src/client.tsx` - StartClient hydration entry with startTransition and hydrateRoot
- `apps/web/src/router.tsx` - getRouter() factory (not createRouter) for plugin compatibility
- `apps/web/src/routes/__root.tsx` - Root route with HeadContent/Scripts from @tanstack/react-router
- `apps/web/src/routes/index.tsx` - Landing page stub (Phase 2 replaces content)
- `apps/web/src/routeTree.gen.ts` - Auto-generated by vite build; committed for type safety
- `.env.example` - DATABASE_URL, ANTHROPIC_API_KEY, PORT, NODE_ENV documented
- `packages/web-deprecated/package.json` - Renamed to @govtrace/web-deprecated

## Decisions Made

- `getRouter` instead of `createRouter` export name: TanStack Start v1.167 plugin creates a `#tanstack-router-entry` alias pointing to `router.tsx` and then imports `{ getRouter }` from it in `hydrateStart.js`. The plan used `createRouter` but the actual plugin code requires `getRouter`.
- `HeadContent` instead of `Meta`: `Meta` is not exported from `@tanstack/react-start` in v1.167. `HeadContent` is the equivalent component available from `@tanstack/react-router`.
- `@tanstack/react-start/client` for `StartClient`: The main `@tanstack/react-start` package does not re-export `StartClient` in v1.167. It lives in the `/client` subpath export. The `StartClient` no longer takes a `router` prop — it hydrates from SSR context.
- `packages/web-deprecated` renamed to `@govtrace/web-deprecated`: Both packages had the same npm name `@govtrace/web`, causing `pnpm --filter @govtrace/web build` to match both and trigger the deprecated vinxi build.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Meta and Scripts wrongly imported from @tanstack/react-start**
- **Found during:** Task 2 verification (build smoke test)
- **Issue:** Plan specified `import { Meta, Scripts } from '@tanstack/react-start'` but `Meta` is not exported from that package in v1.167. `Scripts` is in `@tanstack/react-router`, not `@tanstack/react-start`.
- **Fix:** Changed import to `import { HeadContent, Outlet, Scripts, ScrollRestoration } from '@tanstack/react-router'` and replaced `<Meta />` with `<HeadContent />`
- **Files modified:** `apps/web/src/routes/__root.tsx`
- **Verification:** Build passes after fix
- **Committed in:** `0821ce9` (combined fix commit)

**2. [Rule 1 - Bug] StartClient imported from wrong package path and given router prop**
- **Found during:** Task 2 verification (build smoke test, second error)
- **Issue:** Plan specified `import { StartClient } from '@tanstack/react-start'` but `StartClient` is not in the main index export — it's at `@tanstack/react-start/client`. Also, `StartClient` in v1.167 takes no `router` prop; it gets the router from SSR hydration context.
- **Fix:** Updated import to `@tanstack/react-start/client`, removed `router` prop, wrapped in `startTransition()` per TanStack Start default entry pattern
- **Files modified:** `apps/web/src/client.tsx`
- **Verification:** Build passes after fix
- **Committed in:** `0821ce9` (combined fix commit)

**3. [Rule 1 - Bug] router.tsx exported createRouter but plugin expects getRouter**
- **Found during:** Task 2 verification (build smoke test, third error after Meta fix)
- **Issue:** `@tanstack/start-client-core` `hydrateStart.js` does `import { getRouter } from "#tanstack-router-entry"` where `#tanstack-router-entry` resolves to `src/router.tsx`. The plan named the export `createRouter`, which caused a missing export error.
- **Fix:** Renamed exported function from `createRouter` to `getRouter`, updated the `Register` type accordingly
- **Files modified:** `apps/web/src/router.tsx`
- **Verification:** Build passes after fix
- **Committed in:** `0821ce9` (combined fix commit)

**4. [Rule 1 - Bug] packages/web-deprecated had same npm package name @govtrace/web**
- **Found during:** Task 2 verification (first build attempt)
- **Issue:** `pnpm --filter @govtrace/web build` matched both `apps/web` and `packages/web-deprecated` (which still had `"name": "@govtrace/web"`). The deprecated package ran `vinxi build` which failed with `vinxi: command not found`.
- **Fix:** Changed `packages/web-deprecated/package.json` name to `@govtrace/web-deprecated`
- **Files modified:** `packages/web-deprecated/package.json`
- **Verification:** `pnpm --filter @govtrace/web build` only targets `apps/web`
- **Committed in:** `0821ce9` (combined fix commit)

---

**Total deviations:** 4 auto-fixed (all Rule 1 - bugs due to API divergence between plan's assumed v1.167 interface and actual installed package exports)
**Impact on plan:** All fixes necessary to achieve build success. No scope creep — all changes stay within the 5 plan files.

## Known Stubs

- `apps/web/src/routes/index.tsx` — `IndexPage` renders static placeholder text ("Search and entity profiles coming in Phase 2"). This is intentional per plan spec; Phase 2 will replace with the full landing page and search bar.

## Issues Encountered

The plan was written against the TanStack Start v1.167 API as documented, but three export paths differed from what was actually available in the installed packages:
1. `Meta` — does not exist; replaced by `HeadContent` from `@tanstack/react-router`
2. `StartClient` in main index — not exported; only at `@tanstack/react-start/client` subpath
3. `getRouter` expected by plugin — plan used `createRouter` naming convention

All three were corrected via Rule 1 auto-fix. The build now succeeds end-to-end.

## User Setup Required

None — no external services. Developers should copy `.env.example` to `.env` and fill in their values before running the app.

## Next Phase Readiness

- Web container can now be built successfully — Docker build unblocked
- Phase 1 Success Criterion 5 ("web app can query all 5 source tables") is now achievable — the web container builds
- `apps/web/src/routes/index.tsx` stub is ready for Phase 2 replacement with full landing page
- `routeTree.gen.ts` is committed so fresh clones have TypeScript types immediately

---
*Phase: 01-data-foundation*
*Completed: 2026-04-01*

## Self-Check: PASSED

All files present: apps/web/vite.config.ts, src/client.tsx, src/router.tsx, src/routes/__root.tsx, src/routes/index.tsx, src/routeTree.gen.ts, .env.example, 01-11-SUMMARY.md
All commits present: bf3df8e, d805d08, 0821ce9, b4708ef
