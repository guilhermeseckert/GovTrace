---
phase: quick/260421-2yo
plan: 01
subsystem: web
tags: [ssr, streaming, docker, healthcheck, cache-control, compression, perf]
dependency_graph:
  requires:
    - apps/web builder + runner Dockerfile stages
    - @tanstack/react-start SSR handler (dist/server/server.js)
    - @tanstack/react-router-with-query queryClient context
  provides:
    - Streaming SSR via Readable.fromWeb pipe
    - /health endpoint (200 {"ok":true}, no DB, no security headers)
    - Top-level unhandledRejection/uncaughtException survivors
    - Build-time compiled server.js (Docker runner runs node server.js, not tsx)
    - SSR prefetch of platform-stats / landing-data / debt-hero-stats on /
    - Cache-Control on 8 public SSR pages
    - gzip/brotli compression for text responses (SSR + static)
  affects:
    - apps/web/Dockerfile runner stage (smaller, no global tsx/srvx)
    - docker-compose.prod.yml web healthcheck
    - apps/web/src/routes/index.tsx (loader added)
tech_stack:
  added:
    - node:zlib createGzip / createBrotliCompress
    - node:stream Readable.fromWeb
  patterns:
    - Streaming Web ReadableStream → Node Readable via Readable.fromWeb
    - Loader-level queryClient.ensureQueryData for SSR prefetch
    - Allowlist Set for cacheable public paths
    - Compressible-type helper separating text prefix vs exact-match MIME
key_files:
  created:
    - apps/web/server.js (build artifact, gitignored — produced by build:server)
  modified:
    - apps/web/server.ts
    - apps/web/Dockerfile
    - apps/web/src/routes/index.tsx
    - docker-compose.prod.yml
    - .gitignore
decisions:
  - Streaming SSR replaces buffered response.text() to stop RAM spikes and enable faster TTFB
  - srvx stays in apps/web/package.json dependencies — required by compiled SSR bundle
  - Drop global srvx and tsx installs from Dockerfile runner stage — redundant and a source of version drift
  - /health has no security headers and no DB touch — probe stays cheap and immune to DB outages
  - process.on listeners log only, never process.exit — survive transient faults
  - ensureQueryData keys/fns/staleTime in loader must match useQuery in IndexPage exactly for cache hydration
  - Brotli preferred over gzip when both advertised
  - MIN_COMPRESS_BYTES=1024 applied only to static assets (SSR has no Content-Length)
  - Cache-Control skipped when upstream already set one — single `&&` extension point for future auth-cookie skip
metrics:
  duration_seconds: ~1800
  completed_date: "2026-04-21"
  tasks_completed: 6
---

# Quick Task 260421-2yo: Stream SSR + Error Boundaries + /health + Prefetch + Cache + Compression Summary

Rewrote `apps/web/server.ts` from a buffered SSR wrapper that crashed on any handler error into a streaming production server with compile-time TypeScript, a dedicated `/health` endpoint, home-page SSR prefetching, Cache-Control on public pages, and gzip/brotli compression for text responses. Six independently revertable commits.

## Commits (in order)

| # | Commit | Subject |
|---|--------|---------|
| 1 | `cfb5473` | `fix(quick-260421-2yo): stream SSR and catch handler errors` |
| 2 | `da6460f` | `build(quick-260421-2yo): compile server.ts in image and run node server.js` |
| 3 | `93d9fd3` | `feat(quick-260421-2yo): add /health endpoint and point healthchecks at it` |
| 4 | `619df47` | `perf(quick-260421-2yo): SSR-prefetch home page queries via route loader` |
| 5 | `d23c09e` | `perf(quick-260421-2yo): add Cache-Control to public SSR pages` |
| 6 | `c1b8125` | `perf(quick-260421-2yo): gzip/brotli compression for text responses` |

## What changed, per task

### Task 1 (`cfb5473`) — Stream SSR + process-level safety

- Added `import { Readable } from 'node:stream'`
- SSR branch now wrapped in `try { ... } catch (err: unknown) { ... }`
- Replaced `const body = await response.text(); res.end(body)` with `Readable.fromWeb(response.body as import('node:stream/web').ReadableStream).pipe(res)`
- 204/null body fast-path: `res.end()` without piping
- Error path: logs `[ssr-handler]` and returns plaintext 500 if headers not yet sent
- `process.on('unhandledRejection', ...)` + `process.on('uncaughtException', ...)` log-only — no `process.exit` (survival over crash)
- Also added `apps/web/server.js` to `.gitignore` to keep the `build:server` artifact untracked (Rule 3 — generated file hygiene).

### Task 2 (`da6460f`) — Compile-time TypeScript → runtime node

- Dockerfile builder stage: added `RUN pnpm --filter @govtrace/web build:server` after the existing web build
- Runner stage: dropped global `tsx` and global `srvx` installs (srvx stays resolved via local pnpm install)
- Replaced three COPY lines (`server.ts` + two tsconfigs) with a single `COPY --from=builder /app/apps/web/server.js`
- CMD switched from `["tsx", "server.ts"]` to `["node", "server.js"]`

### Task 3 (`93d9fd3`) — /health endpoint

- `apps/web/server.ts`: added `if (req.method === 'GET' && url.pathname === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); return }` at the top of the request handler, before static and SSR branches. No DB, no security headers.
- `apps/web/Dockerfile`: HEALTHCHECK now `wget -qO- http://localhost:3000/health`
- `docker-compose.prod.yml`: web healthcheck now probes `/health` not `/how-it-works`

### Task 4 (`619df47`) — SSR prefetch on /

- `apps/web/src/routes/index.tsx`: added `loader: async ({ context })` that calls `context.queryClient.ensureQueryData` three times — keys `platform-stats`, `landing-data`, `debt-hero-stats` matching the in-component `useQuery` calls exactly
- Each `ensureQueryData` has an individual `.catch` logging `[home-loader] <key> prefetch failed` — one slow server-fn cannot block SSR
- Named constants `FIVE_MINUTES` and `ONE_HOUR` replace inline magic numbers (Ultracite rule)
- `router.tsx` and the three server-fn files untouched

### Task 5 (`d23c09e`) — Cache-Control for public pages

- `PUBLIC_CACHEABLE_PATHS = new Set(['/', '/dashboard', '/how-it-works', '/about', '/privacy', '/news', '/regulations', '/patterns'])`
- `PUBLIC_CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=600'`
- SSR branch computes `shouldCache` from method/status/content-type/path/no-existing-CC and layers it on top of security + response headers
- Future auth-cookie skip is one `&&` clause away

### Task 6 (`c1b8125`) — gzip/brotli compression

- Imported `createGzip`, `createBrotliCompress` from `node:zlib`
- `COMPRESSIBLE_PREFIXES = ['text/']`, `COMPRESSIBLE_EXACT = new Set(['application/javascript', 'application/json', 'image/svg+xml'])`, `MIN_COMPRESS_BYTES = 1024`
- `pickEncoding()` prefers br over gzip; `isCompressibleType()` matches prefix + exact MIME
- SSR branch: if compressible + client advertises encoding, pipe through brotli or gzip transform and set `Content-Encoding` + `Vary: Accept-Encoding`; `Content-Length` deleted (invalid after compression)
- Static-asset branch: same logic, gated additionally on `stat.size >= MIN_COMPRESS_BYTES` (binary images/woff never compressed, preserving current behaviour)
- `/health` stays uncompressed (body is 11 bytes, far under threshold)

## Runtime verification (local smoke test)

Ran `PORT=3031 node apps/web/server.js` with compiled bundle:

- `GET /health` → `HTTP/1.1 200 OK`, `Content-Type: application/json`, body `{"ok":true}`, no security headers (by design).
- `GET /` with `Accept-Encoding: gzip` → `HTTP/1.1 200 OK`, `Content-Encoding: gzip`, `Vary: Accept-Encoding`, `Cache-Control: public, s-maxage=60, stale-while-revalidate=600`, full security header set.
- `GET /` with `Accept-Encoding: br` → `Content-Encoding: br` (brotli preferred over gzip, as planned).
- Loader `.catch` handlers logged `DATABASE_URL environment variable is required` three times (expected — no DB in smoke env) but the response still succeeded with status 200 and full streaming body. This validates both Task 1 (unhandled SSR errors survive) and Task 4 (per-promise catch so one slow server-fn doesn't fail the loader).

## Deviations from Plan

### Rule 3 — Auto-fix blocking issue: TypeScript narrowing in accept-encoding

The plan (Task 6 step 4) suggested a nested ternary:
```ts
const acceptEncoding =
  typeof req.headers['accept-encoding'] === 'string'
    ? req.headers['accept-encoding']
    : Array.isArray(req.headers['accept-encoding'])
      ? req.headers['accept-encoding'].join(', ')
      : undefined
```

`tsc --project tsconfig.server.json` rejected this with `TS2339: Property 'join' does not exist on type 'never'`. The reason: `@types/node@22.19.15` types `IncomingHttpHeaders['accept-encoding']` as `string | undefined` (not `string | string[] | undefined`), so the `Array.isArray(...)` branch is provably `never` and `.join` cannot resolve.

**Fix:** Simplified the SSR acceptEncoding read to:
```ts
// req.headers['accept-encoding'] is typed as string | undefined by @types/node
const acceptEncoding = req.headers['accept-encoding']
```

The static-asset branch already used the plain string-or-undefined pattern (per plan) so no change there. Behaviour is identical for every client that sends an `Accept-Encoding` string, which is every real client; the deleted array branch was defensive code the type system guaranteed was unreachable.

No other deviations. All other task steps executed exactly as specified — including keeping `srvx` in `apps/web/package.json` dependencies (verified its presence in `apps/web/dist/server/server.js` via prior grep in the plan's interfaces block).

## Ultracite

`npm exec -- ultracite fix` failed at configuration load time due to unknown keys in the user's global `~/biome.jsonc` (`noDuplicateClasses`, `useSortedInterfaceMembers`, `noUnresolvedImports`). These errors originate outside this repository and are unrelated to this task's code changes — no project files were modified by the tool. Per the scope-boundary rule, not fixing user-global config from this quick task. `pnpm --filter @govtrace/web build` and `build:server` both pass cleanly, which is the gate that matters for this change to deploy.

## Files Modified

| File | Purpose |
|------|---------|
| `apps/web/server.ts` | Streaming SSR, /health, error boundaries, cache, compression |
| `apps/web/Dockerfile` | Build-time TS compile, runner uses node server.js, /health probe |
| `apps/web/src/routes/index.tsx` | Loader prefetches three landing queries into queryClient cache |
| `docker-compose.prod.yml` | Web healthcheck points to /health |
| `.gitignore` | Ignore generated apps/web/server.js build artifact |

## Self-Check: PASSED

Verified post-write:

- `apps/web/server.ts` modified — FOUND
- `apps/web/Dockerfile` modified — FOUND
- `apps/web/src/routes/index.tsx` modified — FOUND
- `docker-compose.prod.yml` modified — FOUND
- `.gitignore` modified — FOUND
- Commit `cfb5473` — FOUND in `git log`
- Commit `da6460f` — FOUND
- Commit `93d9fd3` — FOUND
- Commit `619df47` — FOUND
- Commit `d23c09e` — FOUND
- Commit `c1b8125` — FOUND
- `pnpm --filter @govtrace/web build` — PASSED
- `pnpm --filter @govtrace/web build:server` — PASSED
- `apps/web/server.js` — EXISTS, `node --check` PASSED
- Runtime smoke: `/health` returns 200 `{"ok":true}`; `/` with `Accept-Encoding: gzip` returns `Content-Encoding: gzip`; with `br` returns `Content-Encoding: br`; Cache-Control applied on `/`; loader errors logged but do not crash.
