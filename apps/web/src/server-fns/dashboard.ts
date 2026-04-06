import { createServerFn } from '@tanstack/react-start'
import { sql, sum, count, desc, isNotNull, and, ne } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { fiscalSnapshots, internationalAid } from '@govtrace/db/schema/raw'

export type DebtAidDataPoint = {
  year: number
  debtBillionsCad: number
  aidCommittedBillionsCad: number
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
  debtAsOf: string
  sourceDebtUrl: string
  sourceAidUrl: string
}

const DEBT_SOURCE_URL =
  'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1010000201'
const AID_SOURCE_URL =
  'https://international.canada.ca/en/global-affairs/corporate/reports/international-assistance-data'

// ---------------------------------------------------------------------------
// getDebtTimeline — DEBT-01, DEBT-02
// ---------------------------------------------------------------------------

export const getDebtTimeline = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DebtAidDataPoint[]> => {
    const db = getDb()

    // Debt by year — DISTINCT ON needs raw SQL (Drizzle doesn't support it)
    const debtByYear = await db.execute<{ year: number; debt_millions: string }>(
      sql`SELECT DISTINCT ON (EXTRACT(YEAR FROM ref_date))
        EXTRACT(YEAR FROM ref_date)::int AS year,
        value_millions_cad::text AS debt_millions
      FROM fiscal_snapshots
      WHERE series = 'accumulated_deficit' AND value_millions_cad IS NOT NULL
      ORDER BY EXTRACT(YEAR FROM ref_date), ref_date DESC`,
    )

    // Aid by year — Drizzle ORM
    const aidByYear = await db
      .select({
        year: sql<number>`EXTRACT(YEAR FROM ${internationalAid.startDate})::int`,
        committedBillions: sql<number>`ROUND(SUM(${internationalAid.totalCommittedCad}) / 1e9, 3)`,
        disbursedBillions: sql<number>`ROUND(SUM(${internationalAid.totalDisbursedCad}) / 1e9, 3)`,
      })
      .from(internationalAid)
      .where(isNotNull(internationalAid.startDate))
      .groupBy(sql`EXTRACT(YEAR FROM ${internationalAid.startDate})`)
      .orderBy(sql`EXTRACT(YEAR FROM ${internationalAid.startDate})`)

    const aidMap = new Map<number, { committed: number; disbursed: number }>()
    for (const row of aidByYear) {
      aidMap.set(row.year, {
        committed: Number(row.committedBillions ?? 0),
        disbursed: Number(row.disbursedBillions ?? 0),
      })
    }

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
// getDepartmentBreakdown — DEBT-03 (pure Drizzle ORM)
// ---------------------------------------------------------------------------

export const getDepartmentBreakdown = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DeptSpendingRow[]> => {
    const db = getDb()

    const rows = await db
      .select({
        department: internationalAid.fundingDepartment,
        totalCommitted: sum(internationalAid.totalCommittedCad),
        totalDisbursed: sum(internationalAid.totalDisbursedCad),
        projectCount: count(),
      })
      .from(internationalAid)
      .where(isNotNull(internationalAid.fundingDepartment))
      .groupBy(internationalAid.fundingDepartment)
      .orderBy(desc(sum(internationalAid.totalCommittedCad)))

    const grandTotal = rows.reduce(
      (s, r) => s + Number(r.totalCommitted ?? 0),
      0,
    )

    return rows.map((r) => {
      const committed = Number(r.totalCommitted ?? 0)
      return {
        department: r.department ?? '',
        totalCommittedCad: committed,
        totalDisbursedCad: Number(r.totalDisbursed ?? 0),
        projectCount: Number(r.projectCount),
        pctOfTotal: grandTotal > 0 ? Math.round((committed / grandTotal) * 10000) / 100 : 0,
      }
    })
  },
)

// ---------------------------------------------------------------------------
// getDebtHeroStats — DEBT-01, DEBT-04 (pure Drizzle ORM)
// ---------------------------------------------------------------------------

export const getDebtHeroStats = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DebtHeroStats> => {
    const db = getDb()

    const latestDebt = await db
      .select({
        valueMillions: fiscalSnapshots.valueMillionsCad,
        refDate: fiscalSnapshots.refDate,
      })
      .from(fiscalSnapshots)
      .where(
        and(
          sql`${fiscalSnapshots.series} = 'accumulated_deficit'`,
          isNotNull(fiscalSnapshots.valueMillionsCad),
        ),
      )
      .orderBy(desc(fiscalSnapshots.refDate))
      .limit(1)

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
