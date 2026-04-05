import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { parseIatiFile } from './international-aid.ts'

const FIXTURE_PATH = join(import.meta.dirname, '__fixtures__/iati-sample.xml')

describe('parseIatiFile', () => {
  it('extracts iati-identifier as id from sample XML', () => {
    const records = parseIatiFile(FIXTURE_PATH, 'testhash123')
    expect(records).toHaveLength(2)
    expect(records[0]?.id).toBe('CA-3-A031268001')
    expect(records[1]?.id).toBe('CA-3-B099123001')
  })

  it('extracts EN narrative for projectTitle, falling back to FR if EN absent', () => {
    const records = parseIatiFile(FIXTURE_PATH, 'testhash123')
    // Activity 1: has EN narrative
    expect(records[0]?.projectTitle).toBe('Canadian-Caribbean Cooperation Fund')
    // Activity 2: has FR only — must fall back
    expect(records[1]?.projectTitle).toBe('Projet de développement régional en Afrique')
  })

  it('extracts participating-org role="4" as implementerName', () => {
    const records = parseIatiFile(FIXTURE_PATH, 'testhash123')
    expect(records[0]?.implementerName).toBe(
      'Public Works and Government Services Canada - Consulting and Audit Canada',
    )
  })

  it('extracts participating-org role="3" as fundingDepartment', () => {
    const records = parseIatiFile(FIXTURE_PATH, 'testhash123')
    expect(records[0]?.fundingDepartment).toBe('Canadian International Development Agency')
  })

  it('sums budget type="1" values as totalBudgetCad', () => {
    const records = parseIatiFile(FIXTURE_PATH, 'testhash123')
    // Activity 1: 500000 + 750000 = 1250000
    expect(Number(records[0]?.totalBudgetCad)).toBeCloseTo(1250000, 2)
    // Activity 2: 1000000
    expect(Number(records[1]?.totalBudgetCad)).toBeCloseTo(1000000, 2)
  })

  it('sums transaction type="3" (disbursements) as totalDisbursedCad, including negative values', () => {
    const records = parseIatiFile(FIXTURE_PATH, 'testhash123')
    // Activity 1: 250000.50 + (-50000) = 200000.50
    expect(Number(records[0]?.totalDisbursedCad)).toBeCloseTo(200000.5, 2)
  })

  it('sums transaction type="2" (commitments) as totalCommittedCad', () => {
    const records = parseIatiFile(FIXTURE_PATH, 'testhash123')
    // Activity 1: 17933718.13
    expect(Number(records[0]?.totalCommittedCad)).toBeCloseTo(17933718.13, 2)
    // Activity 2: 1000000
    expect(Number(records[1]?.totalCommittedCad)).toBeCloseTo(1000000, 2)
  })

  it('handles #text extraction from value elements with attributes', () => {
    const records = parseIatiFile(FIXTURE_PATH, 'testhash123')
    // The <value value-date="...">500000</value> elements should extract numeric values correctly
    // This verifies the #text handling is working (if broken, values would be 0 or NaN)
    expect(Number(records[0]?.totalBudgetCad)).toBeGreaterThan(0)
    expect(Number(records[0]?.totalCommittedCad)).toBeGreaterThan(0)
  })

  it('handles single-element arrays correctly due to isArray config', () => {
    const records = parseIatiFile(FIXTURE_PATH, 'testhash123')
    // Activity 2 has only one budget — without isArray config it would be an object not array
    // If isArray config is broken, totalBudgetCad would be NaN or 0
    expect(Number(records[1]?.totalBudgetCad)).toBeCloseTo(1000000, 2)
  })

  it('extracts recipient-country code, falls back to recipient-region', () => {
    const records = parseIatiFile(FIXTURE_PATH, 'testhash123')
    // Activity 1 has recipient-country
    expect(records[0]?.recipientCountry).toBe('HT')
    expect(records[0]?.recipientRegion).toBeNull()
    // Activity 2 has recipient-region only
    expect(records[1]?.recipientCountry).toBeNull()
    expect(records[1]?.recipientRegion).toBe('380')
  })

  it('strips BOM from XML content', async () => {
    // Write a copy of the fixture with BOM prepended
    const tmpDir = join(tmpdir(), 'govtrace-test')
    mkdirSync(tmpDir, { recursive: true })
    const bomPath = join(tmpDir, 'iati-bom.xml')
    const originalContent = readFileSync(FIXTURE_PATH, 'utf-8')
    writeFileSync(bomPath, '\uFEFF' + originalContent, 'utf-8')
    // Should parse without error — BOM causes XMLParser to fail if not stripped
    const records = parseIatiFile(bomPath, 'bomhash')
    expect(records).toHaveLength(2)
    expect(records[0]?.id).toBe('CA-3-A031268001')
  })

  it('handles activity with missing implementer (implementerName is null)', () => {
    const records = parseIatiFile(FIXTURE_PATH, 'testhash123')
    // Activity 2 has no role="4" participating-org
    expect(records[1]?.implementerName).toBeNull()
    expect(records[1]?.normalizedImplementerName).toBeNull()
  })
})
