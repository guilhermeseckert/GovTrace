# Stack Research

**Domain:** Civic tech / government transparency data platform
**Researched:** 2026-03-31
**Confidence:** HIGH (core stack) / MEDIUM (deployment gotchas)

---

## Recommended Stack

The user's chosen stack is validated. All core choices are sound for this domain. The notes below add precision on exact versions, a package rename gotcha, and a deployment concern that needs a workaround.

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@tanstack/react-start` | 1.167.x (latest) | Full-stack React framework with SSR, file-based routing, server functions | Active v1 release; replaces deprecated `@tanstack/start`; server functions eliminate need for separate API layer; type-safe end-to-end |
| `@tanstack/react-router` | Bundled with Start | Client-side routing | Tightly coupled with Start; provides type-safe route params and loaders |
| PostgreSQL | 16 | Primary data store | JSONB for semi-structured data, `pg_trgm` built-in, strong full-text search, proven at scale for analytic read patterns |
| `drizzle-orm` | 0.45.x | ORM and query builder | TypeScript-native schema, SQL-close query API avoids N+1 surprises, excellent with PostgreSQL — critical for a data-heavy project where raw SQL clarity matters |
| `drizzle-kit` | Paired with drizzle-orm | Migrations and schema introspection | Must stay in sync with drizzle-orm version; use pnpm catalog to pin both |
| `@anthropic-ai/sdk` | 0.80.x | Claude API for entity matching and summary generation | Official SDK; requires Node.js 18+; use `claude-sonnet-4-5` or `claude-haiku-3-5` for batch entity matching (cost/speed tradeoff) |
| `resend` | 6.10.x | Transactional email and newsletter delivery | Best TypeScript SDK in email space; native React Email integration; actively maintained |
| `d3` | 7.9.x | Bespoke data visualizations | Gold standard for force-directed graphs, Sankey diagrams, and timeline charts; no viable alternative at this level of customization |
| `tailwindcss` | 4.x | Utility-first CSS | Full v4 support in shadcn/ui as of February 2025; CSS-first config replaces tailwind.config.js |
| shadcn/ui | CLI v4 (March 2026) | Component library | Not a dependency — components are copied into the codebase; full Tailwind v4 + React 19 support; official TanStack Start template available |
| TypeScript | 5.x | Type safety across the monorepo | Strict mode required per project constraints |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pg-boss` | Latest (9.x) | Background job queue using PostgreSQL | For the ingestion pipeline: schedule weekly CSV downloads, queue entity matching jobs, retry failed Claude API calls. Uses existing Postgres — no Redis/BullMQ needed |
| `d3-sankey` | 0.12.x | Sankey diagram layout plugin | Required separately from d3 for Sankey money-flow diagrams; not included in the core d3 bundle |
| `papaparse` | 5.x | CSV parsing | Streaming CSV parser for large Elections Canada and contracts CSVs; handles encoding issues and malformed rows gracefully |
| `zod` | 3.x | Runtime schema validation | Validate ingested CSV rows before INSERT; validate Claude API responses; TanStack Start uses Zod natively in route schemas |
| `react-email` | Latest | Email template authoring | Write newsletter templates in React/JSX; renders to HTML for Resend delivery; pairs naturally with the existing React stack |
| `@tanstack/react-query` | 5.x | Client-side data fetching and caching | Bundled with TanStack Start; use for client-side search autocomplete and cached entity profile data |
| `pnpm` | 9.x | Package manager and workspace orchestration | pnpm Catalogs (introduced early 2025) eliminate version drift between packages — **required** to avoid the Drizzle multi-instance bug (see Pitfalls) |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vite | Bundler underlying TanStack Start | TanStack Start migrated from Vinxi to Vite at v1.121.0; do not use older Vinxi-based docs |
| `drizzle-kit studio` | Schema browser and query UI | Run `pnpm drizzle-kit studio` for a local DB GUI — useful during ingestion development |
| Docker + Coolify | Container deployment on Hetzner | Requires a custom server wrapper (see Deployment Gotcha below); Nixpacks build pack works for basic cases |

---

## Installation

```bash
# Create monorepo structure
mkdir -p packages/web packages/ingestion

# Root workspace tools
pnpm add -D typescript @types/node

# packages/web — TanStack Start app
cd packages/web
pnpm add @tanstack/react-start @tanstack/react-router
pnpm add drizzle-orm postgres
pnpm add @anthropic-ai/sdk
pnpm add resend react-email
pnpm add d3 d3-sankey
pnpm add zod
pnpm add -D drizzle-kit tailwindcss @tailwindcss/vite

# packages/ingestion — data pipeline
cd packages/ingestion
pnpm add drizzle-orm postgres
pnpm add papaparse @types/papaparse
pnpm add zod
pnpm add pg-boss
pnpm add @anthropic-ai/sdk
pnpm add -D drizzle-kit

# Add shadcn/ui (copies components into packages/web/src/components)
pnpm dlx shadcn@latest init
```

Pin shared dependency versions in `pnpm-workspace.yaml` using Catalogs:

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'

catalog:
  drizzle-orm: ^0.45.2
  drizzle-kit: ^0.30.0
  postgres: ^3.4.5
  zod: ^3.24.0
  '@anthropic-ai/sdk': ^0.80.0
```

Then in each `package.json`:
```json
{
  "dependencies": {
    "drizzle-orm": "catalog:",
    "postgres": "catalog:"
  }
}
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| TanStack Start | Next.js 15 | If team has deep Next.js experience or needs Vercel edge deployment; Next.js has a larger ecosystem and more community examples for civic tech |
| TanStack Start | Remix | If you need progressive enhancement and prefer Remix's data model; smaller community for this use case |
| Drizzle ORM | Prisma | If team prefers the Prisma DX and schema-first approach; Prisma has better migration tooling but heavier runtime overhead |
| Drizzle ORM | Kysely | If you want pure SQL query building without any schema layer; good for complex analytics queries but no migration tooling |
| pg_trgm (PostgreSQL) | Elasticsearch / Meilisearch | If search becomes the product's primary feature at scale (100K+ entities with complex ranking); adds significant ops burden; not needed for v1 |
| pg-boss | BullMQ + Redis | If you need high-throughput job processing (10K+ jobs/minute); adds Redis infrastructure; overkill for weekly CSV ingestion |
| D3.js | Observable Plot | If visualizations are simpler (bar/line charts); Plot is much easier but cannot build force-directed graphs or Sankey diagrams |
| D3.js | Recharts / Victory | If you only need standard chart types; much easier React integration but cannot produce the custom relationship graphs required |
| Resend | Postmark | If deliverability for transactional email is paramount; similar pricing; Postmark has a longer track record |
| Coolify + Hetzner | Railway / Fly.io | If ops burden is a concern; Railway and Fly.io handle SSR apps with zero custom Dockerfile work; tradeoff is cost and less control |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@tanstack/start` (old package) | Deprecated as of v1.121.0; no longer receiving updates | `@tanstack/react-start` — run the migration if you scaffolded before the rename |
| Prisma with pnpm workspaces | Prisma's binary engine creates complications in monorepo setups; known issues with multiple packages sharing one Prisma instance | Drizzle ORM — designed for this setup, no binary dependencies |
| `tailwindcss-animate` | Deprecated in Tailwind v4 / shadcn/ui v4 ecosystem | `tw-animate-css` — shadcn/ui installs this by default on new projects |
| Barrel files (`index.ts` re-exports) | Prohibited by Ultracite/Biome code standards; causes circular dependency issues | Direct imports from the specific file |
| `any` TypeScript types in ingestion pipeline | CSV rows arrive as `unknown`; silencing the type system here causes runtime bugs that are hard to trace | Zod schemas to parse and type CSV rows at the boundary |
| Elasticsearch for entity search | Adds a third stateful service to operate; pg_trgm with GIN indexes achieves 60-80ms search at the scale of Canadian federal data (tens of thousands of entities) | PostgreSQL `pg_trgm` with a GIN index on normalized name columns |
| OAuth user accounts (v1) | Listed explicitly as out of scope in PROJECT.md; adds significant auth complexity | Public read-only access; community flagging via simple form submission |

---

## Stack Patterns by Variant

**For the ingestion package (`packages/ingestion`):**
- This is a standalone Node.js CLI/cron process, not a web server
- Use `drizzle-orm` with the same schema package as the web app — define schema in a shared `packages/db` package to avoid duplication
- Run ingestion as a separate Docker container alongside the web app in Coolify
- Use pg-boss job queue to schedule and retry ingestion steps rather than cron expressions

**For the web package (`packages/web`):**
- TanStack Start server functions replace REST endpoints for all data queries
- Keep all database access in server functions — never expose Drizzle queries to client components
- Use TanStack Query on the client for search autocomplete (needs low-latency client-side caching)

**For D3 visualizations:**
- Use the "D3 for math, React for rendering" pattern: D3 computes layout (positions, paths), React renders SVG elements
- Do not use D3's DOM manipulation methods (`d3.select`, `.append`) inside React components — use React's `useRef` and state instead
- This avoids D3/React conflicts and keeps components testable

**For Claude API entity matching:**
- Use `claude-haiku-3-5` for high-volume medium-confidence matches (cost-sensitive)
- Use `claude-sonnet-4-5` only for ambiguous matches requiring reasoning
- Always store the model's reasoning alongside the confidence score for the transparency badge UI

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@tanstack/react-start` 1.167.x | `@tanstack/react-router` same version | Always install matching versions; they are released together |
| `drizzle-orm` 0.45.x | `drizzle-kit` 0.30.x | Must be version-compatible; check the Drizzle changelog before upgrading either independently |
| `tailwindcss` 4.x | `shadcn/ui` CLI v4 | Full compatibility confirmed March 2026; older shadcn/ui docs show v3 config patterns — disregard them |
| `@anthropic-ai/sdk` 0.80.x | Node.js 18+ | SDK hard-requires Node 18; Hetzner Docker images default to Node 20 LTS (fine) |
| `d3` 7.9.x | `d3-sankey` 0.12.x | d3-sankey targets D3 v7; do not install d3 v6 |
| `react-email` | `resend` 6.x | Official Resend/React Email integration; use `render()` from `@react-email/render` to convert JSX to HTML string before passing to Resend |

---

## Critical Deployment Gotcha — TanStack Start + Coolify

**Problem (MEDIUM confidence — GitHub issue #5476, active as of late 2025):**
TanStack Start's build output is a module handler, not a runnable server. Running `node dist/server/server.js` directly fails. Coolify's auto-detection does not handle this without a custom server wrapper.

**Workaround:** Add an Express or Nitro wrapper that imports the TanStack handler. The community approach is:

```typescript
// server.ts (root of packages/web)
import express from 'express'
import { toNodeHandler } from 'srvx/node'
import handler from './dist/server/server.js'

const app = express()
app.use(express.static('dist/client'))
app.use(toNodeHandler(handler))
app.listen(3000)
```

Set Coolify to run `node server.js` (compiled) or configure nixpacks to detect the custom start script. The `marcelwolf.dev` guide shows this works with nixpacks and `is_static: false`.

An official Coolify example exists in the `coolify-examples` repository for TanStack Start — use it as a reference Dockerfile rather than letting Coolify auto-detect.

**Alternative:** Deploy with Bun (`bun run ./dist/server/server.js`) — Bun natively runs TanStack Start's output without a wrapper. Coolify supports Bun via nixpacks.

---

## Sources

- [TanStack Start v1 Release Blog](https://tanstack.com/blog/announcing-tanstack-start-v1) — confirmed v1 stable status (HIGH confidence)
- [NPM @tanstack/react-start](https://www.npmjs.com/package/@tanstack/react-start) — confirmed package rename from `@tanstack/start` (HIGH confidence)
- [GitHub TanStack/router releases](https://github.com/TanStack/router/releases) — version 1.167.x confirmed active as of March 2026 (HIGH confidence)
- [NPM drizzle-orm](https://www.npmjs.com/package/drizzle-orm) — 0.45.2 latest as of March 2026 (HIGH confidence)
- [Drizzle ORM Latest Releases](https://orm.drizzle.team/docs/latest-releases) — migration system improvements, tsx loader replacing esbuild-register (HIGH confidence)
- [PNPM Drizzle workspace issue #8163](https://github.com/pnpm/pnpm/issues/8163) — multiple drizzle-orm instances in pnpm workspaces (MEDIUM confidence, known bug)
- [shadcn/ui Changelog March 2026](https://ui.shadcn.com/docs/changelog/2026-03-cli-v4) — CLI v4 with TanStack Start template (HIGH confidence)
- [shadcn/ui TanStack Start installation](https://ui.shadcn.com/docs/installation/tanstack) — official installation guide (HIGH confidence)
- [shadcn/ui Tailwind v4 docs](https://ui.shadcn.com/docs/tailwind-v4) — full v4 compatibility confirmed (HIGH confidence)
- [NPM @anthropic-ai/sdk](https://www.npmjs.com/package/@anthropic-ai/sdk) — 0.80.0, Node 18+ required (HIGH confidence)
- [NPM resend](https://www.npmjs.com/package/resend) — 6.10.0 latest (HIGH confidence)
- [NPM d3](https://www.npmjs.com/package/d3) — 7.9.x latest v7 release (HIGH confidence)
- [d3-sankey GitHub](https://github.com/d3/d3-sankey) — 0.12.x targets D3 v7 (HIGH confidence)
- [TanStack Start SSR Coolify issue #5476](https://github.com/TanStack/router/issues/5476) — known deployment problem, community workarounds exist (MEDIUM confidence)
- [Marcel Wolf Coolify guide](https://marcelwolf.dev/blog/how-to-host-tanstackstart-on-coolify/) — nixpacks deployment confirmed working (MEDIUM confidence)
- [pg-boss npm](https://www.npmjs.com/package/pg-boss) — PostgreSQL-backed job queue, January 2026 updates (HIGH confidence)
- [pnpm Catalogs guide](https://makerkit.dev/docs/nextjs-drizzle/installation/setup-dependencies) — version drift elimination via pnpm-workspace.yaml catalog (MEDIUM confidence)
- [TanStack Start vs Next.js 2026](https://dev.to/alexcloudstar/tanstack-start-vs-nextjs-in-2026-should-you-actually-switch-4b2l) — ecosystem comparison (LOW confidence, community blog)

---
*Stack research for: GovTrace — Canadian government transparency data platform*
*Researched: 2026-03-31*
