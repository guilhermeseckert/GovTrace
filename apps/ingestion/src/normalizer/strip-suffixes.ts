// Legal entity suffixes to strip from company names (case-insensitive).
// These are ONLY legal registration forms — NOT generic business words.
// Order matters — longer suffixes first to avoid partial matches.
// IMPORTANT: Do NOT include generic words like 'group', 'services', 'canada', etc.
// Those words are meaningful parts of entity names (e.g. "Mining Association of Canada").
const LEGAL_SUFFIXES = [
  'incorporated', 'inc.', 'inc',
  'limited', 'ltd.', 'ltd',
  'corporation', 'corp.', 'corp',
  'ltée', 'ltee', // French equivalents
  'société par actions simplifiée', 'sas',
  'société en nom collectif', 'snc',
  's.a.r.l.', 'sarl',
  'llp', 'lp',
  'g.p.', 'l.p.',
]

/**
 * Strips common legal suffixes from a company name.
 * Input should already be lowercase.
 * Strips suffix only if it appears as a whole word at the end of the name.
 */
export function stripLegalSuffixes(name: string): string {
  let result = name.trim()

  // Strip parenthetical content first: "CGI Group (Canada)" → "CGI Group"
  result = result.replace(/\s*\([^)]*\)\s*/g, ' ').trim()

  // Strip leading "The " / "La " / "Le " / "Les "
  result = result.replace(/^(the|la|le|les)\s+/i, '')

  // Strip trailing legal suffixes (repeat until stable — handles "Inc. Ltd." chains)
  let previous = ''
  while (previous !== result) {
    previous = result
    for (const suffix of LEGAL_SUFFIXES) {
      const escapedSuffix = suffix.replace(/\./g, '\\.')
      const pattern = new RegExp(`[,.]?\\s+${escapedSuffix}\\s*$`, 'i')
      result = result.replace(pattern, '').trim()
    }
  }

  return result.trim()
}
