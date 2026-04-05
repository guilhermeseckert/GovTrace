import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { parseVotesXml } from './parliament-votes.ts'

const FIXTURES_DIR = resolve(import.meta.dirname, '__fixtures__')

describe('parseVotesXml', () => {
  it('parses multi-vote XML into VoteRecord array with all fields', () => {
    const xml = readFileSync(resolve(FIXTURES_DIR, 'parliament-votes-sample.xml'), 'utf-8')
    const records = parseVotesXml(xml, '44-1')

    expect(records).toHaveLength(3)

    const first = records[0]
    expect(first.id).toBe('44-1-377')
    expect(first.parliamentNumber).toBe(44)
    expect(first.sessionNumber).toBe(1)
    expect(first.parlSessionCode).toBe('44-1')
    expect(first.divisionNumber).toBe(377)
    expect(first.subject).toContain('Bill C-69')
    expect(first.resultName).toBe('Agreed To')
    expect(first.yeasTotal).toBe(167)
    expect(first.naysTotal).toBe(145)
    expect(first.pairedTotal).toBe(2)
    expect(first.billNumberCode).toBe('C-69')
    expect(first.documentTypeName).toBe('Legislative Process')
  })

  it('returns empty billNumberCode (null) for motion-only votes', () => {
    const xml = readFileSync(resolve(FIXTURES_DIR, 'parliament-votes-sample.xml'), 'utf-8')
    const records = parseVotesXml(xml, '44-1')

    const motionVote = records[1]
    expect(motionVote.divisionNumber).toBe(378)
    expect(motionVote.billNumberCode).toBeNull()
    expect(motionVote.resultName).toBe('Negatived')
  })

  it('returns empty array for empty XML', () => {
    const emptyXml = '<?xml version="1.0" encoding="utf-8"?><ArrayOfVote></ArrayOfVote>'
    const records = parseVotesXml(emptyXml, '44-1')
    expect(records).toHaveLength(0)
  })

  it('handles single-Vote XML as array (isArray safety)', () => {
    const singleVoteXml = `<?xml version="1.0" encoding="utf-8"?>
<ArrayOfVote>
  <Vote>
    <ParliamentNumber>44</ParliamentNumber>
    <SessionNumber>1</SessionNumber>
    <DecisionDivisionNumber>100</DecisionDivisionNumber>
    <DecisionEventDateTime>2023-01-15T14:00:00</DecisionEventDateTime>
    <DecisionDivisionSubject>Test motion</DecisionDivisionSubject>
    <DecisionResultName>Agreed To</DecisionResultName>
    <DecisionDivisionNumberOfYeas>200</DecisionDivisionNumberOfYeas>
    <DecisionDivisionNumberOfNays>50</DecisionDivisionNumberOfNays>
    <DecisionDivisionNumberOfPaired>0</DecisionDivisionNumberOfPaired>
    <DecisionDivisionDocumentTypeName>Supply</DecisionDivisionDocumentTypeName>
    <DecisionDivisionDocumentTypeId>2</DecisionDivisionDocumentTypeId>
    <BillNumberCode></BillNumberCode>
  </Vote>
</ArrayOfVote>`
    const records = parseVotesXml(singleVoteXml, '44-1')
    expect(Array.isArray(records)).toBe(true)
    expect(records).toHaveLength(1)
    expect(records[0].divisionNumber).toBe(100)
  })
})
