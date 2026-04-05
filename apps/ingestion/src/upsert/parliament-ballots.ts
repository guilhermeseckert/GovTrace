import { getDb } from '@govtrace/db/client'
import { parliamentVoteBallots } from '@govtrace/db/schema/parliament'
import type { BallotRecord } from '../parsers/parliament-ballots.ts'

// Larger batch size for ballots — narrow rows, high volume (1.8–2.4M total)
const BATCH_SIZE = 1000

/**
 * Inserts parliament vote ballot records.
 * INSERT ON CONFLICT DO NOTHING — ballots are immutable historical records.
 * Sets entityId from the entityLookup map keyed by personId.
 * Processes in batches of 1000.
 *
 * @param ballots - BallotRecord array from parseVoteBallotsXml
 * @param entityLookup - Map<personId, entityId> built from mp_profiles after matching
 * @returns count of rows inserted
 */
export async function upsertBallots(
  ballots: BallotRecord[],
  entityLookup: Map<number, string>,
): Promise<number> {
  if (ballots.length === 0) return 0

  const db = getDb()
  let total = 0

  for (let i = 0; i < ballots.length; i += BATCH_SIZE) {
    const batch = ballots.slice(i, i + BATCH_SIZE)

    // Deduplicate by id within the batch
    const seen = new Set<string>()
    const uniqueBatch = batch.filter((r) => {
      if (seen.has(r.id)) return false
      seen.add(r.id)
      return true
    })

    const values = uniqueBatch.map((b) => ({
      id: b.id,
      voteId: b.voteId,
      personId: b.personId,
      entityId: entityLookup.get(b.personId) ?? null,
      parliamentNumber: b.parliamentNumber,
      sessionNumber: b.sessionNumber,
      divisionNumber: b.divisionNumber,
      firstName: b.firstName,
      lastName: b.lastName,
      constituency: b.constituency,
      province: b.province,
      caucusShortName: b.caucusShortName,
      ballotValue: b.ballotValue,
      isYea: b.isYea,
      isNay: b.isNay,
      isPaired: b.isPaired,
    }))

    await db.insert(parliamentVoteBallots).values(values).onConflictDoNothing()

    total += uniqueBatch.length
  }

  return total
}
