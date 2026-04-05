import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { parliamentVotes, parliamentBills } from '@govtrace/db/schema/parliament'
import { eq } from 'drizzle-orm'
import type { VoteRecord } from '../parsers/parliament-votes.ts'

const BATCH_SIZE = 500

/**
 * Upserts parliament vote aggregate records.
 * INSERT ON CONFLICT DO UPDATE using the unique index on (parlSessionCode, divisionNumber).
 * Links billId by looking up "{parliament}-{session}-{billNumberCode}" in parliamentBills
 * when BillNumberCode is non-empty (Pitfall 4: many votes have no bill).
 * Processes in batches of 500.
 *
 * @returns count of rows upserted
 */
export async function upsertVotes(votes: VoteRecord[], sourceFileHash: string): Promise<number> {
  if (votes.length === 0) return 0

  const db = getDb()
  let total = 0

  // Pre-fetch existing bills for bill linking to avoid N+1 lookups
  // We only look up bills that have a BillNumberCode
  const billCodesToLookup = votes
    .filter((v) => v.billNumberCode !== null)
    .map((v) => `${v.parliamentNumber}-${v.sessionNumber}-${v.billNumberCode}`)

  const existingBillIds = new Set<string>()
  if (billCodesToLookup.length > 0) {
    // Batch lookup all referenced bills
    const billRows = await db
      .select({ id: parliamentBills.id })
      .from(parliamentBills)
      .where(sql`${parliamentBills.id} = ANY(${sql.raw(`ARRAY[${billCodesToLookup.map((id) => `'${id.replace(/'/g, "''")}'`).join(',')}]`)})`)
    for (const row of billRows) {
      existingBillIds.add(row.id)
    }
  }

  for (let i = 0; i < votes.length; i += BATCH_SIZE) {
    const batch = votes.slice(i, i + BATCH_SIZE)

    // Deduplicate by id within the batch
    const seen = new Set<string>()
    const uniqueBatch = batch.filter((r) => {
      if (seen.has(r.id)) return false
      seen.add(r.id)
      return true
    })

    const values = uniqueBatch.map((v) => {
      const candidateBillId =
        v.billNumberCode !== null
          ? `${v.parliamentNumber}-${v.sessionNumber}-${v.billNumberCode}`
          : null

      const billId = candidateBillId !== null && existingBillIds.has(candidateBillId)
        ? candidateBillId
        : null

      return {
        id: v.id,
        parliamentNumber: v.parliamentNumber,
        sessionNumber: v.sessionNumber,
        parlSessionCode: v.parlSessionCode,
        divisionNumber: v.divisionNumber,
        voteDate: v.voteDate || (new Date().toISOString().split('T')[0] ?? ''),
        voteDateTime: v.voteDateTime ? new Date(v.voteDateTime) : null,
        subject: v.subject,
        resultName: v.resultName,
        yeasTotal: v.yeasTotal,
        naysTotal: v.naysTotal,
        pairedTotal: v.pairedTotal,
        documentTypeName: v.documentTypeName,
        billId,
        billNumber: v.billNumberCode,
        ballotsIngested: false,
        sourceFileHash,
        rawData: v.rawData,
      }
    })

    await db
      .insert(parliamentVotes)
      .values(values)
      .onConflictDoUpdate({
        target: [parliamentVotes.parlSessionCode, parliamentVotes.divisionNumber],
        set: {
          subject: sql`excluded.subject`,
          resultName: sql`excluded.result_name`,
          yeasTotal: sql`excluded.yeas_total`,
          naysTotal: sql`excluded.nays_total`,
          pairedTotal: sql`excluded.paired_total`,
          documentTypeName: sql`excluded.document_type_name`,
          billId: sql`excluded.bill_id`,
          billNumber: sql`excluded.bill_number`,
          sourceFileHash: sql`excluded.source_file_hash`,
          rawData: sql`excluded.raw_data`,
        },
      })

    total += uniqueBatch.length
  }

  return total
}

/**
 * Marks a division's ballots as ingested (resumable ingestion flag).
 */
export async function markBallotsIngested(voteId: string): Promise<void> {
  const db = getDb()
  await db
    .update(parliamentVotes)
    .set({ ballotsIngested: true })
    .where(eq(parliamentVotes.id, voteId))
}
