import { createServerFn } from '@tanstack/react-start'
import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { fiscalSnapshots, internationalAid } from '@govtrace/db/schema/raw'

// ---------------------------------------------------------------------------
// Exported response types (consumed by Plan 02 dashboard UI components)
// ---------------------------------------------------------------------------

export type DebtAidDataPoint = {
  year: number
  debtBillionsCad: number // converted from millions stored in fiscal_snapshots
  aidCommittedBillionsCad: number // annual SUM from international_aid
  aidDisbursedBillionsCad: number
  sourceDebtUrl: string
  sourceAidUrl: string
}

export type DeptSpendingRow = {
  department: string
  totalCommittedCad: number
  totalDisbursedCad: number
  projectCount: number
  pctOfTotal: number
}

export type DebtHeroStats = {
  currentDebtBillions: number
  totalAidBillions: number
  aidAsPercentOfDebt: number
  debtAsOf: string // ISO date string of the most recent fiscal snapshot
  sourceDebtUrl: string
  sourceAidUrl: string
}

// ---------------------------------------------------------------------------
// Source URLs (for DEBT-04 traceability)
// ---------------------------------------------------------------------------

const DEBT_SOURCE_URL =
  'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1010000201'
const AID_SOURCE_URL =
  'https://international.canada.ca/en/global-affairs/corporate/reports/international-assistance-data'

// ---------------------------------------------------------------------------
// getDebtTimeline — annual debt + aid data points for the chart (DEBT-01, DEBT-02)
// Queries December (or latest available month) per year for debt data.
// Joins by calendar year with IATI aid aggregates.
// ---------------------------------------------------------------------------

export const getDebtTimeline = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DebtAidDataPoint[]> => {
    const db = getDb()

    // Annual debt: pick the latest month per year using DISTINCT ON
    const debtByYear = await db.execute<{ year: number; debt_millions: string }>(sql`
      SELECT DISTINCT ON (EXTRACT(YEAR FROM ref_date))
        EXTRACT(YEAR FROM ref_date)::int AS year,
        value_millions_cad::text AS debt_millions
      FROM fiscal_snapshots
      WHERE series = 'accumulated_deficit'
        AND value_millions_cad IS NOT NULL
      ORDER BY EXTRACT(YEAR FROM ref_date), ref_date DESC
    `)

    // Annual aid aggregates from international_aid
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

    // Build aid lookup map
    const aidMap = new Map<number, { committed: number; disbursed: number }>()
    for (const row of aidByYear) {
      aidMap.set(row.year, {
        committed: Number(row.committedBillions ?? 0),
        disbursed: Number(row.disbursedBillions ?? 0),
      })
    }

    // Join by year — exclude current year (incomplete data causes misleading drop)
    const currentYear = new Date().getFullYear()
    const debtRows = Array.from(debtByYear) as Array<{ year: number; debt_millions: string }>
    const results: DebtAidDataPoint[] = []
    for (const debt of debtRows) {
      if (debt.year >= currentYear) continue
      const aid = aidMap.get(debt.year) ?? { committed: 0, disbursed: 0 }
      results.push({
        year: debt.year,
        debtBillionsCad: Number(debt.debt_millions ?? 0) / 1000,
        aidCommittedBillionsCad: aid.committed,
        aidDisbursedBillionsCad: aid.disbursed,
        sourceDebtUrl: DEBT_SOURCE_URL,
        sourceAidUrl: AID_SOURCE_URL,
      })
    }

    return results
  },
)

// ---------------------------------------------------------------------------
// getDepartmentBreakdown — department spending ranked list (DEBT-03)
// ---------------------------------------------------------------------------

export const getDepartmentBreakdown = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DeptSpendingRow[]> => {
    const db = getDb()

    type DeptRow = {
      department: string
      totalCommitted: string | null
      totalDisbursed: string | null
      projectCount: string
    }

    const rows = await db.execute(sql.raw(`
      SELECT
        funding_department AS department,
        SUM(total_committed_cad)::text AS "totalCommitted",
        SUM(total_disbursed_cad)::text AS "totalDisbursed",
        COUNT(*)::text AS "projectCount"
      FROM international_aid
      WHERE funding_department IS NOT NULL
      GROUP BY funding_department
      ORDER BY SUM(total_committed_cad) DESC NULLS LAST
    `)) as unknown as DeptRow[]

    const deptRows = Array.from(rows)

    // Compute grand total for percentage calculation
    const grandTotal = deptRows.reduce(
      (sum, r) => sum + Number(r.totalCommitted ?? 0),
      0,
    )

    return deptRows.map((r) => {
      const committed = Number(r.totalCommitted ?? 0)
      return {
        department: r.department,
        totalCommittedCad: committed,
        totalDisbursedCad: Number(r.totalDisbursed ?? 0),
        projectCount: Number(r.projectCount),
        pctOfTotal: grandTotal > 0 ? Math.round((committed / grandTotal) * 10000) / 100 : 0,
      }
    })
  },
)

// ---------------------------------------------------------------------------
// getDebtHeroStats — headline numbers for hero cards (DEBT-01, DEBT-04)
// ---------------------------------------------------------------------------

export const getDebtHeroStats = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DebtHeroStats> => {
    const db = getDb()

    // Latest accumulated deficit snapshot
    const latestDebt = await db
      .select({
        valueMillions: fiscalSnapshots.valueMillionsCad,
        refDate: fiscalSnapshots.refDate,
      })
      .from(fiscalSnapshots)
      .where(
        sql`${fiscalSnapshots.series} = 'accumulated_deficit'
          AND ${fiscalSnapshots.valueMillionsCad} IS NOT NULL`,
      )
      .orderBy(sql`${fiscalSnapshots.refDate} DESC`)
      .limit(1)

    // Total all-time aid committed
    const totalAid = await db
      .select({
        totalBillions: sql<number>`ROUND(SUM(${internationalAid.totalCommittedCad}) / 1e9, 3)`,
      })
      .from(internationalAid)

    const debtMillions = Number(latestDebt[0]?.valueMillions ?? 0)
    const debtBillions = debtMillions / 1000
    const aidBillions = Number(totalAid[0]?.totalBillions ?? 0)
    const aidAsPercent =
      debtBillions > 0 ? Math.round((aidBillions / debtBillions) * 10000) / 100 : 0

    return {
      currentDebtBillions: debtBillions,
      totalAidBillions: aidBillions,
      aidAsPercentOfDebt: aidAsPercent,
      debtAsOf: latestDebt[0]?.refDate ?? '',
      sourceDebtUrl: DEBT_SOURCE_URL,
      sourceAidUrl: AID_SOURCE_URL,
    }
  },
)
