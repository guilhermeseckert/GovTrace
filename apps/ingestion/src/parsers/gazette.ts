/**
 * Canada Gazette Part II HTML parser
 * Source: gazette.gc.ca Part II issue index pages
 *
 * Parses per-regulation metadata from each biweekly issue index.
 * Extracts: title, SOR/SI number, regulation URL, publication date.
 * Department/enabling act come from individual regulation pages or
 * are inferred from the index page's section headers.
 *
 * Lobbying subject categories are mapped via static keyword lookup —
 * no AI call needed for v1 (Option B from research).
 */

import { load } from 'cheerio'
import { createHash } from 'node:crypto'

export interface ParsedGazetteRegulation {
  id: string // SHA256(sorNumber + 'II' + publicationDate) or SHA256(title + 'II' + publicationDate)
  sorNumber: string | null // e.g., 'SOR/2026-42', 'SI/2026-15'
  title: string
  gazettePart: string // 'II'
  publicationDate: string // YYYY-MM-DD
  registrationDate: string | null
  responsibleDepartment: string | null
  enablingAct: string | null
  gazetteUrl: string // URL to individual regulation page
  lobbyingSubjectCategories: string[]
  sourceFileHash: string
  rawData: Record<string, unknown>
}

// ──────────────────────────────────────────────────────────────────────────────
// Static lobbying subject category mapping (Option B)
// Maps enabling act keywords and department name patterns to lobbying categories.
// Covers ~60-70% of regulations. Unmapped regs get empty array.
// ──────────────────────────────────────────────────────────────────────────────

const ACT_MAPPINGS: [RegExp, string[]][] = [
  [/canadian environmental protection act/i, ['Environment', 'Health']],
  [/fisheries act/i, ['Fisheries', 'Environment']],
  [/species at risk act/i, ['Environment', 'Science and Technology']],
  [/migratory birds convention act/i, ['Environment']],
  [/canada water act/i, ['Environment']],
  [/food and drugs act/i, ['Food and Drugs', 'Health']],
  [/controlled drugs and substances act/i, ['Health', 'Criminal Law and Justice']],
  [/customs act/i, ['International Trade', 'Taxation and Finance']],
  [/customs tariff/i, ['International Trade', 'Taxation and Finance']],
  [/income tax act/i, ['Taxation and Finance']],
  [/excise act/i, ['Taxation and Finance']],
  [/excise tax act/i, ['Taxation and Finance']],
  [/financial administration act/i, ['Taxation and Finance', 'Government Procurement']],
  [/bank act/i, ['Financial Institutions']],
  [/insurance companies act/i, ['Financial Institutions']],
  [/pension benefits standards act/i, ['Financial Institutions', 'Employment and Training']],
  [/aeronautics act/i, ['Transportation', 'Defence']],
  [/canada transportation act/i, ['Transportation']],
  [/motor vehicle safety act/i, ['Transportation', 'Consumer Issues']],
  [/railway safety act/i, ['Transportation', 'Safety']],
  [/shipping act/i, ['Transportation']],
  [/canada shipping act/i, ['Transportation']],
  [/national energy board act/i, ['Energy', 'Environment']],
  [/electricity and gas inspection act/i, ['Energy']],
  [/nuclear safety and control act/i, ['Energy', 'Safety']],
  [/atomic energy control act/i, ['Energy', 'Safety']],
  [/immigration and refugee protection act/i, ['Immigration']],
  [/citizenship act/i, ['Immigration']],
  [/national defence act/i, ['Defence']],
  [/criminal code/i, ['Criminal Law and Justice']],
  [/broadcasting act/i, ['Telecommunications and Broadcasting']],
  [/radiocommunication act/i, ['Telecommunications and Broadcasting']],
  [/telecommunications act/i, ['Telecommunications and Broadcasting']],
  [/copyright act/i, ['Science and Technology', 'Industry']],
  [/patent act/i, ['Science and Technology', 'Industry']],
  [/canada labour code/i, ['Employment and Training', 'Occupational Health and Safety']],
  [/employment insurance act/i, ['Employment and Training']],
  [/canada pension plan/i, ['Employment and Training', 'Social Policy']],
  [/seeds act/i, ['Agriculture', 'Food and Drugs']],
  [/canada grain act/i, ['Agriculture']],
  [/plant protection act/i, ['Agriculture', 'Environment']],
  [/health of animals act/i, ['Agriculture', 'Food and Drugs']],
  [/farm products agencies act/i, ['Agriculture']],
  [/canada agricultural products act/i, ['Agriculture']],
  [/quarantine act/i, ['Health', 'International Trade']],
  [/pest control products act/i, ['Environment', 'Health']],
  [/weights and measures act/i, ['Consumer Issues', 'Industry']],
  [/consumer packaging and labelling act/i, ['Consumer Issues']],
  [/hazardous products act/i, ['Consumer Issues', 'Safety']],
  [/explosives act/i, ['Safety', 'Criminal Law and Justice']],
  [/public service employment act/i, ['Government Procurement', 'Employment and Training']],
  [/procurement ombudsman act/i, ['Government Procurement']],
  [/access to information act/i, ['Access to Information and Privacy']],
  [/privacy act/i, ['Access to Information and Privacy']],
  [/personal information protection/i, ['Access to Information and Privacy']],
  [/indian act/i, ['Aboriginal Affairs']],
  [/first nations/i, ['Aboriginal Affairs']],
  [/department of foreign affairs/i, ['International Relations', 'International Trade']],
  [/export and import permits act/i, ['International Trade']],
  [/special economic measures act/i, ['International Relations', 'International Trade']],
  [/proceeds of crime/i, ['Criminal Law and Justice', 'Financial Institutions']],
]

const DEPT_MAPPINGS: [RegExp, string[]][] = [
  [/environment and climate change/i, ['Environment', 'Climate Change']],
  [/health canada/i, ['Health', 'Food and Drugs']],
  [/transport canada/i, ['Transportation']],
  [/department of finance/i, ['Taxation and Finance', 'Financial Institutions']],
  [/canada revenue agency/i, ['Taxation and Finance']],
  [/natural resources canada/i, ['Energy', 'Environment']],
  [/agriculture and agri-food/i, ['Agriculture']],
  [/fisheries and oceans/i, ['Fisheries', 'Environment']],
  [/public safety canada/i, ['Safety', 'Criminal Law and Justice']],
  [/immigration, refugees/i, ['Immigration']],
  [/national defence/i, ['Defence']],
  [/global affairs/i, ['International Relations', 'International Trade']],
  [/employment and social development/i, ['Employment and Training', 'Social Policy']],
  [/innovation, science/i, ['Science and Technology', 'Industry']],
  [/public services and procurement/i, ['Government Procurement']],
  [/indigenous services/i, ['Aboriginal Affairs']],
  [/crown-indigenous relations/i, ['Aboriginal Affairs']],
  [/canadian nuclear safety/i, ['Energy', 'Safety']],
  [/financial transactions and reports/i, ['Financial Institutions', 'Taxation and Finance']],
]

/**
 * Maps enabling act and/or department name to lobbying subject categories.
 * Returns unique categories (deduped), or empty array if no match found.
 */
export function mapLobbyingCategories(enablingAct: string | null, department: string | null): string[] {
  const categories = new Set<string>()

  if (enablingAct) {
    for (const [pattern, cats] of ACT_MAPPINGS) {
      if (pattern.test(enablingAct)) {
        for (const cat of cats) categories.add(cat)
      }
    }
  }

  if (department) {
    for (const [pattern, cats] of DEPT_MAPPINGS) {
      if (pattern.test(department)) {
        for (const cat of cats) categories.add(cat)
      }
    }
  }

  return Array.from(categories)
}

/**
 * Extracts a SOR/SI number from a string using regex.
 * Returns the first match or null.
 */
function extractSorNumber(text: string): string | null {
  const match = /\b(SOR\/\d{4}-\d+|SI\/\d{4}-\d+|DORS\/\d{4}-\d+|TR\/\d{4}-\d+)\b/i.exec(text)
  return match?.[1] ?? null
}

/**
 * Extracts YYYY-MM-DD from an issue URL like:
 * https://gazette.gc.ca/rp-pr/p2/2026/2026-03-25/html/index-eng.html
 */
function extractDateFromUrl(issueUrl: string): string | null {
  const match = /\/p[12]\/\d{4}\/(\d{4}-\d{2}-\d{2})\//.exec(issueUrl)
  return match?.[1] ?? null
}

/**
 * Extracts which gazette part ('I' or 'II') from an issue URL.
 */
function extractPartFromUrl(issueUrl: string): string {
  if (issueUrl.includes('/p2/')) return 'II'
  if (issueUrl.includes('/p1/')) return 'I'
  return 'II' // default
}

/**
 * Derives a deterministic SHA256 ID for a regulation record.
 * Uses SOR number when available, falls back to title + date.
 */
function deriveId(sorNumber: string | null, gazettePart: string, publicationDate: string, title: string): string {
  const key = sorNumber
    ? `${sorNumber}|${gazettePart}|${publicationDate}`
    : `${title}|${gazettePart}|${publicationDate}`
  return createHash('sha256').update(key).digest('hex')
}

/**
 * Resolves a relative URL from an issue index page to an absolute gazette URL.
 * The individual regulation links in the index are relative paths.
 */
function resolveUrl(href: string, issueUrl: string): string {
  if (href.startsWith('http://') || href.startsWith('https://')) return href
  // Relative URL — resolve against base
  try {
    return new URL(href, issueUrl).toString()
  } catch {
    return href
  }
}

/**
 * Parses one Canada Gazette Part II issue index page.
 * Extracts per-regulation metadata: title, SOR number, URL.
 *
 * The HTML structure as of 2025-2026:
 *   - Regulations appear in <li> or <tr> elements within sections
 *   - Each entry is a link: <a href="...reg-eng.html">SOR/2026-42 - Regulation Title</a>
 *   - Some entries appear under department/section headers (h2, h3)
 *   - SOR/SI numbers may appear in the link text or the href
 *
 * @param html - raw HTML of the issue index page
 * @param issueUrl - URL of the issue index page (used for date extraction and URL resolution)
 * @returns array of parsed regulation records
 */
export function parseGazetteIndex(html: string, issueUrl: string): ParsedGazetteRegulation[] {
  const regulations: ParsedGazetteRegulation[] = []
  const sourceFileHash = createHash('sha256').update(html).digest('hex')

  const publicationDate = extractDateFromUrl(issueUrl) ?? new Date().toISOString().slice(0, 10)
  const gazettePart = extractPartFromUrl(issueUrl)

  // Reject soft 404 pages from gazette.gc.ca (they return HTTP 200)
  if (html.includes('Error 404') || html.includes("couldn't find that Web page")) {
    console.warn(`  [gazette-parser] Skipping soft 404 page: ${issueUrl}`)
    return []
  }

  let $: ReturnType<typeof load>
  try {
    $ = load(html)
  } catch (err) {
    console.warn(`  [gazette-parser] Failed to load HTML for ${issueUrl}: ${err instanceof Error ? err.message : String(err)}`)
    return []
  }

  // Track current section (department) as we walk the DOM
  let currentDepartment: string | null = null

  // Strategy: find all links that point to individual regulation pages
  // Individual regulation pages typically have paths like:
  //   /rp-pr/p2/YYYY/YYYY-MM-DD/html/sor-dors42-eng.html
  //   /rp-pr/p2/YYYY/YYYY-MM-DD/html/si-tr15-eng.html

  // Collect section headings and their associated links by walking the document
  const elements = $('h2, h3, h4, a[href*="-eng.html"]').toArray()

  for (const el of elements) {
    const tag = (el.type === 'tag' ? el.name : '').toLowerCase()

    if (['h2', 'h3', 'h4'].includes(tag)) {
      const headerText = $(el).text().trim()
      if (headerText && !headerText.toLowerCase().includes('table of contents') && headerText.length < 200) {
        currentDepartment = headerText
      }
      continue
    }

    // It's an anchor link
    const href = $(el).attr('href') ?? ''

    // Skip links that are not to individual regulation pages
    // Individual reg pages have paths ending in -eng.html but not index-eng.html
    if (!href.includes('-eng.html') || href.includes('index-eng.html')) continue
    // Skip external links or navigation links
    if (href.startsWith('mailto:') || href.startsWith('javascript:')) continue
    // Skip links to other gazette parts or top-level pages
    if (href.includes('/p1/') && gazettePart === 'II') continue
    if (href.includes('/p2/') && gazettePart === 'I') continue

    const linkText = $(el).text().trim()
    if (!linkText || linkText.length < 3) continue

    // Extract SOR/SI number from link text or href
    const sorFromText = extractSorNumber(linkText)
    const sorFromHref = extractSorNumber(href)
    const sorNumber = sorFromText ?? sorFromHref

    // Derive title: remove SOR number prefix if present
    let title = linkText
    if (sorNumber) {
      title = linkText.replace(sorNumber, '').replace(/^[\s–—\-:]+/, '').trim()
    }
    if (!title) title = linkText // fallback to full link text

    const gazetteUrl = resolveUrl(href, issueUrl)
    const id = deriveId(sorNumber, gazettePart, publicationDate, title)

    // Department from section header; enabling act left null (would need per-reg page fetch)
    const department = currentDepartment
    const enablingAct: string | null = null // Requires individual page scraping — skipped for v1
    const lobbyingSubjectCategories = mapLobbyingCategories(enablingAct, department)

    regulations.push({
      id,
      sorNumber,
      title,
      gazettePart,
      publicationDate,
      registrationDate: null, // Requires individual page scraping
      responsibleDepartment: department,
      enablingAct,
      gazetteUrl,
      lobbyingSubjectCategories,
      sourceFileHash,
      rawData: {
        issueUrl,
        href,
        linkText,
        sorNumber,
        department,
        publicationDate,
      },
    })
  }

  return regulations
}
