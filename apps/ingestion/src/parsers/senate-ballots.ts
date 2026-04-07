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

  // Find the ballot detail table — sencanada.ca uses id="sc-vote-details-table"
  const tableRows = $('#sc-vote-details-table tbody tr').filter((_, el) => {
    return $(el).find('a[href*="/senator/"]').length > 0
  })

  tableRows.each((_, row) => {
    const $row = $(row)
    const cells = $row.find('td')

    // Table columns: Senator(0), Affiliation(1), Province(2), Yea(3), Nay(4), Abstention(5)
    if (cells.length < 6) return

    // Extract senator ID from the link
    const senatorLink = $row.find('a[href*="/senator/"]').first()
    const href = senatorLink.attr('href') ?? ''
    const senatorId = extractSenatorIdFromHref(href)

    if (!senatorId) return

    // Parse senator name from the link text
    const rawName = senatorLink.text().trim()
    const { firstName, lastName } = parseSenatorName(rawName)

    if (!lastName) return

    const cellTexts = cells.map((_, el) => $(el).text().trim()).get()

    // Columns: Senator(0), Affiliation(1), Province(2), Yea(3), Nay(4), Abstention(5)
    const groupAffiliation = cellTexts[1] ?? ''
    const province = cellTexts[2] ?? ''

    // Detect vote: sencanada.ca uses data-order="aaa" on the active vote column,
    // "zzz" on inactive columns. Check columns 3, 4, 5 for the "aaa" marker.
    let ballotValue = ''
    const yeaCell = cells.eq(3)
    const nayCell = cells.eq(4)
    const abstentionCell = cells.eq(5)

    if (yeaCell.attr('data-order') === 'aaa') {
      ballotValue = 'Yea'
    } else if (nayCell.attr('data-order') === 'aaa') {
      ballotValue = 'Nay'
    } else if (abstentionCell.attr('data-order') === 'aaa') {
      ballotValue = 'Abstention'
    }

    if (!ballotValue) return // Senator didn't vote (absent) or unparseable

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
