import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { count, desc, eq, or, sql, sum } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { contracts, donations, grants, internationalAid, lobbyRegistrations } from '@govtrace/db/schema/raw'
import { entities } from '@govtrace/db/schema/entities'
import { cached } from '@/lib/cache'

const Input = z.object({ id: z.string().uuid() })

export type LargestDeal = {
  value: number
  department: string | null
  year: number | null
  dataset: 'contract' | 'grant' | 'aid'
}

export type EntityAggregates = {
  contractsTotal: number
  contractsCount: number
  grantsTotal: number
  grantsCount: number
  donationsTotal: number
  donationsCount: number
  lobbyingCount: number
  aidTotal: number
  aidCount: number
  earliestYear: number | null
  latestYear: number | null
  primaryDepartment: string | null
  largestDeal: LargestDeal | null
}

const AGGREGATES_TTL_MS = 60 * 60 * 1000 // 1 hour — aggregates are stable between weekly ingests

type YearRow = { min_year: number | null; max_year: number | null }
type DeptRow = { department: string; total: string | null }
type LargestRow = {
  value: string | null
  department: string | null
  year: number | null
  dataset: 'contract' | 'grant' | 'aid'
}

async function computeAggregates(entityId: string): Promise<EntityAggregates> {
  const db = getDb()

  // Resolve entity to decide donations handling (politician vs other)
  const entityRows = await db
    .select({ canonicalName: entities.canonicalName, entityType: entities.entityType })
    .from(entities)
    .where(eq(entities.id, entityId))
    .limit(1)
  const entity = entityRows[0]
  if (!entity) {
    return {
      contractsTotal: 0,
      contractsCount: 0,
      grantsTotal: 0,
      grantsCount: 0,
      donationsTotal: 0,
      donationsCount: 0,
      lobbyingCount: 0,
      aidTotal: 0,
      aidCount: 0,
      earliestYear: null,
      latestYear: null,
      primaryDepartment: null,
      largestDeal: null,
    }
  }

  const isPolitician = entity.entityType === 'politician'
  const canonicalName = entity.canonicalName
  const donationWhere = isPolitician
    ? or(
        eq(donations.recipientName, canonicalName),
        eq(donations.entityId, entityId),
      )
    : eq(donations.entityId, entityId)

  const [
    contractsAgg,
    grantsAgg,
    donationsAgg,
    lobbyCountRows,
    aidAgg,
    yearRows,
    contractsDeptRows,
    grantsDeptRows,
    largestRows,
  ] = await Promise.all([
    db
      .select({ total: sum(contracts.value), c: count() })
      .from(contracts)
      .where(eq(contracts.entityId, entityId)),

    db
      .select({ total: sum(grants.amount), c: count() })
      .from(grants)
      .where(eq(grants.entityId, entityId)),

    db
      .select({ total: sum(donations.amount), c: count() })
      .from(donations)
      .where(donationWhere),

    db
      .select({ c: count() })
      .from(lobbyRegistrations)
      .where(
        or(
          eq(lobbyRegistrations.lobbyistEntityId, entityId),
          eq(lobbyRegistrations.clientEntityId, entityId),
        ),
      ),

    db
      .select({
        total: sum(internationalAid.totalDisbursedCad),
        c: count(),
      })
      .from(internationalAid)
      .where(eq(internationalAid.entityId, entityId)),

    // MIN/MAX year across all four date-bearing datasets in one query
    db.execute<YearRow>(sql`
      SELECT
        MIN(y) FILTER (WHERE y IS NOT NULL) AS min_year,
        MAX(y) FILTER (WHERE y IS NOT NULL) AS max_year
      FROM (
        SELECT EXTRACT(YEAR FROM award_date)::int AS y FROM contracts WHERE entity_id = ${entityId}::uuid
        UNION ALL
        SELECT EXTRACT(YEAR FROM agreement_date)::int FROM grants WHERE entity_id = ${entityId}::uuid
        UNION ALL
        SELECT EXTRACT(YEAR FROM donation_date)::int FROM donations
          WHERE ${isPolitician ? sql`(recipient_name = ${canonicalName} OR entity_id = ${entityId}::uuid)` : sql`entity_id = ${entityId}::uuid`}
        UNION ALL
        SELECT EXTRACT(YEAR FROM start_date)::int FROM international_aid WHERE entity_id = ${entityId}::uuid
      ) AS years
    `),

    db
      .select({ department: contracts.department, total: sum(contracts.value) })
      .from(contracts)
      .where(eq(contracts.entityId, entityId))
      .groupBy(contracts.department)
      .orderBy(desc(sum(contracts.value)))
      .limit(1),

    db
      .select({ department: grants.department, total: sum(grants.amount) })
      .from(grants)
      .where(eq(grants.entityId, entityId))
      .groupBy(grants.department)
      .orderBy(desc(sum(grants.amount)))
      .limit(1),

    // Largest single deal across contracts/grants/aid
    db.execute<LargestRow>(sql`
      SELECT value, department, year, dataset FROM (
        SELECT
          value::numeric AS value,
          department AS department,
          EXTRACT(YEAR FROM award_date)::int AS year,
          'contract' AS dataset
        FROM contracts
        WHERE entity_id = ${entityId}::uuid AND value IS NOT NULL

        UNION ALL

        SELECT
          amount::numeric AS value,
          department AS department,
          EXTRACT(YEAR FROM agreement_date)::int AS year,
          'grant' AS dataset
        FROM grants
        WHERE entity_id = ${entityId}::uuid AND amount IS NOT NULL

        UNION ALL

        SELECT
          total_disbursed_cad::numeric AS value,
          funding_department AS department,
          EXTRACT(YEAR FROM start_date)::int AS year,
          'aid' AS dataset
        FROM international_aid
        WHERE entity_id = ${entityId}::uuid AND total_disbursed_cad IS NOT NULL
      ) AS combined
      ORDER BY value DESC NULLS LAST
      LIMIT 1
    `),
  ])

  const contractsTotal = Number(contractsAgg[0]?.total ?? 0)
  const contractsCount = Number(contractsAgg[0]?.c ?? 0)
  const grantsTotal = Number(grantsAgg[0]?.total ?? 0)
  const grantsCount = Number(grantsAgg[0]?.c ?? 0)
  const donationsTotal = Number(donationsAgg[0]?.total ?? 0)
  const donationsCount = Number(donationsAgg[0]?.c ?? 0)
  const lobbyingCount = Number(lobbyCountRows[0]?.c ?? 0)
  const aidTotal = Number(aidAgg[0]?.total ?? 0)
  const aidCount = Number(aidAgg[0]?.c ?? 0)

  const yearRow = Array.from(yearRows)[0]
  const earliestYear = yearRow?.min_year ?? null
  const latestYear = yearRow?.max_year ?? null

  // Primary department = higher total across top contracts department and top grants department
  const contractsDept = contractsDeptRows[0] as DeptRow | undefined
  const grantsDept = grantsDeptRows[0] as DeptRow | undefined
  let primaryDepartment: string | null = null
  if (contractsDept && grantsDept) {
    const cTotal = Number(contractsDept.total ?? 0)
    const gTotal = Number(grantsDept.total ?? 0)
    primaryDepartment = cTotal >= gTotal ? contractsDept.department : grantsDept.department
  } else if (contractsDept) {
    primaryDepartment = contractsDept.department
  } else if (grantsDept) {
    primaryDepartment = grantsDept.department
  }

  const largestRaw = Array.from(largestRows)[0]
  const largestDeal: LargestDeal | null = largestRaw && largestRaw.value !== null
    ? {
        value: Number(largestRaw.value),
        department: largestRaw.department ?? null,
        year: largestRaw.year ?? null,
        dataset: largestRaw.dataset,
      }
    : null

  return {
    contractsTotal,
    contractsCount,
    grantsTotal,
    grantsCount,
    donationsTotal,
    donationsCount,
    lobbyingCount,
    aidTotal,
    aidCount,
    earliestYear,
    latestYear,
    primaryDepartment,
    largestDeal,
  }
}

export const getEntityAggregates = createServerFn({ method: 'GET' })
  .inputValidator(Input)
  .handler(({ data }): Promise<EntityAggregates> =>
    cached(`entity-aggregates:${data.id}`, () => computeAggregates(data.id), AGGREGATES_TTL_MS),
  )
