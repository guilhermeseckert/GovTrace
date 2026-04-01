import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { contracts } from '@govtrace/db/schema/raw'
import type { ContractRecord } from '../parsers/contracts.ts'

const BATCH_SIZE = 500 // contracts rows are larger due to description field

export interface UpsertResult {
  inserted: number
  total: number
}

/**
 * Upserts contract records using INSERT ... ON CONFLICT DO UPDATE.
 * Same source record (same id) will update, not duplicate (DATA-07).
 * Processes in batches of 500 to manage memory and statement size.
 */
export async function upsertContracts(records: ContractRecord[]): Promise<UpsertResult> {
  const db = getDb()
  let inserted = 0

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)

    const values = batch.map((r) => ({
      id: r.id,
      contractId: r.contractId,
      vendorName: r.vendorName,
      department: r.department,
      description: r.description,
      value: r.value,
      originalValue: r.originalValue,
      startDate: r.startDate,
      endDate: r.endDate,
      awardDate: r.awardDate,
      procurementMethod: r.procurementMethod,
      province: r.province,
      sourceFileHash: r.sourceFileHash,
      rawData: r.rawData,
      updatedAt: new Date(),
    }))

    await db
      .insert(contracts)
      .values(values)
      .onConflictDoUpdate({
        target: contracts.id,
        set: {
          contractId: sql`excluded.contract_id`,
          vendorName: sql`excluded.vendor_name`,
          department: sql`excluded.department`,
          description: sql`excluded.description`,
          value: sql`excluded.value`,
          originalValue: sql`excluded.original_value`,
          startDate: sql`excluded.start_date`,
          endDate: sql`excluded.end_date`,
          awardDate: sql`excluded.award_date`,
          procurementMethod: sql`excluded.procurement_method`,
          province: sql`excluded.province`,
          sourceFileHash: sql`excluded.source_file_hash`,
          rawData: sql`excluded.raw_data`,
          updatedAt: sql`excluded.updated_at`,
        },
      })

    inserted += batch.length
  }

  return { inserted, total: records.length }
}
