import { stripLegalSuffixes } from './strip-suffixes.ts'
import { expandAcronym } from './acronyms.ts'

/**
 * Normalizes an entity name for matching comparison.
 * Pipeline: expand acronym → lowercase → strip legal suffixes → collapse whitespace
 * This is the canonical form stored in normalized_name columns and used for pg_trgm GIN index.
 * Order: acronym expansion before suffix stripping (avoid stripping from expanded names mid-word)
 */
export function normalizeName(input: string): string {
  if (!input || input.trim() === '') return ''

  let name = input.trim()

  // Step 1: try acronym expansion (whole-name only)
  const expanded = expandAcronym(name)
  if (expanded !== name) return expanded.toLowerCase()

  // Step 2: lowercase
  name = name.toLowerCase()

  // Step 3: strip legal suffixes (also handles parentheticals and "The")
  name = stripLegalSuffixes(name)

  // Step 4: flip "Last, First" → "First Last" for person names
  // Only flip if: single comma, both parts are short (person-like), no company indicators
  const commaIdx = name.indexOf(',')
  if (commaIdx > 0 && name.indexOf(',', commaIdx + 1) === -1) {
    const before = name.slice(0, commaIdx).trim()
    const after = name.slice(commaIdx + 1).trim()
    const isCompany = /\b(inc|ltd|corp|llc|association|council|commission|foundation|institute|university|college|government|department|canada)\b/.test(name)
    if (!isCompany && before.length > 0 && after.length > 0 && before.split(' ').length <= 3 && after.split(' ').length <= 4) {
      name = `${after} ${before}`
    }
  }

  // Step 5: collapse multiple whitespace and punctuation
  name = name.replace(/[,._-]+/g, ' ').replace(/\s+/g, ' ').trim()

  return name
}
