import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { donations } from '@govtrace/db/schema/raw'
import type { DonationRecord } from '../parsers/elections-canada.ts'

const BATCH_SIZE = 1000 // upsert in batches to avoid hitting Postgres statement size limits

export interface UpsertResult {
  inserted: number
  total: number
}

/**
 * Upserts donation records using INSERT ... ON CONFLICT DO UPDATE.
 * Same source record (same id) will update, not duplicate (DATA-07, Pitfall 2).
 * Processes in batches of 1000 to manage memory and statement size.
 */
export async function upsertDonations(records: DonationRecord[]): Promise<UpsertResult> {
  const db = getDb()
  let inserted = 0

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)

    // Deduplicate within batch — same hash key can appear twice in the source data
    const seen = new Set<string>()
    const uniqueBatch = batch.filter((r) => {
      if (seen.has(r.id)) return false
      seen.add(r.id)
      return true
    })

    const values = uniqueBatch.map((r) => ({
      id: r.id,
      contributorName: r.contributorName,
      contributorType: r.contributorType,
      amount: r.amount,
      donationDate: r.donationDate,
      ridingCode: r.ridingCode,
      ridingName: r.ridingName,
      recipientName: r.recipientName,
      recipientType: r.recipientType,
      electionYear: r.electionYear,
      province: r.province,
      sourceFileHash: r.sourceFileHash,
      rawData: r.rawData,
      updatedAt: new Date(),
    }))

    // INSERT ... ON CONFLICT DO UPDATE — idempotent upsert (DATA-07)
    await db
      .insert(donations)
      .values(values)
      .onConflictDoUpdate({
        target: donations.id,
        set: {
          contributorName: sql`excluded.contributor_name`,
          contributorType: sql`excluded.contributor_type`,
          amount: sql`excluded.amount`,
          donationDate: sql`excluded.donation_date`,
          ridingCode: sql`excluded.riding_code`,
          ridingName: sql`excluded.riding_name`,
          recipientName: sql`excluded.recipient_name`,
          recipientType: sql`excluded.recipient_type`,
          electionYear: sql`excluded.election_year`,
          province: sql`excluded.province`,
          sourceFileHash: sql`excluded.source_file_hash`,
          rawData: sql`excluded.raw_data`,
          updatedAt: sql`excluded.updated_at`,
        },
      })

    inserted += uniqueBatch.length
  }

  return { inserted, total: records.length }
}
