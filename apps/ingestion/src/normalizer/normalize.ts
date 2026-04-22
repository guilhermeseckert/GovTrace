import { expandAcronym } from './acronyms.ts'
import { honAfterCommaRe, honPrefixRe } from './honorifics.ts'
import { stripLegalSuffixes } from './strip-suffixes.ts'

// U+2502 box-drawing char + bilingual-column phrases are CSV artifacts, not
// entity names. Reject by returning '' — downstream matcher already treats
// empty normalized_name as "skip" (see matcher/deterministic.ts findDeterministicMatch).
// Hoisted to module scope per Biome perf rule; matches U+2502 ("│"), U+007C
// ASCII pipe, and common bilingual column labels like "report / rapport".
const BILINGUAL_ARTIFACT_RE = /batch\s+report[\s│|/]*rapport\s+en\s+lots|rapport\s+en\s+lots[\s│|/]*batch\s+report/i

/**
 * Normalizes an entity name for matching comparison (V3).
 *
 * Pipeline:
 *   1. whitespace/empty guard → return ''
 *   2. whole-name acronym expansion (early return if matched)
 *   3. strip parentheticals "(…)" and leading "the/la/le/les"
 *   4. lowercase
 *   5. strip honorifics — prefix AND post-comma, iterate until stable
 *   6. strip legal suffixes (Inc., Ltd., Corp., Ltée, etc.)
 *   7. flip "Last, First" → "First Last" for person-looking names
 *      (guarded by a company-indicator list — departments / orgs keep their comma form)
 *   8. collapse punctuation [,._-]+ and whitespace
 *   9. strip single-letter middle/trailing initials iteratively
 *      (guarded against collapsing to a single-token residue — Pitfall 2)
 *
 * This is the canonical form stored in `normalized_name` columns and used
 * for the pg_trgm GIN index. Idempotent: normalizeName(normalizeName(x)) === normalizeName(x).
 */
export function normalizeName(input: string): string {
  if (!input || input.trim() === '') return ''

  let name = input.trim()

  // Reject bilingual CSV-header artifacts (e.g. "batch report│rapport en lots").
  // These are column-header strings that bleed into data rows during CSV
  // parsing and must NEVER become entities. Returning '' signals skip to the
  // matcher, which already bails out on empty normalizedName.
  if (BILINGUAL_ARTIFACT_RE.test(name)) return ''

  // Step 1: try acronym expansion (whole-name only). Unchanged from V2.
  const expanded = expandAcronym(name)
  if (expanded !== name) return expanded.toLowerCase()

  // Step 2: strip parentheticals and leading "the/la/le/les".
  name = name.replace(/\s*\([^)]*\)\s*/g, ' ').trim()
  name = name.replace(/^(the|la|le|les)\s+/i, '').trim()

  // Step 3: lowercase.
  name = name.toLowerCase()

  // Step 4: strip honorifics — prefix AND post-comma, iterate until stable.
  //   Handles "Dr. Ravi Kakar", "Trudeau, Right Honourable Justin", chained prefixes.
  //   Collapse consecutive commas that can result from stripping (e.g.
  //   "trudeau, right honourable, justin" → "trudeau, , justin" → "trudeau, justin").
  let prev = ''
  while (prev !== name) {
    prev = name
    name = name.replace(honPrefixRe, '').trim()
    name = name.replace(honAfterCommaRe, ',').trim()
    name = name.replace(/,\s*,/g, ',').trim()
  }

  // Step 5: strip legal suffixes (also idempotent).
  name = stripLegalSuffixes(name)

  // Step 6: flip "Last, First" → "First Last" for person names only.
  //   Guarded by a company-indicator regex — orgs / departments keep their form.
  const commaIdx = name.indexOf(',')
  if (commaIdx > 0 && name.indexOf(',', commaIdx + 1) === -1) {
    const before = name.slice(0, commaIdx).trim()
    const after = name.slice(commaIdx + 1).trim()
    const isCompany =
      /\b(inc|ltd|corp|llc|association|council|commission|foundation|institute|university|college|government|department|canada|ministry|agency|office|bank|holdings|pharmacy|dental|medical|clinic)\b/.test(
        name,
      )
    if (
      !isCompany &&
      before.length > 0 &&
      after.length > 0 &&
      before.split(/\s+/).length <= 4 &&
      after.split(/\s+/).length <= 5
    ) {
      name = `${after} ${before}`
    }
  }

  // Step 7: collapse punctuation and whitespace.
  name = name.replace(/[,._-]+/g, ' ').replace(/\s+/g, ' ').trim()

  // Step 8: strip single-letter middle/trailing initials iteratively.
  //   Guard against Pitfall 2: if stripping would leave fewer than 2 tokens,
  //   keep the initial as a distinguishing token (preserves "e arjomardi").
  prev = ''
  while (prev !== name) {
    prev = name
    const candidate = name.replace(/\s+[a-z](?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim()
    if (candidate.split(' ').length >= 2) {
      name = candidate
    } else {
      break
    }
  }

  return name
}
