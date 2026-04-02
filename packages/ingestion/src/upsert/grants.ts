import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { grants } from '@govtrace/db/schema/raw'
import type { GrantRecord } from '../parsers/grants.ts'

const BATCH_SIZE = 500

export interface UpsertResult {
  inserted: number
  total: number
}

/**
 * Upserts grant records using INSERT ... ON CONFLICT DO UPDATE.
 * Same source record (same id) will update, not duplicate (DATA-07).
 * Processes in batches of 500 to manage memory and statement size.
 */
export async function upsertGrants(records: GrantRecord[]): Promise<UpsertResult> {
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
      recipientName: r.recipientName,
      recipientLegalName: r.recipientLegalName,
      department: r.department,
      programName: r.programName,
      description: r.description,
      amount: r.amount,
      agreementDate: r.agreementDate,
      startDate: r.startDate,
      endDate: r.endDate,
      province: r.province,
      city: r.city,
      grantType: r.grantType,
      sourceFileHash: r.sourceFileHash,
      rawData: r.rawData,
      updatedAt: new Date(),
    }))

    await db
      .insert(grants)
      .values(values)
      .onConflictDoUpdate({
        target: grants.id,
        set: {
          recipientName: sql`excluded.recipient_name`,
          recipientLegalName: sql`excluded.recipient_legal_name`,
          department: sql`excluded.department`,
          programName: sql`excluded.program_name`,
          description: sql`excluded.description`,
          amount: sql`excluded.amount`,
          agreementDate: sql`excluded.agreement_date`,
          startDate: sql`excluded.start_date`,
          endDate: sql`excluded.end_date`,
          province: sql`excluded.province`,
          city: sql`excluded.city`,
          grantType: sql`excluded.grant_type`,
          sourceFileHash: sql`excluded.source_file_hash`,
          rawData: sql`excluded.raw_data`,
          updatedAt: sql`excluded.updated_at`,
        },
      })

    inserted += uniqueBatch.length
  }

  return { inserted, total: records.length }
}
