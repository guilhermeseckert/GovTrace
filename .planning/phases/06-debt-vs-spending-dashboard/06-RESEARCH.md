# Phase 6: Debt vs Spending Dashboard — Research

**Researched:** 2026-04-04
**Domain:** Canadian government fiscal data APIs, D3 time-series visualizations, dashboard page architecture
**Confidence:** HIGH (data sources verified live; D3 patterns drawn from existing codebase)

---

## Summary

This phase adds a standalone `/dashboard` page that tells a civic story: Canada's national debt trajectory alongside its overseas aid commitments, broken down by funding department and annotated with election year markers. The data comes from three existing or readily-accessible government sources: Statistics Canada's Web Data Service (WDS) for annual debt figures, the IATI data already ingested in Phase 5 for aid totals by year, and Global Affairs Canada's Statistical Reports for an aggregate cross-check.

The key finding is that **overseas aid totals can be derived entirely from the `international_aid` table already in the database** — no new ingestion pipeline is required for aid data. National debt requires a one-time fetch of Statistics Canada table `10-10-0002-01` (Central Government Debt), which is available as a zipped CSV via a public API with no authentication. The resulting data is small enough (< 30 annual rows for the debt series) to store in a new `fiscal_snapshots` table and refresh annually alongside the existing ingestion pipeline.

The D3 work follows the project's established "D3 for math, React for rendering" pattern from `NetworkGraph.tsx`. The best chart type for this comparison is a **single-axis line chart with a secondary proportional scale** (not true dual-axis), because debt and aid differ by three orders of magnitude. A dual-axis design is technically simpler but misleading — expert civic dataviz practice is to show aid as a percentage of debt on the right axis, making the ratio the story rather than hiding it behind scale mismatch.

**Primary recommendation:** Store annual debt snapshots in a new `fiscal_snapshots` table, derive aid annual totals via a SQL query on `international_aid`, and render a dual-series SVG line chart with D3 scales and React SVG elements following the existing `NetworkGraph.tsx` pattern.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEBT-01 | Dashboard shows current national debt alongside total overseas aid spending | Stats Canada table 10-10-0002-01 for debt; `international_aid` table aggregate for aid |
| DEBT-02 | Timeline visualization compares annual aid commitments against debt growth with federal election year markers | D3 `scaleLinear` + `scaleTime` + SVG `<line>` election markers; election dates catalogued below |
| DEBT-03 | Department-level breakdown shows which departments authorize the most international spending | Direct `GROUP BY funding_department` query on `international_aid` — no new data needed |
| DEBT-04 | All numbers link to source data (Statistics Canada, Global Affairs, Dept of Finance) | Source URLs identified for each data type; store alongside row in `fiscal_snapshots` |
</phase_requirements>

---

## Data Sources

### 1. National Debt — Statistics Canada Table 10-10-0002-01

**What it is:** "Central government debt" — monthly series for federal net debt, gross liabilities, accumulated deficit, and related components. Source: Department of Finance Canada data released through Statistics Canada.

**Why this table:** It is the authoritative machine-readable source for federal net debt. The "A. Federal debt (accumulated deficit)" series gives the headline number shown in budget documents.

**Download URL (verified live):**
```
GET https://www150.statcan.gc.ca/t1/wds/rest/getFullTableDownloadCSV/10100002/en
→ { "status": "SUCCESS", "object": "https://www150.statcan.gc.ca/n1/tbl/csv/10100002-eng.zip" }
```

The WDS API returns a JSON envelope; the ZIP contains a CSV of the full table (all series, all dates).

**Key series within the table:**
- `A. Federal debt (accumulated deficit)` — the top-level debt headline
- `B. Net debt` — liabilities minus financial assets (what economists use)
- `C. Liabilities, gross debt` — total gross obligations

**Time coverage:** Monthly data from September 2009 to present (released ~monthly, updated every business day at 08:30 ET).

**Update frequency:** Monthly. The latest release as of research date: Q4 2025 data (net debt $1,010.2 billion CAD).

**Format:** CSV inside ZIP. Columns follow Statistics Canada standard: `REF_DATE`, `GEO`, `DGUID`, `Central government debt` (series name), `UOM`, `SCALAR_FACTOR`, `VALUE`. Values are in millions of CAD.

**Alternative for annual historical data (1867–2008):**
```
Table 10-10-0048-01 → https://www150.statcan.gc.ca/n1/tbl/csv/10100048-eng.zip
```
This archived table covers the full historical record. For the dashboard timeline (election cycles since ~1993), the `10100002` table is sufficient.

**Source page:** https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1010000201

---

### 2. Annual Overseas Aid Totals — From `international_aid` Table (Already Ingested)

**Can we aggregate from IATI data?** Yes. The `international_aid` table has `start_date`, `total_committed_cad`, `total_disbursed_cad`, and `total_budget_cad`. Annual aid can be derived with:

```sql
SELECT
  EXTRACT(YEAR FROM start_date) AS fiscal_year,
  SUM(total_committed_cad)      AS annual_committed,
  SUM(total_disbursed_cad)      AS annual_disbursed,
  SUM(total_budget_cad)         AS annual_budget
FROM international_aid
WHERE start_date IS NOT NULL
GROUP BY EXTRACT(YEAR FROM start_date)
ORDER BY fiscal_year;
```

**Caveat on IATI aggregation:** IATI project-level data uses activity `start_date` as the year anchor, not fiscal-year disbursement timing. For a civic dashboard the difference is acceptable and aligns with how Global Affairs Canada presents data on its own Project Browser. The Statistical Report on International Assistance 2023–2024 confirms Canada's total international assistance was **$12.29 billion CAD** in FY 2023–24 — this serves as a spot-check against the IATI aggregate.

**No new ingestion pipeline required for DEBT-02 and DEBT-03.** The aid data is live in the database from Phase 5.

**Cross-check source:** Global Affairs Canada Statistical Reports (available for FY 2000–01 through FY 2024–25 as CSVs via the Historical Project Data Set):
- HPDS download tool: `https://international.canada.ca/en/global-affairs/corporate/reports/international-assistance-data`
- Open Canada dataset ID: `2db72da5-23c0-4c7b-87d0-a88da0e5c59c`

**Fiscal year note:** Global Affairs uses April–March fiscal years. The IATI `start_date` field uses calendar year. For the timeline visualization, calendar year alignment is correct for overlaying election dates.

---

### 3. Department-Level Spending — `funding_department` Column (DEBT-03)

The `international_aid.funding_department` column is populated from IATI `participating-org role="3"` during Phase 5 ingestion. Department-level breakdown requires only a query:

```sql
SELECT
  funding_department,
  COUNT(*)                      AS project_count,
  SUM(total_committed_cad)      AS total_committed,
  SUM(total_disbursed_cad)      AS total_disbursed
FROM international_aid
WHERE funding_department IS NOT NULL
GROUP BY funding_department
ORDER BY total_committed DESC;
```

**Known departments in IATI data:** Global Affairs Canada (primary), Department of Finance Canada, Immigration, Refugees and Citizenship Canada, and approximately 15 smaller contributors.

**No schema changes needed for DEBT-03.** The data is already there.

---

### 4. Fiscal Monitor (Dept of Finance) — Supplementary Source for DEBT-04

The Fiscal Monitor is published monthly by the Department of Finance as HTML pages and ZIP downloads containing charts and tables. It is **not machine-readable** in a way suitable for automated ingestion — it is a PDF/HTML report. Its purpose in this phase is as a **source link target**, not a data source.

- Monthly Fiscal Monitor index: `https://www.canada.ca/en/department-finance/services/publications/fiscal-monitor.html`
- Fiscal Reference Tables (annual, Excel/PDF): `https://www.canada.ca/en/department-finance/services/publications/fiscal-reference-tables/2025.html`
  - Table 16 covers "Total liabilities, net debt and the accumulated deficit" — use this URL as the canonical source link shown to users.

**Pitfall:** The Fiscal Monitor ZIP files contain Excel charts embedded in a `.zip`, not structured CSV rows. Do not attempt to parse them programmatically. Use the Statistics Canada WDS API instead.

**Public Accounts accumulated deficit CSV** (supplementary, annual FY 2007–2025):
```
https://donnees-data.tpsgc-pwgsc.gc.ca/ba1/revenuesdeficit/revenuesdeficit-2025.csv
```
This is a verified live URL (HTTP 200, last modified 2025-11-07) from Public Works and Government Services Canada.

---

## Schema Requirements

### New Table: `fiscal_snapshots`

The national debt data (from Statistics Canada) must be stored in the database rather than fetched live on every page load. A small new table in `packages/db/src/schema/raw.ts` is required:

```typescript
// National debt snapshots from Statistics Canada table 10-10-0002-01
// Source: https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1010000201
export const fiscalSnapshots = pgTable('fiscal_snapshots', {
  id: text('id').primaryKey(),               // deterministic: SHA256(series + ref_date)
  series: text('series').notNull(),          // 'federal_net_debt' | 'accumulated_deficit' | 'gross_liabilities'
  refDate: date('ref_date').notNull(),       // YYYY-MM-01 — first of month per StatsCan convention
  valueMillionsCad: numeric('value_millions_cad', { precision: 15, scale: 2 }),
  sourceTable: text('source_table').notNull(),  // '10-10-0002-01'
  sourceUrl: text('source_url').notNull(),
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('fiscal_snapshots_series_date_idx').on(t.series, t.refDate),
  index('fiscal_snapshots_ref_date_idx').on(t.refDate),
])
```

**Why annual is enough for the timeline:** The chart shows annual ticks (one data point per year). Monthly granularity from StatsCan is fine — aggregate to year-end (March 31 for fiscal year, or December for calendar year) in the query.

**Migration needed:** Yes — one new Drizzle migration.

**Ingestion runner needed:** Yes — a simple `ingest-fiscal.ts` runner that calls the StatsCan WDS API, parses the ZIP/CSV, and upserts into `fiscal_snapshots`. Runs annually (or on demand). Estimated < 100 lines.

---

## Canadian Federal Election Dates

Verified from Wikipedia List of Canadian Federal General Elections (confirmed against Elections Canada official records):

```typescript
// Hardcode these — they never change and Elections Canada has no machine-readable API
export const FEDERAL_ELECTION_DATES = [
  { election: '35th', date: '1993-10-25', year: 1993, winner: 'Liberal' },
  { election: '36th', date: '1997-06-02', year: 1997, winner: 'Liberal' },
  { election: '37th', date: '2000-11-27', year: 2000, winner: 'Liberal' },
  { election: '38th', date: '2004-06-28', year: 2004, winner: 'Liberal' },
  { election: '39th', date: '2006-01-23', year: 2006, winner: 'Conservative' },
  { election: '40th', date: '2008-10-14', year: 2008, winner: 'Conservative' },
  { election: '41st', date: '2011-05-02', year: 2011, winner: 'Conservative' },
  { election: '42nd', date: '2015-10-19', year: 2015, winner: 'Liberal' },
  { election: '43rd', date: '2019-10-21', year: 2019, winner: 'Liberal' },
  { election: '44th', date: '2021-09-20', year: 2021, winner: 'Liberal' },
  { election: '45th', date: '2025-04-28', year: 2025, winner: 'Liberal' },
] as const
```

**Finding:** There is no machine-readable Elections Canada API for historical election dates. The correct approach is to hardcode the list — it is immutable historical data. The dashboard covers ~1993–present (30 years), which is 11 elections. New elections happen at most every 4 years; a code update is the right mechanism, not a database lookup.

**Source:** Wikipedia "List of Canadian federal general elections" (verified against Elections Canada Past Elections page: https://www.elections.ca/content.aspx?section=ele&dir=pas&document=index&lang=e)

---

## Architecture Patterns

### Recommended Route Structure

```
apps/web/src/routes/
└── dashboard.tsx              # New standalone page route

apps/web/src/components/
└── dashboard/
    ├── DebtVsAidChart.tsx     # Primary D3 dual-series time-series chart
    ├── DepartmentBreakdown.tsx # Bar/treemap of dept spending (CSS bars, no D3 needed)
    └── DebtHeroStats.tsx      # Big number cards: current debt, total aid, ratio

apps/web/src/server-fns/
└── dashboard.ts               # Server functions: getDebtTimeline, getAidByYear, getDeptBreakdown

apps/ingestion/src/
├── downloaders/fiscal.ts      # Fetch StatsCan WDS ZIP, extract CSV
├── parsers/fiscal.ts          # Parse StatsCan CSV format → FiscalSnapshot rows
├── upsert/fiscal.ts           # Drizzle upsert into fiscal_snapshots
└── runners/ingest-fiscal.ts   # Orchestrator (mirrors ingest-international-aid.ts pattern)
```

### Pattern 1: D3 Dual-Series Time-Series (DebtVsAidChart)

The project's established pattern is "D3 for math, React for rendering" from `NetworkGraph.tsx`. The same pattern applies here. D3 computes scales, axes, and line generators; React renders `<svg>` elements.

**Scale approach — important design decision:**
Debt (~$1 trillion) and aid (~$7–12 billion) differ by ~100x. Two options:

1. **Dual y-axis** (left = debt, right = aid): Technically simple with `d3.scaleLinear()` for each. Risk: visually implies the scales are comparable, which is misleading for a civic audience.
2. **Single left axis (debt) + aid as % of debt on right axis**: More honest. Ratio story — "aid is 0.7% of the debt" — is more impactful than parallel lines. Recommended for the "grandpa test" UX vision.

For the MVP, **dual y-axis** is acceptable and faster to implement. The planner should note the alternative for a future iteration.

```typescript
// Source: existing NetworkGraph.tsx pattern — D3 math, React SVG render
// In DebtVsAidChart.tsx:

const xScale = d3.scaleTime()
  .domain([new Date('1993-01-01'), new Date()])
  .range([margin.left, width - margin.right])

const yDebt = d3.scaleLinear()
  .domain([0, d3.max(data, d => d.debtBillions) ?? 1200])
  .range([height - margin.bottom, margin.top])

const yAid = d3.scaleLinear()
  .domain([0, d3.max(data, d => d.aidBillions) ?? 15])
  .range([height - margin.bottom, margin.top])

const debtLine = d3.line<DataPoint>()
  .x(d => xScale(new Date(d.year, 0)))
  .y(d => yDebt(d.debtBillions))

const aidLine = d3.line<DataPoint>()
  .x(d => xScale(new Date(d.year, 0)))
  .y(d => yAid(d.aidBillions))

// Election markers: vertical <line> elements
// {FEDERAL_ELECTION_DATES.map(e => (
//   <line key={e.year}
//     x1={xScale(new Date(e.date))} x2={xScale(new Date(e.date))}
//     y1={margin.top} y2={height - margin.bottom}
//     stroke="var(--muted-foreground)" strokeDasharray="4,2" strokeWidth={1} />
// ))}
```

**No `d3.select` or `.append()` inside React components** — project rule (see CLAUDE.md). Use `useRef` for the SVG container and `useResizeObserver` from the shared utility already in the codebase.

### Pattern 2: Department Breakdown (DepartmentBreakdown)

Use shadcn/ui Progress bars or simple CSS `width` style, not D3, for the department breakdown table (DEBT-03). This mirrors how `MoneyFlowSankey.tsx` renders its bars with `style={{ width: \`${pct}%\` }}`. D3 is overkill for a ranked list with percentage bars.

### Pattern 3: Server Function Data Shape

Mirror `stats.ts` and `visualizations.ts` patterns — `createServerFn` with `inputValidator` (Zod), return typed objects.

```typescript
// apps/web/src/server-fns/dashboard.ts
export type DebtAidDataPoint = {
  year: number
  debtBillionsCad: number       // from fiscal_snapshots, converted from millions
  aidCommittedBillionsCad: number  // from international_aid aggregate
  aidDisbursedBillionsCad: number
  sourceDebtUrl: string
  sourceAidUrl: string
}

export type DeptSpendingRow = {
  department: string
  totalCommittedCad: number
  projectCount: number
  pctOfTotal: number
}
```

---

## Standard Stack

### Core (all already in the project)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `d3` | 7.9.0 (confirmed in web package.json) | Scales, line generators, axes, time helpers | Already installed; use `d3.scaleLinear`, `d3.scaleTime`, `d3.line` |
| `drizzle-orm` | 0.45.x (catalog) | New `fiscal_snapshots` table + aggregation queries | Existing schema pattern |
| `@tanstack/react-start` | 1.167.x | New `/dashboard` route + server functions | Existing router pattern |
| `zod` | 3.24.x (catalog) | Server function input validation | Existing pattern |
| `adm-zip` | 0.5.10 (catalog) | Unzip Statistics Canada CSV download | Already in catalog — used in existing ingestion |

### New Dependencies Required
None. All required libraries are already installed or in the pnpm catalog.

### Installation
No new packages. The `adm-zip` package already in the pnpm catalog handles the Statistics Canada ZIP extraction.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ZIP extraction from StatsCan WDS | Custom stream unzipper | `adm-zip` (already in catalog) | Already used in ingestion pipeline; handles the specific ZIP format StatsCan uses |
| Percentage-bar department breakdown | D3 bar chart | CSS `width` style (% of max) | `MoneyFlowSankey.tsx` already has this pattern working |
| CSV parsing for fiscal data | Manual string split | Node built-in `readline` or `papaparse` (already in catalog) | StatsCan CSVs have a standard format; papaparse is already available |
| Responsive SVG width | `window.addEventListener('resize')` | `useResizeObserver` hook already in `visualizations/shared/` | Project has this utility; use it |
| Election date lookup | Database table + query | Hardcoded TypeScript constant | Data is immutable historical fact; database lookup adds complexity with no benefit |

---

## Common Pitfalls

### Pitfall 1: StatsCan CSV Coordinate System
**What goes wrong:** The full-table CSV from `10100002` contains all 29 series interleaved in long format. If you naively read it, you get rows for "Accounts payable", "Pension assets", etc. mixed with the debt headline.

**Why it happens:** Statistics Canada uses a long/tidy format — one row per series per date. The `Central government debt` column contains the series name (e.g., "A. Federal debt (accumulated deficit)").

**How to avoid:** Filter on the series name string after parsing:
```typescript
rows.filter(r => r['Central government debt'] === 'A. Federal debt (accumulated deficit)')
```

**Warning signs:** If your aggregate shows implausibly high debt figures, you've summed multiple series.

### Pitfall 2: Scale Mismatch Misleads Users
**What goes wrong:** Dual y-axis chart makes it look like debt and aid are similar in magnitude when debt is ~100x larger.

**Why it happens:** D3 scales each axis to its own domain, hiding the ratio.

**How to avoid:** Either add a clear annotation ("Aid is ~0.7% of the national debt") as a hero stat, or show aid as a percentage of debt. At minimum label both axes clearly and add a callout card on the page.

### Pitfall 3: IATI Fiscal Year vs Calendar Year Mismatch
**What goes wrong:** Global Affairs uses April–March fiscal years. `start_date` in `international_aid` anchors to calendar year. For FY 2023–24 ($12.29B), the IATI aggregate by calendar year will split this across 2023 and 2024.

**Why it happens:** IATI records project start dates, not disbursement-period boundaries.

**How to avoid:** For the chart, use calendar year grouping (consistent with debt data) and add a footnote: "Aid figures show project start year; Government of Canada uses April–March fiscal year." Do not attempt to remap IATI records to fiscal years — too complex for the MVP.

### Pitfall 4: StatsCan Monthly vs Annual Alignment
**What goes wrong:** The `10100002` series is monthly. The chart x-axis is annual. If you plot March data for most years but the latest year has only January data, the chart shows a dip at the end.

**Why it happens:** Data is released with a 2-month lag (e.g., in April 2026, the latest data is February 2026).

**How to avoid:** When aggregating to annual, take the December value as the year-end snapshot — or the latest available month for the current year. Flag the current year value visually ("projected / partial year").

### Pitfall 5: D3 `d3.select` Inside React Component
**What goes wrong:** Using `d3.select(svgRef.current).append('g')` inside a React component causes D3 and React to fight over the DOM, leading to duplicate elements on re-renders.

**Why it happens:** The existing codebase documents this in `NetworkGraph.tsx` comments.

**How to avoid:** Follow the existing pattern: use D3 only for `.zoom()` behavior (which requires `d3.select`) and for math (`d3.line`, `d3.scaleLinear`, etc.). Render all SVG elements via React JSX.

### Pitfall 6: Zero Aid for Early Years in Timeline
**What goes wrong:** The IATI data from Phase 5 only covers projects that are current or recently closed. Projects from the 1990s or early 2000s may not be in the dataset.

**Why it happens:** Global Affairs Canada's IATI files cover active and recently-closed projects; historical projects before ~2010 may have gaps.

**How to avoid:** Start the timeline at the year of the earliest IATI record in the database, not at 1993. Query `MIN(start_date)` from `international_aid` and use that as the chart's left boundary. Add a footnote about data coverage.

---

## Code Examples

### Fetching StatsCan WDS CSV (Fiscal Ingestion)
```typescript
// Source: adm-zip pattern from existing ingestion; WDS API confirmed live 2026-04-04
import AdmZip from 'adm-zip'

async function fetchStatCanTable(tableId: string): Promise<string> {
  // Step 1: Get the ZIP URL from the WDS envelope
  const wdsUrl = `https://www150.statcan.gc.ca/t1/wds/rest/getFullTableDownloadCSV/${tableId}/en`
  const envelopeRes = await fetch(wdsUrl)
  const envelope = await envelopeRes.json() as { status: string; object: string }
  if (envelope.status !== 'SUCCESS') throw new Error(`WDS failed for table ${tableId}`)

  // Step 2: Download the ZIP
  const zipRes = await fetch(envelope.object)
  const zipBuffer = Buffer.from(await zipRes.arrayBuffer())

  // Step 3: Extract the data CSV (not the metadata CSV)
  const zip = new AdmZip(zipBuffer)
  const dataEntry = zip.getEntries().find(e => e.entryName.endsWith('-eng.csv') && !e.entryName.includes('_MetaData'))
  if (!dataEntry) throw new Error('Data CSV not found in StatsCan ZIP')

  return dataEntry.getData().toString('utf8')
}
```

### Aggregating Aid by Year (Server Function)
```typescript
// Source: Drizzle ORM patterns from existing server-fns/stats.ts
import { sql } from 'drizzle-orm'
import { internationalAid } from '@govtrace/db/schema/raw'

const aidByYear = await db
  .select({
    year: sql<number>`EXTRACT(YEAR FROM ${internationalAid.startDate})::int`,
    committedBillions: sql<number>`ROUND(SUM(${internationalAid.totalCommittedCad}) / 1e9, 3)`,
    disbursedBillions: sql<number>`ROUND(SUM(${internationalAid.totalDisbursedCad}) / 1e9, 3)`,
  })
  .from(internationalAid)
  .where(sql`${internationalAid.startDate} IS NOT NULL`)
  .groupBy(sql`EXTRACT(YEAR FROM ${internationalAid.startDate})`)
  .orderBy(sql`EXTRACT(YEAR FROM ${internationalAid.startDate})`)
```

### D3 Line Generator + React SVG Render (DebtVsAidChart Pattern)
```typescript
// Source: NetworkGraph.tsx established pattern — D3 math, React renders
import * as d3 from 'd3'
import { useRef } from 'react'
import { useResizeObserver } from '@/components/visualizations/shared/useResizeObserver'

// Inside component:
const containerRef = useRef<HTMLDivElement>(null)
const { width } = useResizeObserver(containerRef)

const margin = { top: 20, right: 60, bottom: 40, left: 80 }
const height = 400

const xScale = d3.scaleTime()
  .domain(d3.extent(data, d => new Date(d.year, 0, 1)) as [Date, Date])
  .range([margin.left, width - margin.right])

const yDebt = d3.scaleLinear()
  .domain([0, d3.max(data, d => d.debtBillionsCad) ?? 1200])
  .nice()
  .range([height - margin.bottom, margin.top])

const debtLineFn = d3.line<DebtAidDataPoint>()
  .x(d => xScale(new Date(d.year, 0, 1)))
  .y(d => yDebt(d.debtBillionsCad))
  .curve(d3.curveMonotoneX)

// React render:
return (
  <div ref={containerRef} className="w-full">
    {width > 0 && (
      <svg width={width} height={height} role="img" aria-label="National debt vs overseas aid">
        <path d={debtLineFn(data) ?? ''} fill="none" stroke="var(--destructive)" strokeWidth={2} />
        {/* Election markers */}
        {FEDERAL_ELECTION_DATES.map(e => (
          <line
            key={e.year}
            x1={xScale(new Date(e.date))}
            x2={xScale(new Date(e.date))}
            y1={margin.top}
            y2={height - margin.bottom}
            stroke="var(--muted-foreground)"
            strokeDasharray="4,2"
            strokeWidth={1}
          />
        ))}
      </svg>
    )}
  </div>
)
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Scraping Fiscal Monitor PDFs | Stats Canada WDS REST API | WDS provides structured CSV; PDF scraping is brittle and unnecessary |
| Recharts / Victory for charts | D3 + React SVG (project standard) | Project already established this; don't introduce a chart library for one page |
| Dual y-axis as default | Annotated ratio callout preferred | Expert civic dataviz guidance; implementable in MVP via hero stat card |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Statistics Canada WDS API | National debt ingestion | Yes (verified live 2026-04-04) | Public REST API | None needed |
| `adm-zip` | ZIP extraction | Yes (in pnpm catalog 0.5.10) | 0.5.10 | None needed |
| `d3` v7 | Chart rendering | Yes (in apps/web package.json) | 7.9.0 | None needed |
| `papaparse` | CSV parsing (StatsCan) | Yes (in pnpm catalog 5.x) | 5.4.1 | Node `readline` module |
| Public accounts CSV host | Supplementary source link | Yes (HTTP 200 verified) | — | Use Fiscal Monitor page URL |

**No blocking missing dependencies.**

---

## Open Questions

1. **IATI data coverage start year**
   - What we know: Phase 5 ingested active + recently-closed projects. Global Affairs started publishing IATI in October 2012.
   - What's unclear: What is the earliest `start_date` in the `international_aid` table after Phase 5 completes?
   - Recommendation: Query `SELECT MIN(start_date) FROM international_aid` after Phase 5 ingestion is confirmed complete. Set chart left boundary dynamically.

2. **National debt chart start year**
   - What we know: `10100002` covers from September 2009. The archived `10100048` covers 1867–2008.
   - What's unclear: Does the planner want to stitch both tables for a longer historical view?
   - Recommendation: For Phase 6 MVP, use `10100002` only (2009–present), which covers 4 election cycles (2011, 2015, 2019, 2021, 2025). This is sufficient for the stated goal. The 1993–2008 period can be added later via `10100048` as a separate migration.

3. **Fiscal snapshot refresh cadence**
   - What we know: StatsCan releases monthly with 2-month lag.
   - What's unclear: Should the fiscal ingestion run monthly alongside the existing weekly pipeline, or only on-demand?
   - Recommendation: Add as a monthly pg-boss scheduled job — much lower frequency than the weekly CSV jobs. One additional `ingest-fiscal` job type.

---

## Sources

### Primary (HIGH confidence)
- Statistics Canada WDS API live test (2026-04-04) — confirmed `getFullTableDownloadCSV/10100002/en` returns valid ZIP URL
- `https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1010000201` — Central government debt table metadata
- `https://www.statcan.gc.ca/en/developers/wds/user-guide` — WDS API endpoint documentation
- `https://donnees-data.tpsgc-pwgsc.gc.ca/ba1/revenuesdeficit/revenuesdeficit-2025.csv` — HTTP 200 live, last modified 2025-11-07
- `https://open.canada.ca/data/en/dataset/2db72da5-23c0-4c7b-87d0-a88da0e5c59c` — Project Browser Data Set (Global Affairs HPDS)
- Wikipedia "List of Canadian federal general elections" — election dates confirmed against Elections Canada
- `/apps/web/src/components/visualizations/NetworkGraph.tsx` — established D3 + React pattern in codebase
- `/packages/db/src/schema/raw.ts` — confirmed `international_aid.funding_department` and `start_date` columns exist

### Secondary (MEDIUM confidence)
- `https://international.canada.ca/en/global-affairs/corporate/reports/international-assistance-data/statistical-report-2023-2024` — $12.29B FY 2023–24 confirmed as spot-check
- Statistics Canada Q4 2025 government finance statistics release — federal net debt $1,010.2B confirmed

### Tertiary (LOW confidence)
- WebSearch results for Fiscal Reference Tables Excel download — search reported XLS format but could not verify direct URL (403 on page)

---

## Metadata

**Confidence breakdown:**
- Data sources (Stats Canada API, IATI SQL): HIGH — live-verified URLs, confirmed data fields exist
- Election dates: HIGH — immutable historical data, confirmed from two sources
- D3 chart pattern: HIGH — derived from existing codebase (NetworkGraph.tsx), not guesswork
- Schema design: HIGH — follows established table patterns in raw.ts
- Aid annual aggregate accuracy: MEDIUM — IATI project-level timing differs from fiscal-year disbursement reporting; acceptable for civic dashboard with disclosure

**Research date:** 2026-04-04
**Valid until:** 2026-10-01 (StatsCan WDS API is stable; aid data grows incrementally; election dates are fixed)
