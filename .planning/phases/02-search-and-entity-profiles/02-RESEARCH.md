# Phase 2: Search and Entity Profiles — Research

**Researched:** 2026-03-31
**Domain:** TanStack Start server functions, shadcn/ui initialization, pg_trgm autocomplete, TanStack Table, Claude API summaries, dark mode, i18n structure
**Confidence:** HIGH (core patterns) / MEDIUM (dark mode SSR, model name currency)

---

## Summary

Phase 2 builds the entire user-facing application on top of the Phase 1 data foundation: a landing page with sub-150ms search autocomplete, a search results page with filters, and entity profile pages with tabbed data tables and AI-generated summaries. The web scaffold at `apps/web/` is minimal (two routes, no shadcn, no CSS) — this phase builds everything from scratch.

The technical approach is well-defined by the locked stack. TanStack Start server functions serve as the data layer (replacing a traditional REST API), shadcn/ui with Tailwind v4 handles UI components, TanStack Table drives the sortable/paginated data tables, and the Anthropic SDK generates entity summaries cached in the existing `ai_summaries` database table. The critical path is: shadcn init → route structure → server functions → search → entity profile → AI summaries.

**Important model update:** Phase 1 ingestion code uses `claude-haiku-3-5` and `claude-sonnet-4-5` as model IDs. As of March 2026, the current models are `claude-haiku-4-5` and `claude-sonnet-4-6`. Phase 2 AI summary generation should use `claude-haiku-4-5` for cost-efficiency. The older model names remain functional aliases but should not be introduced in new code.

**Primary recommendation:** Use server functions (not server routes) as the API layer for all data operations. Server functions provide type-safe RPC that works for both SSR (called directly, no HTTP overhead) and client-side calls (called via fetch automatically). Build server routes only for the POST /api/entity/:id/flag endpoint which must accept requests from non-React contexts.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SRCH-01 | User can search for any entity from a prominent search bar | Landing page design in UI-SPEC; server function + Combobox/Input pattern |
| SRCH-02 | Search provides autocomplete suggestions as user types (<150ms perceived latency) | pg_trgm with GIN index + debounce 200ms + TanStack Query cache |
| SRCH-03 | Search results grouped by entity type (Politicians, Companies/Organizations, People) | SQL GROUP BY entityType; client-side section rendering |
| SRCH-04 | Each search result shows summary counts (donations, contracts, lobbying, grants) | Count query across 4 raw tables; pre-computed in entity profile or computed in search query |
| SRCH-05 | User can filter search results by entity type, date range, and province | URL search params via TanStack Router `validateSearch` + server function params |
| PROF-01 | Entity profile with name, type, and AI match confidence badge | Dynamic route `entity/$id.tsx` + server function + UI-SPEC badge design |
| PROF-02 | Profile shows plain-language AI summary as first visible content | `ai_summaries` table query; generate on-demand if missing; claude-haiku-4-5 |
| PROF-03 | Profile has tabbed views: Donations, Contracts, Grants, Lobbying, Connections | shadcn Tabs + 5 tab panels, each wrapping a DataTable |
| PROF-04 | Each data section shows sortable, filterable table with pagination | TanStack Table v8 + shadcn Table components; server-side pagination via server functions |
| PROF-05 | Every record links back to original government data source | `rawData` jsonb column contains source URL fields; render ExternalLink per row |
| PROF-06 | Profile shows data provenance timestamps (when each dataset was last updated) | Query last `ingestedAt` per source table; render in footer |
| AI-01 | Plain-language AI summaries with emoji icons | claude-haiku-4-5 with structured prompt; store in `ai_summaries` table |
| AI-02 | Summaries include "connections do not imply wrongdoing" caveat | System prompt enforcement; UI disclaimer below summary |
| AI-03 | Summaries cached and regenerated weekly on data refresh | `ai_summaries.isStale` flag; pg-boss weekly job already in scheduler |
| AI-04 | AI match transparency badge shows confidence score, method, AI reasoning | `entity_aliases` + `entity_matches_log` query; shadcn Popover |
| AI-05 | "How do we write this summary?" link explains AI generation | Static modal/Dialog with explanation copy |
| COMM-01 | User can flag incorrect entity match via "Flag an error" button | shadcn Dialog form + POST server function → `flags` table |
| COMM-02 | Flags stored with optional email for follow-up | `flags` table has `reporter_email` (nullable) column — already exists |
| COMM-03 | Flagged matches visible in entity_matches_log for review | `flags.match_log_id` FK to `entity_matches_log` — already exists |
| API-01 | GET /api/search with query, type filter, pagination | Server function `searchEntities`; also expose as server route for external use |
| API-02 | GET /api/entity/:id returns full entity profile | Server function `getEntityProfile`; all related data in one call |
| API-03 | GET /api/entity/:id/donations, /contracts, /lobbying, /grants with pagination | Per-tab server functions with cursor pagination |
| API-04 | GET /api/entity/:id/connections | Server function querying `entity_connections` table |
| API-05 | GET /api/entity/:id/summary returns AI summary | Server function with cache-then-generate pattern |
| API-11 | GET /api/stats returns platform-wide statistics | Server function querying COUNT across main tables |
| API-12 | POST /api/entity/:id/flag submits error flag | Server route (POST, non-browser clients) → `flags` table insert |
| DSGN-01 | Professional civic design | UI-SPEC fully specifies all visual details |
| DSGN-02 | Dark mode support | Cookie-based SSR-safe theme; CSS variables; `.dark` class on `<html>` |
| DSGN-03 | Mobile responsive, tables collapse to cards | Tailwind responsive prefixes; CSS grid/flex; table→card transform at <768px |
| DSGN-04 | Bilingual-ready i18n keys externalized | `apps/web/src/i18n/en.ts` translation file; typed key access |
| DSGN-05 | Landing page with search bar, tagline, platform statistics | Route `index.tsx` with hero section + API-11 stats |
| DSGN-06 | "Connections do not imply wrongdoing" disclaimer on all relationship views | Connections tab banner + AI summary disclaimer |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

The CLAUDE.md for this project is auto-generated from project files and contains no additional directives beyond the PROJECT.md constraints. The following apply to all Phase 2 work:

- **Tech stack (locked):** TanStack Start 1.167.x, shadcn/ui CLI v4, Tailwind CSS 4.x, TypeScript strict mode, Drizzle ORM
- **No barrel files:** Ultracite/Biome prohibits `index.ts` re-export files — import directly from specific files
- **No `any` types:** Use `unknown` + Zod parsing at boundaries
- **Arrow functions for callbacks:** Use `for...of` not `.forEach()`
- **Async/await:** Always `await` promises, never leave floating
- **Remove console.log:** No debug logging in committed code (use structured logging or remove)
- **Semantic HTML + ARIA:** All form inputs have visible labels; autocomplete uses `role="listbox"` pattern
- **No OAuth/user accounts:** Out of scope for v1 — flag submission is anonymous

---

## Standard Stack

### Core (already in apps/web/package.json)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-start` | 1.167.16 | Full-stack framework, SSR, file routing, server functions | Locked project choice |
| `@tanstack/react-router` | 1.167.16 | Type-safe routing, search params as state | Paired with Start |
| `@tanstack/react-query` | 5.96.1 | Client-side cache for autocomplete, profile data | Bundled with Start ecosystem |
| `drizzle-orm` | 0.45.2 (catalog) | Database queries in server functions | Phase 1 established pattern |
| `zod` | 3.x (catalog) | Server function input validation | Phase 1 established pattern |
| `tailwindcss` | 4.2.2 | Utility CSS | Locked project choice |
| `@anthropic-ai/sdk` | 0.80.x (catalog) | Claude API for entity summaries | Locked project choice |

### Must Install (not yet in apps/web/package.json)

| Library | Version | Purpose | Install Command |
|---------|---------|---------|-----------------|
| shadcn/ui components | CLI v4.1.2 | UI component library (init + add) | `pnpm dlx shadcn@latest init` then `pnpm dlx shadcn@latest add ...` |
| `@tanstack/react-table` | 8.21.3 | Headless table engine for sortable/paginated tables | `pnpm add @tanstack/react-table` |
| `lucide-react` | 1.7.0 | Icon library (shadcn standard) | `pnpm add lucide-react` |
| `next-themes` | 0.4.6 | Dark mode theme provider (for non-SSR path) | See dark mode section — cookie approach preferred |
| `@govtrace/db` | workspace:* | Already in package.json — DB schema + client | Already present |

**Version verification (npm registry as of 2026-03-31):**
- `@tanstack/react-table`: 8.21.3
- `lucide-react`: 1.7.0
- `next-themes`: 0.4.6
- shadcn CLI: 4.1.2

### shadcn Components to Install

Per UI-SPEC.md:
```bash
# From apps/web/ directory
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add input button badge card tabs table dialog popover select pagination separator skeleton
```

Additional (not a shadcn command):
```bash
pnpm add lucide-react @tanstack/react-table
```

### Claude Model IDs (CRITICAL UPDATE from Phase 1)

Phase 1 uses `claude-haiku-3-5` and `claude-sonnet-4-5`. Current models as of March 2026 (verified from official Anthropic docs):

| Use Case | Model ID | Price |
|----------|----------|-------|
| Entity summaries (high volume) | `claude-haiku-4-5` | $1/$5 per MTok in/out |
| Complex reasoning (escalation) | `claude-sonnet-4-6` | $3/$15 per MTok in/out |

Phase 2 summary generation: use `claude-haiku-4-5`. Note: `claude-haiku-3-5` refers to a legacy model not in the current tier table. The Phase 1 ingestion code uses this name — leave it as-is (it still functions) but do not repeat it in Phase 2.

---

## Architecture Patterns

### Route File Structure

TanStack Start uses file-based routing in `apps/web/src/routes/`. Files map directly to URL paths. Dynamic segments use `$param` prefix.

```
apps/web/src/
├── routes/
│   ├── __root.tsx          # Root layout (HTML, ThemeProvider, skip-to-content)
│   ├── index.tsx           # / Landing page (search bar, tagline, stats)
│   ├── search.tsx          # /search Search results page (query + filters from URL params)
│   ├── entity/
│   │   └── $id.tsx         # /entity/:id Entity profile page (tabbed data)
│   └── api/
│       ├── search.ts       # GET /api/search (server route for external consumers)
│       ├── stats.ts        # GET /api/stats (server route)
│       └── entity/
│           └── $id/
│               ├── flag.ts         # POST /api/entity/:id/flag (server route — mutation)
│               └── summary.ts      # GET /api/entity/:id/summary (server route)
├── server-fns/
│   ├── search.ts           # searchEntities(), getAutocomplete() — server functions
│   ├── entity.ts           # getEntityProfile(), getEntityStats() — server functions
│   ├── datasets.ts         # getDonations(), getContracts(), getGrants(), getLobbying(), getConnections() — server functions
│   ├── summary.ts          # getOrGenerateSummary() — server function with Claude call
│   ├── flag.ts             # submitFlag() — server function
│   └── stats.ts            # getPlatformStats() — server function
├── components/
│   ├── ui/                 # shadcn copied components (DO NOT edit manually)
│   ├── search/
│   │   ├── SearchBar.tsx       # Input + autocomplete dropdown (SRCH-01, SRCH-02)
│   │   ├── SearchResults.tsx   # Grouped results by entity type (SRCH-03, SRCH-04)
│   │   └── SearchFilters.tsx   # Sidebar filters (SRCH-05)
│   ├── entity/
│   │   ├── EntityHeader.tsx    # Blue header band, name, type, confidence badge
│   │   ├── AISummary.tsx       # Summary block with disclaimer (PROF-02, AI-01, AI-02)
│   │   ├── ConfidenceBadge.tsx # 3-state badge + popover (AI-04)
│   │   ├── ProfileTabs.tsx     # Tab bar with count badges (PROF-03)
│   │   └── FlagModal.tsx       # Flag an error dialog (COMM-01)
│   ├── tables/
│   │   ├── DonationsTable.tsx
│   │   ├── ContractsTable.tsx
│   │   ├── GrantsTable.tsx
│   │   ├── LobbyingTable.tsx
│   │   └── ConnectionsTable.tsx
│   ├── layout/
│   │   ├── ThemeProvider.tsx   # Dark mode context + cookie persistence
│   │   └── SkipToContent.tsx   # Accessibility skip link
│   └── landing/
│       ├── HeroSearch.tsx      # Landing page hero section
│       └── StatChips.tsx       # Platform statistics row
├── i18n/
│   └── en.ts                   # All visible copy strings keyed (DSGN-04)
└── lib/
    └── utils.ts                # shadcn className utility (auto-generated by init)
```

### Pattern 1: Server Functions as Data Layer

Server functions are the idiomatic TanStack Start data pattern. They run server-side but are callable from both loaders (SSR, no HTTP overhead) and client components (via automatic fetch).

```typescript
// Source: https://tanstack.com/start/latest/docs/framework/react/guide/server-functions
// apps/web/src/server-fns/search.ts

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getDb } from '@govtrace/db/client'
import { entities } from '@govtrace/db/schema/entities'
import { sql, ilike, eq } from 'drizzle-orm'

const SearchInputSchema = z.object({
  query: z.string().min(1).max(200),
  type: z.enum(['all', 'politician', 'company', 'person']).default('all'),
  province: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
})

export const searchEntities = createServerFn({ method: 'GET' })
  .validator((data: unknown) => SearchInputSchema.parse(data))
  .handler(async ({ data }) => {
    const db = getDb()
    // pg_trgm similarity search on normalized_name
    const results = await db
      .select()
      .from(entities)
      .where(
        sql`similarity(${entities.normalizedName}, ${data.query.toLowerCase()}) > 0.3`
      )
      .orderBy(sql`similarity(${entities.normalizedName}, ${data.query.toLowerCase()}) DESC`)
      .limit(data.pageSize)
      .offset((data.page - 1) * data.pageSize)
    return results
  })
```

Calling from route loader (SSR — direct call, no HTTP):
```typescript
// apps/web/src/routes/search.tsx
export const Route = createFileRoute('/search')({
  validateSearch: z.object({ q: z.string(), type: z.string().optional() }),
  loader: async ({ context }) => {
    // Direct call on server — no HTTP overhead
    const results = await searchEntities({ data: { query: context.search.q } })
    return { results }
  },
  component: SearchPage,
})
```

Calling from client component (TanStack Query + queryOptions pattern):
```typescript
// Source: https://www.brenelz.com/posts/using-server-functions-and-tanstack-query/
import { queryOptions, useQuery } from '@tanstack/react-query'

const autocompleteQueryOptions = (query: string) =>
  queryOptions({
    queryKey: ['autocomplete', query],
    queryFn: () => searchEntities({ data: { query, pageSize: 8 } }),
    staleTime: 1000 * 60,  // 1 minute cache
    enabled: query.length >= 2,
  })
```

### Pattern 2: Search Autocomplete — Sub-150ms Perceived Latency

The <150ms perceived latency requirement (SRCH-02) is achievable with three layers:

1. **Debounce on keystroke:** 200ms debounce on the input. This prevents firing on every keypress. The user does not perceive 200ms as latency because input is still fast.
2. **pg_trgm GIN index:** Already created in Phase 1 (`entities_normalized_name_gin_idx`). GIN indexes on `normalized_name` deliver autocomplete in ~5-30ms at Canadian federal entity scale (tens of thousands of entities).
3. **TanStack Query caching:** Previous search results are cached client-side. Repeated queries (common: users refine searches) hit the cache instantly.

```typescript
// Source: https://benwilber.github.io/programming/2024/08/21/pg-trgm-autocomplete.html
// Optimized autocomplete SQL — ILIKE for prefix match (fastest) combined with pg_trgm for fuzzy
// Use ILIKE for the first suggestion (exact prefix), pg_trgm for fuzzy tail

// In server function:
const autocomplete = await db.execute(sql`
  SELECT id, canonical_name, entity_type, normalized_name,
         similarity(normalized_name, ${query}) AS score
  FROM entities
  WHERE normalized_name % ${query}  -- pg_trgm operator uses GIN index
  ORDER BY score DESC
  LIMIT 8
`)
```

**Debounce implementation in SearchBar component:**
```typescript
// No external library needed — use useDeferredValue (React 18+)
import { useDeferredValue, useState } from 'react'

function SearchBar() {
  const [inputValue, setInputValue] = useState('')
  const deferredQuery = useDeferredValue(inputValue)  // React defers updates

  // Or explicit debounce with useEffect + setTimeout (300ms):
  const [debouncedQuery, setDebouncedQuery] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(inputValue), 200)
    return () => clearTimeout(timer)
  }, [inputValue])
}
```

### Pattern 3: Route Search Params for Filter State

TanStack Router treats search params as first-class typed state. Filters live in the URL — bookmarkable, shareable, back-button safe.

```typescript
// apps/web/src/routes/search.tsx
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const SearchParamsSchema = z.object({
  q: z.string().default(''),
  type: z.enum(['all', 'politician', 'company', 'person']).default('all'),
  province: z.string().optional(),
  from: z.string().optional(),   // date string YYYY-MM-DD
  to: z.string().optional(),
  page: z.number().int().default(1),
})

export const Route = createFileRoute('/search')({
  validateSearch: SearchParamsSchema,
  // ...
})

// Inside component — type-safe access:
function SearchFilters() {
  const { type, province } = Route.useSearch()
  const navigate = Route.useNavigate()

  const updateFilter = (key: string, value: string) =>
    navigate({ search: (prev) => ({ ...prev, [key]: value, page: 1 }) })
}
```

### Pattern 4: TanStack Table with shadcn Components

TanStack Table v8 is headless — it provides state and logic, shadcn provides rendering. The combination is the shadcn standard approach.

```typescript
// Source: https://ui.shadcn.com/docs/components/data-table
// apps/web/src/components/tables/DonationsTable.tsx
import {
  ColumnDef, SortingState, flexRender,
  getCoreRowModel, getSortedRowModel,
  getPaginationRowModel, useReactTable,
} from '@tanstack/react-table'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

// For server-side pagination: manualPagination + manualSorting = true
// Pass state back to server function as URL params or via parent state
```

**Server-side vs client-side:**
- Phase 2 tables use **server-side pagination** (data volumes can reach millions of rows)
- Set `manualPagination: true` and `manualSorting: true` on the table
- Table state (page, sort direction) stored in URL search params
- Each tab panel fetches its own page of data via server function when params change

### Pattern 5: AI Summary Generation and Caching

The `ai_summaries` table in `packages/db/src/schema/entities.ts` already exists with `isStale` flag. The server function pattern:

```typescript
// apps/web/src/server-fns/summary.ts
import Anthropic from '@anthropic-ai/sdk'
import { createServerFn } from '@tanstack/react-start'

const SUMMARY_MODEL = 'claude-haiku-4-5'  // Current model as of March 2026

export const getOrGenerateSummary = createServerFn({ method: 'GET' })
  .validator((data: unknown) => z.object({ entityId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const db = getDb()

    // Cache-first: check for fresh summary
    const cached = await db
      .select()
      .from(aiSummaries)
      .where(
        and(
          eq(aiSummaries.entityId, data.entityId),
          eq(aiSummaries.isStale, false),
        )
      )
      .limit(1)

    if (cached.length > 0) return cached[0].summaryText

    // Generate on-demand for first visit — fetch entity data first
    const [entity, donationCount, contractCount, grantCount, lobbyCount] =
      await Promise.all([/* count queries */])

    const apiKey = process.env['ANTHROPIC_API_KEY']
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required')
    const client = new Anthropic({ apiKey })

    const response = await client.messages.create({
      model: SUMMARY_MODEL,
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: buildSummaryPrompt(entity, donationCount, contractCount, grantCount, lobbyCount),
      }],
    })

    const summaryText = response.content[0].type === 'text' ? response.content[0].text : ''

    // Cache the result
    await db.insert(aiSummaries).values({
      entityId: data.entityId,
      summaryText,
      model: SUMMARY_MODEL,
      isStale: false,
    }).onConflictDoUpdate({
      target: aiSummaries.entityId,
      set: { summaryText, model: SUMMARY_MODEL, isStale: false, generatedAt: new Date() },
    })

    return summaryText
  })
```

**Cost management:** `claude-haiku-4-5` at $1/million input tokens. A typical entity summary prompt is ~500 tokens input, 200 tokens output = $0.00150/generation. For 10,000 entities: ~$15 total. Caching eliminates repeat costs.

### Pattern 6: Dark Mode (SSR-Safe, No Flicker)

The `next-themes` library causes SSR hydration mismatches when HTML is rendered on the server without knowing the user's theme preference. The correct approach for TanStack Start: store theme in a cookie, read it in the root route loader.

```typescript
// Source: https://nisabmohd.vercel.app/tanstack-dark
// apps/web/src/routes/__root.tsx

export const Route = createRootRoute({
  loader: () => getThemeFn(),   // reads cookie server-side
  component: RootComponent,
})

function RootComponent() {
  const theme = Route.useLoaderData()
  return (
    <html lang="en" className={theme} suppressHydrationWarning>
      <head><HeadContent /></head>
      <body>
        <ThemeProvider theme={theme}>
          <a href="#main-content" className="sr-only focus:not-sr-only">Skip to content</a>
          <Outlet />
        </ThemeProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}
```

The `.dark` class on `<html>` is the shadcn standard mechanism. shadcn v4 CSS variables use the `@theme inline` directive in `globals.css`:

```css
:root {
  --background: hsl(0 0% 100%);
  --foreground: hsl(0 0% 3.9%);
  --primary: 214 60% 23%;  /* government blue #1a3a5c */
}

.dark {
  --background: hsl(0 0% 3.9%);
  --foreground: hsl(0 0% 98%);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: hsl(var(--primary));
}
```

### Pattern 7: i18n Structure (EN-only v1)

Per DSGN-04 and UI-SPEC: all copy strings in `apps/web/src/i18n/en.ts`, never hardcoded in components. TypeScript-typed for autocomplete. No runtime i18n library needed for v1 — just a typed constant.

```typescript
// apps/web/src/i18n/en.ts
export const en = {
  search: {
    placeholder: 'Search politicians, companies, or people…',
    cta: 'Search the database',
    emptyHeading: 'No matching entities found',
    emptyBody: 'Try a different spelling or a shorter name.',
    emptyHint: "Searching for a company? Try searching without 'Inc.' or 'Ltd.'",
    autocompleteEmpty: 'No matches found — try a shorter name',
  },
  profile: {
    loading: 'Loading profile…',
    flagButton: 'Flag an error',
    summaryExplanation: 'How do we write this summary?',
    disclaimer: 'Connections shown do not imply wrongdoing.',
  },
  badge: {
    high: 'High confidence',
    medium: 'AI-verified',
    low: 'Unverified',
    explanation: 'How is this calculated?',
  },
  flag: {
    title: 'Flag an error',
    body: 'Help us improve GovTrace. If you believe this entity match is incorrect, let us know.',
    textareaPlaceholder: 'e.g., This profile merges two different people with similar names',
    emailPlaceholder: 'your@email.com — for follow-up only',
    submit: 'Submit flag',
    cancel: 'Never mind',
    confirmation: 'Thanks — your flag has been recorded. We review all submissions.',
  },
  table: {
    empty: 'No {dataset} records found for this entity.',
    pagination: { rowsPerPage: 'Rows per page', of: 'of' },
  },
  common: {
    error: 'Unable to load data. Try refreshing the page. If this keeps happening, the government data source may be temporarily unavailable.',
  },
} as const

export type TranslationKey = typeof en
```

### Pattern 8: Server Routes for External API Endpoints

API-01, API-02, API-11, API-12 are exposed as server routes (not just server functions) because they need stable HTTP URLs callable from external consumers and non-browser contexts. Server routes in TanStack Start are files in `src/routes/` that export HTTP method handlers:

```typescript
// Source: https://jilles.me/tanstack-start-server-functions-how-they-work/
// apps/web/src/routes/api/search.ts
import { createAPIFileRoute } from '@tanstack/react-start/api'

export const APIRoute = createAPIFileRoute('/api/search')({
  GET: async ({ request }) => {
    const url = new URL(request.url)
    const query = url.searchParams.get('q') ?? ''
    const results = await searchEntities({ data: { query } })
    return Response.json(results)
  },
})
```

**Decision:** Server functions are the primary data access mechanism for internal React pages. Server routes are only created for API-01, API-11, and API-12 (the three that serve non-React consumers). All internal data fetching goes through server functions.

### Anti-Patterns to Avoid

- **Calling database directly in client components:** All Drizzle queries must be inside server functions. Never import `getDb()` in a file that runs in the browser.
- **Using `manualPagination: false` for large datasets:** Donations can have 50k+ rows per entity. Always use server-side pagination.
- **Generating AI summaries synchronously on every profile load:** Always check `ai_summaries` cache first. On-demand generation only if the entity has never been summarized.
- **Barrel files:** Never create `components/index.ts` or `server-fns/index.ts` — Biome/Ultracite will reject them.
- **Hardcoding copy strings in components:** All user-visible text goes in `en.ts` first.
- **Using `next-themes` ThemeProvider without cookie backing:** Causes flash-of-unstyled-content (FOUC) in SSR. Use cookie-based theme from root loader.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Table sorting/pagination logic | Custom sort/page state machine | `@tanstack/react-table` v8 | Handles 15+ edge cases (multi-sort, column visibility, row selection, filtering) |
| Fuzzy search | Custom string distance algorithm | PostgreSQL `pg_trgm` with GIN index | 30-60ms on 10M rows; trigram math handles transliterations, accents, abbreviations |
| Accessible dialog | Custom modal with focus trap | shadcn `Dialog` (Radix UI) | ARIA `role="dialog"`, focus trap, scroll lock, keyboard escape — non-trivial to implement correctly |
| Accessible dropdown | Custom listbox | shadcn `Popover` + manual `role="listbox"` | Radix Popover handles positioning, portal, outside-click; add `role="listbox"` manually per UI-SPEC |
| Theme toggle without flicker | `localStorage` theme on mount | Cookie-based theme in root route loader | `localStorage` is not available during SSR — always causes FOUC on first paint |
| Copy string management | Hardcoded strings in JSX | `apps/web/src/i18n/en.ts` typed object | Required for DSGN-04 bilingual structure; TypeScript catches missing keys |
| Client-side search debounce library | Extra npm package | `useEffect` + `setTimeout(fn, 200)` or `useDeferredValue` | Zero dependency; both React patterns cover the use case cleanly |
| API response caching | Custom in-memory cache | `@tanstack/react-query` `staleTime` | Already in the dependency tree; handles invalidation, background refresh, deduplication |

**Key insight:** The most dangerous hand-roll in this phase is accessibility. Focus management for the autocomplete dropdown (ARIA listbox), modal focus trap, and keyboard navigation are exactly the problems Radix UI (via shadcn) was built to solve. Always reach for shadcn before building interactive UI primitives.

---

## Common Pitfalls

### Pitfall 1: shadcn Init in Wrong Directory

**What goes wrong:** Running `pnpm dlx shadcn@latest init` from the monorepo root creates `components.json` at the root instead of inside `apps/web/`.

**Why it happens:** The CLI looks for the nearest project root.

**How to avoid:** Always `cd apps/web` first, or pass `-c apps/web` to the CLI command.

**Warning signs:** `components.json` appears in the monorepo root rather than `apps/web/components.json`.

### Pitfall 2: shadcn Tailwind v4 CSS Config Difference

**What goes wrong:** Following v3 shadcn docs that show `tailwind.config.js` — Tailwind v4 uses CSS-first config with `@theme inline` in `globals.css`. No `tailwind.config.js` is created.

**Why it happens:** Most blog posts and StackOverflow answers are for shadcn + Tailwind v3.

**How to avoid:** Follow only the official shadcn docs for Tailwind v4. The `@theme inline` block in `globals.css` replaces `tailwind.config.js` entirely.

**Warning signs:** shadcn components rendering without any theme — missing CSS variable values.

### Pitfall 3: `routeTree.gen.ts` Not Updated After Adding Routes

**What goes wrong:** Adding new `.tsx` files to `src/routes/` without restarting the dev server causes TypeScript errors because `routeTree.gen.ts` is stale.

**Why it happens:** `routeTree.gen.ts` is auto-generated by the TanStack Router Vite plugin on dev server start and on file changes.

**How to avoid:** Run `pnpm dev` (restarts the watcher) after adding new route files. Or use the `@tanstack/router-plugin` which watches for file additions.

**Warning signs:** TypeScript error "Route not found in route tree" or new routes returning 404.

### Pitfall 4: Server Function Validators Use `.validator()` Not `.inputValidator()`

**What goes wrong:** Using `.inputValidator()` (the older API shown in many tutorials) causes type errors in TanStack Start 1.167.x which uses `.validator()`.

**Why it happens:** The API was renamed between beta versions.

**How to avoid:** Always use `.validator((data: unknown) => Schema.parse(data))` in createServerFn chains.

**Warning signs:** TypeScript error on the server function definition.

### Pitfall 5: AI Summary Generation Blocks Profile Load

**What goes wrong:** If summary generation is awaited synchronously in the profile loader, the first visit to any entity profile takes 1-3 seconds for the Claude API call.

**Why it happens:** No cache warmup has been done on a fresh database.

**How to avoid:** Use a "skeleton → async load" pattern. The profile loader fetches cached summary; if none exists, the profile renders with a skeleton and the `AISummary` component triggers a client-side query that generates on-demand. Alternatively: add a pg-boss job that pre-generates summaries for all entities above a view threshold.

**Warning signs:** Profile pages with >1s TTI for first-time entity visits.

### Pitfall 6: pg_trgm Similarity Threshold Too High for Short Names

**What goes wrong:** The default similarity threshold 0.6 misses short names (2-3 chars). Similarity is low for short strings because fewer trigrams exist.

**Why it happens:** pg_trgm similarity is computed as `|trigrams_in_common| / |trigrams_in_A ∪ trigrams_in_B|`. Short strings have few trigrams, so similarity is diluted.

**How to avoid:** For autocomplete (SRCH-02), use threshold 0.2-0.3 and sort by score DESC, LIMIT 8. For entity matching in the ingestion pipeline (Phase 1, threshold 0.6), a higher bar is appropriate to avoid false merges. These are different queries with different thresholds.

**Warning signs:** Autocomplete returns no results for real entity names that are 4-6 characters.

### Pitfall 7: TanStack Table Sort State Not Synced to Server

**What goes wrong:** Using `getSortedRowModel()` (client-side sort) on server-paginated data only sorts the current page, not the full dataset.

**Why it happens:** Client-side sort and server-side pagination are conceptually incompatible.

**How to avoid:** For server-paginated tables, set `manualSorting: true` and `manualPagination: true`. Pass `sortingState` as URL search params. The server function reads these params and adds `ORDER BY` to the SQL query.

**Warning signs:** Sorting a column only reorders the 10 rows visible, not all 500+ rows.

### Pitfall 8: Dark Mode Flash on First Load

**What goes wrong:** Theme initializes to `light` on the server (no cookie) but user had selected `dark` — the page flashes light before going dark.

**Why it happens:** `localStorage`-based theme readers (like vanilla `next-themes`) run only on the client, after SSR.

**How to avoid:** Use the cookie-based approach from Pattern 6. The root route loader reads the theme cookie server-side, applies the `.dark` class to `<html>` before hydration.

**Warning signs:** Visible FOUC (flash of unstyled content / wrong-theme flash) on page load.

---

## Code Examples

### Autocomplete Dropdown with Keyboard Navigation

```typescript
// Source: UI-SPEC.md SRCH-02 requirements — role="listbox" per WCAG
// apps/web/src/components/search/SearchBar.tsx
import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { en } from '@/i18n/en'

function SearchBar() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200)
    return () => clearTimeout(timer)
  }, [query])

  const { data: suggestions } = useQuery({
    queryKey: ['autocomplete', debouncedQuery],
    queryFn: () => getAutocomplete({ data: { query: debouncedQuery } }),
    staleTime: 60_000,
    enabled: debouncedQuery.length >= 2,
  })

  const isOpen = (suggestions?.length ?? 0) > 0 && query.length >= 2

  return (
    <div role="combobox" aria-expanded={isOpen} aria-haspopup="listbox">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={en.search.placeholder}
        aria-autocomplete="list"
        aria-controls="autocomplete-list"
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setActiveIndex((i) => Math.min(i + 1, (suggestions?.length ?? 1) - 1))
          if (e.key === 'ArrowUp') setActiveIndex((i) => Math.max(i - 1, 0))
          if (e.key === 'Escape') setQuery('')
        }}
      />
      {isOpen && (
        <ul id="autocomplete-list" role="listbox" ref={listRef}>
          {suggestions?.map((s, i) => (
            <li
              key={s.id}
              role="option"
              aria-selected={i === activeIndex}
            >
              {s.canonicalName}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

### Entity Profile Route with Loader

```typescript
// apps/web/src/routes/entity/$id.tsx
import { createFileRoute } from '@tanstack/react-router'
import { getEntityProfile } from '@/server-fns/entity'

export const Route = createFileRoute('/entity/$id')({
  loader: async ({ params }) => {
    const profile = await getEntityProfile({ data: { id: params.id } })
    if (!profile) throw new Error('Entity not found')
    return profile
  },
  errorComponent: ({ error }) => <div>{en.common.error}</div>,
  pendingComponent: () => <div>{en.profile.loading}</div>,
  component: EntityProfilePage,
})

function EntityProfilePage() {
  const profile = Route.useLoaderData()
  // ...
}
```

### Submit Flag Server Function

```typescript
// apps/web/src/server-fns/flag.ts
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { flags } from '@govtrace/db/schema/entities'
import { getDb } from '@govtrace/db/client'

const FlagInputSchema = z.object({
  entityId: z.string().uuid(),
  description: z.string().min(1).max(2000),
  reporterEmail: z.string().email().optional(),
})

export const submitFlag = createServerFn({ method: 'POST' })
  .validator((data: unknown) => FlagInputSchema.parse(data))
  .handler(async ({ data }) => {
    const db = getDb()
    await db.insert(flags).values({
      entityId: data.entityId,
      description: data.description,
      reporterEmail: data.reporterEmail ?? null,
      status: 'pending',
    })
    return { success: true }
  })
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` | CSS-first config via `@theme inline` in `globals.css` | Tailwind v4 (Feb 2025) | No `tailwind.config.js` in new projects — disregard all v3 docs |
| `tailwindcss-animate` | `tw-animate-css` | shadcn/ui v4 (2025) | shadcn init installs `tw-animate-css` automatically |
| shadcn `default` style | `new-york` style is now default | shadcn/ui v4 (2025) | New projects default to new-york style — neutral theme still available |
| React.forwardRef | ref as prop (React 19) | React 19 | shadcn v4 components use ref as prop — no `forwardRef` wrapper needed |
| `inputValidator` on createServerFn | `.validator()` | TanStack Start v1 stable | All tutorials before v1 stable show the old API |
| `claude-haiku-3-5` (legacy) | `claude-haiku-4-5` | March 2026 | New code should use `claude-haiku-4-5`; `claude-haiku-3-5` is now a legacy alias |
| `Meta` from `@tanstack/react-start` | `HeadContent` from `@tanstack/react-router` | v1.167 | Already fixed in Phase 1 `__root.tsx` |

**Deprecated/outdated:**
- `@tanstack/start` (old package name): replaced by `@tanstack/react-start`
- `claude-3-haiku-20240307`: deprecated April 19, 2026 — do not use in any new code
- `tailwindcss-animate`: use `tw-animate-css`

---

## Open Questions

1. **Source URL field for PROF-05 external links**
   - What we know: each raw table has a `rawData jsonb` column with the full original CSV row
   - What's unclear: government source URLs are not stored as a dedicated column — they may need to be constructed from dataset identifiers + record IDs, or Elections Canada/open.canada.ca URLs may not be deep-linkable to individual records
   - Recommendation: During plan execution, check Elections Canada and open.canada.ca URL patterns. Fall back to linking to the dataset download page if record-level deep links are not available.

2. **Model name for Phase 1 ingestion code**
   - What we know: Phase 1 uses `claude-haiku-3-5` which maps to a legacy model; `claude-haiku-3-5` is deprecated April 19, 2026
   - What's unclear: Whether to update Phase 1 ingestion code as part of Phase 2 or leave it
   - Recommendation: Update model constants in Phase 1 ingestion to `claude-haiku-4-5` as part of a Wave 0 task in Phase 2, before building Phase 2 AI features. Low-risk, prevents a broken ingestion pipeline post-April 19.

3. **Summary count data for SRCH-04 (search result cards)**
   - What we know: search result cards must show "12 donations, 3 contracts, 2 lobbying, 1 grant" per entity
   - What's unclear: these counts are not stored in the `entities` table. Each search result would require 4 COUNT queries across raw tables per entity. This could make search slow if returning 20 results.
   - Recommendation: Add a `summary_counts` jsonb column to `entities` or a separate `entity_summary_counts` table, populated during the graph rebuild job. This avoids N+4 queries per search result page. Flag this as a Wave 0 schema migration task.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | TanStack Start dev server | ✓ | v24.13.0 | — |
| Docker | PostgreSQL local dev | ✓ | 27.5.1 (OrbStack) | — |
| PostgreSQL | All server functions | ✓ (port 5432 occupied — likely running) | 16 (from Phase 1) | — |
| pnpm | Package management | ✓ | (in project) | — |
| ANTHROPIC_API_KEY | AI summary generation | ✗ (not set in env) | — | Skip summary generation in dev; use placeholder text |

**Missing dependencies with no fallback:**
- `ANTHROPIC_API_KEY`: Required for AI-01, AI-03, AI-05. Must be set in `.env` before running summary generation. Dev can proceed without it for all other features — summary endpoint should return a placeholder when key is absent.

**Missing dependencies with fallback:**
- PostgreSQL port conflict: The `docker compose up` failed due to port 5432 already allocated. This suggests a PostgreSQL instance is already running (likely from a previous Phase 1 session). Confirm with `docker ps` or `lsof -i :5432` — no action needed if DB is already running.

---

## Sources

### Primary (HIGH confidence)
- https://ui.shadcn.com/docs/installation/tanstack — Official shadcn TanStack Start installation
- https://ui.shadcn.com/docs/tailwind-v4 — Tailwind v4 CSS variables, `@theme inline` pattern
- https://ui.shadcn.com/docs/components/data-table — TanStack Table + shadcn data table pattern
- https://platform.claude.com/docs/en/about-claude/models/overview — Current Claude model IDs, pricing (verified March 2026)
- https://tanstack.com/start/latest/docs/framework/react/guide/server-functions — createServerFn API
- https://tanstack.com/router/v1/docs/framework/react/guide/search-params — URL search params as state

### Secondary (MEDIUM confidence)
- https://nisabmohd.vercel.app/tanstack-dark — Cookie-based SSR-safe dark mode for TanStack Start (2025 community post, verified against TanStack docs patterns)
- https://codestandup.com/posts/2026/tanstack-tutorial-loader-and-server-functions/ — createServerFn with loader patterns (2026)
- https://www.brenelz.com/posts/using-server-functions-and-tanstack-query/ — queryOptions + server function integration
- https://jilles.me/tanstack-start-server-functions-how-they-work/ — Server functions vs server routes distinction
- https://benwilber.github.io/programming/2024/08/21/pg-trgm-autocomplete.html — pg_trgm GIN index autocomplete performance (30ms on 140M rows)

### Tertiary (LOW confidence)
- WebSearch results on TanStack Table server-side pagination — pattern confirmed by official TanStack Table docs, initial discovery via search

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry
- shadcn initialization: HIGH — official docs + UI-SPEC already specifies the exact components
- TanStack Start server functions: HIGH — official docs, multiple 2026 tutorials confirm API
- pg_trgm autocomplete: HIGH — GIN index from Phase 1 already built; SQL pattern well-documented
- Dark mode: MEDIUM — official TanStack docs don't have a dedicated dark mode guide; community pattern cross-referenced against framework primitives
- Claude model names: HIGH — directly verified against official Anthropic models page
- Summary count data for search results (SRCH-04): LOW — identified as a gap; workaround in Open Questions

**Research date:** 2026-03-31
**Valid until:** 2026-05-01 (30 days — stack is stable; Claude model names change more frequently)
