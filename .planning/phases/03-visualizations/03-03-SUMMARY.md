---
phase: 03-visualizations
plan: 03
subsystem: ui
tags: [d3, d3-sankey, visualization, react, typescript, sankey, timeline, d3-zoom, svg]

requires:
  - phase: 03-01
    provides: getMoneyFlow/getTimeline server functions, MoneyFlowResponse/TimelineResponse types, useChartColors, useResizeObserver hooks, en.viz.sankey/timeline i18n keys

provides:
  - MoneyFlowSankey component (VIZ-04): D3-Sankey money flow diagram with entity/party/department flows and empty state
  - ActivityTimeline component (VIZ-05): Chronological event timeline with type shape markers, election year overlays, and horizontal scroll

affects: [03-04]

tech-stack:
  added:
    - "@types/d3-sankey@0.12.5 (devDependency) — TypeScript types for d3-sankey, not included in @types/d3"
  patterns:
    - "D3 for math, React for rendering: d3-sankey computes layout, React renders SVG rects/paths via JSX"
    - "Deep-copy pattern before sankey(): nodes.map(n => ({ ...n })) to avoid Pitfall 4 mutation of React state"
    - "d3.select used only for zoom attachment (d3.zoom.call), not for DOM rendering — rendering stays pure JSX"
    - "d3.timeYear.every(2) returns TimeInterval | undefined — guard with ternary before passing to xScale.ticks()"

key-files:
  created:
    - apps/web/src/components/visualizations/MoneyFlowSankey.tsx
    - apps/web/src/components/visualizations/ActivityTimeline.tsx
  modified:
    - apps/web/package.json
    - pnpm-lock.yaml

key-decisions:
  - "@types/d3-sankey separate install required — @types/d3 v7.4.3 does not bundle d3-sankey types despite d3-sankey being a companion package"
  - "d3.select on containerRef used exclusively to attach zoom handler — not for SVG rendering; aligns with research Pattern 2"
  - "d3.timeYear.every(2) may return undefined per TypeScript types — guarded before passing to xScale.ticks() to avoid overload mismatch"

patterns-established:
  - "Pattern: @types/d3-sankey required separately from @types/d3 for SankeyNode/SankeyLink type imports"
  - "Pattern: useMemo for sankey layout computation (depends on [rawNodes, rawLinks, width]) with deep-copy inside"
  - "Pattern: Timeline horizontal scroll via d3.zoom attached once in useEffect with [] deps; translateX in React state"

requirements-completed:
  - VIZ-04
  - VIZ-05

duration: 4min
completed: 2026-04-03
---

# Phase 03 Plan 03: MoneyFlowSankey and ActivityTimeline Summary

**D3-Sankey money flow diagram and scaleTime activity timeline with election year overlays — two Wave 2 visualization components completing the visualization trifecta for Plan 04 wiring**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-03T01:54:48Z
- **Completed:** 2026-04-03T01:59:26Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created MoneyFlowSankey.tsx: D3-Sankey layout with React JSX rendering, deep-copy mutation guard, node colors by type from CSS variables, empty state for < 3 nodes
- Created ActivityTimeline.tsx: scaleTime timeline with d3.zoom horizontal scroll, all 8 Canadian federal election year reference lines, 5 event type shape markers, hover tooltips, and legend
- Installed @types/d3-sankey (missing type package not included in @types/d3 bundle)

## Task Commits

1. **Task 1: Build MoneyFlowSankey component (VIZ-04)** - `d5ed0eb` (feat)
2. **Task 2: Build ActivityTimeline component (VIZ-05)** - `58f3795` (feat)

**Plan metadata:** (see final commit)

## Files Created/Modified

- `apps/web/src/components/visualizations/MoneyFlowSankey.tsx` - D3-Sankey money flow diagram; self-fetches via getMoneyFlow; empty state when < 3 nodes
- `apps/web/src/components/visualizations/ActivityTimeline.tsx` - scaleTime timeline; horizontal scroll via d3.zoom; election year lines; 5 event shape markers; legend
- `apps/web/package.json` - added @types/d3-sankey devDependency
- `pnpm-lock.yaml` - updated lockfile

## Decisions Made

- **@types/d3-sankey separate install**: @types/d3 v7.4.3 does not include d3-sankey types. Required `pnpm add -D @types/d3-sankey` for TypeScript strict mode compliance.
- **d3.select for zoom only**: ActivityTimeline uses `d3.select(containerRef.current).call(zoom)` exclusively to attach the zoom behavior — all SVG elements rendered via JSX. This is the approved Pattern 2 from research, not a DOM mutation violation.
- **d3.timeYear.every(2) null guard**: TypeScript types show `TimeInterval | undefined` return type. Added ternary guard `interval ? xScale.ticks(interval) : xScale.ticks(10)` to satisfy overload types.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing @types/d3-sankey type definitions**
- **Found during:** Task 1 (MoneyFlowSankey)
- **Issue:** `import type { SankeyNode, SankeyLink } from 'd3-sankey'` failed — @types/d3 does not bundle d3-sankey types; tsc reported TS7016 (implicit any)
- **Fix:** `pnpm --filter @govtrace/web add -D @types/d3-sankey`
- **Files modified:** apps/web/package.json, pnpm-lock.yaml
- **Verification:** tsc --noEmit shows no errors in MoneyFlowSankey.tsx
- **Committed in:** d5ed0eb (Task 1 commit)

**2. [Rule 1 - Bug] Fixed d3.timeYear.every(2) TypeScript overload mismatch**
- **Found during:** Task 2 (ActivityTimeline)
- **Issue:** `xScale.ticks(d3.timeYear.every(2))` — `every()` returns `TimeInterval | undefined` but `.ticks()` overloads require either `number` or `TimeInterval` (not union with undefined)
- **Fix:** Added ternary: `const interval = d3.timeYear.every(2); return interval ? xScale.ticks(interval) : xScale.ticks(10)`
- **Files modified:** apps/web/src/components/visualizations/ActivityTimeline.tsx
- **Verification:** tsc --noEmit shows no errors in ActivityTimeline.tsx
- **Committed in:** 58f3795 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking — missing type package; 1 bug — TypeScript overload mismatch)
**Impact on plan:** Both auto-fixes necessary for TypeScript strict mode compliance. No scope creep.

## Issues Encountered

- Ultracite/Biome check command fails at project root due to pre-existing biome.jsonc configuration errors (`noDuplicateClasses` and `useSortedInterfaceMembers` are unknown keys). This is an out-of-scope pre-existing issue logged to deferred-items. TypeScript compilation used as primary verification.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both MoneyFlowSankey and ActivityTimeline (plus NetworkGraph from Plan 02) are ready for Plan 04 wiring task
- All three Wave 2 visualization components self-fetch via their respective server functions and accept `entityId` prop
- Plan 04 can import `MoneyFlowSankey` from `@/components/visualizations/MoneyFlowSankey` and `ActivityTimeline` from `@/components/visualizations/ActivityTimeline`

---
*Phase: 03-visualizations*
*Completed: 2026-04-03*

## Self-Check: PASSED

- FOUND: apps/web/src/components/visualizations/MoneyFlowSankey.tsx
- FOUND: apps/web/src/components/visualizations/ActivityTimeline.tsx
- FOUND: .planning/phases/03-visualizations/03-03-SUMMARY.md
- FOUND commit d5ed0eb: feat(03-03): build MoneyFlowSankey component (VIZ-04)
- FOUND commit 58f3795: feat(03-03): build ActivityTimeline component (VIZ-05)
