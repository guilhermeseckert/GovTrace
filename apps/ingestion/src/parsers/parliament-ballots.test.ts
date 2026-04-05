import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { parseVoteBallotsXml } from './parliament-ballots.ts'

const FIXTURES_DIR = resolve(import.meta.dirname, '__fixtures__')

describe('parseVoteBallotsXml', () => {
  it('parses multi-participant XML into BallotRecord array with all fields', () => {
    const xml = readFileSync(resolve(FIXTURES_DIR, 'parliament-ballots-sample.xml'), 'utf-8')
    const records = parseVoteBallotsXml(xml, '44-1-377')

    expect(records).toHaveLength(4)

    const nayVoter = records[0]
    expect(nayVoter.id).toBe('44-1-377-89156')
    expect(nayVoter.voteId).toBe('44-1-377')
    expect(nayVoter.personId).toBe(89156)
    expect(nayVoter.firstName).toBe('Ziad')
    expect(nayVoter.lastName).toBe('Aboultaif')
    expect(nayVoter.constituency).toBe('Edmonton Manning')
    expect(nayVoter.province).toBe('Alberta')
    expect(nayVoter.caucusShortName).toBe('CPC')
    expect(nayVoter.ballotValue).toBe('Nay')
    expect(nayVoter.isYea).toBe(false)
    expect(nayVoter.isNay).toBe(true)
    expect(nayVoter.isPaired).toBe(false)
  })

  it('correctly maps Yea, Nay, and Paired ballot values', () => {
    const xml = readFileSync(resolve(FIXTURES_DIR, 'parliament-ballots-sample.xml'), 'utf-8')
    const records = parseVoteBallotsXml(xml, '44-1-377')

    const yeaVoter = records.find((r) => r.personId === 12345)
    expect(yeaVoter?.ballotValue).toBe('Yea')
    expect(yeaVoter?.isYea).toBe(true)
    expect(yeaVoter?.isNay).toBe(false)

    const pairedVoter = records.find((r) => r.personId === 67890)
    expect(pairedVoter?.ballotValue).toBe('Paired')
    expect(pairedVoter?.isPaired).toBe(true)
  })

  it('handles French-accented names without corruption', () => {
    const xml = readFileSync(resolve(FIXTURES_DIR, 'parliament-ballots-sample.xml'), 'utf-8')
    const records = parseVoteBallotsXml(xml, '44-1-377')

    const frenchMp = records.find((r) => r.personId === 54321)
    expect(frenchMp?.firstName).toBe('Stéphane')
    expect(frenchMp?.lastName).toBe('Lauzon')
    expect(frenchMp?.constituency).toBe('Argenteuil—La Petite-Nation')
  })

  it('handles single-VoteParticipant XML as array (isArray safety)', () => {
    const singleXml = `<?xml version="1.0" encoding="utf-8"?>
<ArrayOfVoteParticipant>
  <VoteParticipant>
    <PersonId>99999</PersonId>
    <ParliamentNumber>44</ParliamentNumber>
    <SessionNumber>1</SessionNumber>
    <DecisionDivisionNumber>100</DecisionDivisionNumber>
    <DecisionEventDateTime>2023-01-15T14:00:00</DecisionEventDateTime>
    <PersonShortSalutation>Mr.</PersonShortSalutation>
    <PersonOfficialFirstName>Test</PersonOfficialFirstName>
    <PersonOfficialLastName>Member</PersonOfficialLastName>
    <ConstituencyName>Test Riding</ConstituencyName>
    <ConstituencyProvinceTerritoryName>Ontario</ConstituencyProvinceTerritoryName>
    <CaucusShortName>LPC</CaucusShortName>
    <VoteValueName>Yea</VoteValueName>
    <IsVoteYea>true</IsVoteYea>
    <IsVoteNay>false</IsVoteNay>
    <IsVotePaired>false</IsVotePaired>
    <DecisionResultName>Agreed To</DecisionResultName>
  </VoteParticipant>
</ArrayOfVoteParticipant>`
    const records = parseVoteBallotsXml(singleXml, '44-1-100')
    expect(Array.isArray(records)).toBe(true)
    expect(records).toHaveLength(1)
    expect(records[0].personId).toBe(99999)
  })
})
