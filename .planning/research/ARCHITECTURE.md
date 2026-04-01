# Architecture Research

**Domain:** Government transparency / civic data platform (multi-source entity graph)
**Researched:** 2026-03-31
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     INGESTION LAYER (packages/ingestion)             │
├──────────────┬──────────────┬──────────────┬──────────────┬─────────┤
│  Downloader  │  Parser      │  Normalizer  │  Entity      │ Sched-  │
│  (fetch CSV/ │  (CSV →      │  (strip      │  Matcher     │ uler    │
│   ZIP files) │   typed rows)│   suffixes,  │  (trgm →     │ (cron   │
│              │              │   canonicalize│  AI verify)  │  jobs)  │
└──────┬───────┴──────┬───────┴──────┬───────┴──────┬───────┴────┬────┘
       │              │              │              │            │
       └──────────────┴──────────────┴──────────────┴────────────┘
                                     │
                          ┌──────────▼──────────┐
                          │  PostgreSQL 16        │
                          │  (pg_trgm enabled)    │
                          │                       │
                          │  Raw tables:          │
                          │  donations, contracts,│
                          │  grants, lobby_regs,  │
                          │  lobby_comms          │
                          │                       │
                          │  Resolved tables:     │
                          │  entities,            │
                          │  entity_aliases,      │
                          │  entity_connections   │
                          │  (pre-computed graph) │
                          └──────────┬────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────┐
│                      WEB LAYER (packages/web)                        │
│                        TanStack Start                                │
├──────────────┬──────────────┬──────────────┬──────────────┬─────────┤
│  Search      │  Entity      │  Graph/Viz   │  Newsletter  │  AI     │
│  Routes      │  Profile     │  API         │  Routes      │  Summary│
│  + autocmp.  │  Routes      │  Endpoints   │  + Resend    │  Cache  │
└──────┬───────┴──────┬───────┴──────┬───────┴──────┬───────┴────┬────┘
       │              │              │              │            │
       └──────────────┴──────────────┴──────────────┴────────────┘
                                     │
                          ┌──────────▼──────────┐
                          │    Browser Client    │
                          │                      │
                          │  shadcn/ui components│
                          │  D3.js (force graph, │
                          │  Sankey, timeline,   │
                          │  heatmap)            │
                          │  TanStack Query      │
                          └──────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Notes |
|-----------|----------------|-------|
| Downloader | Fetch raw files from Elections Canada, open.canada.ca, lobbycanada.gc.ca | Respects update frequencies; idempotent on re-runs |
| Parser | Convert CSV/ZIP to typed TypeScript row objects with schema validation | Per-source parser; data source schemas differ significantly |
| Normalizer | Strip legal suffixes (Inc., Ltd.), uppercase, trim whitespace, canonical form | Deterministic; no external calls |
| Entity Matcher | Three-stage: deterministic rules → pg_trgm similarity → Claude API for 0.6–0.85 confidence band | Core technical challenge; results stored with confidence score |
| Scheduler | Cron jobs triggering ingestion runs per-source update schedule | Weekly: donations + lobbyist; quarterly: contracts + grants |
| PostgreSQL 16 | Primary data store: raw data, resolved entities, pre-computed graph, search indexes | pg_trgm GIN indexes on entity names |
| entity_connections | Pre-computed table of (entity_a, entity_b, connection_type, strength, source_record_ids) | Populated after entity matching; replaces runtime JOINs for graph queries |
| TanStack Start (web) | SSR React app with server functions as data access layer | Server functions replace API routes; Drizzle ORM in `.server.ts` files |
| Search API | Server function: pg_trgm similarity query + GIN index → ranked results | Powers autocomplete and full search |
| Graph API | Server function: query entity_connections by entity_id → node/edge lists for D3 | Pre-computed table makes this O(1) per entity |
| Timeline API | Server function: union across all source tables filtered by entity_id, ordered by date | Assembled at query time from raw tables |
| D3.js visualizations | Client-side rendering of force graph, Sankey, timeline, heatmap | Data fetched from server functions; D3 handles layout |
| AI Summary | Server function: fetch entity data → Claude API → cache result in DB | Generated on first profile view; stored to avoid repeated API calls |
| Newsletter | Scheduled server function or ingestion job → Resend API | Weekly digest of new connections flagged as notable |
| Community Flags | Simple form submission → flags table → manual review queue | Contributes to entity match confidence adjustment |

## Recommended Project Structure

```
govtrace/
├── packages/
│   ├── ingestion/                  # Data pipeline package
│   │   ├── src/
│   │   │   ├── downloaders/        # Per-source file fetchers
│   │   │   │   ├── elections-canada.ts
│   │   │   │   ├── federal-contracts.ts
│   │   │   │   ├── grants.ts
│   │   │   │   ├── lobby-registrations.ts
│   │   │   │   └── lobby-communications.ts
│   │   │   ├── parsers/            # Per-source CSV parsers
│   │   │   │   ├── elections-canada.ts
│   │   │   │   └── ...
│   │   │   ├── normalizer/         # Entity name normalization
│   │   │   │   ├── strip-suffixes.ts
│   │   │   │   └── canonical.ts
│   │   │   ├── matcher/            # Entity resolution pipeline
│   │   │   │   ├── deterministic.ts
│   │   │   │   ├── fuzzy.ts        # pg_trgm queries
│   │   │   │   └── ai-verify.ts    # Claude API calls
│   │   │   ├── graph/              # entity_connections builder
│   │   │   │   └── build-connections.ts
│   │   │   ├── scheduler/          # Cron job definitions
│   │   │   │   └── jobs.ts
│   │   │   └── index.ts            # CLI entry point
│   │   └── package.json
│   │
│   └── web/                        # TanStack Start app
│       ├── src/
│       │   ├── routes/             # File-based routes
│       │   │   ├── index.tsx       # Homepage / search
│       │   │   ├── entity/
│       │   │   │   └── $id.tsx     # Entity profile page
│       │   │   ├── search.tsx      # Search results
│       │   │   └── newsletter.tsx  # Subscribe page
│       │   ├── server/             # Server-only code (.server.ts)
│       │   │   ├── db.server.ts    # Drizzle client (lazy init)
│       │   │   ├── search.server.ts
│       │   │   ├── entity.server.ts
│       │   │   ├── graph.server.ts
│       │   │   └── ai-summary.server.ts
│       │   ├── functions/          # createServerFn wrappers
│       │   │   ├── search.functions.ts
│       │   │   ├── entity.functions.ts
│       │   │   └── graph.functions.ts
│       │   ├── components/         # React components
│       │   │   ├── visualizations/ # D3 wrappers
│       │   │   │   ├── ForceGraph.tsx
│       │   │   │   ├── SankeyDiagram.tsx
│       │   │   │   ├── Timeline.tsx
│       │   │   │   └── Heatmap.tsx
│       │   │   ├── search/
│       │   │   └── entity/
│       │   └── lib/                # Shared utilities
│       └── package.json
│
├── packages/db/                    # Shared schema package (optional split)
│   ├── src/
│   │   ├── schema/                 # Drizzle table definitions
│   │   │   ├── raw.ts              # donations, contracts, grants, lobby tables
│   │   │   ├── entities.ts         # entities, entity_aliases
│   │   │   └── connections.ts      # entity_connections
│   │   └── index.ts
│   └── package.json
│
├── pnpm-workspace.yaml
├── package.json                    # Root scripts
└── docker-compose.yml              # Local dev: postgres + ingestion + web
```

### Structure Rationale

- **packages/ingestion:** Runs as a separate Node.js process or container. Has no knowledge of the web app; writes to shared PostgreSQL. Can be triggered via cron or CLI.
- **packages/db (shared schema):** Both ingestion and web need Drizzle schema definitions. A shared package prevents schema drift. Import `@govtrace/db` from both consumers.
- **packages/web/src/server/:** Files suffixed `.server.ts` are tree-shaken from the client bundle by TanStack Start's build. Database queries live here exclusively.
- **packages/web/src/functions/:** `createServerFn()` wrappers are the only public interface to server logic. Importable from anywhere (client or server) because the build replaces them with RPC stubs on the client.
- **components/visualizations/:** D3.js components are client-only. They receive plain data (nodes/edges arrays) from server functions; they do not fetch data themselves.

## Architectural Patterns

### Pattern 1: Pre-Computed Entity Connections Table

**What:** After entity matching, a dedicated `entity_connections` table stores every resolved relationship as a row: `(entity_a_id, entity_b_id, connection_type, weight, source_ids[])`. This table is rebuilt/updated on each ingestion run.

**When to use:** Any time graph traversal or "who is connected to whom" queries need to be fast. Without this, querying connections requires joining donations → entities, contracts → entities, grants → entities, and lobby tables simultaneously. With it, a graph query is a single indexed lookup.

**Trade-offs:** Adds a build step after ingestion. Connections data is slightly stale between ingestion runs (acceptable given weekly/quarterly source update frequency). Storage cost is low — connections compress well.

```typescript
// Schema example (Drizzle)
export const entityConnections = pgTable('entity_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityAId: uuid('entity_a_id').notNull().references(() => entities.id),
  entityBId: uuid('entity_b_id').notNull().references(() => entities.id),
  connectionType: text('connection_type').notNull(), // 'donor_contractor', 'lobbyist_client', etc.
  weight: integer('weight').notNull().default(1),
  sourceRecordIds: uuid('source_record_ids').array(),
  firstSeen: date('first_seen'),
  lastSeen: date('last_seen'),
});
// GIN index on (entity_a_id) and (entity_b_id) for bidirectional lookup
```

### Pattern 2: Three-Stage Entity Resolution

**What:** Entity name matching proceeds in confidence tiers. Stage 1 is deterministic (exact match after normalization). Stage 2 is pg_trgm similarity with a GIN index (similarity threshold ~0.85 = HIGH confidence, 0.6–0.85 = MEDIUM). Stage 3 sends MEDIUM-confidence candidate pairs to Claude API with both names plus context for a YES/NO/UNSURE verdict with reasoning.

**When to use:** This pattern is specifically designed for the cost/accuracy tradeoff. Deterministic matching handles the majority (~70%) of records cheaply. Fuzzy matching handles the next tier (~25%). AI verification only touches the ambiguous ~5%, keeping API costs manageable.

**Trade-offs:** Three stages add pipeline complexity. AI stage introduces latency and cost. Community flagging is a fourth correction layer that runs asynchronously.

```typescript
// Confidence band routing
const CERTAIN_THRESHOLD = 0.85;   // Store directly as match
const FUZZY_MIN = 0.60;           // Below: treat as no match
const FUZZY_MAX = 0.85;           // Between: send to AI

if (similarity >= CERTAIN_THRESHOLD) {
  await storeMatch(a, b, 'HIGH', similarity);
} else if (similarity >= FUZZY_MIN) {
  const verdict = await claudeVerify(a, b);
  await storeMatch(a, b, verdict.confidence, similarity, verdict.reasoning);
}
```

### Pattern 3: Server Functions as the Data Access Boundary

**What:** All database queries live in `.server.ts` files. `createServerFn()` wrappers in `.functions.ts` files are the only way client code accesses data. The build process ensures `.server.ts` code never ships to the browser.

**When to use:** Always, for this project. Eliminates the need for a separate API server or REST/GraphQL layer. Type safety flows end-to-end from Drizzle schema through server function return type to React component props.

**Trade-offs:** TanStack Start is the only framework supporting this pattern natively. Cannot reuse server functions from outside the web package (ingestion writes directly to DB). Server function overhead is one HTTP round-trip per call from the client.

```typescript
// .server.ts — never ships to browser
export async function queryEntityProfile(entityId: string) {
  const db = getDb();
  return db.query.entities.findFirst({
    where: eq(entities.id, entityId),
    with: { aliases: true, connections: true }
  });
}

// .functions.ts — safe to import anywhere
export const getEntityProfile = createServerFn()
  .validator(z.object({ id: z.string().uuid() }))
  .handler(({ data }) => queryEntityProfile(data.id));
```

### Pattern 4: D3.js as a Pure Rendering Layer

**What:** D3.js components receive fully-formed data from server functions (nodes array, edges array, timeline events array). D3 handles only layout computation and SVG rendering — it does not fetch, filter, or transform data.

**When to use:** Any time D3 visualization is used inside a React app. Mixing D3 data fetching with React's data fetching leads to double-fetching and cache incoherence.

**Trade-offs:** Requires API endpoints to return data in D3-ready formats (nodes/links shape for force graphs). Server functions should include shape transformation rather than pushing it to the client.

## Data Flow

### Request Flow: Entity Profile Page

```
User visits /entity/[id]
    ↓
TanStack Start SSR: route loader fires
    ↓
getEntityProfile({ id }) — server function
    ↓
entity.server.ts → Drizzle query → PostgreSQL
    ↓ (parallel)
getEntityConnections({ id }) → entity_connections table
getEntityTimeline({ id }) → UNION across raw tables
getAISummary({ id }) → check cache → Claude API if miss
    ↓
HTML streamed to browser with all data hydrated
    ↓
Client renders D3 graph from connections data (nodes/edges)
D3 force simulation runs client-side only
```

### Request Flow: Search Autocomplete

```
User types in search box
    ↓
Debounced call: searchEntities({ query: "cgi" })
    ↓
search.server.ts → pg_trgm similarity query with GIN index
SELECT * FROM entities WHERE name % $1 ORDER BY similarity(name, $1) DESC LIMIT 10
    ↓
Returns ranked entity list with type and alias info
    ↓
Client renders dropdown suggestions
```

### Ingestion Flow

```
Scheduler triggers job (cron: weekly/quarterly per source)
    ↓
Downloader: HTTP GET → save raw file to /tmp or S3-compatible
    ↓
Parser: stream CSV rows → validate schema → emit typed objects
    ↓
Normalizer: strip suffixes, uppercase, canonical form → normalized_name
    ↓
Upsert to raw table (on conflict update)
    ↓
Entity Matcher:
  1. Exact match on normalized_name → link to existing entity (HIGH)
  2. pg_trgm: find candidates above 0.6 similarity
  3. 0.85+: store as HIGH confidence match
  4. 0.60–0.85: batch send to Claude API → store with reasoning
  5. Below 0.60: create new entity record
    ↓
Rebuild entity_connections table (delta or full rebuild)
    ↓
Invalidate AI summary cache for affected entities
    ↓
Log run: records processed, matches made, AI calls used, errors
```

### State Management

```
Server State (TanStack Query / loader data)
    ↓ (preloaded via SSR loader)
Route component receives typed data as props
    ↓
D3 components receive plain arrays (no TanStack Query involved)
    ↓
User interactions (filter, date range) → re-call server functions
    ↓
TanStack Query cache deduplicates repeated calls
```

### Key Data Flows

1. **Entity resolution writes:** ingestion → raw tables → matcher → entities + entity_aliases → entity_connections
2. **Graph read path:** browser → server function → entity_connections (single table, indexed) → D3 client render
3. **Search path:** browser → server function → pg_trgm GIN index → entities table → ranked list
4. **AI summary path:** browser → server function → ai_summaries cache check → (miss) Claude API → store → return
5. **Community correction path:** browser → server function → flags table → async review → entity match confidence update

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–10k monthly users | Single Hetzner VPS is sufficient. One Docker container for web, one for ingestion cron, one for PostgreSQL. No cache layer needed. |
| 10k–100k monthly users | Add pgBouncer connection pooler in front of PostgreSQL. Cache AI summaries aggressively (already planned). Consider read replica for heavy graph queries. |
| 100k+ monthly users | Promote entity_connections to a proper graph store (e.g., Apache Age on PG or external Neo4j). Add Redis for autocomplete result caching. CDN for static assets. |

### Scaling Priorities

1. **First bottleneck: AI summary generation.** Claude API latency is 2–5s per call. Solution: generate and cache on first profile view; background re-generate when source data changes. This is already in the architecture.
2. **Second bottleneck: D3 force graph with large entity networks.** Rendering 500+ nodes client-side is slow. Solution: limit initial graph to 1–2 hops; paginate/filter deeper connections.
3. **Third bottleneck: PostgreSQL connection exhaustion.** Node.js creates many short-lived connections. Solution: lazy DB init (never eager), pgBouncer when concurrent requests grow.

## Anti-Patterns

### Anti-Pattern 1: Querying Across Raw Tables at Runtime for Graph Data

**What people do:** Join donations, contracts, grants, and lobby tables on entity name at query time for each graph page load.

**Why it's wrong:** Cross-table JOINs on string fields — even with indexes — are expensive at scale. With 5 source tables and millions of records, this creates unpredictable latency per request.

**Do this instead:** Build the `entity_connections` table as part of ingestion. Graph queries become indexed primary-key lookups on a single table.

### Anti-Pattern 2: Eager Database Connection in Shared Module

**What people do:** Export a Drizzle `db` instance at module load time from a shared package.

**Why it's wrong:** In TanStack Start's SSR/build process, modules are evaluated during bundling. An eager DB connection at import time causes connection pool exhaustion during builds and fails in edge environments.

**Do this instead:** Lazy-initialize the DB client inside a `getDb()` function that creates or returns a singleton. Only instantiate when a server function actually runs.

### Anti-Pattern 3: Storing Entity Matches Without Provenance

**What people do:** Merge duplicate entity records directly, discarding the original name variants.

**Why it's wrong:** When a match is wrong (AI false positive, fuzzy match error), there's no way to audit or reverse it. Users flagging errors have no evidence trail.

**Do this instead:** Keep original names in an `entity_aliases` table with `(entity_id, raw_name, source, confidence, match_method, ai_reasoning)`. The canonical entity is a pointer to the best alias. Corrections update the pointer, not the raw data.

### Anti-Pattern 4: Running D3 Simulations with Full Dataset

**What people do:** Load all entity_connections for a given entity (potentially hundreds or thousands) into D3 force simulation.

**Why it's wrong:** D3 force simulation is O(n²) per tick for n nodes. 200+ nodes causes visible jank on mid-range devices.

**Do this instead:** Server function returns only 1-hop connections by default. UI offers "expand" for 2-hop with a node count warning. Impose a hard cap (e.g., 150 nodes) and surface a "too complex to visualize — see table view" fallback.

### Anti-Pattern 5: Editorializing Through Data Presentation

**What people do:** Highlight suspicious patterns, use loaded language in labels, or selectively surface connections that imply wrongdoing.

**Why it's wrong:** Opens the project to legal risk and damages credibility. The platform's value is in raw factual connections, not interpretation.

**Do this instead:** Show connections with dates, amounts, and source links. Add the standard disclaimer on every connection display. Let AI summaries describe what the data shows, not what it means.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Elections Canada (CSV) | Scheduled HTTP download → stream parse | Weekly; file URL may change between cycles — verify before each run |
| open.canada.ca (contracts/grants) | Scheduled HTTP download → stream parse | Quarterly; large files — stream do not buffer entirely in memory |
| lobbycanada.gc.ca | Scheduled HTTP download → stream parse | Weekly; HTML scrape fallback if CSV unavailable |
| Claude API (Anthropic) | HTTP via `@anthropic-ai/sdk`; called from ingestion (entity matching) and web (summaries) | Rate limit: respect per-minute token limits; batch entity match calls where possible |
| Resend (email) | REST API call from server function or ingestion job | Newsletter: build digest → call Resend bulk send; confirmation: transactional single send |
| Coolify (deployment) | Docker image build → push → Coolify webhook triggers redeploy | Separate services for `web` and `ingestion`; ingestion runs as a worker with cron scheduled tasks |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| ingestion ↔ PostgreSQL | Direct Drizzle queries; ingestion owns write path | Web package is read-only from DB perspective |
| web ↔ PostgreSQL | Drizzle queries inside `.server.ts` files only | Never query DB from client-side code |
| ingestion ↔ web | No direct communication; shared DB is the contract | Both packages import schema from `@govtrace/db` |
| web server functions ↔ client | RPC stubs generated by TanStack Start build | Full TypeScript inference across the boundary |
| ingestion ↔ Claude API | Called only in `matcher/ai-verify.ts` | Isolated; easy to mock in tests |
| web ↔ Claude API | Called only in `server/ai-summary.server.ts` | Results cached in `ai_summaries` table |

### Build Order for Development

Dependencies between components determine implementation order:

```
1. packages/db         — Schema definitions (no dependencies)
2. packages/ingestion  — Depends on db schema; needs real PostgreSQL to test
3. PostgreSQL setup    — Run migrations from db package
4. packages/web        — Depends on db schema; can mock data initially
```

Within ingestion, implementation order mirrors the pipeline:
```
1. Downloader + Parser (one source)
2. Normalizer
3. Database upsert (raw tables)
4. Entity Matcher (deterministic only first)
5. pg_trgm stage
6. AI verification stage
7. entity_connections builder
8. Scheduler
9. Remaining data sources
```

Within web, implementation order:
```
1. DB connection + schema types
2. Search server function + route
3. Entity profile server function + route
4. Static tables (donations, contracts, grants, lobbying tabs)
5. AI summary server function (with DB cache)
6. Graph API server function
7. D3 force graph component
8. Remaining visualizations (Sankey, timeline, heatmap)
9. Newsletter routes + Resend integration
10. Community flag form
```

## Sources

- TanStack Start server functions docs: https://tanstack.com/start/latest/docs/framework/react/guide/server-functions
- TanStack Start code execution patterns: https://tanstack.com/start/latest/docs/framework/react/guide/code-execution-patterns
- Drizzle ORM + TanStack Start integration: https://grokipedia.com/page/Drizzle_ORM_integration_with_TanStack_Start
- pg_trgm autocomplete (2024): https://benwilber.github.io/programming/2024/08/21/pg-trgm-autocomplete.html
- Entity resolution pipeline overview: https://faingezicht.com/articles/2024/09/03/entity-resolution/
- Semantic entity resolution with LLMs: https://towardsdatascience.com/the-rise-of-semantic-entity-resolution/
- PostgreSQL materialized views: https://www.postgresql.org/docs/16/rules-materializedviews.html
- Coolify cron/scheduled tasks: https://coolify.io/docs/knowledge-base/cron-syntax
- pnpm monorepo architecture: https://storyie.com/blog/monorepo-architecture
- D3 force-directed graphs: https://d3js.org/d3-force

---
*Architecture research for: GovTrace — Canadian government transparency data platform*
*Researched: 2026-03-31*
