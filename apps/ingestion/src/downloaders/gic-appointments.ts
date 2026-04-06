/**
 * GIC Appointments downloader
 * Source: https://federal-organizations.canada.ca
 *
 * Two functions:
 *   fetchOrganizationIndex() — scrapes /orgs.php?lang=en&t=1 for all ~290 OrgID codes
 *   fetchOrganizationProfile(orgCode) — fetches raw HTML for one org profile page
 *
 * Polite scraping:
 *   - User-Agent: GovTrace/1.0 (https://govtrace.ca; civic tech; open data)
 *   - 200ms delay is the CALLER's responsibility — this module does not sleep
 *   - Returns raw HTML strings for the parser to process
 */

import { load } from 'cheerio'

const BASE_URL = 'https://federal-organizations.canada.ca'
const USER_AGENT = 'GovTrace/1.0 (https://govtrace.ca; civic tech; open data)'

/**
 * Fetches the organization index page and extracts all OrgID codes.
 * Parses links matching /profil.php?OrgID=...
 *
 * @returns array of unique OrgID strings (e.g. ["CBC", "CRTC", ...])
 * @throws Error on non-200 HTTP responses
 */
export async function fetchOrganizationIndex(): Promise<string[]> {
  const url = `${BASE_URL}/orgs.php?lang=en&t=1`
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,*/*',
    },
  })

  if (!response.ok) {
    throw new Error(`fetchOrganizationIndex failed: HTTP ${response.status} ${response.statusText}`)
  }

  const html = await response.text()
  const $ = load(html)
  const orgCodes = new Set<string>()

  // Extract OrgID from links like /profil.php?OrgID=CBC&lang=en
  $('a[href*="profil.php"]').each((_i, el) => {
    const href = $(el).attr('href') ?? ''
    const match = /[?&]OrgID=([^&]+)/i.exec(href)
    if (match?.[1]) {
      orgCodes.add(decodeURIComponent(match[1]).trim())
    }
  })

  return Array.from(orgCodes)
}

/**
 * Fetches the HTML profile page for one federal organization.
 * Returns raw HTML — parsing is done by the parser module.
 *
 * @param orgCode - OrgID code (e.g. "CBC")
 * @returns raw HTML string
 * @throws Error on non-200 HTTP responses
 */
export async function fetchOrganizationProfile(orgCode: string): Promise<string> {
  const url = `${BASE_URL}/profil.php?OrgID=${encodeURIComponent(orgCode)}&lang=en`
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,*/*',
    },
  })

  if (!response.ok) {
    throw new Error(`fetchOrganizationProfile failed for ${orgCode}: HTTP ${response.status} ${response.statusText}`)
  }

  return await response.text()
}
