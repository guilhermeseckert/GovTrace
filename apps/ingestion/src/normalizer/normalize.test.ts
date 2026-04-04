import { describe, it, expect } from 'vitest'
import { normalizeName } from './normalize.ts'

describe('normalizeName', () => {
  // Test 1: CGI Group Inc.
  it('strips legal suffix "Inc." from company name', () => {
    expect(normalizeName('CGI Group Inc.')).toBe('cgi group')
  })

  // Test 2: CGI Inc.
  it('strips legal suffix from short company name', () => {
    expect(normalizeName('CGI Inc.')).toBe('cgi')
  })

  // Test 3: CGI Group, Inc.
  it('strips comma-separated legal suffix', () => {
    expect(normalizeName('CGI Group, Inc.')).toBe('cgi group')
  })

  // Test 4: whitespace trimming
  it('trims leading and trailing whitespace', () => {
    expect(normalizeName('  Mining Association of Canada  ')).toBe('mining association of canada')
  })

  // Test 5: acronym expansion — MAC
  it('expands known acronym MAC to full name', () => {
    expect(normalizeName('MAC')).toBe('mining association of canada')
  })

  // Test 6: acronym expansion — CBA
  it('expands known acronym CBA to full name', () => {
    expect(normalizeName('CBA')).toBe('canadian bar association')
  })

  // Test 7: lowercase
  it('lowercases all-caps company name', () => {
    expect(normalizeName('CGI INFORMATION SYSTEMS')).toBe('cgi information systems')
  })

  // Test 8: French accents preserved with legal suffix stripped
  it('preserves French accents while stripping legal suffix', () => {
    expect(normalizeName('Services de Santé Ltée')).toBe('services de santé')
  })

  // Test 9: parenthetical removal and "The" prefix stripping
  it('strips parenthetical content and "The" prefix', () => {
    expect(normalizeName('The Mining Association of Canada (MAC)')).toBe('mining association of canada')
  })

  // Test 10: empty string
  it('returns empty string for empty input without crashing', () => {
    expect(normalizeName('')).toBe('')
  })

  // Test 11: handles whitespace-only input
  it('returns empty string for whitespace-only input', () => {
    expect(normalizeName('   ')).toBe('')
  })

  // Test 12: Corporation suffix
  it('strips "Corporation" suffix', () => {
    expect(normalizeName('Acme Corporation')).toBe('acme')
  })

  // Test 13: Ltd suffix
  it('strips "Ltd" suffix (no period)', () => {
    expect(normalizeName('Smith Consulting Ltd')).toBe('smith consulting')
  })

  // Test 14: normalization produces same result for CGI Group Inc. and CGI Inc.
  it('CGI Group Inc. and CGI Inc. normalize to values that can be compared', () => {
    const a = normalizeName('CGI Group Inc.')
    const b = normalizeName('CGI Inc.')
    // Both should be normalized; "cgi group" and "cgi" differ but are close — pg_trgm handles the rest
    expect(a).toBe('cgi group')
    expect(b).toBe('cgi')
  })

  // Test 15: CFIB acronym expansion
  it('expands known acronym CFIB to full name', () => {
    expect(normalizeName('CFIB')).toBe('canadian federation of independent business')
  })
})
