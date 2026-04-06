import { eq, sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { parliamentVotes, parliamentBills } from '@govtrace/db/schema/parliament'
import type { ParsedSenateVote } from '../parsers/senate-votes.ts'

const BATCH_SIZE = 500

/**
 * Builds a composite Senate vote ID from parliament/session/voteId.
 * Format: "senate-{parl}-{session}-{voteId}" (e.g. "senate-44-1-612906")
 * Prefixed with "senate-" to avoid collision with House division number IDs.
 */
export function buildSenateVoteId(parliament: number, session: number, voteId: string): string {
  return `senate-${parliament}-${session}-${voteId}`
}

/**
 * Upserts Senate vote aggregate records into parliament_votes with chamber='senate'.
 * INSERT ON CONFLICT DO UPDATE using the unique index on (parlSessionCode, divisionNumber).
 *
 * Note: Senate voteId is stored in the divisionNumber column as an integer (parsing the numeric ID).
 * The id field uses the "senate-{parl}-{session}-{voteId}" composite key.
 *
 * @param votes - ParsedSenateVote array from parseSenateVoteListingHtml
 * @param parliament - Parliament number
 * @param session - Session number
 * @param parlSessionCode - e.g. "44-1"
 * @returns count of rows upserted
 */
export async function upsertSenateVotes(
  votes: ParsedSenateVote[],
  parliament: number,
  session: number,
  parlSessionCode: string,
): Promise<number> {
  if (votes.length === 0) return 0

  const db = getDb()
  let total = 0

  // Pre-fetch bill IDs for bill linking
  const billCodesToLookup = votes
    .filter((v) => v.billNumber !== null)
    .map((v) => `${parliament}-${session}-${v.billNumber}`)

  const existingBillIds = new Set<string>()
  if (billCodesToLookup.length > 0) {
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

    // Deduplicate by voteId within the batch
    const seen = new Set<string>()
    const uniqueBatch = batch.filter((r) => {
      if (seen.has(r.voteId)) return false
      seen.add(r.voteId)
      return true
    })

    const values = uniqueBatch.map((v) => {
      const id = buildSenateVoteId(parliament, session, v.voteId)
      const divisionNumber = Number.parseInt(v.voteId, 10) || 0

      const candidateBillId = v.billNumber !== null
        ? `${parliament}-${session}-${v.billNumber}`
        : null
      const billId = candidateBillId !== null && existingBillIds.has(candidateBillId)
        ? candidateBillId
        : null

      return {
        id,
        chamber: 'senate' as const,
        parliamentNumber: parliament,
        sessionNumber: session,
        parlSessionCode,
        divisionNumber,
        voteDate: v.voteDate || (new Date().toISOString().split('T')[0] ?? ''),
        voteDateTime: null,
        subject: v.subject,
        resultName: v.resultName,
        yeasTotal: v.yeasTotal,
        naysTotal: v.naysTotal,
        pairedTotal: 0, // Senate has no paired votes
        abstentionsTotal: v.abstentionsTotal,
        documentTypeName: null,
        billId,
        billNumber: v.billNumber,
        ballotsIngested: false,
        sourceFileHash: null,
        rawData: { voteId: v.voteId, sessionCode: parlSessionCode } as Record<string, unknown>,
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
          abstentionsTotal: sql`excluded.abstentions_total`,
          billId: sql`excluded.bill_id`,
          billNumber: sql`excluded.bill_number`,
        },
      })

    total += uniqueBatch.length
  }

  return total
}

/**
 * Marks a Senate vote's ballots as ingested (resumable ingestion flag).
 */
export async function markSenateBallotsIngested(voteId: string): Promise<void> {
  const db = getDb()
  await db
    .update(parliamentVotes)
    .set({ ballotsIngested: true })
    .where(eq(parliamentVotes.id, voteId))
}
