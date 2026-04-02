---
phase: 02-search-and-entity-profiles
plan: 01
subsystem: ui
tags: [shadcn, tailwind, dark-mode, i18n, accessibility, react, css-variables]

# Dependency graph
requires: []
provides:
  - shadcn/ui initialized with neutral theme + government blue primary (#1a3a5c as HSL 214 60% 23%)
  - 13 shadcn UI components available in apps/web/src/components/ui/
  - Tailwind v4 CSS-first configuration with @theme inline block and dark mode tokens
  - apps/web/src/i18n/en.ts — all copy strings keyed by namespace
  - apps/web/src/components/layout/ThemeProvider.tsx — cookie-based SSR-safe dark mode
  - apps/web/src/components/layout/SkipToContent.tsx — accessibility skip link
  - apps/web/src/server-fns/theme.ts — server function reading theme cookie
  - apps/web/src/routes/__root.tsx — root layout with dark mode class on html element
  - apps/web/vite.config.ts — @/* path alias configured for src/
affects:
  - 02-02-search-server-functions
  - 02-03-landing-page
  - 02-04-entity-profile
  - 02-05-search-ui
  - 02-06-ai-summaries
  - 02-07-flag-system

# Tech tracking
tech-stack:
  added:
    - shadcn/ui CLI v4 (base-nova style, neutral theme)
    - lucide-react ^1.7.0
    - "@tanstack/react-table ^8.21.3"
    - "@anthropic-ai/sdk ^0.82.0"
    - tw-animate-css ^1.4.0
    - class-variance-authority ^0.7.1
    - clsx ^2.1.1
    - tailwind-merge ^3.5.0
  patterns:
    - Tailwind v4 CSS-first: no tailwind.config.js, all config in @theme inline block in app.css
    - HSL CSS variables for all color tokens — components use hsl(var(--primary)) pattern
    - Cookie-based dark mode SSR-safe: getCookie('theme') in server function, .dark class on html
    - All copy strings in en.ts — no hardcoded English in component JSX

key-files:
  created:
    - apps/web/components.json
    - apps/web/src/app.css
    - apps/web/src/components/ui/ (13 components)
    - apps/web/src/lib/utils.ts
    - apps/web/src/i18n/en.ts
    - apps/web/src/components/layout/ThemeProvider.tsx
    - apps/web/src/components/layout/SkipToContent.tsx
    - apps/web/src/server-fns/theme.ts
  modified:
    - apps/web/src/routes/__root.tsx
    - apps/web/package.json
    - apps/web/tsconfig.json
    - apps/web/vite.config.ts

key-decisions:
  - "getCookie from @tanstack/react-start/server replaces getWebRequest — getWebRequest is not exported in TanStack Start v1.167.16"
  - "Vite resolve.alias required for @/* path resolution at build time — tsconfig.json paths alone insufficient for Vite/Rollup"
  - "shadcn init uses oklch colors by default; overridden to HSL-based CSS variables per plan spec for government blue compatibility"
  - "tw-animate-css installed by shadcn init (replaces deprecated tailwindcss-animate per CLAUDE.md)"

patterns-established:
  - "Pattern: Copy strings via en.ts — import { en } from '@/i18n/en' then en.namespace.key"
  - "Pattern: Dark mode toggle via useTheme() from ThemeProvider — setTheme('dark') writes cookie and updates html class"
  - "Pattern: shadcn components import from '@/components/ui/[name]' — never edit files in components/ui/"

requirements-completed: [DSGN-01, DSGN-02, DSGN-03, DSGN-04, DSGN-05, DSGN-06]

# Metrics
duration: 6min
completed: 2026-04-02
---

# Phase 02 Plan 01: shadcn + Design System + i18n + Dark Mode Summary

**shadcn/ui initialized with neutral theme and government blue #1a3a5c, cookie-based SSR-safe dark mode wired in root layout, and all copy strings externalized to en.ts**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-02T00:55:35Z
- **Completed:** 2026-04-02T01:01:xx Z
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments
- shadcn/ui initialized from apps/web/ with neutral theme; 13 components installed (button, input, badge, card, tabs, table, dialog, popover, select, pagination, separator, skeleton, textarea)
- Tailwind v4 CSS-first design system configured in app.css with @theme inline block; --primary: 214 60% 23% (government blue #1a3a5c) in light mode
- Cookie-based dark mode: getCookie('theme') in server function, className={theme} on html element — no FOUC on first paint
- All visible copy strings externalized to apps/web/src/i18n/en.ts with full type export
- SkipToContent link targeting #main-content added to root layout (WCAG accessibility)

## Task Commits

Each task was committed atomically:

1. **Task 1: shadcn init + Tailwind v4 design system** - `26edcf1` (feat)
2. **Task 2: i18n file, ThemeProvider, SkipToContent, root layout update** - `2b18f06` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `apps/web/components.json` - shadcn configuration (neutral theme, CSS variables)
- `apps/web/src/app.css` - Tailwind v4 CSS-first with @theme inline, HSL brand tokens, dark mode
- `apps/web/src/components/ui/` - 13 shadcn component files (do not edit manually)
- `apps/web/src/lib/utils.ts` - shadcn cn() utility (clsx + tailwind-merge)
- `apps/web/src/i18n/en.ts` - All copy strings: search, profile, badge, flag, table, common, landing
- `apps/web/src/components/layout/ThemeProvider.tsx` - Cookie-based dark mode context + toggle
- `apps/web/src/components/layout/SkipToContent.tsx` - Accessibility skip link to #main-content
- `apps/web/src/server-fns/theme.ts` - Server function reading theme cookie via getCookie()
- `apps/web/src/routes/__root.tsx` - Root layout with ThemeProvider, SkipToContent, theme loader
- `apps/web/tsconfig.json` - Added @/* path alias mapping to ./src/*
- `apps/web/vite.config.ts` - Added resolve.alias for @/ path at Vite/Rollup level
- `apps/web/package.json` - Added lucide-react, @tanstack/react-table, @anthropic-ai/sdk, tw-animate-css

## Decisions Made
- `getCookie` from `@tanstack/react-start/server` replaces `getWebRequest` which is not exported in TanStack Start v1.167.16
- Vite `resolve.alias` is required in addition to tsconfig.json paths — tsconfig paths alone don't resolve @/* in Rollup bundling
- shadcn init generated oklch-based color values by default; overridden to HSL values per plan spec (government blue compatibility and plan must_have truth)
- `tw-animate-css` installed by shadcn init (replaces deprecated tailwindcss-animate per CLAUDE.md stack guidance)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed getWebRequest import — getCookie API used instead**
- **Found during:** Task 2 (server-fns/theme.ts compilation)
- **Issue:** Plan specified `getWebRequest` from `@tanstack/react-start/server` but this function is not exported in TanStack Start v1.167.16. The correct API is `getCookie(name)` from the same module.
- **Fix:** Replaced `getWebRequest` approach with `getCookie('theme')` — cleaner and correctly typed
- **Files modified:** apps/web/src/server-fns/theme.ts
- **Verification:** Build passes; getCookie correctly resolves theme cookie value
- **Committed in:** 2b18f06 (Task 2 commit)

**2. [Rule 3 - Blocking] Added Vite resolve.alias for @/* path resolution**
- **Found during:** Task 2 (build failure after root.tsx update)
- **Issue:** Build failed with "Rollup failed to resolve import @/components/layout/ThemeProvider". tsconfig.json paths only inform TypeScript type checking; Vite/Rollup requires explicit alias configuration.
- **Fix:** Added `resolve.alias: { '@': resolve(import.meta.dirname, './src') }` to vite.config.ts
- **Files modified:** apps/web/vite.config.ts
- **Verification:** Build passes; all @/ imports resolve correctly
- **Committed in:** 2b18f06 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking issues)
**Impact on plan:** Both fixes required for correct build; no scope creep.

## Issues Encountered
- shadcn init failed on first attempt — tsconfig.json lacked @/* path alias and app.css was absent. Added both pre-conditions then re-ran init successfully.
- shadcn init uses oklch colors by default in CLI v4; replaced with HSL values as specified in plan must_haves.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 13 shadcn UI components available for import from @/components/ui/
- Design tokens (--primary, --secondary, --muted, etc.) available via Tailwind classes (bg-primary, text-muted-foreground, etc.)
- Dark mode toggle via useTheme() — ready for NavBar dark mode button in 02-03
- Copy strings via en.namespace.key pattern — all subsequent plans use this
- ThemeProvider wraps all routes; any child component can call useTheme()

---
*Phase: 02-search-and-entity-profiles*
*Completed: 2026-04-02*
