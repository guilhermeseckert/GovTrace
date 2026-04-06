import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { travelDisclosures } from '@govtrace/db/schema/raw'
import type { TravelRecord } from '../parsers/travel.ts'

const BATCH_SIZE = 500

export interface UpsertResult {
  inserted: number
  total: number
}

/**
 * Upserts travel disclosure records using INSERT ... ON CONFLICT DO UPDATE.
 * Same source record (same id) will update, not duplicate.
 * Processes in batches of 500 to manage memory and statement size.
 */
export async function upsertTravelDisclosures(records: TravelRecord[]): Promise<UpsertResult> {
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
      refNumber: r.refNumber,
      disclosureGroup: r.disclosureGroup,
      name: r.name,
      titleEn: r.titleEn,
      department: r.department,
      departmentCode: r.departmentCode,
      purposeEn: r.purposeEn,
      destinationEn: r.destinationEn,
      destination2En: r.destination2En,
      destinationOtherEn: r.destinationOtherEn,
      startDate: r.startDate,
      endDate: r.endDate,
      airfare: r.airfare,
      otherTransport: r.otherTransport,
      lodging: r.lodging,
      meals: r.meals,
      otherExpenses: r.otherExpenses,
      total: r.total,
      normalizedName: r.normalizedName,
      sourceFileHash: r.sourceFileHash,
      rawData: r.rawData,
      updatedAt: new Date(),
    }))

    await db
      .insert(travelDisclosures)
      .values(values)
      .onConflictDoUpdate({
        target: travelDisclosures.id,
        set: {
          refNumber: sql`excluded.ref_number`,
          disclosureGroup: sql`excluded.disclosure_group`,
          name: sql`excluded.name`,
          titleEn: sql`excluded.title_en`,
          department: sql`excluded.department`,
          departmentCode: sql`excluded.department_code`,
          purposeEn: sql`excluded.purpose_en`,
          destinationEn: sql`excluded.destination_en`,
          destination2En: sql`excluded.destination_2_en`,
          destinationOtherEn: sql`excluded.destination_other_en`,
          startDate: sql`excluded.start_date`,
          endDate: sql`excluded.end_date`,
          airfare: sql`excluded.airfare`,
          otherTransport: sql`excluded.other_transport`,
          lodging: sql`excluded.lodging`,
          meals: sql`excluded.meals`,
          otherExpenses: sql`excluded.other_expenses`,
          total: sql`excluded.total`,
          normalizedName: sql`excluded.normalized_name`,
          sourceFileHash: sql`excluded.source_file_hash`,
          rawData: sql`excluded.raw_data`,
          updatedAt: sql`excluded.updated_at`,
        },
      })

    inserted += uniqueBatch.length
  }

  return { inserted, total: records.length }
}
