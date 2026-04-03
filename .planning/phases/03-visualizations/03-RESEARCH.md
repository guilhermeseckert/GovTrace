# Phase 3: Visualizations - Research

**Researched:** 2026-03-31
**Domain:** D3.js v7 data visualizations in React 19 / TanStack Start with PostgreSQL graph queries
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VIZ-01 | Relationship network graph (D3.js force-directed) with color-coded node types and edge styles | D3 force simulation pattern; node type color scheme documented |
| VIZ-02 | Graph supports click-to-expand (drill into a node's connections), hover tooltips, zoom/pan | d3-zoom attach pattern; click handler triggers server fn refetch |
| VIZ-03 | Graph supports filtering by relationship type and date range | Filter state stored in React, passed to graph server fn as params |
| VIZ-04 | Money flow Sankey diagram showing donor → party → contract/grant flows | d3-sankey 0.12.x data shape fully documented; confirmed DB has donor/party/dept data |
| VIZ-05 | Activity timeline showing all events chronologically across datasets with type-coded markers | D3 scaleTime + custom SVG markers; scrollable via d3-zoom |
| VIZ-06 | Network heatmap showing politician/department vs company relationship density | D3 matrix layout with scaleSequential; 2D grid of entity pairs |
| VIZ-07 | Spending by department chart (treemap or bar chart with drill-down) | D3 treemap with d3.hierarchy; dept data confirmed in contracts table |
| VIZ-08 | Donations trend chart with election date overlays and stacking by top donors | D3 area/stack with scaleTime; election year data in donations table |
| API-06 | GET /api/entity/:id/graph returns nodes and edges for D3 (depth parameter) | Recursive CTE depth-2 tested at 153ms; depth-1 at <1ms |
| API-07 | GET /api/entity/:id/money-flow returns Sankey diagram data | Query shape documented below |
| API-08 | GET /api/entity/:id/timeline returns chronological events | Multi-table UNION with event_type field |
| API-09 | GET /api/entity/:id/heatmap returns relationship intensity matrix | Aggregation query over entity_connections |
| API-10 | GET /api/entity/:id/spending-breakdown returns department spending data | confirmed contracts.department column exists |
</phase_requirements>

---

## Summary

This phase adds six interactive data visualizations to GovTrace entity profile pages. The core library is D3.js v7 (already in the project stack), supplemented by d3-sankey for the money flow diagram. All visualizations follow the established "D3 for math, React for rendering" pattern from STACK.md: D3 computes positions/paths/layouts, React renders SVG elements and manages state.

The entity_connections table has 1,073,658 rows (confirmed via live DB query), split almost entirely between `donor_to_party` (1,013,522) and `grant_recipient_to_department` (60,136) connection types. The maximum direct-connection count for any entity is ~45 nodes. Depth-1 graph queries return in under 1ms; depth-2 recursive CTEs return in ~150ms due to JIT compilation overhead — acceptable for graph data fetches.

The traceability table in REQUIREMENTS.md assigns VIZ-01 through VIZ-05 and API-06 through API-08 to Phase 3. VIZ-06, VIZ-07, VIZ-08, API-09, and API-10 are assigned to Phase 4 — the planner must scope Phase 3 work accordingly.

**Primary recommendation:** Implement VIZ-01 through VIZ-05 and API-06 through API-08 in Phase 3. Use SVG (not Canvas) for all graphs at this node scale (max ~150 nodes confirmed). Use `db.execute(sql`...`)` with raw SQL for recursive CTE graph queries — Drizzle does not support `WITH RECURSIVE` natively.

---

## Project Constraints (from CLAUDE.md)

The project's global CLAUDE.md enforces **Ultracite** (Biome-based) code standards. Key directives that affect visualization code:

- Use `for...of` loops over `.forEach()` in TypeScript code
- Use arrow functions for callbacks
- Use `const` by default, never `var`
- No `console.log` in production code
- Prefer `unknown` over `any` — D3 simulation nodes must be typed, not typed as `any`
- No barrel files (`index.ts` re-exports) — import directly from specific files
- Semantic HTML and ARIA attributes required — visualization containers need `role` and `aria-label`
- `rel="noopener"` on any `target="_blank"` links
- React 19: use `ref` as a prop instead of `React.forwardRef`
- Format before commit: `npm exec -- ultracite fix`

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `d3` | 7.9.0 (current) | Force simulation, scales, axis, zoom, drag, treemap, area/stack | Project-mandated; confirmed latest on npm |
| `d3-sankey` | 0.12.3 (current) | Sankey diagram layout | Not in core d3 bundle; confirmed latest on npm |
| React 19 + `useRef` + `useEffect` | 19.x | Component rendering, DOM refs for D3 attach | Already installed |
| TanStack Start `createServerFn` | 1.167.x | Server-side graph queries | Pattern established in Phase 2 |
| Drizzle ORM `db.execute(sql`...`)` | 0.45.x | Raw SQL for recursive CTEs (Drizzle has no WITH RECURSIVE) | Only viable approach for graph traversal |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@types/d3` | 7.4.3 (current) | TypeScript types for all d3 modules | Required for strict mode — install as devDependency |
| `ResizeObserver` (Web API) | browser built-in | Make SVG charts respond to container resize | Use in every chart component via `useEffect` cleanup |
| Tailwind CSS variables via `getComputedStyle` | — | Read HSL color values for D3 color scales in dark mode | See Dark Mode Pattern below |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw D3 + React | `react-force-graph` (vasturiano) | `react-force-graph` is a wrapper over three.js/Canvas — easier to set up but loses control over exact styling, node shapes, Tailwind integration; at max 45 nodes, raw D3 SVG is appropriate |
| SVG rendering | Canvas rendering | Canvas is better above ~1000 nodes; at max 150 nodes SVG is fine and much easier to style with Tailwind |
| `db.execute(sql`...`)` for graph | Drizzle relational API | Drizzle has no `WITH RECURSIVE` — raw sql template is the only correct approach |

**Installation (packages not yet in apps/web/package.json):**

```bash
cd apps/web
pnpm add d3 d3-sankey
pnpm add -D @types/d3
```

Note: `d3` and `d3-sankey` are not yet in apps/web/package.json — they must be added.

**Version verification (confirmed 2026-03-31):**

```bash
npm view d3 version          # 7.9.0
npm view d3-sankey version   # 0.12.3
npm view @types/d3 version   # 7.4.3
```

---

## Architecture Patterns

### Recommended Project Structure

```
apps/web/src/
├── components/
│   └── visualizations/
│       ├── NetworkGraph.tsx          # VIZ-01, VIZ-02, VIZ-03 (force-directed)
│       ├── MoneyFlowSankey.tsx       # VIZ-04 (Sankey)
│       ├── ActivityTimeline.tsx      # VIZ-05 (timeline)
│       └── shared/
│           ├── useChartColors.ts     # Read CSS vars for dark mode compatibility
│           └── useResizeObserver.ts  # Container width/height hook
├── server-fns/
│   └── visualizations.ts             # getGraphData, getMoneyFlow, getTimeline
└── routes/entity/
    └── $id.tsx                       # Integrate viz tab into ProfileTabs
```

### Pattern 1: D3 for Math, React for Rendering

This is the established project pattern from STACK.md. D3 computes positions; React renders SVG elements via JSX. Never use `d3.select` / `.append` to mutate the DOM inside React components.

```typescript
// Source: established project pattern in STACK.md + community verification
import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'

type GraphNode = d3.SimulationNodeDatum & {
  id: string
  name: string
  entityType: string
  x?: number
  y?: number
}

type GraphLink = d3.SimulationLinkDatum<GraphNode> & {
  connectionType: string
  totalValue: number | null
}

export function NetworkGraph({ nodes, links }: { nodes: GraphNode[]; links: GraphLink[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [simNodes, setSimNodes] = useState<GraphNode[]>([])
  const [simLinks, setSimLinks] = useState<GraphLink[]>([])
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 })

  useEffect(() => {
    const simulation = d3
      .forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d) => (d as GraphNode).id).distance(80))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(400, 300))
      .force('collision', d3.forceCollide(20))

    simulation.on('tick', () => {
      setSimNodes([...simulation.nodes()])
      setSimLinks([...(links as GraphLink[])])
    })

    return () => { simulation.stop() }
  }, [nodes, links])

  // Render SVG via JSX — not d3.select
  return (
    <svg ref={svgRef} role="img" aria-label="Entity relationship network">
      <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
        {/* links and nodes rendered here */}
      </g>
    </svg>
  )
}
```

### Pattern 2: d3-zoom Attached via useEffect, Transform in React State

```typescript
// Source: d3js.org/d3-zoom official docs + verified pattern
useEffect(() => {
  if (!svgRef.current) return
  const svg = d3.select(svgRef.current)
  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.25, 4])
    .on('zoom', (event) => {
      setTransform({ x: event.transform.x, y: event.transform.y, k: event.transform.k })
    })
  svg.call(zoom)
  return () => { svg.on('.zoom', null) }
}, [])
```

### Pattern 3: D3-Sankey Layout

```typescript
// Source: github.com/d3/d3-sankey README (d3-sankey 0.12.3)
import { sankey, sankeyLinkHorizontal } from 'd3-sankey'

type SankeyNode = { id: string; name: string }
type SankeyLink = { source: string; target: string; value: number }

const sankeyLayout = sankey<SankeyNode, SankeyLink>()
  .nodeWidth(20)
  .nodePadding(12)
  .nodeId((d) => d.id)
  .extent([[0, 0], [width, height]])

const { nodes, links } = sankeyLayout({ nodes: rawNodes, links: rawLinks })
// Each node now has: x0, x1, y0, y1 (position bounds)
// Each link now has: y0, y1 (endpoint y), width (stroke width)
```

### Pattern 4: Dark Mode — Reading CSS Variables for D3 Colors

The app uses HSL CSS variables (`--foreground`, `--primary`, etc.) defined in `app.css`. D3 color scales must read these at render time, not hardcode hex values.

```typescript
// Source: MDN getComputedStyle + project app.css HSL variable pattern
export function useChartColors() {
  return {
    getColor: (cssVar: string): string => {
      const raw = getComputedStyle(document.documentElement)
        .getPropertyValue(cssVar)
        .trim()
      return `hsl(${raw})`
    }
  }
}

// Usage in component:
const { getColor } = useChartColors()
const nodeColors = {
  politician: getColor('--primary'),      // government blue
  person: getColor('--muted-foreground'),
  organization: getColor('--accent-foreground'),
  company: getColor('--secondary-foreground'),
  department: getColor('--ring'),
}
```

This pattern correctly adapts to dark/light mode changes because `getComputedStyle` reads the live computed value at the time D3 renders.

### Pattern 5: Responsive Chart via ResizeObserver

```typescript
// Source: MDN ResizeObserver + D3 standard pattern
export function useResizeObserver(ref: React.RefObject<HTMLElement | null>) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  useEffect(() => {
    if (!ref.current) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [ref])
  return dimensions
}
```

### Pattern 6: Recursive CTE Graph Query via Raw SQL

Drizzle does not support `WITH RECURSIVE` in its query builder (GitHub issue #209 still open as of 2026). Use `db.execute(sql`...`)` for graph traversal.

```typescript
// Source: drizzle-team/drizzle-orm discussions #3026 + PostgreSQL CYCLE clause docs
import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'

async function getGraphNodes(entityId: string, maxDepth: number) {
  const db = getDb()
  const result = await db.execute(sql`
    WITH RECURSIVE graph AS (
      -- Depth-1: direct connections (both directions)
      SELECT
        CASE WHEN entity_a_id = ${entityId}::uuid
             THEN entity_b_id ELSE entity_a_id END AS connected_id,
        id AS connection_id,
        connection_type,
        total_value,
        transaction_count,
        first_seen,
        last_seen,
        1 AS depth
      FROM entity_connections
      WHERE entity_a_id = ${entityId}::uuid
         OR entity_b_id = ${entityId}::uuid

      UNION

      -- Depth-N: expand neighbors up to maxDepth
      SELECT
        CASE WHEN ec.entity_a_id = g.connected_id
             THEN ec.entity_b_id ELSE ec.entity_a_id END,
        ec.id,
        ec.connection_type,
        ec.total_value,
        ec.transaction_count,
        ec.first_seen,
        ec.last_seen,
        g.depth + 1
      FROM entity_connections ec
      JOIN graph g ON ec.entity_a_id = g.connected_id
                   OR ec.entity_b_id = g.connected_id
      WHERE g.depth < ${maxDepth}
    )
    CYCLE connected_id SET is_cycle USING path
    SELECT DISTINCT ON (g.connected_id)
      g.connected_id,
      g.connection_id,
      g.connection_type,
      g.total_value,
      g.transaction_count,
      g.first_seen,
      g.last_seen,
      g.depth,
      e.canonical_name,
      e.entity_type
    FROM graph g
    JOIN entities e ON e.id = g.connected_id
    WHERE NOT g.is_cycle
    ORDER BY g.connected_id, g.depth
    LIMIT 150
  `)
  return result.rows
}
```

**Critical note:** The `CYCLE` clause (PostgreSQL 14+) prevents infinite loops in cyclic graphs. Always include it for bidirectional graph traversal.

### Pattern 7: Server Function for Graph Data (API-06)

```typescript
// Source: TanStack Start createServerFn pattern from Phase 2 (server-fns/entity.ts)
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const GraphInputSchema = z.object({
  id: z.string().uuid(),
  depth: z.number().int().min(1).max(3).default(1),
  connectionTypes: z.array(z.string()).optional(),
})

export const getGraphData = createServerFn({ method: 'GET' })
  .inputValidator(GraphInputSchema)
  .handler(async ({ data }) => {
    // Returns { nodes: GraphNode[], edges: GraphEdge[], truncated: boolean }
  })
```

### Anti-Patterns to Avoid

- **D3 DOM mutation in React**: Never call `d3.select(svgRef.current).selectAll('circle').data(...).join(...)` to render nodes. D3's DOM mutations conflict with React's reconciler. Use D3 for layout math only, render via JSX.
- **Hardcoded hex colors**: Always read from CSS variables — charts must work in both light and dark mode.
- **No node cap enforcement**: Without a `LIMIT 150` in the server function, a hub entity could return thousands of nodes. Enforce at the query layer, not the render layer.
- **Depth-3 as default**: Depth-3 recursive CTEs on the bidirectional graph with 1M+ rows may cause query plan explosions. Default to depth-1; depth-2 by user action; depth-3 only for very simple graphs (< 10 depth-1 neighbors).
- **`any` types for D3 simulation**: D3 simulation nodes use `d3.SimulationNodeDatum` intersection types. Don't use `any` — TypeScript will catch rendering bugs at compile time.
- **Barrel file imports**: Import directly from `@/components/visualizations/NetworkGraph` etc. — no index files.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Force simulation physics | Custom spring/repulsion math | `d3.forceSimulation` + `d3.forceLink` + `d3.forceManyBody` | Velocity Verlet integration is numerically stable; hand-rolled physics drift and fail to converge |
| Zoom/pan gesture handling | `onWheel` + `onMouseMove` handlers | `d3.zoom` | Handles pinch zoom, two-finger touchpad, mouse wheel, click-drag — testing each gesture is weeks of work |
| Drag-to-reposition nodes | `onMouseDown` tracking | `d3.drag` | Handles pointer capture, accidental text selection, touch events |
| Sankey layout math | Rectangle sizing + link curves | `d3-sankey` + `sankeyLinkHorizontal` | Iterative relaxation algorithm for overlap avoidance is non-trivial; d3-sankey is battle-tested |
| Color scheme for entity types | Custom hex palette | `d3.scaleOrdinal` with project CSS vars | `scaleOrdinal` guarantees consistent color-to-category mapping; CSS var approach ensures dark mode |
| Graph cycle detection | Custom visited-set tracking | PostgreSQL `CYCLE` clause (pg14+) | The CYCLE clause is O(1) overhead vs. application-layer BFS which requires round-trips |
| SVG path for Sankey links | bezierCurveTo math | `sankeyLinkHorizontal()` | Returns a path generator compatible with d3-sankey's computed y0/y1/width values |
| Chart responsiveness | Fixed pixel dimensions | `ResizeObserver` hook | Container width changes on mobile / panel toggle; fixed dimensions break layout |

**Key insight:** D3 is not just a rendering library — its real value is physics simulation, layout algorithms, and scale functions. Using it purely for rendering (with alternatives like Recharts) wastes its capabilities. Using it for DOM mutation conflicts with React. The sweet spot is D3 layout + React rendering.

---

## Common Pitfalls

### Pitfall 1: Stale Closure in Simulation `tick` Callback

**What goes wrong:** The simulation `tick` fires many times per second. If the `setSimNodes` state setter is captured in a stale closure (from an old `useEffect` run), nodes stop updating visually while the simulation keeps running invisibly.

**Why it happens:** `useEffect` with missing dependencies captures old function references. Running without the exhaustive-deps lint rule can mask this.

**How to avoid:** Pass a function form to `setSimNodes`: `setSimNodes(prev => [...simulation.nodes()])`. This avoids needing to include `setSimNodes` in deps. Alternatively, use a ref for the simulation and restart it explicitly when data changes.

**Warning signs:** Graph appears frozen after the first data load but console shows no errors.

---

### Pitfall 2: D3 Zoom Conflicts with React Re-Renders

**What goes wrong:** If the SVG element re-mounts (e.g., due to a parent re-render or conditional rendering), the zoom behavior attached in `useEffect` is lost. Pan/zoom stops working.

**Why it happens:** `d3.zoom` attaches event listeners to the DOM element directly. React unmounting/remounting creates a new element with no listeners.

**How to avoid:** Keep the SVG stable — don't conditionally render it. Show a loading overlay on top of the SVG while data loads rather than unmounting it. Attach zoom inside `useEffect` with `[]` deps (only once on mount). Clean up with `svg.on('.zoom', null)` in the return.

**Warning signs:** Zoom works on first load but breaks after a filter change or tab switch.

---

### Pitfall 3: Depth-2 Recursive CTE Explosion on High-Degree Nodes

**What goes wrong:** A depth-2 bidirectional traversal from a hub node (e.g., a person who donated to 40 parties) expands to 40 × avg-neighbors nodes. This can hit thousands of rows per query and take 500ms+ before the LIMIT kicks in.

**Why it happens:** The LIMIT applies to the final SELECT, not to the recursive CTE expansion. The CTE generates all intermediate rows before LIMIT filters them.

**How to avoid:** Add a LIMIT inside the recursive step itself: `WHERE g.depth < ${maxDepth} LIMIT 500`. For depth-2 requests, also cap depth-1 results first (max 20 immediate neighbors per expansion step). The graph endpoint should cap at 150 total nodes and return `truncated: true` when the graph is larger.

**Warning signs:** Graph queries for popular politicians take 1–2 seconds; depth-2 for `donor_to_party` connections (1M rows) is especially prone.

---

### Pitfall 4: d3-sankey Mutates Input Arrays

**What goes wrong:** `sankey()(data)` modifies the `nodes` and `links` arrays in-place, adding computed properties (`x0`, `x1`, `y0`, `y1`, `sourceLinks`, etc.). If you pass React state arrays directly, this triggers unexpected state mutations.

**Why it happens:** d3-sankey follows the D3 convention of mutating input objects for performance.

**How to avoid:** Always deep-copy input data before passing to sankey: `sankey()({ nodes: nodes.map(n => ({ ...n })), links: links.map(l => ({ ...l })) })`.

**Warning signs:** React dev tools show unexpected state changes; Sankey re-renders break on second call with "source is not defined" errors.

---

### Pitfall 5: Missing `CYCLE` Clause Causes Infinite Recursive CTE

**What goes wrong:** Without `CYCLE connected_id SET is_cycle USING path`, the bidirectional recursive CTE can enter an infinite loop when the graph has cycles (A connects to B, B connects back to A through a different path). PostgreSQL will run until it hits the `max_recursive_depth` setting and throws an error.

**Why it happens:** The `entity_connections` table has `donor_to_party` connections — donors who donated to many parties, where multiple paths can form cycles. All bidirectional CTEs on this table will encounter cycles.

**How to avoid:** Always include `CYCLE connected_id SET is_cycle USING path` after the recursive CTE definition (PostgreSQL 14+ feature). Include `WHERE NOT g.is_cycle` in the final SELECT.

**Warning signs:** Server function call hangs for 30+ seconds then returns a PostgreSQL error about recursive CTE depth.

---

### Pitfall 6: Node Positions Not Stable Between Data Updates (Janky Graph)

**What goes wrong:** When the user clicks to expand a node (VIZ-02), entirely new `nodes` and `links` arrays trigger a new simulation. All existing nodes start from random positions, causing the entire graph to "explode" and re-settle visually.

**Why it happens:** New array references cause the `useEffect` to re-run with fresh simulation. D3 initializes node positions randomly unless `x`/`y` are pre-set.

**How to avoid:** When expanding a node, merge the new nodes with the existing ones — preserve `x`/`y`/`vx`/`vy` from existing nodes in the new array. New nodes should initialize near the clicked node's position, not at random.

**Warning signs:** Every click-to-expand causes the whole graph to rearrange rather than organically growing.

---

### Pitfall 7: Sankey Diagram for This Dataset — `donor_to_party` Only

**What goes wrong:** VIZ-04 is "money flow showing donor → party → contract/grant." But the live database only has `donor_to_party` and `grant_recipient_to_department` connection types — there is no direct donor → contract link in `entity_connections`. The Sankey must be built from multi-source queries, not from `entity_connections` alone.

**Why it happens:** The Sankey requires a different data model than the general graph. The API-07 server function must aggregate: (1) entity donations by recipient party, (2) contracts/grants by department, for the same entity.

**How to avoid:** API-07 must join `donations` → `recipientName` → `contracts.department` via the entity matching layer. A practical shape: `[contributor → party → department]` using party donations and that party's associated contracts.

**Warning signs:** Sankey returns only 2-node graphs because `entity_connections` doesn't encode the full flow chain.

---

## Database Reality Check (Live Data)

Verified via live PostgreSQL 16 instance (confirmed 2026-03-31):

| Metric | Value |
|--------|-------|
| Total entity_connections rows | 1,073,658 |
| Connection types present | `donor_to_party` (1,013,522), `grant_recipient_to_department` (60,136) |
| Max direct connections for any entity | ~45 nodes |
| Median entities with 1 connection | 534,470 |
| Depth-1 query time (indexed) | < 1ms |
| Depth-2 bidirectional CTE time | ~150ms (JIT overhead; fast after warm-up) |
| Total entities | 1,231,390 (676,501 persons, 546,519 organizations, 8,291 politicians, 79 companies) |

**Important implication:** The 150-node cap in VIZ-01 is not primarily a rendering concern (SVG handles 150 nodes easily). It is a query performance concern for depth-2+ traversals. Set `LIMIT 150` in the graph query.

**Missing connection types:** `vendor_to_department`, `lobbyist_to_official`, `lobbyist_client_to_official`, `lobbyist_to_client` are defined in the schema comments but do not appear in live data yet. The force-directed graph should degrade gracefully when only `donor_to_party` data is available.

---

## API Shape Reference

### API-06: Graph Data

**Request:** `getGraphData({ id, depth: 1|2|3 })`

**Response shape:**
```typescript
type GraphResponse = {
  rootEntityId: string
  nodes: Array<{
    id: string
    name: string
    entityType: 'person' | 'politician' | 'organization' | 'company' | 'department'
    depth: number
  }>
  edges: Array<{
    sourceId: string
    targetId: string
    connectionType: string
    totalValue: number | null
    transactionCount: number
    firstSeen: string | null
    lastSeen: string | null
  }>
  truncated: boolean  // true if > 150 nodes
}
```

### API-07: Money Flow (Sankey)

**What to query:** For a given entity, aggregate:
1. Donations made by the entity → group by `recipientName` (party)
2. Contracts/grants received by same entities as the parties donated to → group by `department`

This is a two-hop JOIN that cannot be satisfied by `entity_connections` alone. The server function must query `donations` and `contracts`/`grants` directly.

**Response shape:**
```typescript
type MoneyFlowResponse = {
  nodes: Array<{ id: string; name: string; type: 'entity' | 'party' | 'department' }>
  links: Array<{ source: string; target: string; value: number }>
}
```

### API-08: Timeline

**What to query:** UNION across all 5 datasets where `entity_id = entityId` (or dual-FK pattern for lobbying), ordered by date, returning a typed event.

**Response shape:**
```typescript
type TimelineEvent = {
  date: string
  eventType: 'donation' | 'contract' | 'grant' | 'lobby_registration' | 'lobby_communication'
  description: string
  amount: number | null
  relatedEntityName: string | null
  sourceUrl: string | null
}
type TimelineResponse = { events: TimelineEvent[] }
```

---

## Visualization-Specific Notes

### Force-Directed Network Graph (VIZ-01 through VIZ-03)

- **Node colors by type** (using CSS vars): politician = primary (government blue), person = muted-foreground, organization = accent-foreground, department = ring, company = destructive
- **Edge styles by type**: `donor_to_party` = solid; `vendor_to_department` = dashed; `lobbyist_to_official` = dotted
- **Click-to-expand (VIZ-02)**: On node click, call `getGraphData` with `{ id: clickedNodeId, depth: 1 }` and merge new nodes/edges into existing state, preserving positions of already-rendered nodes
- **Hover tooltips (VIZ-02)**: Use React state (`hoveredNode`) + absolute positioned `div` — do not use SVG `<title>` elements (inaccessible). Include entity name, type, connection count, and total value.
- **Filter by type (VIZ-03)**: Store `activeTypes` and `dateRange` in React state; pass to server fn. On filter change, re-fetch from server — do not filter client-side (filtered nodes may reveal new data from DB)
- **Zoom/pan (VIZ-02)**: Attach `d3.zoom` to outer SVG; render inner `<g>` with transform from React state. Scale extent: `[0.1, 8]`.

### Sankey Diagram (VIZ-04)

- **Node alignment**: Use `sankeyLeft()` for entity node on the left, center columns for parties, right column for departments
- **Link color**: Use source node color at 50% opacity (creates a natural gradient effect without actual SVG gradients)
- **Data source**: Build from `donations` + `contracts` tables, not from `entity_connections`
- **If < 3 nodes**: Show a "not enough data" empty state (many entities have only donations to one party and no connected contracts)

### Activity Timeline (VIZ-05)

- **X-axis**: `d3.scaleTime` from min(date) to max(date) across all event types
- **Horizontal scrollable**: Use `d3.zoom` with constrained `translateExtent` on X axis only; Y is fixed
- **Event markers by type**: Use different SVG shapes — circle for donations, square for contracts, diamond for grants, triangle for lobbying
- **Election year overlays**: Add vertical reference lines at Canadian federal election years (2004, 2006, 2008, 2011, 2015, 2019, 2021, 2025)

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| D3 v5 select/join for React | "D3 for math, React for rendering" | ~2020 (widespread adoption) | No more React/D3 DOM conflicts |
| Hardcoded colors | CSS variable reading at render time | Tailwind v4 era | Dark mode works without separate color logic |
| `React.forwardRef` for SVG refs | Ref as prop (React 19) | React 19 (2024) | Simpler typing for SVG refs |
| `tailwindcss-animate` | `tw-animate-css` | shadcn/ui CLI v4 (2025) | Project already uses `tw-animate-css` |
| Drizzle relational API for complex queries | `db.execute(sql`...`)` for recursive CTEs | Drizzle issue #209 (unresolved) | Must use raw SQL for graph traversal |

---

## Open Questions

1. **VIZ-04 Sankey — multi-hop data shape**
   - What we know: `entity_connections` only has `donor_to_party` and `grant_recipient_to_department` — no single record links donor → party → department
   - What's unclear: Should the Sankey show (a) entity as donor → parties directly, or (b) attempt a 3-node flow via a lookup join? Option (a) is feasible with live data. Option (b) requires joining donations to contracts where `recipientName` matches known party names — possible but complex.
   - Recommendation: Implement option (a) first (entity → parties → recipient types); document option (b) as a future enhancement when more connection types are ingested.

2. **VIZ-03 Filter by date range performance**
   - What we know: `entity_connections` has `first_seen`/`last_seen` columns. No index on these columns currently.
   - What's unclear: At 1M+ rows, filtering by date range without an index may be slow.
   - Recommendation: Add a migration to create an index on `entity_connections(first_seen, last_seen)` in the server function's Wave 0 setup task.

3. **VIZ-02 Click-to-expand — depth tracking**
   - What we know: Client must track which nodes have been expanded to avoid re-fetching
   - What's unclear: Should expanded state persist across tab switches? Should the graph reset when the user navigates away?
   - Recommendation: Track `expandedNodeIds: Set<string>` in component state. Reset on navigation (standard React behavior when component unmounts).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | apps/web runtime | ✓ | v24.13.0 | — |
| Docker | Local PostgreSQL | ✓ | 27.5.1 | — |
| PostgreSQL 16 | Graph queries | ✓ | 16-alpine (confirmed running via `docker ps`) | — |
| `d3` npm package | All visualizations | ✗ (not yet installed) | 7.9.0 available | Must install before work begins |
| `d3-sankey` npm package | VIZ-04 | ✗ (not yet installed) | 0.12.3 available | Must install before work begins |
| `@types/d3` npm package | TypeScript strict mode | ✗ (not yet installed) | 7.4.3 available | Must install before work begins |

**Missing dependencies with no fallback:**
- `d3`, `d3-sankey`, `@types/d3` — all must be installed in `apps/web` as Wave 0 task before visualization code can be written.

---

## Sources

### Primary (HIGH confidence)

- [d3js.org/d3-force](https://d3js.org/d3-force) — force simulation API (forces, tick, restart, alphaDecay)
- [d3js.org/d3-zoom](https://d3js.org/d3-zoom) — zoom/pan API (scaleExtent, translateExtent, events, transform.x/y/k)
- [github.com/d3/d3-sankey](https://github.com/d3/d3-sankey) — Sankey input/output data shape (nodes, links, computed properties)
- [npm view d3 version](https://www.npmjs.com/package/d3) — confirmed 7.9.0 current as of 2026-03-31
- [npm view d3-sankey version](https://www.npmjs.com/package/d3-sankey) — confirmed 0.12.3 current
- [npm view @types/d3 version](https://www.npmjs.com/package/@types/d3) — confirmed 7.4.3 current
- Live PostgreSQL database — entity_connections row counts, query EXPLAIN ANALYZE timings

### Secondary (MEDIUM confidence)

- [observablehq.com/@d3/force-directed-graph-component](https://observablehq.com/@d3/force-directed-graph-component) — D3 team's canonical force graph component pattern
- [PostgreSQL docs: WITH Queries](https://www.postgresql.org/docs/current/queries-with.html) — CYCLE clause (pg14+), SEARCH clause
- [drizzle-team/drizzle-orm discussions #3026](https://github.com/drizzle-team/drizzle-orm/discussions/3026) — WITH RECURSIVE not supported in Drizzle query builder; use sql template
- [drizzle-team/drizzle-orm issues #209](https://github.com/drizzle-team/drizzle-orm/issues/209) — tracking issue for native WITH RECURSIVE (unresolved)
- [d3js.org/d3-scale-chromatic](https://d3js.org/d3-scale-chromatic) — categorical color scheme guidance

### Tertiary (LOW confidence)

- WebSearch results for D3 + React 19 patterns — community blogs, used to triangulate patterns, not cited as authoritative

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm versions verified against live registry; packages confirmed not yet installed
- Architecture patterns: HIGH — verified against official D3 docs and Phase 2 established patterns
- Database queries: HIGH — tested against live PostgreSQL 16 instance with EXPLAIN ANALYZE
- Pitfalls: MEDIUM-HIGH — most from D3 docs + known community gotchas; d3-sankey mutation pitfall from official source

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (D3 v7 is stable; d3-sankey is stable; TanStack Start 1.167 is active)
