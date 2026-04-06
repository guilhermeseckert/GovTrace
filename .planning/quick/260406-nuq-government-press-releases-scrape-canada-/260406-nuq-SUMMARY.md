---
phase: quick
plan: 260406-nuq
subsystem: ingestion, web
tags: [press-releases, scraping, canada.ca, pm-rss, dublin-core, news-page]
dependency_graph:
  requires: [packages/db, apps/ingestion, apps/web]
  provides: [press_releases table, /news route, press releases ingestion pipeline]
  affects: [apps/web navigation, packages/db schema]
tech_stack:
  added: [cheerio (html parsing), fast-xml-parser (pm rss)]
  patterns: [two-source ingestion strategy, Dublin Core metadata extraction, entity cross-reference panel]
key_files:
  created:
    - packages/db/src/schema/raw.ts (pressReleases table added)
    - apps/ingestion/src/downloaders/press-releases.ts
    - apps/ingestion/src/parsers/press-releases.ts
    - apps/ingestion/src/upsert/press-releases.ts
    - apps/ingestion/src/runners/press-releases.ts
    - apps/web/src/server-fns/news.ts
    - apps/web/src/routes/news.tsx
  modified:
    - apps/ingestion/src/index.ts (added press-releases case)
    - apps/web/src/routes/__root.tsx (added News nav link)
    - apps/web/src/routeTree.gen.ts (registered /news route)
decisions:
  - cheerio already installed in ingestion package — no new dependency needed
  - PM RSS items stored as minimal records without detail page fetch (pm.gc.ca different domain)
  - Entity matching via normalized_name exact match — no AI for initial ingestion
  - routeTree.gen.ts manually updated (no dev server to auto-regenerate)
metrics:
  duration: "~15 minutes"
  completed: "2026-04-06"
  tasks: 2
  files: 10
---

# Quick Task 260406-nuq: Government Press Releases Ingestion + /news Page Summary

**One-liner:** canada.ca HTML scraping + PM RSS feed ingestion into press_releases table with Dublin Core metadata extraction, entity mention scaffolding, and /news route with paginated cards and lazy-loaded entity cross-references.

## What Was Built

### Task 1: Schema + Ingestion Pipeline

**Database schema** (`packages/db/src/schema/raw.ts`): Added `pressReleases` table with:
- 20 fields including `ministers[]`, `keywords[]`, `subjects[]` arrays
- `mentionedEntities` JSONB for extracted entities with confidence levels
- `dollarAmounts` JSONB for financial figure extraction
- Indexes on published_date, department, content_type, unique on url
- Schema pushed to database via `drizzle-kit push`

**Downloader** (`apps/ingestion/src/downloaders/press-releases.ts`):
- `fetchListingPage(idx)` — paginated listing scrape with Akamai soft-404 detection
- `fetchDetailPage(url)` — individual press release page fetch
- `fetchPmRssFeed()` — PM Office RSS 2.0 feed fetch
- User-Agent: `GovTrace/1.0 (https://govtrace.ca; civic tech; open data)`

**Parser** (`apps/ingestion/src/parsers/press-releases.ts`):
- `parseListingPage(html)` — extracts title, URL, date, department, type, summary from `<article class="item">`
- `parseDetailPage(html, url)` — extracts all Dublin Core meta tags (dcterms.title, dcterms.minister, dcterms.subject, keywords, etc.), body text, dollar amounts via regex
- `parsePmRssFeed(xml)` — RSS 2.0 XML parsing via fast-xml-parser

**Upsert** (`apps/ingestion/src/upsert/press-releases.ts`): BATCH_SIZE=500, INSERT ON CONFLICT DO UPDATE on id.

**Runner** (`apps/ingestion/src/runners/press-releases.ts`):
- Phase A: Paginates listing pages, stops at 3-month cutoff or known URLs
- Phase B: Fetches detail pages for new URLs with 1500ms polite delay
- Phase C: PM RSS feed with URL deduplication against Phase A
- Phase D: Entity matching — queries entities table for minister names (normalized_name match)
- Logs to ingestionRuns table

**Test run result:** 30 records upserted (20 from detail pages + 10 from PM RSS)

### Task 2: /news Page with Entity Cross-References

**Server functions** (`apps/web/src/server-fns/news.ts`):
- `getNews` — paginated query with department/contentType/search filters
- `getNewsStats` — total count, department count, latest date
- `getDepartmentListForNews` — distinct departments for filter dropdown
- `getEntityCrossReferences` — queries entity_connections for donation/lobbying/contract counts per matched entity

**Route** (`apps/web/src/routes/news.tsx`):
- Stats banner: total announcements, departments, latest date
- Filters: search input, department dropdown, content type dropdown (6 types)
- Press release cards with expand/collapse
- Per-card: title + external link, date + department + type badges, 2-line summary
- Minister badges (link to entity profile if matched), dollar amount badges
- "Grandpa test" story sentence: ministers + dollar amounts summary
- EntityCrossRefsPanel: lazy-loaded on expand, shows donation/lobbying/contract counts
- Content type color coding (6 distinct colors)
- Pagination

**Navigation**: "News" link added to site header in `__root.tsx` with Newspaper icon.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ANY array parameter SQL error**
- **Found during:** Task 1 execution
- **Issue:** Passing JS array directly to `sql` template literal produces `= ANY((val1, val2))` syntax — PostgreSQL requires `= ANY(ARRAY[...])`. Drizzle DrizzleQueryError: "op ANY/ALL (array) requires array on right side"
- **Fix:** Used `sql.join(arr.map(n => sql\`${n}\`), sql\`, \`)` wrapped in `ARRAY[...]` for correct PostgreSQL binding
- **Files modified:** `apps/ingestion/src/runners/press-releases.ts`
- **Commit:** 20c743e (fix included in same commit)

**2. [Rule 2 - Missing functionality] Removed unused import**
- **Found during:** Task 2 code review
- **Issue:** `entityConnections` imported but not used (raw SQL used instead for flexibility)
- **Fix:** Removed unused import from news.ts
- **Files modified:** `apps/web/src/server-fns/news.ts`
- **Commit:** 16efc0a

## Self-Check: PASSED

Files exist:
- packages/db/src/schema/raw.ts: pressReleases table added — FOUND
- apps/ingestion/src/downloaders/press-releases.ts — FOUND
- apps/ingestion/src/parsers/press-releases.ts — FOUND
- apps/ingestion/src/upsert/press-releases.ts — FOUND
- apps/ingestion/src/runners/press-releases.ts — FOUND
- apps/web/src/server-fns/news.ts — FOUND
- apps/web/src/routes/news.tsx — FOUND

Commits:
- 20c743e: feat(quick-260406-nuq): add press_releases schema + ingestion pipeline — FOUND
- 16efc0a: feat(quick-260406-nuq): add /news page with entity cross-references — FOUND

TypeScript: No errors in news.ts, news.tsx, __root.tsx, routeTree.gen.ts

Ingestion: 30 records upserted successfully in test run with --limit 20

## Known Stubs

None — all wired to live data.
