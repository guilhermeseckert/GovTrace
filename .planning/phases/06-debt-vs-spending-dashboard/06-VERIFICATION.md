---
phase: 06-debt-vs-spending-dashboard
verified: 2026-04-04T00:00:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
---

# Phase 06: Debt vs Spending Dashboard — Verification Report

**Phase Goal:** Citizens can see at a glance how much Canada sends overseas relative to the national debt, with timeline context showing trends over election cycles
**Verified:** 2026-04-04
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | fiscal_snapshots table exists with national debt data from Statistics Canada | VERIFIED | `packages/db/src/schema/raw.ts` L150: `pgTable('fiscal_snapshots', {...})` with correct columns; migration `0001_regular_valeria_richards.sql` confirmed |
| 2 | Server functions return annual debt timeline, annual aid totals, and department breakdown | VERIFIED | `apps/web/src/server-fns/dashboard.ts`: `getDebtTimeline`, `getDepartmentBreakdown`, `getDebtHeroStats` all export real `createServerFn` handlers with live DB queries |
| 3 | Election dates are available as a typed constant for chart annotation | VERIFIED | `apps/web/src/lib/constants/elections.ts`: 11 entries from 35th (1993) to 45th (2025) exported `as const` |
| 4 | User can navigate to /dashboard and see the national debt vs aid spending page | VERIFIED | `apps/web/src/routes/dashboard.tsx` registered; `routeTree.gen.ts` confirms `/dashboard` path; nav link in `__root.tsx` L69-71 |
| 5 | User sees hero stat cards showing current debt, total aid, and the aid-as-percent-of-debt ratio | VERIFIED | `DebtHeroStats.tsx` renders 3 shadcn Cards with `formatDebt`, `formatAid`, and `aidAsPercentOfDebt.toFixed(1)%` |
| 6 | User sees a time-series chart with debt and aid lines plus election year markers | VERIFIED | `DebtVsAidChart.tsx`: D3 `scaleTime`, `scaleLinear`, `line()` for math; React renders SVG paths; `FEDERAL_ELECTION_DATES` filtered to domain and rendered as dashed vertical `<line>` elements |
| 7 | User sees a department breakdown showing which departments authorize the most spending | VERIFIED | `DepartmentBreakdown.tsx`: CSS percentage bars, top-10 slice, `pctOfTotal` bar widths, `remaining` count |
| 8 | Every number has a source link to the original government data | VERIFIED | `DebtHeroStats.tsx`: ExternalLink icons on all 3 cards with `rel="noopener noreferrer"`; `DepartmentBreakdown.tsx` L92-101: GAC dataset link; server functions embed `sourceDebtUrl` and `sourceAidUrl` on every data point |

**Score:** 8/8 truths verified

---

### Required Artifacts

#### Plan 06-01 Artifacts

| Artifact | Min Lines | Actual | Status | Details |
|----------|-----------|--------|--------|---------|
| `packages/db/src/schema/raw.ts` | — | 188 | VERIFIED | `fiscalSnapshots` at L150; unique composite index + ref_date index |
| `packages/db/drizzle/0001_regular_valeria_richards.sql` | — | 35 | VERIFIED | `CREATE TABLE "fiscal_snapshots"` present; both indexes confirmed |
| `apps/ingestion/src/downloaders/fiscal.ts` | — | 59 | VERIFIED | Exports `downloadFiscalCsv`; WDS REST endpoint, adm-zip extraction, SHA-256 hash |
| `apps/ingestion/src/parsers/fiscal.ts` | — | 102 | VERIFIED | Exports `parseFiscalCsv`; papaparse, series filter, SCALAR_FACTOR normalisation |
| `apps/ingestion/src/upsert/fiscal.ts` | — | 47 | VERIFIED | Exports `upsertFiscalSnapshots`; batch-500 onConflictDoUpdate |
| `apps/ingestion/src/runners/ingest-fiscal.ts` | — | 72 | VERIFIED | Exports `runFiscalIngestion`; mirrors international-aid pattern; ingestion_runs record lifecycle |
| `apps/web/src/lib/constants/elections.ts` | — | 19 | VERIFIED | 11 entries `as const`; all fields present |
| `apps/web/src/server-fns/dashboard.ts` | — | 209 | VERIFIED | 3 server functions + 3 exported types (`DebtAidDataPoint`, `DeptSpendingRow`, `DebtHeroStats`) |

#### Plan 06-02 Artifacts

| Artifact | Min Lines | Actual | Status | Details |
|----------|-----------|--------|--------|---------|
| `apps/web/src/routes/dashboard.tsx` | 30 | 93 | VERIFIED | `createFileRoute('/dashboard')` with loader calling all 3 server functions via `Promise.all`; registered in routeTree.gen.ts |
| `apps/web/src/components/dashboard/DebtVsAidChart.tsx` | 80 | 320 | VERIFIED | D3 math-only (scaleTime, scaleLinear, line, curveMonotoneX); React SVG rendering; election markers; dual y-axes; legend; `role="img"` aria label |
| `apps/web/src/components/dashboard/DepartmentBreakdown.tsx` | 40 | 105 | VERIFIED | Top-10 slice, CSS bar widths, currency formatting, project count, GAC source link |
| `apps/web/src/components/dashboard/DebtHeroStats.tsx` | 30 | 128 | VERIFIED | 3-card responsive grid; `formatDebt` / `formatAid` helpers; ExternalLink icons; debtAsOf date |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/ingestion/src/runners/ingest-fiscal.ts` | `packages/db/src/schema/raw.ts` | `fiscalSnapshots` import | WIRED | L5-8: imports from `@govtrace/db/schema/jobs` and the three fiscal helper modules; `upsertFiscalSnapshots` (which imports `fiscalSnapshots`) called at L52 |
| `apps/web/src/server-fns/dashboard.ts` | `packages/db/src/schema/raw.ts` | SQL queries on `fiscalSnapshots` and `internationalAid` | WIRED | L4: `import { fiscalSnapshots, internationalAid } from '@govtrace/db/schema/raw'`; both used in live DB queries |
| `apps/web/src/routes/dashboard.tsx` | `apps/web/src/server-fns/dashboard.ts` | loader calling `getDebtTimeline`, `getDepartmentBreakdown`, `getDebtHeroStats` | WIRED | L2: import; L13-17: `Promise.all([getDebtTimeline(), getDepartmentBreakdown(), getDebtHeroStats()])` |
| `apps/web/src/components/dashboard/DebtVsAidChart.tsx` | `apps/web/src/lib/constants/elections.ts` | `FEDERAL_ELECTION_DATES` import for election markers | WIRED | L4: `import { FEDERAL_ELECTION_DATES } from '@/lib/constants/elections'`; used at L90 to filter + render markers |
| `apps/web/src/components/dashboard/DebtVsAidChart.tsx` | `d3` | D3 scales and line generators | WIRED | L2: `import * as d3 from 'd3'`; `d3.scaleTime()`, `d3.scaleLinear()`, `d3.line()`, `d3.curveMonotoneX` all used for math |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `DebtHeroStats.tsx` | `stats` prop | `getDebtHeroStats()` in route loader | Yes — queries `fiscal_snapshots` (latest deficit) and `international_aid` (SUM committed) | FLOWING |
| `DebtVsAidChart.tsx` | `data` prop | `getDebtTimeline()` in route loader | Yes — queries `fiscal_snapshots` per year + `international_aid` aggregated by year | FLOWING |
| `DepartmentBreakdown.tsx` | `data` prop | `getDepartmentBreakdown()` in route loader | Yes — raw SQL `GROUP BY funding_department` on `international_aid` | FLOWING |

Note: `fiscal_snapshots` table will be empty until `runFiscalIngestion()` is run against a live database. Server functions correctly return empty arrays / zero values in that case, and components render appropriate empty-state UI. This is correct behavior — not a stub.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `/dashboard` route registered in router | grep routeTree.gen.ts | Found `/dashboard` path with `DashboardRouteImport` | PASS |
| Dashboard route imports all 3 server functions | grep dashboard.tsx | `getDebtTimeline`, `getDepartmentBreakdown`, `getDebtHeroStats` all imported and called | PASS |
| Nav link exists for dashboard | grep __root.tsx | `<NavLink to="/dashboard">` with `BarChart2` icon at L69-71 | PASS |
| TypeScript errors in dashboard-specific files | tsc --noEmit filtered | Zero errors in `dashboard.tsx`, `DebtHeroStats.tsx`, `DebtVsAidChart.tsx`, `DepartmentBreakdown.tsx`, `dashboard.ts`, `elections.ts` | PASS |
| Pre-existing TS5097 errors are project-wide, not phase-introduced | Compare with international-aid runner | Same TS5097 pattern exists in `contracts.ts` and other pre-phase files; `ingest-fiscal.ts` follows same `.ts` extension convention as `international-aid.ts` | INFO |
| D3 DOM manipulation absent (no d3.select / .append) | grep DebtVsAidChart.tsx | No matches — D3 used only for scales and path math | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DEBT-01 | 06-01, 06-02 | Dashboard page shows current national debt alongside total overseas aid spending | SATISFIED | `DebtHeroStats` cards show `currentDebtBillions` and `totalAidBillions`; `getDebtHeroStats` queries both sources |
| DEBT-02 | 06-01, 06-02 | Timeline visualization compares annual aid commitments against debt growth with election year markers | SATISFIED | `DebtVsAidChart` dual-axis line chart; `FEDERAL_ELECTION_DATES` used to draw vertical dashed election markers within x-domain |
| DEBT-03 | 06-01, 06-02 | Department-level breakdown shows which departments authorize the most international spending | SATISFIED | `getDepartmentBreakdown` groups by `funding_department` ordered by committed DESC; `DepartmentBreakdown` renders top-10 with CSS bars |
| DEBT-04 | 06-01, 06-02 | All numbers link to source data (Statistics Canada, Global Affairs, Dept of Finance) | SATISFIED | `DEBT_SOURCE_URL` and `AID_SOURCE_URL` embedded on every `DebtAidDataPoint`; ExternalLink icons on all 3 hero cards; GAC dataset link in `DepartmentBreakdown` |

All 4 DEBT requirements are satisfied. No orphaned requirements found — all IDs declared in plan frontmatter map to this phase in REQUIREMENTS.md.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TODO, FIXME, placeholder, hardcoded empty returns, or console.log statements found in any dashboard file. D3 DOM manipulation patterns (`d3.select`, `.append`) are absent — the "D3 for math, React for rendering" pattern is correctly applied.

---

### Human Verification Required

#### 1. Visual Chart Rendering

**Test:** Start dev server (`pnpm --filter @govtrace/web dev`), navigate to `http://localhost:3000/dashboard` with the database populated (run `runFiscalIngestion()` first, or confirm `international_aid` data exists).

**Expected:** Dual-axis line chart shows two colored lines (debt in red/destructive, aid in chart-2 color) with dashed vertical lines at election years. Y-axis labels appear on both left and right. Chart resizes when browser window is resized.

**Why human:** Visual rendering, responsive behavior, and dual-axis readability cannot be verified programmatically.

#### 2. Empty-State Graceful Degradation

**Test:** If `fiscal_snapshots` is empty (ingestion not yet run), load `/dashboard`.

**Expected:** Chart and hero stats show dashes (`—`) rather than zeros or crashes; DepartmentBreakdown shows the "No department data available" message if `international_aid` is also empty.

**Why human:** Requires controlling database state to produce empty conditions.

#### 3. Source Link Validity

**Test:** Click the ExternalLink icons on each hero card and the department source link.

**Expected:** Statistics Canada Table 10-10-0002-01 page opens; Global Affairs international assistance page opens; GAC IATI dataset page opens.

**Why human:** URL reachability and correct landing page require browser/network access.

---

### Gaps Summary

No gaps found. All 8 observable truths are verified at all four levels (exists, substantive, wired, data flowing). All 4 DEBT requirements are satisfied by concrete implementations — not stubs or placeholders.

The only TypeScript compilation errors in the repository (`TS5097 allowImportingTsExtensions`, `TS18048` in the AI matcher) are pre-existing project-wide issues that predate Phase 06. Zero new errors were introduced by this phase's files, as confirmed by targeted tsc output filtering.

---

_Verified: 2026-04-04_
_Verifier: Claude (gsd-verifier)_
