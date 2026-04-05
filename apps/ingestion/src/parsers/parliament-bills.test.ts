import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { parseBillsJson } from './parliament-bills.ts'

const FIXTURES_DIR = resolve(import.meta.dirname, '__fixtures__')

describe('parseBillsJson', () => {
  it('parses full bill data into BillRecord array with all fields', () => {
    const json = readFileSync(resolve(FIXTURES_DIR, 'parliament-bills-sample.json'), 'utf-8')
    const records = parseBillsJson(json, '44-1')

    expect(records).toHaveLength(3)

    const fullBill = records.find((r) => r.billNumberFormatted === 'C-69')
    expect(fullBill).toBeDefined()
    expect(fullBill?.id).toBe('42-1-C-69')
    expect(fullBill?.billNumber).toBe('C-69')
    expect(fullBill?.shortTitleEn).toBe('Impact Assessment Act')
    expect(fullBill?.longTitleEn).toContain('Impact Assessment Act')
    expect(fullBill?.billTypeEn).toBe('Government Bill')
    expect(fullBill?.sponsorEn).toBe('Hon. Catherine McKenna')
    expect(fullBill?.currentStatusEn).toBe('Royal Assent')
    expect(fullBill?.receivedRoyalAssentAt).toBe('2019-06-21T00:00:00')
    expect(fullBill?.parlSessionCode).toBe('42-1')
  })

  it('handles null ShortTitleEn gracefully', () => {
    const json = readFileSync(resolve(FIXTURES_DIR, 'parliament-bills-sample.json'), 'utf-8')
    const records = parseBillsJson(json, '44-1')

    const proFormaBill = records.find((r) => r.billNumberFormatted === 'C-1')
    expect(proFormaBill).toBeDefined()
    expect(proFormaBill?.shortTitleEn).toBeNull()
    expect(proFormaBill?.id).toBe('44-1-C-1')
  })

  it('handles null ReceivedRoyalAssentDateTime gracefully', () => {
    const json = readFileSync(resolve(FIXTURES_DIR, 'parliament-bills-sample.json'), 'utf-8')
    const records = parseBillsJson(json, '44-1')

    const pendingBill = records.find((r) => r.billNumberFormatted === 'C-318')
    expect(pendingBill).toBeDefined()
    expect(pendingBill?.receivedRoyalAssentAt).toBeNull()
    expect(pendingBill?.currentStatusEn).toBe('At second reading in the Senate')
  })

  it('constructs bill ID from parlSessionCode + billNumberFormatted', () => {
    const json = readFileSync(resolve(FIXTURES_DIR, 'parliament-bills-sample.json'), 'utf-8')
    const records = parseBillsJson(json, '44-1')

    // Each bill ID uses the bill's own ParlSessionCode (not the passed parlSessionCode)
    const c1 = records.find((r) => r.billNumberFormatted === 'C-1')
    expect(c1?.id).toBe('44-1-C-1')

    const c318 = records.find((r) => r.billNumberFormatted === 'C-318')
    expect(c318?.id).toBe('44-1-C-318')
  })
})
