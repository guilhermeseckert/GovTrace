# Milestones

## v1.0 MVP (Shipped: 2026-04-05)

**Phases completed:** 6 phases, 27 plans, 53 tasks

**Key accomplishments:**

- pnpm monorepo with Drizzle-ORM schema for 12 PostgreSQL tables, GIN trigram index, pg_trgm Docker init, and pnpm Catalogs preventing drizzle multi-instance version drift
- TanStack Start custom server wrapper (srvx + toNodeHandler) and security-hardened docker-compose.yml using expose: for PostgreSQL to prevent Docker DNAT bypass of Hetzner firewall
- Elections Canada donation ingestion pipeline with chardet encoding detection, SHA-256 deterministic keys, header-driven multi-era CSV schema mapping, and idempotent ON CONFLICT DO UPDATE upserts
- Idempotent CSV ingestion pipelines for federal contracts and grants using encoding detection, header-name column mapping, and ON CONFLICT DO UPDATE upserts wired into the ingestion CLI
- One-liner:
- One-liner:
- Claude Batch API entity verification with circuit breaker — verifyMatchWithAI for sync testing, submitMatchingBatch + processBatchResults for production backfill storing full AI provenance per decision
- Pre-computed entity_connections table builder with mark-stale/rebuild/cleanup pattern and pg-boss weekly/quarterly scheduler wiring all 5 ingestion sources
- Fixed Drizzle onConflictDoUpdate target from non-existent `entities.normalizedName` unique constraint to composite `[entities.canonicalName, entities.entityType]` matching the actual `entities_canonical_name_type_idx` unique index
- pnpm workspace restructured: web moved from packages/web to apps/web, Turborepo 2.9.3 added with build/dev/lint/test pipelines, docker-compose updated to apps/web/Dockerfile
- Minimal TanStack Start v1.167 scaffold in apps/web/src/ with vite build scripts, resolving all three API divergences from plan (Meta, StartClient, getRouter) to achieve a passing pnpm --filter @govtrace/web build
- shadcn/ui initialized with neutral theme and government blue #1a3a5c, cookie-based SSR-safe dark mode wired in root layout, and all copy strings externalized to en.ts
- pg_trgm-powered searchEntities/getAutocomplete server functions with per-entity dataset counts plus getPlatformStats and external GET /api/search, /api/stats HTTP routes
- ARIA combobox search bar with 200ms debounce, landing page with live stat chips, and grouped search results with URL-persisted filters across entity type, province, and date range
- Six server functions and two API routes providing the complete entity data layer: profile with AI confidence badge, five paginated dataset tabs, claude-haiku-4-5 AI summaries with cache-first storage, and anonymous flag submission with weekly summary staleness.
- Entity profile route /entity/:id with government-blue header, 3-state confidence badge popover, skeleton-loading AI summary, and 5-tab layout with count badges and connections disclaimer
- Five TanStack Table v8 DataTable components with server-side pagination, CAD currency, source links, mobile card collapse, and per-dataset provenance footer wired into entity profile
- shadcn Dialog FlagModal with anonymous flag submission and confirmation state; AISummaryExplanation dialog for AI transparency — entity profile flagging flow fully wired end-to-end
- D3 v7 + d3-sankey installed; three server functions (graph/sankey/timeline) and two shared hooks established as Wave 1 foundation for all visualization components
- D3 force-directed graph with zoom/pan, click-to-expand, hover tooltip, and connection-type filter — delivers VIZ-01, VIZ-02, and VIZ-03
- D3-Sankey money flow diagram and scaleTime activity timeline with election year overlays — two Wave 2 visualization components completing the visualization trifecta for Plan 04 wiring
- NetworkGraph, MoneyFlowSankey, and ActivityTimeline wired into entity profile Visualizations tab via vizContent slot prop and VisualizationsPanel sub-component with hidden-based sub-tab switching
- Static /how-it-works explainer page with 5 government data source cards, 3-step walkthrough, AI transparency with confidence tiers, and collapsible FAQ accordion
- Header and footer nav links wired to /how-it-works with BookOpen icon and human-verified page appearance
- Shared connection-labels lib, fixed getEntityStats connection count, and enriched AI summary prompt with named entities, dollar amounts, and cross-dataset storytelling
- Plain English connection cards with color-coded badges and SQL-driven "Did you know?" pattern callouts for entity profiles

---
