/**
 * Canada.ca press releases downloader
 *
 * Sources:
 *   1. canada.ca news results listing: https://www.canada.ca/en/news/advanced-news-search/news-results.html
 *   2. Individual press release detail pages
 *   3. PM RSS feed: https://pm.gc.ca/en/news.rss
 *
 * Polite scraping:
 *   - User-Agent: GovTrace/1.0 (https://govtrace.ca; civic tech; open data)
 *   - 1500ms delay is the CALLER's responsibility — this module does not sleep
 *   - Returns raw HTML/XML strings for the parser to process
 *
 * Pitfall 1: Akamai returns HTTP 200 with 404 body — always check response body.
 */

const BASE_URL = 'https://www.canada.ca'
const PM_RSS_URL = 'https://pm.gc.ca/en/news.rss'
const USER_AGENT = 'GovTrace/1.0 (https://govtrace.ca; civic tech; open data)'

/**
 * Checks whether an HTML response body is a soft 404.
 * canada.ca CDN (Akamai) returns HTTP 200 with an error page body.
 */
function isSoft404(body: string): boolean {
  return (
    body.includes('<title>Not Found') ||
    body.includes('<title>404') ||
    body.includes("couldn't find that Web page") ||
    body.includes('Error 404') ||
    body.includes('page not found')
  )
}

/**
 * Fetches a listing page from the canada.ca news results pagination.
 *
 * @param idx - Pagination offset (0, 10, 20, …)
 * @returns Raw HTML string of the listing page
 * @throws Error on non-200 response or soft 404
 */
export async function fetchListingPage(idx: number): Promise<string> {
  const url = `${BASE_URL}/en/news/advanced-news-search/news-results.html?idx=${idx}`

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,*/*',
    },
  })

  if (!response.ok) {
    throw new Error(`fetchListingPage failed for idx=${idx}: HTTP ${response.status} ${response.statusText}`)
  }

  const html = await response.text()

  if (isSoft404(html)) {
    throw new Error(`fetchListingPage soft 404 for idx=${idx}`)
  }

  return html
}

/**
 * Fetches an individual press release detail page.
 *
 * @param url - Full URL to the individual press release
 * @returns Raw HTML string of the detail page
 * @throws Error on non-200 response or soft 404
 */
export async function fetchDetailPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,*/*',
    },
  })

  if (!response.ok) {
    throw new Error(`fetchDetailPage failed for ${url}: HTTP ${response.status} ${response.statusText}`)
  }

  const html = await response.text()

  if (isSoft404(html)) {
    throw new Error(`fetchDetailPage soft 404 for ${url}`)
  }

  return html
}

/**
 * Fetches the PM Office RSS feed.
 *
 * @returns Raw RSS XML string
 * @throws Error on non-200 response
 */
export async function fetchPmRssFeed(): Promise<string> {
  const response = await fetch(PM_RSS_URL, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/rss+xml,application/xml,text/xml,*/*',
    },
  })

  if (!response.ok) {
    throw new Error(`fetchPmRssFeed failed: HTTP ${response.status} ${response.statusText}`)
  }

  return await response.text()
}
