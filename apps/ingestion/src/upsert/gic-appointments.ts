import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { gicAppointments } from '@govtrace/db/schema/appointments'
import type { ParsedAppointment } from '../parsers/gic-appointments.ts'

const BATCH_SIZE = 500

/**
 * Upserts GIC appointment records.
 * Uses ON CONFLICT (organization_code, appointee_name, position_title) DO UPDATE.
 * Processes in batches of 500 (same as contracts/grants).
 *
 * @returns count of rows upserted
 */
export async function upsertGicAppointments(records: ParsedAppointment[]): Promise<number> {
  if (records.length === 0) return 0

  const db = getDb()
  let total = 0

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)

    // Deduplicate within batch by composite key
    const seen = new Set<string>()
    const uniqueBatch = batch.filter((r) => {
      const key = `${r.organizationCode}|${r.appointeeName}|${r.positionTitle}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    const values = uniqueBatch.map((r) => ({
      id: r.id,
      appointeeName: r.appointeeName,
      normalizedAppointeeName: r.normalizedAppointeeName,
      positionTitle: r.positionTitle,
      organizationName: r.organizationName,
      organizationCode: r.organizationCode,
      appointmentType: r.appointmentType,
      tenureType: r.tenureType,
      appointmentDate: r.appointmentDate,
      expiryDate: r.expiryDate,
      isVacant: r.isVacant,
      sourceUrl: r.sourceUrl,
      sourceFileHash: r.sourceFileHash,
      rawData: r.rawData,
      updatedAt: new Date(),
    }))

    await db
      .insert(gicAppointments)
      .values(values)
      .onConflictDoUpdate({
        target: [
          gicAppointments.organizationCode,
          gicAppointments.appointeeName,
          gicAppointments.positionTitle,
        ],
        set: {
          appointmentDate: sql`excluded.appointment_date`,
          expiryDate: sql`excluded.expiry_date`,
          appointmentType: sql`excluded.appointment_type`,
          tenureType: sql`excluded.tenure_type`,
          normalizedAppointeeName: sql`excluded.normalized_appointee_name`,
          rawData: sql`excluded.raw_data`,
          sourceFileHash: sql`excluded.source_file_hash`,
          updatedAt: sql`NOW()`,
        },
      })

    total += uniqueBatch.length
  }

  return total
}
