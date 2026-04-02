---
phase: 02-search-and-entity-profiles
plan: 05
subsystem: ui
tags: [react, tanstack-start, tanstack-router, shadcn, tailwind, lucide-react, tanstack-query]

# Dependency graph
requires:
  - phase: 02-search-and-entity-profiles
    plan: 01
    provides: shadcn/ui components, Tailwind v4, lucide-react, i18n en.ts
  - phase: 02-search-and-entity-profiles
    plan: 04
    provides: getEntityProfile, getEntityStats, getOrGenerateSummary server functions, EntityProfile type
provides:
  - Entity profile route /entity/:id with SSR loader
  - EntityHeader component — blue header band with entity name, type, confidence badge, flag button
  - ConfidenceBadge component — 3-state (high/medium/low) with Popover showing score, method, reasoning
  - AISummary component — cache-then-async pattern with skeleton loading
  - ProfileTabs component — 5 tabs with count badges and connections disclaimer banner
  - Data provenance footer below tabs
affects:
  - 02-06 (DataTable components injected via ProfileTabs tablesSlot props)
  - 02-07 (FlagModal replaces placeholder flag modal in EntityProfilePage)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Cache-then-async: AISummary checks initialSummary from SSR, only triggers useQuery if null (Pitfall 5)
    - Route loader: Promise.all for parallel server function calls with notFound() on missing entity
    - State CONFIG as const: color/icon/label map keyed by badge state for type-safe 3-state rendering

key-files:
  created:
    - apps/web/src/components/entity/ConfidenceBadge.tsx
    - apps/web/src/components/entity/EntityHeader.tsx
    - apps/web/src/components/entity/AISummary.tsx
    - apps/web/src/components/entity/ProfileTabs.tsx
    - apps/web/src/routes/entity/$id.tsx
  modified:
    - apps/web/src/routeTree.gen.ts

key-decisions:
  - "ProfileTabs accepts optional ReactNode slot props (donationsTable, contractsTable, etc.) so Plan 06 can inject DataTable components without modifying the tabs structure"
  - "FlagModal is a placeholder div in Plan 05 — real shadcn Dialog wired in Plan 07 (COMM-01)"
  - "Provenance footer uses entity.updatedAt for now — Plan 06 adds per-dataset ingestedAt queries"

patterns-established:
  - "3-state badge pattern: getState() pure function + STATE_CONFIG as const map for type-safe color/icon/label selection"
  - "Entity route loader: Promise.all([getEntityProfile, getEntityStats, getOrGenerateSummary]) with catch(() => null) on summary to not block profile on AI failure"
  - "AISummary enabled: !initialSummary — only fires client-side query if SSR cache miss, preventing double fetches"

requirements-completed:
  - PROF-01
  - PROF-02
  - PROF-03
  - PROF-06
  - AI-01
  - AI-02
  - AI-04
  - AI-05
  - DSGN-01
  - DSGN-02
  - DSGN-03
  - DSGN-06

# Metrics
duration: 2min
completed: 2026-04-02
---

# Phase 02 Plan 05: Entity Profile Page Summary

**Entity profile route /entity/:id with government-blue header, 3-state confidence badge popover, skeleton-loading AI summary, and 5-tab layout with count badges and connections disclaimer**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-02T01:05:10Z
- **Completed:** 2026-04-02T01:07:15Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Entity profile page route with SSR loader (Promise.all across 3 server functions, notFound() on missing entity)
- ConfidenceBadge 3-state rendering (High green #16a34a / Medium amber #d97706 / Low red #dc2626) with ShieldCheck/Shield/ShieldAlert icons and Popover showing confidence score, match method, and AI reasoning
- AISummary cache-then-async pattern: SSR passes initialSummary, component only triggers useQuery if null (avoids blocking profile load per Pitfall 5)
- ProfileTabs 5-tab layout with count badges, min-h-[44px] WCAG touch targets, and connections disclaimer banner with role="status" aria-live="polite"

## Task Commits

Each task was committed atomically:

1. **Task 1: EntityHeader, ConfidenceBadge, AISummary components** - `c8e5ea2` (feat)
2. **Task 2: ProfileTabs, provenance footer, and entity route** - `19adb1a` (feat)

**Plan metadata:** (docs commit — added below)

## Files Created/Modified
- `apps/web/src/components/entity/ConfidenceBadge.tsx` - 3-state confidence badge with Popover for score/method/reasoning
- `apps/web/src/components/entity/EntityHeader.tsx` - Government-blue header band with entity name, type, badge, and flag button
- `apps/web/src/components/entity/AISummary.tsx` - AI summary with skeleton loading and cache-then-async pattern
- `apps/web/src/components/entity/ProfileTabs.tsx` - 5-tab layout with count badges and connections disclaimer banner
- `apps/web/src/routes/entity/$id.tsx` - Entity profile route with SSR loader, all 4 route components, provenance footer, and flag modal placeholder
- `apps/web/src/routeTree.gen.ts` - Auto-regenerated with /entity/$id route registered

## Decisions Made
- ProfileTabs accepts optional ReactNode slot props (donationsTable etc.) so Plan 06 can inject DataTable components without modifying tab structure
- FlagModal placeholder (plain div) in Plan 05 — real shadcn Dialog wired in Plan 07
- Provenance footer uses entity.updatedAt for now — Plan 06 will add per-dataset ingestedAt queries

## Deviations from Plan
None - plan executed exactly as written.

## Known Stubs
- **FlagModal placeholder** (`apps/web/src/routes/entity/$id.tsx`, EntityProfilePage): The `flagModalOpen` state toggles a plain `<div>` overlay with "Flag modal coming in Plan 07". This is intentional — Plan 07 implements the real shadcn Dialog with the flag submission form (COMM-01, COMM-02).
- **Tab content placeholders** (`apps/web/src/components/entity/ProfileTabs.tsx`): Each tab panel shows the `en.table.empty` message by default. This is intentional — Plan 06 injects DataTable components via the optional slot props (donationsTable, contractsTable, etc.).
- **Provenance footer** (`apps/web/src/routes/entity/$id.tsx`): Shows single `entity.updatedAt` timestamp, not per-dataset ingestedAt. Plan 06 adds per-dataset provenance queries.

## Issues Encountered
None.

## Next Phase Readiness
- Entity profile route complete; ready for Plan 06 (DataTable components) to inject data into ProfileTabs slot props
- Plan 07 (FlagModal) can replace the placeholder flag modal by receiving entityId and matchLogId from the entity route
- All 5 tab panels render empty states — Plan 06 wires the actual data tables

---
*Phase: 02-search-and-entity-profiles*
*Completed: 2026-04-02*
