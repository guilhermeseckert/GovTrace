/**
 * Honorific titles to strip from entity names.
 *
 * Rules:
 * - Short forms (hon, dr, mr, mrs, ms, prof, rev) REQUIRE a trailing period
 *   to avoid collisions with surnames like Honda, Drake, Honey, Hongjiu.
 * - Full-word forms (honourable, honorable, sir, lady, miss) are matched as
 *   complete whitespace-delimited tokens; they cannot collide with partial surnames.
 * - Do NOT include bare `m\.?` (French "Monsieur") — collides with middle
 *   initial 'm' after lowercasing (e.g. 'Hunkin, John M.').
 *
 * Patterns are regex-escaped strings intended for use inside a `(?:a|b|c)` group.
 */
export const HONORIFICS: readonly string[] = [
  // Multi-word honourifics (must come first for greedy matching)
  'right honourable',
  'right honorable',
  'rt\\. hon\\.?',
  'right hon\\.?',
  'très honorable',
  'tres honorable',
  'the honourable',
  'honourable',
  'the honorable',
  'honorable',
  'hon\\.',
  // French
  "l'honorable",
  'lhonorable',
  // English personal titles — short forms require periods
  'mr\\.?',
  'mrs\\.?',
  'ms\\.?',
  'miss',
  'dr\\.?',
  'prof\\.?',
  'rev\\.?',
  // Unambiguous long-form titles
  'sir',
  'lady',
  // French personal titles (≥ 2 letters — no bare 'm.' collision risk)
  'mme',
  'mlle',
] as const

/**
 * Matches an honorific at the very start of the (lowercased) name,
 * followed by at least one whitespace character.
 * Example: "hon. justin trudeau" → matches "hon. "
 */
export const honPrefixRe = new RegExp(`^(?:${HONORIFICS.join('|')})\\s+`, 'i')

/**
 * Matches an honorific that immediately follows a comma, e.g. "trudeau, right honourable".
 * Requires a word boundary AFTER the honorific (whitespace, comma, or end of string)
 * so that "honda" is not misread as "hon" followed by "da".
 */
export const honAfterCommaRe = new RegExp(
  `,\\s*(?:${HONORIFICS.join('|')})(?=\\s|,|$)`,
  'gi',
)
