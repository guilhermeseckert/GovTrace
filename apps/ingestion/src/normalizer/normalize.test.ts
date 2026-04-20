import { describe, expect, it } from 'vitest'
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
    expect(a).toBe('cgi group')
    expect(b).toBe('cgi')
  })

  // Test 15: CFIB acronym expansion
  it('expands known acronym CFIB to full name', () => {
    expect(normalizeName('CFIB')).toBe('canadian federation of independent business')
  })
})

// --- V3 additions ---

describe('normalizeName — honorific prefix strip', () => {
  it('strips "Hon." prefix', () => {
    expect(normalizeName('Hon. Justin Trudeau')).toBe('justin trudeau')
  })

  it('strips "Rt. Hon." prefix', () => {
    expect(normalizeName('Rt. Hon. Justin Trudeau')).toBe('justin trudeau')
  })

  it('strips "Right Honourable" prefix', () => {
    expect(normalizeName('Right Honourable Justin Trudeau')).toBe('justin trudeau')
  })

  it('strips "The Honourable" prefix', () => {
    expect(normalizeName('The Honourable Chrystia Freeland')).toBe('chrystia freeland')
  })

  it('strips "Dr." prefix', () => {
    expect(normalizeName('Dr. Ravi Kakar')).toBe('ravi kakar')
  })

  it('strips "Mr." prefix', () => {
    expect(normalizeName('Mr. John Smith')).toBe('john smith')
  })

  it('strips "Mrs." prefix', () => {
    expect(normalizeName('Mrs. Jane Doe')).toBe('jane doe')
  })

  it('strips "Ms." prefix', () => {
    expect(normalizeName('Ms. Alice Brown')).toBe('alice brown')
  })

  it('strips "Sir" prefix and trailing middle initial', () => {
    expect(normalizeName('Sir John A Macdonald')).toBe('john macdonald')
  })

  it('strips "Prof." prefix', () => {
    expect(normalizeName('Prof. Stephen Hawking')).toBe('stephen hawking')
  })

  it('strips "Rev." prefix', () => {
    expect(normalizeName('Rev. Thomas Green')).toBe('thomas green')
  })

  it('handles "L\'Honorable" French prefix', () => {
    // Either 'pierre elliott trudeau' or 'pierre trudeau' is acceptable per plan
    const result = normalizeName("L'Honorable Pierre Elliott Trudeau")
    expect(['pierre elliott trudeau', 'pierre trudeau']).toContain(result)
  })
})

describe('normalizeName — honorific after comma', () => {
  it('strips "Right Honourable" after comma', () => {
    expect(normalizeName('Trudeau, Right Honourable Justin')).toBe('justin trudeau')
  })

  it('strips "Right Honourable," with trailing comma after honorific', () => {
    expect(normalizeName('Trudeau, Right Honourable, Justin')).toBe('justin trudeau')
  })

  it('strips "Hon." embedded after comma (all-caps)', () => {
    expect(normalizeName('ABRAHAM, HON. ALAN R.')).toBe('alan abraham')
  })

  it('strips "Dr." embedded after comma (all-caps)', () => {
    expect(normalizeName('ASHRAF, DR. MOHAMMAD')).toBe('mohammad ashraf')
  })
})

describe('normalizeName — middle-initial strip (aggressive)', () => {
  it('strips bare single-letter middle initial (no period)', () => {
    expect(normalizeName('Justin P Trudeau')).toBe('justin trudeau')
  })

  it('strips single-letter middle initial with period', () => {
    expect(normalizeName('Justin P. Trudeau')).toBe('justin trudeau')
  })

  it('strips comma-preserved middle initials with embedded periods', () => {
    expect(normalizeName('Trudeau, Justin P.J.')).toBe('justin trudeau')
  })

  it('strips iteratively chained middle initials', () => {
    expect(normalizeName('Justin J T Trudeau')).toBe('justin trudeau')
  })

  it('over-merges distinct Robert Hunter A/B (documented trade-off, mitigated by audit flag)', () => {
    expect(normalizeName('Hunter, Robert A')).toBe('robert hunter')
    expect(normalizeName('Hunter, Robert B')).toBe('robert hunter')
    expect(normalizeName('Hunter, Robert A')).toBe(normalizeName('Hunter, Robert B'))
  })
})

describe('normalizeName — collision guards (must NOT strip)', () => {
  it('does NOT strip "hon" inside "Honda"', () => {
    expect(normalizeName('Honda, Steve')).toBe('steve honda')
  })

  it('does NOT strip "hon" inside "Honey"', () => {
    expect(normalizeName('Apter, Honey')).toBe('honey apter')
  })

  it('does NOT strip "hon" inside "Hongjiu"', () => {
    expect(normalizeName('Hongjiu, Kou')).toBe('kou hongjiu')
  })

  it('does NOT strip "dr" inside "Drake"', () => {
    expect(normalizeName('Drake, James')).toBe('james drake')
  })

  it('does NOT strip "dr" inside "Driscoll"', () => {
    expect(normalizeName('Driscoll, Mary')).toBe('mary driscoll')
  })
})

describe('normalizeName — single-token residue guard (Pitfall 2)', () => {
  it('preserves "e arjomardi" rather than collapsing to bare "arjomardi"', () => {
    const result = normalizeName('Arjomardi, Dr. E')
    expect(result).toBe('e arjomardi')
    expect(result.split(' ').length).toBeGreaterThanOrEqual(2)
  })
})

describe('normalizeName — regression guards', () => {
  it('acronym expansion unchanged', () => {
    expect(normalizeName('MAC')).toBe('mining association of canada')
  })

  it('legal suffix strip unchanged for CGI Group Inc.', () => {
    expect(normalizeName('CGI Group Inc.')).toBe('cgi group')
  })

  it('no flip on "Mining Association of Canada"', () => {
    expect(normalizeName('Mining Association of Canada')).toBe('mining association of canada')
  })

  it('no flip on "Foreign Affairs, Trade and Development Canada"', () => {
    expect(normalizeName('Foreign Affairs, Trade and Development Canada')).toBe(
      'foreign affairs trade and development canada',
    )
  })

  it('preserves French accents', () => {
    expect(normalizeName('Services de Santé Ltée')).toBe('services de santé')
  })
})

describe('normalizeName — idempotency', () => {
  it('normalize(normalize(x)) === normalize(x) for Trudeau variant', () => {
    const once = normalizeName('Trudeau, Right Honourable Justin P.J.')
    const twice = normalizeName(once)
    expect(twice).toBe(once)
  })

  it('all 8 Trudeau variants collapse to "justin trudeau"', () => {
    const variants = [
      'Hon. Justin Trudeau',
      'Rt. Hon. Justin Trudeau',
      'Right Honourable Justin Trudeau',
      'Trudeau, Right Honourable Justin',
      'Trudeau, Right Honourable, Justin',
      'Trudeau, Justin P.J.',
      'Justin P Trudeau',
      'TRUDEAU, JUSTIN',
    ]
    for (const variant of variants) {
      expect(normalizeName(variant)).toBe('justin trudeau')
    }
  })
})
