import { createServerFn } from '@tanstack/react-start'
import { sql, sum, count, desc, isNotNull, and, eq, ilike, or } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '@govtrace/db/client'
import { fiscalSnapshots, internationalAid, departmentExpenditures, pressReleases } from '@govtrace/db/schema/raw'
import { cached } from '@/lib/cache'
import { getCountryName, getSectorTheme } from '@/lib/country-codes'

// ---------------------------------------------------------------------------
// TopRecipientWithConnections — top contractors and grant recipients w/ connection counts
// ---------------------------------------------------------------------------

export type TopRecipientWithConnections = {
  name: string
  entityId: string
  type: 'contractor' | 'grant_recipient'
  totalValue: number
  recordCount: number
  lobbyingCount: number
  donationCount: number
}

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

export type CountrySpendingRow = {
  countryCode: string
  countryName: string
  totalCommittedCad: number
  totalDisbursedCad: number
  projectCount: number
  pctOfTotal: number
}

export type SectorSpendingRow = {
  theme: string
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
  (): Promise<DebtAidDataPoint[]> => cached('debt-timeline', async () => {
    const db = getDb()

    // Debt by year — max value per year (latest month's reading)
    const debtByYear = await db
      .select({
        year: sql`EXTRACT(YEAR FROM ${fiscalSnapshots.refDate})`,
        debtMillions: sql`MAX(${fiscalSnapshots.valueMillionsCad})`,
      })
      .from(fiscalSnapshots)
      .where(
        and(
          sql`${fiscalSnapshots.series} = 'accumulated_deficit'`,
          isNotNull(fiscalSnapshots.valueMillionsCad),
        ),
      )
      .groupBy(sql`EXTRACT(YEAR FROM ${fiscalSnapshots.refDate})`)
      .orderBy(sql`EXTRACT(YEAR FROM ${fiscalSnapshots.refDate})`)

    // Aid by year
    const aidByYear = await db
      .select({
        year: sql`EXTRACT(YEAR FROM ${internationalAid.startDate})`,
        committed: sql`ROUND(SUM(${internationalAid.totalCommittedCad}) / 1e9, 3)`,
        disbursed: sql`ROUND(SUM(${internationalAid.totalDisbursedCad}) / 1e9, 3)`,
      })
      .from(internationalAid)
      .where(isNotNull(internationalAid.startDate))
      .groupBy(sql`EXTRACT(YEAR FROM ${internationalAid.startDate})`)
      .orderBy(sql`EXTRACT(YEAR FROM ${internationalAid.startDate})`)

    // Build aid lookup
    const aidMap = new Map<number, { committed: number; disbursed: number }>()
    for (const row of aidByYear) {
      const yr = Number(row.year)
      aidMap.set(yr, {
        committed: Number(row.committed ?? 0),
        disbursed: Number(row.disbursed ?? 0),
      })
    }

    // Join by year — exclude current year (incomplete data)
    const currentYear = new Date().getFullYear()
    const results: DebtAidDataPoint[] = []
    for (const debt of debtByYear) {
      const yr = Number(debt.year)
      if (yr >= currentYear) continue
      const aid = aidMap.get(yr) ?? { committed: 0, disbursed: 0 }
      results.push({
        year: yr,
        debtBillionsCad: Number(debt.debtMillions ?? 0) / 1000,
        aidCommittedBillionsCad: aid.committed,
        aidDisbursedBillionsCad: aid.disbursed,
        sourceDebtUrl: DEBT_SOURCE_URL,
        sourceAidUrl: AID_SOURCE_URL,
      })
    }

    return results
  }),
)

// ---------------------------------------------------------------------------
// getDepartmentBreakdown — DEBT-03
// ---------------------------------------------------------------------------

export const getDepartmentBreakdown = createServerFn({ method: 'GET' }).handler(
  (): Promise<DeptSpendingRow[]> => cached('dept-breakdown', async () => {
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
  }),
)

// ---------------------------------------------------------------------------
// getDebtHeroStats — DEBT-01, DEBT-04
// ---------------------------------------------------------------------------

export const getDebtHeroStats = createServerFn({ method: 'GET' }).handler(
  (): Promise<DebtHeroStats> => cached('debt-hero-stats', async () => {
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
        total: sql`ROUND(SUM(${internationalAid.totalCommittedCad}) / 1e9, 3)`,
      })
      .from(internationalAid)

    const debtMillions = Number(latestDebt[0]?.valueMillions ?? 0)
    const debtBillions = debtMillions / 1000
    const aidBillions = Number(totalAid[0]?.total ?? 0)
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
  }),
)

// ---------------------------------------------------------------------------
// getCountryBreakdown — where does Canadian aid go by recipient country?
// ---------------------------------------------------------------------------

export const getCountryBreakdown = createServerFn({ method: 'GET' }).handler(
  (): Promise<CountrySpendingRow[]> => cached('country-breakdown', async () => {
    const db = getDb()

    const rows = await db
      .select({
        recipientCountry: internationalAid.recipientCountry,
        totalCommitted: sum(internationalAid.totalCommittedCad),
        totalDisbursed: sum(internationalAid.totalDisbursedCad),
        projectCount: count(),
      })
      .from(internationalAid)
      .where(isNotNull(internationalAid.recipientCountry))
      .groupBy(internationalAid.recipientCountry)
      .orderBy(desc(sum(internationalAid.totalCommittedCad)))

    const grandTotal = rows.reduce(
      (s, r) => s + Number(r.totalCommitted ?? 0),
      0,
    )

    return rows.map((r) => {
      const code = r.recipientCountry ?? ''
      const committed = Number(r.totalCommitted ?? 0)
      return {
        countryCode: code,
        countryName: getCountryName(code),
        totalCommittedCad: committed,
        totalDisbursedCad: Number(r.totalDisbursed ?? 0),
        projectCount: Number(r.projectCount),
        pctOfTotal: grandTotal > 0 ? Math.round((committed / grandTotal) * 10000) / 100 : 0,
      }
    })
  }),
)

// ---------------------------------------------------------------------------
// getSectorBreakdown — which thematic areas does Canadian aid target?
// ---------------------------------------------------------------------------

export const getSectorBreakdown = createServerFn({ method: 'GET' }).handler(
  (): Promise<SectorSpendingRow[]> => cached('sector-breakdown', async () => {
    const db = getDb()

    const rows = await db
      .select({
        sectorCode: internationalAid.sectorCode,
        totalCommitted: sum(internationalAid.totalCommittedCad),
        totalDisbursed: sum(internationalAid.totalDisbursedCad),
        projectCount: count(),
      })
      .from(internationalAid)
      .where(isNotNull(internationalAid.sectorCode))
      .groupBy(internationalAid.sectorCode)
      .orderBy(desc(sum(internationalAid.totalCommittedCad)))

    // Merge rows with the same theme (multiple 5-digit codes can map to the same theme)
    const themeMap = new Map<
      string,
      { totalCommittedCad: number; totalDisbursedCad: number; projectCount: number }
    >()

    for (const r of rows) {
      const theme = getSectorTheme(r.sectorCode ?? '')
      const existing = themeMap.get(theme)
      if (existing) {
        existing.totalCommittedCad += Number(r.totalCommitted ?? 0)
        existing.totalDisbursedCad += Number(r.totalDisbursed ?? 0)
        existing.projectCount += Number(r.projectCount)
      } else {
        themeMap.set(theme, {
          totalCommittedCad: Number(r.totalCommitted ?? 0),
          totalDisbursedCad: Number(r.totalDisbursed ?? 0),
          projectCount: Number(r.projectCount),
        })
      }
    }

    const merged = Array.from(themeMap.entries())
      .map(([theme, values]) => ({ theme, ...values }))
      .sort((a, b) => b.totalCommittedCad - a.totalCommittedCad)

    const grandTotal = merged.reduce((s, r) => s + r.totalCommittedCad, 0)

    return merged.map((r) => ({
      ...r,
      pctOfTotal: grandTotal > 0 ? Math.round((r.totalCommittedCad / grandTotal) * 10000) / 100 : 0,
    }))
  }),
)

// ---------------------------------------------------------------------------
// CountryAidProjectRow — project record for the country drill-down page
// ---------------------------------------------------------------------------

export type CountryAidProjectRow = {
  id: string
  projectTitle: string | null
  description: string | null
  implementerName: string | null
  fundingDepartment: string | null
  activityStatus: string | null
  recipientCountry: string | null
  recipientRegion: string | null
  startDate: string | null
  endDate: string | null
  totalBudgetCad: string | null
  totalDisbursedCad: string | null
  totalCommittedCad: string | null
  currency: string | null
  rawData: unknown
}

export type CountryAidProjectsResult = {
  rows: CountryAidProjectRow[]
  total: number
  totalCommittedCad: number
  totalDisbursedCad: number
}

const CountryAidProjectsInputSchema = z.object({
  countryCode: z.string().min(2).max(3),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
})

// ---------------------------------------------------------------------------
// getCountryAidProjects — all projects for a specific recipient country
// ---------------------------------------------------------------------------

export const getCountryAidProjects = createServerFn({ method: 'GET' })
  .inputValidator(CountryAidProjectsInputSchema)
  .handler(async ({ data }): Promise<CountryAidProjectsResult> => {
    const { countryCode, search, page, pageSize } = data
    const offset = (page - 1) * pageSize

    const fetchData = async (): Promise<CountryAidProjectsResult> => {
      const db = getDb()

      const baseCondition = search
        ? and(
            eq(internationalAid.recipientCountry, countryCode),
            or(
              ilike(internationalAid.projectTitle, `%${search}%`),
              ilike(internationalAid.implementerName, `%${search}%`),
            ),
          )
        : eq(internationalAid.recipientCountry, countryCode)

      const [rows, totalsResult, countResult] = await Promise.all([
        db
          .select({
            id: internationalAid.id,
            projectTitle: internationalAid.projectTitle,
            description: internationalAid.description,
            implementerName: internationalAid.implementerName,
            fundingDepartment: internationalAid.fundingDepartment,
            activityStatus: internationalAid.activityStatus,
            recipientCountry: internationalAid.recipientCountry,
            recipientRegion: internationalAid.recipientRegion,
            startDate: internationalAid.startDate,
            endDate: internationalAid.endDate,
            totalBudgetCad: internationalAid.totalBudgetCad,
            totalDisbursedCad: internationalAid.totalDisbursedCad,
            totalCommittedCad: internationalAid.totalCommittedCad,
            currency: internationalAid.currency,
            rawData: internationalAid.rawData,
          })
          .from(internationalAid)
          .where(baseCondition)
          .orderBy(desc(internationalAid.totalCommittedCad))
          .limit(pageSize)
          .offset(offset),

        db
          .select({
            totalCommitted: sum(internationalAid.totalCommittedCad),
            totalDisbursed: sum(internationalAid.totalDisbursedCad),
          })
          .from(internationalAid)
          .where(baseCondition),

        db
          .select({ c: count() })
          .from(internationalAid)
          .where(baseCondition),
      ])

      return {
        rows: rows.map((r) => ({
          ...r,
          currency: r.currency ?? 'CAD',
        })),
        total: Number(countResult[0]?.c ?? 0),
        totalCommittedCad: Number(totalsResult[0]?.totalCommitted ?? 0),
        totalDisbursedCad: Number(totalsResult[0]?.totalDisbursed ?? 0),
      }
    }

    // Only cache non-search queries
    if (!search) {
      return cached(`country-aid-${countryCode}`, fetchData)
    }
    return fetchData()
  })

// ---------------------------------------------------------------------------
// SpendingCategoryRow — department_expenditures breakdown by standard object
// ---------------------------------------------------------------------------

export type SpendingCategoryRow = {
  category: string
  amount: number // dollars (can be negative for revenue categories)
}

// ---------------------------------------------------------------------------
// getSpendingByCategory — federal spending by standard object (latest fiscal year)
// ---------------------------------------------------------------------------

export const getSpendingByCategory = createServerFn({ method: 'GET' }).handler(
  (): Promise<SpendingCategoryRow[]> => cached('spending-by-category', async () => {
    const db = getDb()

    // Get latest fiscal year available
    const latestYearResult = await db
      .select({ fiscalYear: departmentExpenditures.fiscalYear })
      .from(departmentExpenditures)
      .orderBy(desc(departmentExpenditures.fiscalYear))
      .limit(1)

    const latestFiscalYear = latestYearResult[0]?.fiscalYear
    if (!latestFiscalYear) return []

    const rows = await db
      .select({
        standardObject: departmentExpenditures.standardObject,
        total: sum(departmentExpenditures.expenditures),
      })
      .from(departmentExpenditures)
      .where(sql`${departmentExpenditures.fiscalYear} = ${latestFiscalYear}`)
      .groupBy(departmentExpenditures.standardObject)
      .orderBy(desc(sum(departmentExpenditures.expenditures)))

    return rows.map((r) => ({
      category: r.standardObject ?? '',
      amount: Number(r.total ?? 0),
    }))
  }),
)

// ---------------------------------------------------------------------------
// RecentSpendingAnnouncement — press releases with dollar amounts
// ---------------------------------------------------------------------------

export type RecentSpendingAnnouncement = {
  id: string
  title: string
  url: string
  publishedDate: string
  department: string
  dollarAmounts: { amount: string; context: string }[]
  ministers: string[]
}

// ---------------------------------------------------------------------------
// getTopRecipientsWithConnections — top contractors + grant recipients + connection counts
// ---------------------------------------------------------------------------

export const getTopRecipientsWithConnections = createServerFn({ method: 'GET' }).handler(
  (): Promise<TopRecipientWithConnections[]> => cached('top-recipients-connections', async () => {
    const db = getDb()

    const rows = await db.execute(sql`
      WITH top_contractors AS (
        SELECT
          vendor_name AS name,
          entity_id,
          'contractor' AS type,
          SUM(value::numeric) AS total_value,
          COUNT(*) AS record_count
        FROM contracts
        WHERE entity_id IS NOT NULL AND value IS NOT NULL
        GROUP BY vendor_name, entity_id
        ORDER BY total_value DESC
        LIMIT 5
      ),
      top_grants AS (
        SELECT
          recipient_name AS name,
          entity_id,
          'grant_recipient' AS type,
          SUM(amount::numeric) AS total_value,
          COUNT(*) AS record_count
        FROM grants
        WHERE entity_id IS NOT NULL AND amount IS NOT NULL
        GROUP BY recipient_name, entity_id
        ORDER BY total_value DESC
        LIMIT 5
      ),
      combined AS (
        SELECT * FROM top_contractors
        UNION ALL
        SELECT * FROM top_grants
      )
      SELECT
        c.name,
        c.entity_id AS "entityId",
        c.type,
        c.total_value AS "totalValue",
        c.record_count AS "recordCount",
        CASE WHEN c.entity_id IS NOT NULL THEN COALESCE(
          (
            SELECT SUM(ec.transaction_count)
            FROM entity_connections ec
            WHERE (ec.entity_a_id = c.entity_id OR ec.entity_b_id = c.entity_id)
              AND ec.connection_type IN ('lobbyist_to_official', 'lobbyist_client_to_official')
              AND ec.is_stale = false
          ), 0
        ) ELSE 0 END AS "lobbyingCount",
        CASE WHEN c.entity_id IS NOT NULL THEN COALESCE(
          (
            SELECT SUM(ec.transaction_count)
            FROM entity_connections ec
            WHERE (ec.entity_a_id = c.entity_id OR ec.entity_b_id = c.entity_id)
              AND ec.connection_type = 'donor_to_party'
              AND ec.is_stale = false
          ), 0
        ) ELSE 0 END AS "donationCount"
      FROM combined c
      ORDER BY c.total_value DESC
    `)

    return Array.from(rows).map((r) => {
      const row = r as Record<string, unknown>
      return {
        name: String(row.name ?? ''),
        entityId: String(row.entityId ?? ''),
        type: row.type === 'contractor' ? 'contractor' : 'grant_recipient',
        totalValue: Number(row.totalValue ?? 0),
        recordCount: Number(row.recordCount ?? 0),
        lobbyingCount: Number(row.lobbyingCount ?? 0),
        donationCount: Number(row.donationCount ?? 0),
      }
    })
  }),
)

// ---------------------------------------------------------------------------
// SPENDING_BUCKETS — plain-English groupings for standard object categories
// ---------------------------------------------------------------------------

export const SPENDING_BUCKETS: Record<string, string> = {
  'Personnel - Military and RCMP': 'People (salaries & pensions)',
  'Personnel - Civilian': 'People (salaries & pensions)',
  'Transfer payments': 'Transfers (aid, grants & pensions)',
  'Professional and special services': 'Running government (operations)',
  'Transportation and communications': 'Running government (operations)',
  'Rentals': 'Running government (operations)',
  'Utilities, materials and supplies': 'Running government (operations)',
  'Repair and maintenance': 'Running government (operations)',
  'Acquisition of land, buildings and works': 'Building things (capital)',
  'Acquisition of machinery and equipment': 'Building things (capital)',
  'Public debt charges': 'Paying interest on debt',
  'Other subsidies and payments': 'Transfers (aid, grants & pensions)',
  'Information': 'Running government (operations)',
}

export function bucketizeSpending(rows: SpendingCategoryRow[]): { bucket: string; amount: number }[] {
  const bucketMap = new Map<string, number>()

  for (const row of rows) {
    const bucket = SPENDING_BUCKETS[row.category] ?? 'Other'
    const existing = bucketMap.get(bucket) ?? 0
    bucketMap.set(bucket, existing + row.amount)
  }

  return Array.from(bucketMap.entries())
    .map(([bucket, amount]) => ({ bucket, amount }))
    .sort((a, b) => b.amount - a.amount)
}

// ---------------------------------------------------------------------------
// getRecentSpendingAnnouncements — latest press releases with $ amounts
// ---------------------------------------------------------------------------

export const getRecentSpendingAnnouncements = createServerFn({ method: 'GET' }).handler(
  (): Promise<RecentSpendingAnnouncement[]> => cached('recent-spending-announcements', async () => {
    const db = getDb()

    const rows = await db
      .select({
        id: pressReleases.id,
        title: pressReleases.title,
        url: pressReleases.url,
        publishedDate: pressReleases.publishedDate,
        department: pressReleases.department,
        dollarAmounts: pressReleases.dollarAmounts,
        ministers: pressReleases.ministers,
      })
      .from(pressReleases)
      .where(sql`dollar_amounts IS NOT NULL AND dollar_amounts::text != '[]'`)
      .orderBy(desc(pressReleases.publishedDate))
      .limit(10)

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      url: r.url,
      publishedDate: String(r.publishedDate),
      department: r.department,
      dollarAmounts: (r.dollarAmounts as { amount: string; context: string }[]) ?? [],
      ministers: r.ministers ?? [],
    }))
  }),
)
