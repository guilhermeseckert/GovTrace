import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { internationalAid } from '@govtrace/db/schema/raw'
import type { IatiActivityRecord } from '../parsers/international-aid.ts'

const BATCH_SIZE = 500

export interface UpsertResult {
  inserted: number
  total: number
}

/**
 * Upserts international aid activity records using INSERT ... ON CONFLICT DO UPDATE.
 * Uses iati-identifier as primary key (globally unique, stable by IATI standard).
 * Processes in batches of 500 to manage memory and statement size.
 */
export async function upsertInternationalAid(records: IatiActivityRecord[]): Promise<UpsertResult> {
  const db = getDb()
  let inserted = 0

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)

    const seen = new Set<string>()
    const uniqueBatch = batch.filter((r) => {
      if (seen.has(r.id)) return false
      seen.add(r.id)
      return true
    })

    const values = uniqueBatch.map((r) => ({
      id: r.id,
      projectTitle: r.projectTitle,
      description: r.description,
      implementerName: r.implementerName,
      fundingDepartment: r.fundingDepartment,
      recipientCountry: r.recipientCountry,
      recipientRegion: r.recipientRegion,
      activityStatus: r.activityStatus,
      startDate: r.startDate,
      endDate: r.endDate,
      totalBudgetCad: r.totalBudgetCad,
      totalDisbursedCad: r.totalDisbursedCad,
      totalCommittedCad: r.totalCommittedCad,
      currency: r.currency,
      normalizedImplementerName: r.normalizedImplementerName,
      sourceFileHash: r.sourceFileHash,
      rawData: r.rawData,
      updatedAt: new Date(),
    }))

    await db
      .insert(internationalAid)
      .values(values)
      .onConflictDoUpdate({
        target: internationalAid.id,
        set: {
          projectTitle: sql`excluded.project_title`,
          description: sql`excluded.description`,
          implementerName: sql`excluded.implementer_name`,
          fundingDepartment: sql`excluded.funding_department`,
          recipientCountry: sql`excluded.recipient_country`,
          recipientRegion: sql`excluded.recipient_region`,
          activityStatus: sql`excluded.activity_status`,
          startDate: sql`excluded.start_date`,
          endDate: sql`excluded.end_date`,
          totalBudgetCad: sql`excluded.total_budget_cad`,
          totalDisbursedCad: sql`excluded.total_disbursed_cad`,
          totalCommittedCad: sql`excluded.total_committed_cad`,
          currency: sql`excluded.currency`,
          normalizedImplementerName: sql`excluded.normalized_implementer_name`,
          sourceFileHash: sql`excluded.source_file_hash`,
          rawData: sql`excluded.raw_data`,
          updatedAt: sql`excluded.updated_at`,
        },
      })

    inserted += uniqueBatch.length
  }

  return { inserted, total: records.length }
}
