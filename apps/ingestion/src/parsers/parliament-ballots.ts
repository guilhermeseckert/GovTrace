import { XMLParser } from 'fast-xml-parser'

export interface BallotRecord {
  id: string // "{voteId}-{personId}"
  voteId: string // e.g. "44-1-377"
  personId: number
  parliamentNumber: number
  sessionNumber: number
  divisionNumber: number
  firstName: string
  lastName: string
  constituency: string | null
  province: string | null
  caucusShortName: string | null
  ballotValue: string // "Yea", "Nay", or "Paired"
  isYea: boolean
  isNay: boolean
  isPaired: boolean
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // Force array mode for VoteParticipant elements — prevents single-element collapse (Pitfall 6)
  isArray: (name) => ['VoteParticipant'].includes(name),
  parseAttributeValue: false,
  trimValues: true,
})

/**
 * Parses ArrayOfVoteParticipant XML from ourcommons.ca into BallotRecord array.
 * Handles single-participant XML (isArray safety) and French-accented names.
 *
 * @param xml - Raw XML string from https://www.ourcommons.ca/members/en/votes/{parliament}/{session}/{voteNumber}/xml
 * @param voteId - Composite vote ID e.g. "44-1-377"
 */
export function parseVoteBallotsXml(xml: string, voteId: string): BallotRecord[] {
  if (!xml || xml.trim().length === 0) return []

  let parsed: unknown
  try {
    parsed = parser.parse(xml)
  } catch {
    return []
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('ArrayOfVoteParticipant' in parsed)
  ) {
    return []
  }

  const root = (parsed as Record<string, unknown>)['ArrayOfVoteParticipant']
  if (
    typeof root !== 'object' ||
    root === null ||
    !('VoteParticipant' in (root as Record<string, unknown>))
  ) {
    return []
  }

  const participants = (root as Record<string, unknown>)['VoteParticipant']
  if (!Array.isArray(participants)) return []

  return participants.map((participant: unknown): BallotRecord => {
    const p = participant as Record<string, unknown>

    const personId = Number(p['PersonId'] ?? 0)
    const parliament = Number(p['ParliamentNumber'] ?? 0)
    const session = Number(p['SessionNumber'] ?? 0)
    const divisionNumber = Number(p['DecisionDivisionNumber'] ?? 0)

    // Boolean values may come as string "true"/"false" from XML
    const parseXmlBool = (val: unknown): boolean => {
      if (typeof val === 'boolean') return val
      return String(val).toLowerCase() === 'true'
    }

    return {
      id: `${voteId}-${personId}`,
      voteId,
      personId,
      parliamentNumber: parliament,
      sessionNumber: session,
      divisionNumber,
      firstName: String(p['PersonOfficialFirstName'] ?? '').trim(),
      lastName: String(p['PersonOfficialLastName'] ?? '').trim(),
      constituency: String(p['ConstituencyName'] ?? '').trim() || null,
      province: String(p['ConstituencyProvinceTerritoryName'] ?? '').trim() || null,
      caucusShortName: String(p['CaucusShortName'] ?? '').trim() || null,
      ballotValue: String(p['VoteValueName'] ?? '').trim(),
      isYea: parseXmlBool(p['IsVoteYea']),
      isNay: parseXmlBool(p['IsVoteNay']),
      isPaired: parseXmlBool(p['IsVotePaired']),
    }
  })
}
