---
phase: 02-search-and-entity-profiles
verified: 2026-03-31T00:00:00Z
status: gaps_found
score: 26/28 must-haves verified
gaps:
  - truth: "GET /api/entity/:id returns full entity profile with all related data (API-02)"
    status: failed
    reason: "No createAPIFileRoute HTTP route file exists for GET /api/entity/:id — only a TanStack server function (getEntityProfile) was created. API-02 requires an accessible HTTP endpoint for external consumers, which the server function alone does not provide."
    artifacts:
      - path: "apps/web/src/routes/api/entity/$id.ts"
        issue: "File does not exist — no GET /api/entity/:id HTTP route"
    missing:
      - "Create apps/web/src/routes/api/entity/$id.ts with createAPIFileRoute('/api/entity/$id')({ GET: ... }) that calls getEntityProfile + getEntityStats"

  - truth: "GET /api/entity/:id/donations, /contracts, /lobbying, /grants HTTP routes for external consumers (API-03, API-04)"
    status: failed
    reason: "No createAPIFileRoute HTTP route files exist for the individual dataset endpoints. API-03 and API-04 require accessible HTTP endpoints for external consumers, but only server functions (getDonations, getContracts, getGrants, getLobbying, getConnections) were created."
    artifacts:
      - path: "apps/web/src/routes/api/entity/$id/donations.ts"
        issue: "File does not exist"
      - path: "apps/web/src/routes/api/entity/$id/contracts.ts"
        issue: "File does not exist"
      - path: "apps/web/src/routes/api/entity/$id/grants.ts"
        issue: "File does not exist"
      - path: "apps/web/src/routes/api/entity/$id/lobbying.ts"
        issue: "File does not exist"
      - path: "apps/web/src/routes/api/entity/$id/connections.ts"
        issue: "File does not exist"
    missing:
      - "Create GET HTTP route files for each dataset endpoint that delegate to the corresponding server functions"
      - "Note: these 5 routes + the entity/:id route above are all closely related — can be addressed in a single gap-closure plan"
---

# Phase 02: Search and Entity Profiles — Verification Report

**Phase Goal:** Users can search any name and immediately see their complete financial and lobbying picture across all government datasets
**Verified:** 2026-03-31
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User types a name and sees autocomplete suggestions via ARIA combobox | VERIFIED | `SearchBar.tsx` has `role="combobox"`, 200ms debounce, `getAutocomplete` wired via `useQuery`, max 8 results, 44px touch targets |
| 2 | User sees search results grouped by entity type with summary counts | VERIFIED | `SearchResults.tsx` groups by politician/company/person/other; each card shows donation/contract/lobbying/grant counts sourced from `searchEntities` |
| 3 | User can filter search results by entity type, date range, and province | VERIFIED | `SearchFilters.tsx` has radio type filter, 13-province Select, and dateFrom/dateTo date inputs; all filters persist in URL params via `validateSearch` |
| 4 | User lands on entity profile with blue header, confidence badge, and AI summary first | VERIFIED | `/entity/$id.tsx` loader calls `getEntityProfile` + `getEntityStats` + `getOrGenerateSummary`; `EntityHeader` has `bg-primary` (government blue); `AISummary` renders before `ProfileTabs` |
| 5 | Tabbed data sections (Donations, Contracts, Grants, Lobbying, Connections) are sortable and paginated | VERIFIED | All 5 tables have `manualPagination: true` + `manualSorting: true`; wired into `ProfileTabs` slot props |
| 6 | Every record links to original government source | VERIFIED | All 5 table files import `ExternalLink` from lucide-react; `getSourceUrl()` resolves rawData URL fields |
| 7 | User can flag an incorrect entity match without an account | VERIFIED | `FlagModal.tsx` calls `submitFlag` server function; `POST /api/entity/:id/flag` HTTP route exists with no auth |
| 8 | AI summary shows "connections do not imply wrongdoing" disclaimer and "How do we write this summary?" link | VERIFIED | `AISummary.tsx` renders `en.profile.disclaimer`; explanation button opens `AISummaryExplanation` dialog |
| 9 | Data provenance footer shows per-dataset last-ingested dates | VERIFIED | `getEntityProvenance` queries `max(ingestedAt)` across all 5 raw tables; footer in `$id.tsx` shows per-dataset dates + Open Government Licence attribution |
| 10 | Cookie-based dark mode with no flash on first paint | VERIFIED | `getThemeFn` reads cookie server-side; `className={theme}` on `<html>` in `__root.tsx`; `ThemeProvider` writes cookie on toggle |
| 11 | Skip-to-content link at top of every page | VERIFIED | `SkipToContent.tsx` rendered in `__root.tsx` before `ThemeProvider` |
| 12 | Landing page shows tagline, autofocused search, and platform stat chips | VERIFIED | `index.tsx` loader calls `getPlatformStats`; `HeroSearch` renders tagline + `SearchBar autoFocus` + `StatChips` |
| 13 | GET /api/search and GET /api/stats HTTP routes for external consumers | VERIFIED | `apps/web/src/routes/api/search.ts` and `apps/web/src/routes/api/stats.ts` exist with `createAPIFileRoute` |
| 14 | POST /api/entity/:id/flag and GET /api/entity/:id/summary HTTP routes | VERIFIED | Both route files exist with correct `createAPIFileRoute` patterns, 201/400 responses |
| 15 | GET /api/entity/:id HTTP route for external consumers (API-02) | FAILED | No route file exists — only `getEntityProfile` server function; external HTTP access to full entity profile is not possible without going through the browser-rendered page |
| 16 | GET /api/entity/:id/donations, /contracts, /lobbying, /grants, /connections HTTP routes (API-03, API-04) | FAILED | No route files exist for individual dataset endpoints — only server functions; external API consumers cannot query datasets via HTTP |
| 17 | AI summary caches in `ai_summaries` and regenerates weekly | VERIFIED | `getOrGenerateSummary` checks `isStale=false` cache first; weekly pg-boss job at `'0 22 * * 0'` marks all rows stale |
| 18 | Confidence badge shows 3 states (high/medium/low) with popover | VERIFIED | `ConfidenceBadge.tsx` has `bg-[#16a34a]`/`bg-[#d97706]`/`bg-[#dc2626]` states; Popover shows score, method, and AI reasoning |
| 19 | All copy strings live in `en.ts`, not hardcoded in JSX | VERIFIED | `en.ts` exports all namespaces (search, profile, badge, flag, table, common, landing); components import `{ en }` |
| 20 | Brand blue #1a3a5c mapped to `--primary` CSS variable | VERIFIED | `app.css` has `--primary: 214 60% 23%` (HSL equivalent of #1a3a5c); `@theme inline` block maps to `--color-primary` |
| 21 | shadcn components available from `@/components/ui/` | VERIFIED | 13 components present (button, input, badge, card, tabs, table, dialog, popover, select, pagination, separator, skeleton, textarea) |
| 22 | Tables collapse to stacked card view on mobile | VERIFIED | All 5 tables have `md:hidden` mobile card sections alongside `hidden md:block` desktop table |
| 23 | Flag stored in flags table with matchLogId FK support | VERIFIED | `submitFlag` inserts with `matchLogId: data.matchLogId ?? null`; `FlagInputSchema` accepts `matchLogId` UUID optional |
| 24 | Connections tab has "does not imply wrongdoing" disclaimer banner | VERIFIED | `ProfileTabs.tsx` connections tab has `role="status"` `aria-live="polite"` banner with `en.profile.connections_disclaimer` |
| 25 | pg_trgm similarity search returns results with filters and counts | VERIFIED | `searchEntities` uses `normalized_name % ${normalizedQuery}` with type/province/date filters; `getEntityCounts` queries donations/contracts/grants/lobbyRegistrations |
| 26 | Autocomplete uses pg_trgm `%` operator for GIN index | VERIFIED | `getAutocomplete` uses `normalized_name % ${normalizedQuery}` in raw SQL via `db.execute(sql\`...\`)` |
| 27 | Weekly pg-boss job marks summaries stale | VERIFIED | `packages/ingestion/src/scheduler/jobs.ts` registers `MARK_SUMMARIES_STALE` at `'0 22 * * 0'` |
| 28 | AISummary uses cache-then-async pattern (no profile block on AI failure) | VERIFIED | Loader wraps `getOrGenerateSummary` with `.catch(() => null)`; `AISummary` has `enabled: !initialSummary` to avoid double-fetch |

**Score:** 26/28 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/components.json` | shadcn configuration | VERIFIED | Exists with neutral theme configuration |
| `apps/web/src/app.css` | Tailwind v4 CSS variables + brand primary | VERIFIED | `--primary: 214 60% 23%`; `@theme inline` block with 19 `hsl(var(--)` mappings; `.dark` overrides |
| `apps/web/src/i18n/en.ts` | All English copy strings | VERIFIED | Exports `en` as const with all 7 namespaces; exports `TranslationKey` type |
| `apps/web/src/components/layout/ThemeProvider.tsx` | Cookie-based dark mode context | VERIFIED | Exports `ThemeProvider` and `useTheme`; writes cookie on toggle |
| `apps/web/src/components/layout/SkipToContent.tsx` | Skip link to #main-content | VERIFIED | Exists; renders `<a href="#main-content">` |
| `apps/web/src/routes/__root.tsx` | Root layout with ThemeProvider + theme loader | VERIFIED | Imports ThemeProvider, SkipToContent, getThemeFn; loader calls getThemeFn; `className={theme}` on html |
| `apps/web/src/server-fns/search.ts` | searchEntities, getAutocomplete | VERIFIED | Both exports present; pg_trgm `%` operator used; `.validator()` API; getEntityCounts with lobby dual-FK |
| `apps/web/src/server-fns/stats.ts` | getPlatformStats | VERIFIED | Exports `getPlatformStats` and `PlatformStats` type; parallel Promise.all across 5 tables |
| `apps/web/src/routes/api/search.ts` | GET /api/search | VERIFIED | `createAPIFileRoute('/api/search')` with GET handler; calls `searchEntities` |
| `apps/web/src/routes/api/stats.ts` | GET /api/stats | VERIFIED | `createAPIFileRoute('/api/stats')` with GET handler; calls `getPlatformStats` |
| `apps/web/src/routes/index.tsx` | Landing page route | VERIFIED | Loader calls `getPlatformStats`; renders `<HeroSearch stats={stats} />` |
| `apps/web/src/routes/search.tsx` | Search results route with URL params | VERIFIED | `validateSearch: SearchParamsSchema`; `loaderDeps` pattern; calls `searchEntities` |
| `apps/web/src/components/landing/HeroSearch.tsx` | Hero section | VERIFIED | Renders tagline, `<SearchBar autoFocus />`, `<StatChips stats={stats} />` |
| `apps/web/src/components/landing/StatChips.tsx` | Platform stat chips | VERIFIED | K/M formatting; skeleton loading; chips for donations/contracts/grants/lobbying |
| `apps/web/src/components/search/SearchBar.tsx` | ARIA combobox with autocomplete | VERIFIED | `role="combobox"`; `role="listbox"` dropdown; `role="option"` items; 200ms debounce; keyboard nav |
| `apps/web/src/components/search/SearchResults.tsx` | Grouped results by type | VERIFIED | Groups by politician/company/person/other; ordered; empty state from `en.search.emptyHeading` |
| `apps/web/src/components/search/SearchFilters.tsx` | Filter sidebar | VERIFIED | Radio entity types; 13-province Select; date-from/date-to date inputs |
| `apps/web/src/server-fns/entity.ts` | getEntityProfile, getEntityStats, getEntityProvenance | VERIFIED | All three exports present; bestAlias + matchLogId fetched; provenance uses `max()` across all 5 raw tables |
| `apps/web/src/server-fns/datasets.ts` | getDonations, getContracts, getGrants, getLobbying, getConnections | VERIFIED | All 5 exports; server-side pagination; rawData included; getLobbying queries dual-FK lobby tables |
| `apps/web/src/server-fns/summary.ts` | getOrGenerateSummary with Claude cache-first | VERIFIED | Cache check `WHERE isStale=false`; generates with `claude-haiku-4-5`; upserts result; "Connections shown do not imply wrongdoing." enforced in prompt |
| `apps/web/src/server-fns/flag.ts` | submitFlag | VERIFIED | Exports `submitFlag`; POST method; `matchLogId` optional UUID; description min 10 chars |
| `apps/web/src/routes/api/entity/$id/flag.ts` | POST /api/entity/:id/flag | VERIFIED | `createAPIFileRoute('/api/entity/$id/flag')` with POST handler; 201/400 responses |
| `apps/web/src/routes/api/entity/$id/summary.ts` | GET /api/entity/:id/summary | VERIFIED | `createAPIFileRoute('/api/entity/$id/summary')` with GET handler; 404 on missing |
| `apps/web/src/routes/api/entity/$id.ts` | GET /api/entity/:id — full profile | MISSING | File does not exist |
| `apps/web/src/routes/api/entity/$id/donations.ts` | GET /api/entity/:id/donations | MISSING | File does not exist |
| `apps/web/src/routes/api/entity/$id/contracts.ts` | GET /api/entity/:id/contracts | MISSING | File does not exist |
| `apps/web/src/routes/api/entity/$id/grants.ts` | GET /api/entity/:id/grants | MISSING | File does not exist |
| `apps/web/src/routes/api/entity/$id/lobbying.ts` | GET /api/entity/:id/lobbying | MISSING | File does not exist |
| `apps/web/src/routes/api/entity/$id/connections.ts` | GET /api/entity/:id/connections | MISSING | File does not exist |
| `apps/web/src/routes/entity/$id.tsx` | Entity profile route | VERIFIED | loader uses Promise.all for 4 server fns; notFoundComponent, errorComponent, pendingComponent present |
| `apps/web/src/components/entity/EntityHeader.tsx` | Blue header band | VERIFIED | `bg-primary`; h1 `text-[28px] font-semibold`; `en.profile.flagButton`; `ConfidenceBadge` rendered |
| `apps/web/src/components/entity/AISummary.tsx` | AI summary with skeleton + async pattern | VERIFIED | `border-l-4 border-primary`; Skeleton on loading; `en.profile.disclaimer`; `enabled: !initialSummary` |
| `apps/web/src/components/entity/ConfidenceBadge.tsx` | 3-state badge with popover | VERIFIED | `bg-[#16a34a]`/`bg-[#d97706]`/`bg-[#dc2626]`; ShieldCheck/Shield/ShieldAlert icons; Popover with score + method + reasoning |
| `apps/web/src/components/entity/ProfileTabs.tsx` | 5-tab layout with count badges | VERIFIED | 5 tabs with `min-h-[44px]`; connections disclaimer banner `role="status"` `aria-live="polite"` |
| `apps/web/src/components/tables/DonationsTable.tsx` | TanStack Table with server pagination | VERIFIED | `manualPagination: true` + `manualSorting: true`; tabular-nums amount/date; ExternalLink column; mobile card view |
| `apps/web/src/components/tables/ContractsTable.tsx` | TanStack Table for contracts | VERIFIED | Same pattern; buyandsell.gc.ca fallback URL; `manualPagination: true` |
| `apps/web/src/components/tables/GrantsTable.tsx` | TanStack Table for grants | VERIFIED | `manualPagination: true`; ExternalLink; mobile card view |
| `apps/web/src/components/tables/LobbyingTable.tsx` | TanStack Table for lobbying | VERIFIED | Merges registrations + communications into flat LobbyRow[]; `manualPagination: true`; ExternalLink |
| `apps/web/src/components/tables/ConnectionsTable.tsx` | TanStack Table for connections | VERIFIED | `manualPagination: true`; TanStack Link to `/entity/$id`; connection type badge; ExternalLink |
| `apps/web/src/components/entity/FlagModal.tsx` | shadcn Dialog flag form | VERIFIED | `submitFlag` called on submit; `en.flag.*` copy strings; confirmation-replace pattern; `role="alert"` on error |
| `apps/web/src/components/entity/AISummaryExplanation.tsx` | AI explanation dialog | VERIFIED | shadcn Dialog with plain-language AI explanation |
| `packages/ingestion/src/scheduler/jobs.ts` | Weekly mark-summaries-stale pg-boss job | VERIFIED | `MARK_SUMMARIES_STALE` registered at `'0 22 * * 0'`; updates `aiSummaries.isStale = true` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `__root.tsx` | `ThemeProvider.tsx` | theme cookie read, `.dark` class on html | WIRED | `loader: () => getThemeFn()`; `className={theme}` on html; ThemeProvider wraps Outlet |
| `components/ui/` | `app.css` | CSS variable tokens `hsl(var(--primary))` | WIRED | `@theme inline` block has 19 `hsl(var(--)` mappings |
| `SearchBar.tsx` | `server-fns/search.ts` | useQuery calling getAutocomplete with 200ms debounce | WIRED | `useQuery({ queryFn: () => getAutocomplete(...)})` with debounce |
| `routes/search.tsx` | `server-fns/search.ts` | loader calling searchEntities with URL params | WIRED | `loaderDeps` + `loader: async ({ deps }) => searchEntities(...)` |
| `routes/index.tsx` | `server-fns/stats.ts` | loader calling getPlatformStats | WIRED | `loader: async () => getPlatformStats()` |
| `routes/api/search.ts` | `server-fns/search.ts` | searchEntities call in GET handler | WIRED | `GET: async () => { ... await searchEntities(...) }` |
| `summary.ts` | `@anthropic-ai/sdk` | Anthropic client with claude-haiku-4-5 | WIRED | `const SUMMARY_MODEL = 'claude-haiku-4-5'`; client.messages.create called |
| `summary.ts` | `aiSummaries` table | cache lookup and upsert | WIRED | `WHERE isStale=false` check; `onConflictDoUpdate` upsert after generation |
| `datasets.ts` | `@govtrace/db/schema/raw.ts` | Drizzle queries with entityId filter | WIRED | All 5 functions query raw tables with `eq(...entityId, data.entityId)` |
| `entity/$id.tsx` | `server-fns/entity.ts` | loader calling getEntityProfile + getEntityStats + getEntityProvenance | WIRED | Promise.all([getEntityProfile, getEntityStats, getOrGenerateSummary, getEntityProvenance]) |
| `AISummary.tsx` | `server-fns/summary.ts` | useQuery calling getOrGenerateSummary | WIRED | `queryFn: () => getOrGenerateSummary(...)`; `enabled: !initialSummary` |
| `FlagModal.tsx` | `server-fns/flag.ts` | submitFlag called on form submit | WIRED | `await submitFlag({ data: { entityId, description, reporterEmail } })` |
| `entity/$id.tsx` | `DonationsTable/ContractsTable/...` | ProfileTabs slot props filled | WIRED | All 5 tables passed as slot props to ProfileTabs |
| `DonationsTable.tsx` | `server-fns/datasets.ts` | useQuery calling getDonations | WIRED | `queryFn: () => getDonations({ data: { entityId, page, pageSize, sortBy, sortDir } })` |
| `routes/api/entity/$id/flag.ts` | `@govtrace/db/schema/entities` flags table | Direct insert (no server fn) | WIRED | Direct `db.insert(flags)` in POST handler |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `StatChips.tsx` | `stats: PlatformStats` | `getPlatformStats()` via `index.tsx` loader | Yes — parallel `count()` queries on 5 tables | FLOWING |
| `SearchResults.tsx` | `results: EntityResult[]` | `searchEntities()` via `search.tsx` loader | Yes — pg_trgm similarity query on entities table | FLOWING |
| `DonationsTable.tsx` | `data.rows` | `getDonations()` via `useQuery` | Yes — Drizzle SELECT with pagination on donations table | FLOWING |
| `AISummary.tsx` | `summary: string` | `getOrGenerateSummary()` via `$id.tsx` loader + useQuery | Yes — DB cache check then Claude API; returns real text | FLOWING |
| `ConfidenceBadge.tsx` | `confidenceScore`, `aiReasoning` | `getEntityProfile()` → bestAlias from entityAliases table | Yes — `orderBy(desc(confidenceScore)).limit(1)` | FLOWING |
| `ProfileTabs.tsx` | `counts: TabCounts` | `getEntityStats()` via `$id.tsx` loader | Yes — parallel count() queries; lobbying/connections = 0 (not yet populated in Phase 1 for lobbying entity FKs) | FLOWING (partial for lobbying/connections counts — expected Phase 2 known gap) |

### Behavioral Spot-Checks

Skipped — no running server available for live endpoint checks. All wiring verified via static code analysis above.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SRCH-01 | 02-02, 02-03 | Prominent search bar | SATISFIED | Landing page HeroSearch + search.tsx route |
| SRCH-02 | 02-02, 02-03 | Autocomplete < 150ms via pg_trgm | SATISFIED | getAutocomplete uses `%` operator on GIN index; SearchBar 200ms debounce |
| SRCH-03 | 02-03 | Results grouped by entity type | SATISFIED | SearchResults groups politician/company/person |
| SRCH-04 | 02-03 | Summary counts per result | SATISFIED | getEntityCounts returns donations/contracts/grants/lobbying per entity |
| SRCH-05 | 02-03 | Filter by type, date, province | SATISFIED | SearchFilters + validateSearch schema with all 3 filter types |
| PROF-01 | 02-04, 02-05 | Entity profile with name, type, confidence badge | SATISFIED | /entity/$id route with EntityHeader + ConfidenceBadge |
| PROF-02 | 02-05 | AI summary first visible content | SATISFIED | AISummary rendered before ProfileTabs in $id.tsx |
| PROF-03 | 02-05, 02-06 | Tabbed views for 5 datasets | SATISFIED | ProfileTabs 5 tabs with all DataTable components wired |
| PROF-04 | 02-06 | Sortable, paginated tables | SATISFIED | All 5 tables: manualPagination + manualSorting; rows-per-page Select |
| PROF-05 | 02-06 | Every record links to source | SATISFIED | ExternalLink column in all 5 tables; getSourceUrl() from rawData |
| PROF-06 | 02-06 | Provenance timestamps | SATISFIED | getEntityProvenance: max(ingestedAt) per dataset; per-dataset footer |
| AI-01 | 02-04 | Plain-language summaries via Claude | SATISFIED | getOrGenerateSummary generates with claude-haiku-4-5; simple-words prompt |
| AI-02 | 02-04 | "Connections do not imply wrongdoing" caveat | SATISFIED | Enforced in summary prompt; rendered in AISummary + ProfileTabs connections tab |
| AI-03 | 02-04 | Summaries cached, weekly regeneration | SATISFIED | DB cache with isStale check; weekly pg-boss job at 22:00 Sunday |
| AI-04 | 02-05 | AI match transparency badge | SATISFIED | ConfidenceBadge 3-state: score, method, reasoning in Popover |
| AI-05 | 02-07 | "How do we write this summary?" explanation | SATISFIED | AISummaryExplanation dialog wired to explanation button in AISummary |
| COMM-01 | 02-07 | Flag an error button, no account needed | SATISFIED | FlagModal with submitFlag; no auth check; POST /api/entity/:id/flag unauthenticated |
| COMM-02 | 02-07 | Flags stored with optional email | SATISFIED | FlagInputSchema optional email; flags table insert includes reporterEmail |
| COMM-03 | 02-04, 02-07 | Flagged matches in entity_matches_log | SATISFIED | submitFlag inserts matchLogId FK; FlagModal passes matchLogId from EntityProfile |
| API-01 | 02-02 | GET /api/search | SATISFIED | `apps/web/src/routes/api/search.ts` with createAPIFileRoute |
| API-02 | 02-04 | GET /api/entity/:id full profile | NOT SATISFIED | No HTTP route file — only getEntityProfile server function; no external HTTP access to full entity profile |
| API-03 | 02-04 | GET /api/entity/:id/donations, /contracts, /lobbying, /grants | NOT SATISFIED | No HTTP route files — only server functions; external dataset queries not accessible via HTTP |
| API-04 | 02-04 | GET /api/entity/:id/connections | NOT SATISFIED | No HTTP route file — only getConnections server function |
| API-05 | 02-04 | GET /api/entity/:id/summary | SATISFIED | `apps/web/src/routes/api/entity/$id/summary.ts` exists |
| API-11 | 02-02 | GET /api/stats | SATISFIED | `apps/web/src/routes/api/stats.ts` with createAPIFileRoute |
| API-12 | 02-04 | POST /api/entity/:id/flag | SATISFIED | `apps/web/src/routes/api/entity/$id/flag.ts` with POST handler; 201/400 responses |
| DSGN-01 | 02-01, 02-05 | Civic design, government blue primary | SATISFIED | --primary: 214 60% 23%; bg-primary in EntityHeader |
| DSGN-02 | 02-01 | Dark mode support | SATISFIED | .dark CSS class overrides; ThemeProvider; cookie-based SSR-safe |
| DSGN-03 | 02-06 | Mobile responsive, tables collapse to cards | SATISFIED | md:hidden card sections in all 5 tables; responsive flex layout in search page |
| DSGN-04 | 02-01, 02-07 | Bilingual-ready i18n structure | SATISFIED | en.ts with 7 namespaces; all components import en; no hardcoded strings |
| DSGN-05 | 02-03 | Landing page with search, tagline, stats | SATISFIED | HeroSearch with tagline + SearchBar + StatChips loaded from getPlatformStats |
| DSGN-06 | 02-05 | "Connections do not imply wrongdoing" visible | SATISFIED | ProfileTabs connections tab banner; AISummary disclaimer |

**Orphaned requirements check:** All 32 requirement IDs listed in the phase requirements frontmatter are accounted for across plans 02-01 through 02-07. REQUIREMENTS.md maps all Phase 2 requirements correctly. No orphaned requirements found.

**Summary of requirement gaps:**
- API-02 (GET /api/entity/:id): NOT SATISFIED — no HTTP route file
- API-03 (GET /api/entity/:id/donations etc.): NOT SATISFIED — no HTTP route files (5 missing routes)
- API-04 (GET /api/entity/:id/connections): NOT SATISFIED — no HTTP route file
- All other 29 requirements: SATISFIED

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `server-fns/entity.ts` | ~161 | `lobbying: 0` and `connections: 0` in getEntityStats | Info | Lobbying and connections count badges always show 0 — expected pending Phase 1 full entity FK population for lobby tables; not a code error |
| `components/entity/ProfileTabs.tsx` | `_entityId` | entityId prop renamed with underscore prefix (unused variable) | Info | Minor — entityId prop accepted but not used in ProfileTabs body; Plan 06 tables receive it directly |

No blocker or warning anti-patterns found. No TODO/FIXME/placeholder comments found in delivered code. FlagModal placeholder from Plan 05 was correctly replaced in Plan 07.

### Human Verification Required

#### 1. Autocomplete < 150ms Latency

**Test:** Type a 3-character name in the search bar on a running instance with a populated database
**Expected:** Autocomplete suggestions appear in under 150ms perceived latency (requirement SRCH-02)
**Why human:** Cannot measure latency from static code analysis — requires a live database with GIN index and real pg_trgm data

#### 2. AI Summary Generation End-to-End

**Test:** Navigate to an entity profile page for an entity with no cached summary, with `ANTHROPIC_API_KEY` set
**Expected:** Skeleton shows briefly, then AI-generated summary appears in plain language with "Connections shown do not imply wrongdoing." at the end
**Why human:** Cannot invoke Claude API without credentials and live database

#### 3. Dark Mode No-FOUC

**Test:** Load the landing page in a fresh browser session with a `theme=dark` cookie set; observe whether dark mode applies before first paint
**Expected:** No flash of unstyled (light) content — dark mode should be present on initial render
**Why human:** SSR behavior requires a running browser session to observe

#### 4. Mobile Responsive Tables

**Test:** Open an entity profile page on a mobile viewport (< 768px) and navigate to the Donations tab
**Expected:** Table collapses to stacked card view; no horizontal overflow; cards readable without scrolling
**Why human:** Requires viewport resizing in a browser

#### 5. Flag Submission Flow

**Test:** Click "Flag an error" on an entity profile, submit a description (>10 chars) without an email
**Expected:** Modal shows confirmation message "Thanks — your flag has been recorded. We review all submissions."; row appears in flags table with status=pending
**Why human:** Requires live database to verify insertion

### Gaps Summary

Two distinct gaps exist, both in the external HTTP API layer (Plans 02-04 claimed API-02, API-03, API-04 but the implementation only created server functions, not HTTP route files):

**Gap 1: GET /api/entity/:id is missing (API-02)**
The entity profile server function `getEntityProfile` exists and is wired to the browser page. However, the REQUIREMENTS.md defines API-02 as "GET /api/entity/:id returns full entity profile with all related data" — a public HTTP endpoint. No `createAPIFileRoute` file exists for this. External consumers (journalists, researchers, other tools) cannot query an entity profile via HTTP.

**Gap 2: Individual dataset HTTP routes are missing (API-03, API-04)**
Similarly, API-03 requires "GET /api/entity/:id/donations, /contracts, /lobbying, /grants with pagination" and API-04 requires "GET /api/entity/:id/connections" as HTTP endpoints. Five server functions exist (getDonations, getContracts, getGrants, getLobbying, getConnections) but none have corresponding `createAPIFileRoute` wrapper files.

These gaps are closely related and could be resolved in a single gap-closure plan that creates 6 thin HTTP route files (one for the entity profile, five for datasets), each delegating to the existing server functions. The server functions already implement all pagination, sorting, and data logic — the route files only need to parse query params and call the server functions.

The core user-facing product goal ("Users can search any name and immediately see their complete financial and lobbying picture") is fully achieved. The gaps are in the external API surface for non-browser consumers, which does not affect the primary product loop.

---

_Verified: 2026-03-31_
_Verifier: Claude (gsd-verifier)_
