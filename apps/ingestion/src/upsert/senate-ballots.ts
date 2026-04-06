import { getDb } from '@govtrace/db/client'
import { parliamentVoteBallots } from '@govtrace/db/schema/parliament'
import type { ParsedSenateBallot } from '../parsers/senate-ballots.ts'

const BATCH_SIZE = 1000

export interface SenateBallotRecord {
  id: string             // "{senateVoteId}-{senatorId}"
  voteId: string         // e.g. "senate-44-1-612906"
  senatorId: number
  parliamentNumber: number
  sessionNumber: number
  divisionNumber: number // numeric senate voteId
  firstName: string
  lastName: string
  groupAffiliation: string
  province: string
  ballotValue: string    // "Yea" | "Nay" | "Abstention"
  isYea: boolean
  isNay: boolean
  isAbstention: boolean
}

/**
 * Builds a SenateBallotRecord from a ParsedSenateBallot and the parent vote context.
 */
export function buildSenateBallotRecords(
  ballots: ParsedSenateBallot[],
  voteId: string,
  parliament: number,
  session: number,
  divisionNumber: number,
): SenateBallotRecord[] {
  return ballots.map((b) => ({
    id: `${voteId}-${b.senatorId}`,
    voteId,
    senatorId: b.senatorId,
    parliamentNumber: parliament,
    sessionNumber: session,
    divisionNumber,
    firstName: b.firstName,
    lastName: b.lastName,
    groupAffiliation: b.groupAffiliation,
    province: b.province,
    ballotValue: b.ballotValue,
    isYea: b.ballotValue === 'Yea',
    isNay: b.ballotValue === 'Nay',
    isAbstention: b.ballotValue === 'Abstention',
  }))
}

/**
 * Inserts Senate vote ballot records into parliament_vote_ballots with chamber='senate'.
 * INSERT ON CONFLICT DO NOTHING — ballots are immutable historical records.
 * Sets entityId from the entityLookup map keyed by senatorId.
 * Processes in batches of 1000.
 *
 * @param ballots - SenateBallotRecord array
 * @param entityLookup - Map<senatorId, entityId> built from senator_profiles after matching
 * @returns count of rows inserted
 */
export async function upsertSenateBallots(
  ballots: SenateBallotRecord[],
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
      chamber: 'senate' as const,
      personId: b.senatorId, // reuse personId column for senator ID
      entityId: entityLookup.get(b.senatorId) ?? null,
      parliamentNumber: b.parliamentNumber,
      sessionNumber: b.sessionNumber,
      divisionNumber: b.divisionNumber,
      firstName: b.firstName,
      lastName: b.lastName,
      constituency: null, // senators don't have constituencies
      province: b.province || null,
      caucusShortName: b.groupAffiliation || null, // reuse caucusShortName for group affiliation
      ballotValue: b.ballotValue,
      isYea: b.isYea,
      isNay: b.isNay,
      isPaired: false, // Senate has no paired votes
      isAbstention: b.isAbstention,
    }))

    await db.insert(parliamentVoteBallots).values(values).onConflictDoNothing()

    total += uniqueBatch.length
  }

  return total
}
