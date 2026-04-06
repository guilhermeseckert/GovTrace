import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { hospitalityDisclosures } from '@govtrace/db/schema/raw'
import type { HospitalityRecord } from '../parsers/hospitality.ts'

const BATCH_SIZE = 500

export interface UpsertResult {
  inserted: number
  total: number
}

/**
 * Upserts hospitality disclosure records using INSERT ... ON CONFLICT DO UPDATE.
 * Same source record (same id) will update, not duplicate.
 * Processes in batches of 500 to manage memory and statement size.
 */
export async function upsertHospitalityDisclosures(records: HospitalityRecord[]): Promise<UpsertResult> {
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
      descriptionEn: r.descriptionEn,
      locationEn: r.locationEn,
      vendorEn: r.vendorEn,
      startDate: r.startDate,
      endDate: r.endDate,
      employeeAttendees: r.employeeAttendees,
      guestAttendees: r.guestAttendees,
      total: r.total,
      normalizedName: r.normalizedName,
      sourceFileHash: r.sourceFileHash,
      rawData: r.rawData,
      updatedAt: new Date(),
    }))

    await db
      .insert(hospitalityDisclosures)
      .values(values)
      .onConflictDoUpdate({
        target: hospitalityDisclosures.id,
        set: {
          refNumber: sql`excluded.ref_number`,
          disclosureGroup: sql`excluded.disclosure_group`,
          name: sql`excluded.name`,
          titleEn: sql`excluded.title_en`,
          department: sql`excluded.department`,
          departmentCode: sql`excluded.department_code`,
          descriptionEn: sql`excluded.description_en`,
          locationEn: sql`excluded.location_en`,
          vendorEn: sql`excluded.vendor_en`,
          startDate: sql`excluded.start_date`,
          endDate: sql`excluded.end_date`,
          employeeAttendees: sql`excluded.employee_attendees`,
          guestAttendees: sql`excluded.guest_attendees`,
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
