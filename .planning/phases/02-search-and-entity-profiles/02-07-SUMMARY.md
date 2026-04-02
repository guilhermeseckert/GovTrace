---
phase: 02-search-and-entity-profiles
plan: 07
subsystem: ui
tags: [react, shadcn, dialog, tanstack-start, i18n]

# Dependency graph
requires:
  - phase: 02-search-and-entity-profiles
    plan: 01
    provides: shadcn Dialog, Button, Textarea, Input components installed
  - phase: 02-search-and-entity-profiles
    plan: 04
    provides: submitFlag server function for flag submission
  - phase: 02-search-and-entity-profiles
    plan: 05
    provides: entity profile route with flagModalOpen state placeholder

provides:
  - FlagModal component with shadcn Dialog, form validation, confirmation state, anonymous submission
  - AISummaryExplanation dialog explaining AI summary generation process
  - AISummary.tsx wired to open explanation dialog on button click
  - Entity profile route fully integrated with real FlagModal (Plan 05 placeholder removed)

affects:
  - 03-visualizations
  - any future community flagging admin views

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Modal confirmation pattern: replaced modal body with confirmation message after submit, single Close button"
    - "Anonymous form submission: no auth required, optional email field, all copy from en.ts"
    - "Accessible form pattern: visible label elements (not placeholder-only) with htmlFor/id pairing"

key-files:
  created:
    - apps/web/src/components/entity/FlagModal.tsx
    - apps/web/src/components/entity/AISummaryExplanation.tsx
  modified:
    - apps/web/src/components/entity/AISummary.tsx
    - apps/web/src/routes/entity/$id.tsx

key-decisions:
  - "All copy strings sourced from en.ts (flag.title, flag.body, flag.submit, flag.cancel, flag.confirmation) — never hardcoded in component"
  - "FlagModal state reset uses 300ms setTimeout after onOpenChange(false) to allow close animation to complete before clearing form"
  - "AISummaryExplanation placed inside the flex row in AISummary.tsx alongside the button that triggers it — Dialog renders into portal so layout position is irrelevant"

patterns-established:
  - "Confirmation-replace pattern: after submit success, replace modal body entirely with confirmation paragraph and switch to single Close button"
  - "Error alert pattern: error messages use role=alert for screen reader announcement"

requirements-completed: [COMM-01, COMM-02, COMM-03, AI-05, DSGN-04]

# Metrics
duration: 6min
completed: 2026-04-02
---

# Phase 02 Plan 07: Flag Modal and AI Explanation Summary

**shadcn Dialog FlagModal with anonymous flag submission and confirmation state; AISummaryExplanation dialog for AI transparency — entity profile flagging flow fully wired end-to-end**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-02T01:11:30Z
- **Completed:** 2026-04-02T01:17:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- FlagModal component with shadcn Dialog, accessible form labels, min-10-char textarea validation, optional email input, error state with role=alert, and post-submit confirmation body replacement
- AISummaryExplanation dialog with plain-language explanation of Claude-based AI summary generation process (AI-05)
- AISummary.tsx updated to open explanation dialog on "How do we write this summary?" button click (was a no-op placeholder)
- Entity profile route ($id.tsx) Plan 05 inline placeholder div removed and replaced with real FlagModal component

## Task Commits

1. **Task 1: FlagModal component and AI explanation dialog** - `e2bf70f` (feat)
2. **Task 2: Wire FlagModal into entity profile route** - `305dd8a` (feat)

## Files Created/Modified

- `apps/web/src/components/entity/FlagModal.tsx` - shadcn Dialog form for anonymous flag submission; calls submitFlag server fn; confirmation state replaces body after success
- `apps/web/src/components/entity/AISummaryExplanation.tsx` - Informational Dialog explaining AI summary generation from public government data
- `apps/web/src/components/entity/AISummary.tsx` - Added useState for explanationOpen, onClick handler on explanation button, AISummaryExplanation component render
- `apps/web/src/routes/entity/$id.tsx` - Added FlagModal import, replaced placeholder div with real FlagModal component

## Decisions Made

- All copy strings sourced from en.ts — `en.flag.*` used throughout FlagModal, ensuring DSGN-04 compliance and future i18n readiness
- 300ms setTimeout for state reset after modal close allows close animation to complete before clearing form fields
- FlagModal email field uses `z.string().email().optional().or(z.literal(''))` on server side (from Plan 04) — client passes empty string as undefined via `|| undefined` pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Community flagging flow complete end-to-end: button click → Dialog → form → submitFlag → flags table → confirmation
- Entity profile page is now feature-complete for Phase 02 scope
- Phase 03 (visualizations) can build on the entity profile page structure without flagging concerns
- GrantsTable and LobbyingTable from Plan 06 are still pending (ConnectionsTable too) — those are tracked as stubs in Plan 06's scope, not in this plan

---
*Phase: 02-search-and-entity-profiles*
*Completed: 2026-04-02*
