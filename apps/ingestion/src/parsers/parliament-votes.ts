import { XMLParser } from 'fast-xml-parser'

export interface VoteRecord {
  id: string // "{parliament}-{session}-{divisionNumber}"
  parliamentNumber: number
  sessionNumber: number
  parlSessionCode: string
  divisionNumber: number
  voteDate: string // ISO date string
  voteDateTime: string // ISO datetime string
  subject: string
  resultName: string
  yeasTotal: number
  naysTotal: number
  pairedTotal: number
  documentTypeName: string | null
  billNumberCode: string | null // null when vote is not on a bill
  rawData: Record<string, unknown>
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // Force array mode for Vote elements — prevents single-element collapse (Pitfall 6)
  isArray: (name) => ['Vote'].includes(name),
  parseAttributeValue: false,
  trimValues: true,
})

/**
 * Parses ArrayOfVote XML from ourcommons.ca into VoteRecord array.
 * Handles empty XML, single-vote XML (isArray safety), and nullable BillNumberCode.
 *
 * @param xml - Raw XML string from https://www.ourcommons.ca/members/en/votes/xml?parlSession={parliament}-{session}
 * @param parlSessionCode - e.g. "44-1"
 */
export function parseVotesXml(xml: string, parlSessionCode: string): VoteRecord[] {
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
    !('ArrayOfVote' in parsed)
  ) {
    return []
  }

  const root = (parsed as Record<string, unknown>)['ArrayOfVote']
  if (typeof root !== 'object' || root === null || !('Vote' in (root as Record<string, unknown>))) {
    return []
  }

  const votes = (root as Record<string, unknown>)['Vote']
  if (!Array.isArray(votes)) return []

  return votes.map((vote: unknown): VoteRecord => {
    const v = vote as Record<string, unknown>

    const parliament = Number(v['ParliamentNumber'] ?? 0)
    const session = Number(v['SessionNumber'] ?? 0)
    const divisionNumber = Number(v['DecisionDivisionNumber'] ?? 0)
    const rawBillCode = String(v['BillNumberCode'] ?? '').trim()
    const dateTimeStr = String(v['DecisionEventDateTime'] ?? '')

    return {
      id: `${parliament}-${session}-${divisionNumber}`,
      parliamentNumber: parliament,
      sessionNumber: session,
      parlSessionCode,
      divisionNumber,
      voteDate: dateTimeStr ? (dateTimeStr.split('T')[0] ?? '') : '',
      voteDateTime: dateTimeStr,
      subject: String(v['DecisionDivisionSubject'] ?? '').trim(),
      resultName: String(v['DecisionResultName'] ?? '').trim(),
      yeasTotal: Number(v['DecisionDivisionNumberOfYeas'] ?? 0),
      naysTotal: Number(v['DecisionDivisionNumberOfNays'] ?? 0),
      pairedTotal: Number(v['DecisionDivisionNumberOfPaired'] ?? 0),
      documentTypeName: String(v['DecisionDivisionDocumentTypeName'] ?? '').trim() || null,
      billNumberCode: rawBillCode.length > 0 ? rawBillCode : null,
      rawData: v as Record<string, unknown>,
    }
  })
}
