import { load } from 'cheerio'

export interface ParsedSenateVote {
  voteId: string        // extracted from detail link href (e.g. "612906")
  voteDate: string      // YYYY-MM-DD
  subject: string       // title/motion text
  billNumber: string | null
  yeasTotal: number
  naysTotal: number
  abstentionsTotal: number
  resultName: string    // "Adopted" | "Defeated"
}

/**
 * Maps English month names to zero-padded month numbers.
 * Senate pages show dates like "March 26, 2024" or "26 March 2024".
 */
const MONTH_MAP: Record<string, string> = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12',
  // French month names (bilingual pages may include these)
  janvier: '01',
  'février': '02',
  fevrier: '02',
  mars: '03',
  avril: '04',
  mai: '05',
  juin: '06',
  juillet: '07',
  'août': '08',
  aout: '08',
  septembre: '09',
  octobre: '10',
  novembre: '11',
  'décembre': '12',
  decembre: '12',
}

/**
 * Parses a date string like "March 26, 2024" or "26 March 2024" into YYYY-MM-DD.
 * Returns empty string on failure (don't throw — match House ingestion pattern).
 */
function parseSenateDate(raw: string): string {
  const trimmed = raw.trim()

  // Try "Month DD, YYYY" format (e.g. "March 26, 2024")
  const mdy = trimmed.match(/^(\w+)\s+(\d{1,2}),?\s+(\d{4})$/)
  if (mdy) {
    const month = MONTH_MAP[mdy[1]?.toLowerCase() ?? '']
    const day = (mdy[2] ?? '').padStart(2, '0')
    const year = mdy[3] ?? ''
    if (month && day && year) return `${year}-${month}-${day}`
  }

  // Try "DD Month YYYY" format (e.g. "26 March 2024")
  const dmy = trimmed.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/)
  if (dmy) {
    const day = (dmy[1] ?? '').padStart(2, '0')
    const month = MONTH_MAP[dmy[2]?.toLowerCase() ?? '']
    const year = dmy[3] ?? ''
    if (day && month && year) return `${year}-${month}-${day}`
  }

  // Try ISO format already (YYYY-MM-DD)
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return trimmed

  return ''
}

/**
 * Extracts a Senate vote ID from a detail link URL.
 * URL pattern: /en/in-the-chamber/votes/details/{voteId}/{parl}-{session}
 */
function extractVoteIdFromHref(href: string): string | null {
  const match = href.match(/\/votes\/details\/(\d+)\//)
  return match?.[1] ?? null
}

/**
 * Parses the vote listing HTML page for a Senate session.
 * Returns an array of parsed vote records. Returns empty array on failure.
 *
 * The Senate vote listing table has columns:
 *   Date | Title/Motion | Related Bill | Yeas | Nays | Abstentions | Total | Result
 *
 * @param html - Raw HTML from sencanada.ca/en/in-the-chamber/votes/{parl}-{session}
 * @param sessionCode - e.g. "44-1"
 */
export function parseSenateVoteListingHtml(html: string, sessionCode: string): ParsedSenateVote[] {
  if (!html || html.trim().length === 0) return []

  let $: ReturnType<typeof load>
  try {
    $ = load(html)
  } catch {
    return []
  }

  const votes: ParsedSenateVote[] = []

  // The vote listing table — find rows with vote detail links
  // sencanada.ca renders the votes in a DataTables table; the rows contain detail links
  // Try common table selectors
  const tableRows = $('table tr, .table tr, [data-table] tr').filter((_, el) => {
    return $(el).find('a[href*="/votes/details/"]').length > 0
  })

  tableRows.each((_, row) => {
    const $row = $(row)
    const cells = $row.find('td')

    if (cells.length < 4) return // Skip malformed rows

    // Extract vote ID from the detail link
    const detailLink = $row.find('a[href*="/votes/details/"]').first()
    const href = detailLink.attr('href') ?? ''
    const voteId = extractVoteIdFromHref(href)
    if (!voteId) return // Skip rows without a valid vote ID

    // Parse cells — column order varies slightly by session, but positional approach works
    // Look for date text, motion/subject text, bill reference, vote counts, result
    const cellTexts = cells.map((_, el) => $(el).text().trim()).get()

    // Attempt to identify columns by content patterns
    // Date column: contains month name or numeric date
    let voteDate = ''
    let subject = ''
    let billNumber: string | null = null
    let yeasTotal = 0
    let naysTotal = 0
    let abstentionsTotal = 0
    let resultName = ''

    for (let i = 0; i < cellTexts.length; i++) {
      const text = cellTexts[i] ?? ''

      // Date: matches date patterns
      if (!voteDate && /\b\d{4}\b/.test(text) && text.length < 40) {
        const parsed = parseSenateDate(text)
        if (parsed) {
          voteDate = parsed
          continue
        }
      }

      // Bill number: matches "C-XX", "S-XX" patterns
      if (!billNumber && /^[CS]-\d+[A-Z]?$/.test(text.trim())) {
        billNumber = text.trim()
        continue
      }

      // Vote counts: pure numbers
      if (/^\d+$/.test(text)) {
        const n = Number(text)
        if (!yeasTotal) { yeasTotal = n; continue }
        if (!naysTotal) { naysTotal = n; continue }
        if (!abstentionsTotal && n < yeasTotal + naysTotal) { abstentionsTotal = n }
        continue
      }

      // Result: "Adopted" or "Defeated"
      if (!resultName && (text === 'Adopted' || text === 'Defeated')) {
        resultName = text
        continue
      }

      // Subject: the longest remaining text (the motion description)
      if (!subject && text.length > 20 && !text.match(/^\d+$/) && text !== resultName) {
        // Use text from link if available, else cell text
        const linkText = $row.find('a[href*="/votes/details/"]').first().text().trim()
        subject = linkText || text
      }
    }

    // Fallback: if subject still empty, use the detail link text
    if (!subject) {
      subject = detailLink.text().trim() || `Senate vote ${voteId}`
    }

    if (!voteDate) return // Skip rows where we couldn't parse a date

    votes.push({
      voteId,
      voteDate,
      subject,
      billNumber,
      yeasTotal,
      naysTotal,
      abstentionsTotal,
      resultName: resultName || 'Unknown',
    })
  })

  return votes
}
