---
phase: 02-search-and-entity-profiles
plan: "03"
subsystem: ui
tags: [tanstack-start, tanstack-router, tanstack-query, shadcn, tailwind, zod, aria, autocomplete]

# Dependency graph
requires:
  - phase: 02-search-and-entity-profiles
    plan: "02"
    provides: "searchEntities, getAutocomplete, getPlatformStats server functions"
  - phase: 02-search-and-entity-profiles
    plan: "01"
    provides: "shadcn/ui components (Input, Button, Badge, Card, Select, Skeleton), i18n en.ts, ThemeProvider, SkipToContent"
provides:
  - "Landing page route / with HeroSearch and platform stat chips loaded from server"
  - "SearchBar component with ARIA combobox pattern, 200ms debounce, keyboard navigation, 44px touch targets"
  - "StatChips component with K/M number formatting and skeleton loading state"
  - "HeroSearch component with tagline, autofocused search bar, and stat chips"
  - "Search results route /search with validateSearch URL params (q, type, province, dateFrom, dateTo, page)"
  - "SearchResults component grouping entities by type with count badges and empty state"
  - "SearchFilters sidebar with radio buttons for entity type, all 13 Canadian provinces, and date range inputs"
affects: [entity-profile-page, search-integration-tests, navigation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ARIA combobox pattern: role=combobox on wrapper, role=listbox on dropdown, role=option on items, aria-selected on active"
    - "loaderDeps pattern for TanStack Start route loader URL param access (avoids TypeScript context.location.search issues)"
    - "Route.useNavigate() with search updater function (prev => ({ ...prev, [key]: value })) for filter URL persistence"
    - "200ms debounce via useEffect + setTimeout on search query before triggering TanStack Query useQuery"

key-files:
  created:
    - apps/web/src/components/search/SearchBar.tsx
    - apps/web/src/components/landing/StatChips.tsx
    - apps/web/src/components/landing/HeroSearch.tsx
    - apps/web/src/components/search/SearchResults.tsx
    - apps/web/src/components/search/SearchFilters.tsx
    - apps/web/src/routes/search.tsx
  modified:
    - apps/web/src/routes/index.tsx

key-decisions:
  - "loaderDeps used in search.tsx instead of context.location.search — avoids TypeScript type errors with TanStack Start v1.167 loader context"
  - "Label shadcn component not installed — plain HTML label elements used instead; functionally equivalent, no dependency needed"
  - "StatChips formatCount uses 1 decimal for M (1.0M) and 0 decimal for K (1K) per UI-SPEC"
  - "SearchResults seenLabels Set deduplicates Companies/Organizations group label across company and organization keys"

patterns-established:
  - "Pattern: All copy strings sourced from apps/web/src/i18n/en.ts — no hardcoded strings in components"
  - "Pattern: Route filter updates use navigate({ search: (prev) => ({ ...prev, [key]: value, page: 1 }) }) to reset pagination"
  - "Pattern: ARIA combobox uses onBlur + setTimeout(150ms) to allow click events to fire before dropdown closes"

requirements-completed: [SRCH-01, SRCH-02, SRCH-03, SRCH-04, SRCH-05, API-01, API-11, DSGN-05]

# Metrics
duration: 3min
completed: 2026-04-02
---

# Phase 02 Plan 03: Landing Page and Search Results Summary

**ARIA combobox search bar with 200ms debounce, landing page with live stat chips, and grouped search results with URL-persisted filters across entity type, province, and date range**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-02T01:05:09Z
- **Completed:** 2026-04-02T01:08:30Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- SearchBar with full ARIA combobox pattern (role=combobox/listbox/option), 200ms debounce, keyboard navigation (Arrow/Enter/Escape), 44px touch targets, autocomplete dropdown with up to 8 suggestions
- Landing page with tagline, autofocused SearchBar, and StatChips showing formatted counts (K/M) from getPlatformStats server function with skeleton loading state
- Search results page with URL-persisted filters (entity type, province, dateFrom, dateTo, page), grouped results by type (Politicians, Companies/Organizations, People), and i18n empty state
- SearchFilters sidebar with radio buttons for entity type, full 13-province Select, and date range inputs

## Task Commits

Each task was committed atomically:

1. **Task 1: Landing page with HeroSearch and StatChips** - `6876143` (feat)
2. **Task 2: Search results page with filters and grouped results** - `80c0b7d` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified

- `apps/web/src/components/search/SearchBar.tsx` - ARIA combobox input with autocomplete, debounce, keyboard navigation
- `apps/web/src/components/landing/StatChips.tsx` - 4 stat chips with K/M formatting and skeleton loading state
- `apps/web/src/components/landing/HeroSearch.tsx` - Hero section with tagline, autofocused search bar, stat chips
- `apps/web/src/components/search/SearchResults.tsx` - Grouped results by entity type with count badges, entity links, dataset counts
- `apps/web/src/components/search/SearchFilters.tsx` - Filter sidebar with radio entity type, 13-province Select, date range inputs
- `apps/web/src/routes/search.tsx` - Search route with validateSearch, loaderDeps, filter URL persistence
- `apps/web/src/routes/index.tsx` - Updated from stub to full landing page with getPlatformStats loader

## Decisions Made

- **loaderDeps pattern:** Used `loaderDeps: ({ search }) => ({...})` + `loader: async ({ deps }) => {...}` instead of `context.location.search` — avoids TypeScript type inference issues with TanStack Start v1.167 loader context shape.
- **No Label shadcn component:** The Label shadcn component is not installed in this project. Plain HTML `<label>` elements are used instead — functionally equivalent, no additional dependency needed.

## Deviations from Plan

None — plan executed exactly as written. The `loaderDeps` alternative pattern was explicitly documented in the plan as the preferred approach if TypeScript errors occurred with `context.location.search`.

## Issues Encountered

None beyond applying the pre-documented loaderDeps pattern for route search param access.

## Known Stubs

None — SearchBar calls real getAutocomplete server function, landing page loads real getPlatformStats, search results page loads real searchEntities results. All data paths are wired to server functions from Plan 02.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Landing page search bar and stat chips are fully functional, pending a running database with data
- Search results page with grouped results, filters, and URL persistence is ready
- Entity profile links (`/entity/$id`) are rendered in SearchBar and SearchResults — entity profile route needed in Plan 05 (entity profile page)
- No blockers for Phase 02 continuation plans

---
*Phase: 02-search-and-entity-profiles*
*Completed: 2026-04-02*

## Self-Check: PASSED
