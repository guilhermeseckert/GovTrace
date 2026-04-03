import { createServerFn } from '@tanstack/react-start'
import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'

export type RecentActivity = {
  type: 'contract' | 'grant' | 'donation'
  entityName: string
  entityId: string | null
  department: string | null
  amount: number | null
  date: string | null
}

export type TopRecipient = {
  name: string
  entityId: string | null
  totalValue: number
  contractCount: number
}

export type LandingData = {
  recentContracts: RecentActivity[]
  recentGrants: RecentActivity[]
  topContractors: TopRecipient[]
  topGrantRecipients: TopRecipient[]
}

export const getLandingData = createServerFn({ method: 'GET' })
  .handler(async (): Promise<LandingData> => {
    const db = getDb()

    const [recentContracts, recentGrants, topContractors, topGrantRecipients] = await Promise.all([
      // Recent big contracts
      db.execute<{
        vendor_name: string
        entity_id: string | null
        department: string | null
        val: string | null
        award_date: string | null
      }>(sql`
        SELECT vendor_name, entity_id::text, department, value::text AS val, award_date::text
        FROM contracts
        WHERE value IS NOT NULL AND value > 10000
        ORDER BY award_date DESC NULLS LAST
        LIMIT 10
      `),

      // Recent grants
      db.execute<{
        recipient_name: string
        entity_id: string | null
        department: string | null
        val: string | null
        agreement_date: string | null
      }>(sql`
        SELECT recipient_name, entity_id::text, department, amount::text AS val, agreement_date::text
        FROM grants
        WHERE amount IS NOT NULL AND amount > 10000
        ORDER BY agreement_date DESC NULLS LAST
        LIMIT 10
      `),

      // Top contractors by total value
      db.execute<{
        name: string
        entity_id: string | null
        total: string
        cnt: string
      }>(sql`
        SELECT vendor_name AS name, entity_id::text, SUM(value)::text AS total, COUNT(*)::text AS cnt
        FROM contracts
        WHERE value IS NOT NULL AND entity_id IS NOT NULL
        GROUP BY vendor_name, entity_id
        ORDER BY SUM(value) DESC
        LIMIT 8
      `),

      // Top grant recipients by total value
      db.execute<{
        name: string
        entity_id: string | null
        total: string
        cnt: string
      }>(sql`
        SELECT recipient_name AS name, entity_id::text, SUM(amount)::text AS total, COUNT(*)::text AS cnt
        FROM grants
        WHERE amount IS NOT NULL AND entity_id IS NOT NULL
        GROUP BY recipient_name, entity_id
        ORDER BY SUM(amount) DESC
        LIMIT 8
      `),
    ])

    return {
      recentContracts: Array.from(recentContracts).map((r) => ({
        type: 'contract' as const,
        entityName: r.vendor_name,
        entityId: r.entity_id,
        department: r.department,
        amount: r.val ? Number(r.val) : null,
        date: r.award_date,
      })),
      recentGrants: Array.from(recentGrants).map((r) => ({
        type: 'grant' as const,
        entityName: r.recipient_name,
        entityId: r.entity_id,
        department: r.department,
        amount: r.val ? Number(r.val) : null,
        date: r.agreement_date,
      })),
      topContractors: Array.from(topContractors).map((r) => ({
        name: r.name,
        entityId: r.entity_id,
        totalValue: Number(r.total),
        contractCount: Number(r.cnt),
      })),
      topGrantRecipients: Array.from(topGrantRecipients).map((r) => ({
        name: r.name,
        entityId: r.entity_id,
        totalValue: Number(r.total),
        contractCount: Number(r.cnt),
      })),
    }
  })
