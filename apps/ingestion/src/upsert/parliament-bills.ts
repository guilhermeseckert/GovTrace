import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { parliamentBills } from '@govtrace/db/schema/parliament'
import type { BillRecord } from '../parsers/parliament-bills.ts'

const BATCH_SIZE = 500

/**
 * Upserts parliament bills from LEGISinfo.
 * INSERT ON CONFLICT DO UPDATE — updates mutable fields on conflict.
 * Processes in batches of 500.
 *
 * @returns count of rows upserted
 */
export async function upsertBills(bills: BillRecord[]): Promise<number> {
  if (bills.length === 0) return 0

  const db = getDb()
  let total = 0

  for (let i = 0; i < bills.length; i += BATCH_SIZE) {
    const batch = bills.slice(i, i + BATCH_SIZE)

    // Deduplicate by id within the batch
    const seen = new Set<string>()
    const uniqueBatch = batch.filter((r) => {
      if (seen.has(r.id)) return false
      seen.add(r.id)
      return true
    })

    const values = uniqueBatch.map((b) => ({
      id: b.id,
      billNumber: b.billNumber,
      billNumberFormatted: b.billNumberFormatted,
      parliamentNumber: b.parliamentNumber,
      sessionNumber: b.sessionNumber,
      parlSessionCode: b.parlSessionCode,
      shortTitleEn: b.shortTitleEn,
      shortTitleFr: b.shortTitleFr,
      longTitleEn: b.longTitleEn,
      longTitleFr: b.longTitleFr,
      billTypeEn: b.billTypeEn,
      sponsorEn: b.sponsorEn,
      currentStatusEn: b.currentStatusEn,
      receivedRoyalAssentAt: b.receivedRoyalAssentAt ? new Date(b.receivedRoyalAssentAt) : null,
      passedHouseThirdReadingAt: b.passedHouseThirdReadingAt
        ? new Date(b.passedHouseThirdReadingAt)
        : null,
      rawData: b.rawData,
      updatedAt: new Date(),
    }))

    await db
      .insert(parliamentBills)
      .values(values)
      .onConflictDoUpdate({
        target: parliamentBills.id,
        set: {
          shortTitleEn: sql`excluded.short_title_en`,
          shortTitleFr: sql`excluded.short_title_fr`,
          longTitleEn: sql`excluded.long_title_en`,
          longTitleFr: sql`excluded.long_title_fr`,
          currentStatusEn: sql`excluded.current_status_en`,
          sponsorEn: sql`excluded.sponsor_en`,
          receivedRoyalAssentAt: sql`excluded.received_royal_assent_at`,
          passedHouseThirdReadingAt: sql`excluded.passed_house_third_reading_at`,
          rawData: sql`excluded.raw_data`,
          updatedAt: sql`NOW()`,
        },
      })

    total += uniqueBatch.length
  }

  return total
}
