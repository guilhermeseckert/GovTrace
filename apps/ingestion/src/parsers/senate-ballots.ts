import { load } from 'cheerio'

export interface ParsedSenateBallot {
  senatorId: number       // from senator URL link (e.g. /senator/207812/)
  firstName: string
  lastName: string
  groupAffiliation: string  // C, ISG, CSG, PSG, Non-affiliated
  province: string
  ballotValue: string       // "Yea" | "Nay" | "Abstention"
}

/**
 * Extracts senator ID from a sencanada.ca senator URL.
 * URL pattern: /en/in-the-chamber/votes/senator/{id}/{parl}-{session}
 * Returns 0 if not found.
 */
function extractSenatorIdFromHref(href: string): number {
  const match = href.match(/\/senator\/(\d+)\//)
  return match ? Number(match[1]) : 0
}

/**
 * Parses a senator name in "Surname, FirstName" format into first and last name.
 * Senate pages display names as "Smith, John" — the comma separates last from first.
 * Handles "Smith, John A." and multi-part surnames like "St. Germain, Gerry".
 */
function parseSenatorName(raw: string): { firstName: string; lastName: string } {
  const trimmed = raw.trim()
  const commaIdx = trimmed.indexOf(',')

  if (commaIdx === -1) {
    // No comma — split on last space as fallback
    const parts = trimmed.split(/\s+/)
    const lastName = parts.pop() ?? trimmed
    const firstName = parts.join(' ')
    return { firstName, lastName }
  }

  const lastName = trimmed.slice(0, commaIdx).trim()
  const firstName = trimmed.slice(commaIdx + 1).trim()
  return { firstName, lastName }
}

/**
 * Parses the vote detail HTML page for a single Senate vote.
 * Returns per-senator ballot records. Returns empty array on failure.
 *
 * The vote detail table has columns:
 *   Senator (linked) | Group | Province/Territory | Vote (Yea/Nay/Abstention)
 *
 * @param html - Raw HTML from sencanada.ca/en/in-the-chamber/votes/details/{voteId}/{parl}-{session}
 */
export function parseSenateVoteDetailHtml(html: string): ParsedSenateBallot[] {
  if (!html || html.trim().length === 0) return []

  let $: ReturnType<typeof load>
  try {
    $ = load(html)
  } catch {
    return []
  }

  const ballots: ParsedSenateBallot[] = []

  // Find table rows that contain senator links
  // sencanada.ca renders the detail table with links to /senator/{id}/
  const tableRows = $('table tr, .table tr').filter((_, el) => {
    return $(el).find('a[href*="/senator/"]').length > 0
  })

  tableRows.each((_, row) => {
    const $row = $(row)
    const cells = $row.find('td')

    if (cells.length < 3) return // Need at least senator, group/province, vote

    // Extract senator ID from the link
    const senatorLink = $row.find('a[href*="/senator/"]').first()
    const href = senatorLink.attr('href') ?? ''
    const senatorId = extractSenatorIdFromHref(href)

    if (!senatorId) return // Skip rows without a valid senator ID

    // Parse senator name from the link text
    const rawName = senatorLink.text().trim()
    const { firstName, lastName } = parseSenatorName(rawName)

    if (!lastName) return // Skip rows with no parseable name

    const cellTexts = cells.map((_, el) => $(el).text().trim()).get()

    // Column identification: senator name is first, then group, province, vote
    // The exact positions vary slightly but follow a consistent pattern
    let groupAffiliation = ''
    let province = ''
    let ballotValue = ''

    // Known group affiliations
    const KNOWN_GROUPS = new Set(['C', 'ISG', 'CSG', 'PSG', 'Non-affiliated', 'Vacant'])
    // Known ballot values
    const KNOWN_BALLOT_VALUES = new Set(['Yea', 'Nay', 'Abstention'])
    // Canadian provinces/territories
    const KNOWN_PROVINCES = new Set([
      'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador',
      'Northwest Territories', 'Nova Scotia', 'Nunavut', 'Ontario', 'Prince Edward Island',
      'Quebec', 'Saskatchewan', 'Yukon',
      // French names
      'Colombie-Britannique', 'Nouveau-Brunswick', 'Nouvelle-Écosse', 'Terre-Neuve-et-Labrador',
      'Territoires du Nord-Ouest', 'Île-du-Prince-Édouard',
    ])

    for (const text of cellTexts) {
      if (KNOWN_BALLOT_VALUES.has(text)) {
        ballotValue = text
      } else if (KNOWN_GROUPS.has(text)) {
        groupAffiliation = text
      } else if (KNOWN_PROVINCES.has(text)) {
        province = text
      }
    }

    // Fallback: if still missing values, use positional approach
    // Typical columns: [name] [group] [province] [vote]
    if (!groupAffiliation && cellTexts.length >= 2) {
      groupAffiliation = cellTexts[1] ?? ''
    }
    if (!province && cellTexts.length >= 3) {
      province = cellTexts[2] ?? ''
    }
    if (!ballotValue && cellTexts.length >= 4) {
      const lastCell = cellTexts[cellTexts.length - 1] ?? ''
      if (KNOWN_BALLOT_VALUES.has(lastCell)) ballotValue = lastCell
    }

    if (!ballotValue) return // Skip rows without a parseable vote

    ballots.push({
      senatorId,
      firstName,
      lastName,
      groupAffiliation,
      province,
      ballotValue,
    })
  })

  return ballots
}
