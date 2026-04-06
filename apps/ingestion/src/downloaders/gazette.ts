/**
 * Canada Gazette downloader
 * Source: https://gazette.gc.ca
 *
 * Two functions:
 *   discoverIssueUrls(startYear, endYear) — walks biweekly dates to build Part II issue URL list
 *   fetchIssueIndex(issueUrl) — fetches raw HTML for one issue index page
 *
 * Polite scraping:
 *   - User-Agent: GovTrace/1.0 (https://govtrace.ca; civic tech; open data)
 *   - 1500ms delay is the CALLER's responsibility — this module does not sleep
 *   - Returns raw HTML strings for the parser to process
 */

const BASE_URL = 'https://gazette.gc.ca'
const USER_AGENT = 'GovTrace/1.0 (https://govtrace.ca; civic tech; open data)'

/**
 * Pads a number to two digits (e.g. 3 -> "03").
 */
function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Builds a candidate list of biweekly Part II issue URLs for a given year.
 * Part II publishes approximately every two weeks (26 issues/year).
 * We walk from January 1 in 14-day increments to generate candidates.
 */
function buildCandidateUrls(year: number): string[] {
  const urls: string[] = []
  // Walk from Jan 1 in 14-day increments through December
  const start = new Date(`${year}-01-01`)
  const end = new Date(`${year}-12-31`)
  let current = new Date(start)

  while (current <= end) {
    const yyyy = current.getFullYear()
    const mm = pad2(current.getMonth() + 1)
    const dd = pad2(current.getDate())
    const dateStr = `${yyyy}-${mm}-${dd}`
    urls.push(`${BASE_URL}/rp-pr/p2/${yyyy}/${dateStr}/html/index-eng.html`)
    // Advance 14 days
    current = new Date(current.getTime() + 14 * 24 * 60 * 60 * 1000)
  }

  return urls
}

/**
 * Probes a URL to see if an issue exists at that date.
 * gazette.gc.ca returns HTTP 200 for non-existent pages (soft 404),
 * so we must fetch the body and check for "Error 404" in the content.
 * Real issue pages contain "Canada Gazette, Part II".
 */
async function probeUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html',
      },
    })
    if (!response.ok) return null
    const html = await response.text()
    // Soft 404 detection — gazette.gc.ca returns 200 with error page
    if (html.includes('Error 404') || !html.includes('Canada Gazette')) return null
    return url
  } catch {
    return null
  }
}

/**
 * Discovers actual Part II issue URLs for the given year range.
 * Probes candidate biweekly dates — skips 404s.
 * Callers should add 1500ms delays between requests.
 *
 * @param startYear - First year to include (e.g. 2020)
 * @param endYear - Last year to include (e.g. 2026)
 * @returns array of confirmed issue index page URLs
 */
export async function discoverIssueUrls(startYear: number, endYear: number): Promise<string[]> {
  const discovered: string[] = []

  for (let year = startYear; year <= endYear; year++) {
    const candidates = buildCandidateUrls(year)
    console.log(`  [gazette-downloader] Probing ${candidates.length} candidate dates for ${year}...`)

    for (const url of candidates) {
      const confirmed = await probeUrl(url)
      if (confirmed) {
        discovered.push(confirmed)
      }
      // 300ms between probes during discovery
      await new Promise<void>((resolve) => setTimeout(resolve, 300))
    }

    console.log(`  [gazette-downloader] ${year}: found ${discovered.filter((u) => u.includes(`/${year}/`)).length} issues`)
  }

  return discovered
}

/**
 * Fetches the HTML index page for one Canada Gazette Part II issue.
 * Returns raw HTML — parsing is done by the parser module.
 *
 * @param issueUrl - Full URL to the issue index page
 * @returns raw HTML string
 * @throws Error on non-200 HTTP responses
 */
export async function fetchIssueIndex(issueUrl: string): Promise<string> {
  const response = await fetch(issueUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,*/*',
    },
  })

  if (!response.ok) {
    throw new Error(`fetchIssueIndex failed for ${issueUrl}: HTTP ${response.status} ${response.statusText}`)
  }

  return await response.text()
}
