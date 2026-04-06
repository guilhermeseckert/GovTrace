/**
 * Canada.ca press releases parser
 *
 * Three exported functions:
 *   parseListingPage(html) — extracts listing items from news-results.html
 *   parseDetailPage(html, url) — extracts Dublin Core metadata + body text from individual page
 *   parsePmRssFeed(xml) — parses PM RSS 2.0 feed items
 *
 * Entity extraction:
 *   - Dollar amounts via regex — no AI in the parser
 *   - Minister mentions from dcterms.minister — entity matching in runner
 */

import { load } from 'cheerio'
import { XMLParser } from 'fast-xml-parser'
import { createHash } from 'node:crypto'

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface ParsedListingItem {
  title: string
  url: string
  date: string // YYYY-MM-DD
  department: string
  contentType: string
  summary: string
}

export interface DollarAmount {
  amount: string
  context: string
}

export interface MentionedEntity {
  name: string
  type: 'politician' | 'organization' | 'unknown'
  entityId?: string
  confidence: 'metadata' | 'text-match'
}

export interface ParsedPressRelease {
  id: string // SHA256(url)
  title: string
  url: string
  publishedDate: string // YYYY-MM-DD
  department: string
  contentType: string | null
  summary: string | null
  ministers: string[]
  keywords: string[]
  subjects: string[]
  spatial: string | null
  bodyText: string | null
  mentionedEntities: MentionedEntity[]
  dollarAmounts: DollarAmount[]
  sourceUrl: string
  sourceFileHash: string
  rawData: Record<string, unknown>
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

const DOLLAR_PATTERN = /\$[\d,]+(?:\.\d+)?\s*(?:million|billion|trillion|M|B|T)\b|\$[\d,.]+/gi

/**
 * Extracts the surrounding sentence (up to 200 chars) around a match index.
 */
function extractContext(text: string, matchIndex: number, matchLength: number): string {
  const start = Math.max(0, matchIndex - 80)
  const end = Math.min(text.length, matchIndex + matchLength + 80)
  let context = text.slice(start, end).trim()
  if (start > 0) context = `...${context}`
  if (end < text.length) context = `${context}...`
  return context
}

/**
 * Extracts dollar amount mentions from body text.
 */
function extractDollarAmounts(text: string): DollarAmount[] {
  const amounts: DollarAmount[] = []
  const pattern = new RegExp(DOLLAR_PATTERN.source, 'gi')
  let match: RegExpExecArray | null

  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex loop pattern
  while ((match = pattern.exec(text)) !== null) {
    amounts.push({
      amount: match[0].trim(),
      context: extractContext(text, match.index, match[0].length),
    })
    // Limit to first 20 dollar amounts per release
    if (amounts.length >= 20) break
  }

  return amounts
}

/**
 * Splits a meta tag value by common separators (semicolons and commas).
 * Returns trimmed, non-empty strings.
 */
function splitMetaValue(value: string | undefined, separator: RegExp = /[;,]/): string[] {
  if (!value) return []
  return value
    .split(separator)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/**
 * Normalizes a canada.ca URL to absolute form.
 * Listing items use relative URLs starting with '/'.
 */
function normalizeUrl(href: string): string {
  if (href.startsWith('http://') || href.startsWith('https://')) return href
  if (href.startsWith('/')) return `https://www.canada.ca${href}`
  return href
}

/**
 * Derives a deterministic SHA256 ID from the press release URL.
 */
function deriveId(url: string): string {
  return createHash('sha256').update(url).digest('hex')
}

// ──────────────────────────────────────────────────────────────────────────────
// parseListingPage
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Parses a canada.ca news results listing page.
 *
 * HTML structure (observed 2026-04-06):
 *   <article class="item">
 *     <h3 class="h5"><a href="/en/dept/news/...">{title}</a></h3>
 *     <p><time datetime="YYYY-MM-DD">{date}</time> | {department} | {content type}</p>
 *     <p>{summary}</p>
 *   </article>
 *
 * @param html - Raw HTML of the listing page
 * @returns Array of parsed listing items
 */
export function parseListingPage(html: string): ParsedListingItem[] {
  const items: ParsedListingItem[] = []

  let $: ReturnType<typeof load>
  try {
    $ = load(html)
  } catch {
    return []
  }

  $('article.item').each((_, el) => {
    const $el = $(el)

    // Title and URL
    const $link = $el.find('h3.h5 a, h3 a').first()
    const title = $link.text().trim()
    const href = $link.attr('href') ?? ''
    if (!title || !href) return

    const url = normalizeUrl(href)

    // Date, department, content type — in a <p> following the heading
    // Pattern: "<time datetime="...">...</time> | Department | Type"
    let date = ''
    let department = ''
    let contentType = ''

    $el.find('time[datetime]').each((_, timeEl) => {
      const dt = $(timeEl).attr('datetime') ?? ''
      if (dt) date = dt
    })

    // The metadata paragraph contains pipe-separated fields
    const metaParas = $el.find('p')
    metaParas.each((_, p) => {
      const text = $(p).text()
      if (text.includes('|')) {
        const parts = text.split('|').map((s) => s.trim()).filter((s) => s.length > 0)
        // First part is date text (already captured), second is department, third is content type
        if (parts.length >= 3) {
          department = parts[1] ?? ''
          contentType = parts[2] ?? ''
        } else if (parts.length === 2) {
          department = parts[1] ?? ''
        }
      }
    })

    // Summary — the last <p> in the article that is not the meta line
    let summary = ''
    const allParas = $el.find('p').toArray()
    for (const p of allParas) {
      const text = $(p).text().trim()
      if (text && !text.includes('|') && !$(p).find('time').length) {
        summary = text
      }
    }

    if (!date) return // Skip items without a date

    items.push({
      title,
      url,
      date,
      department: department || 'Government of Canada',
      contentType: contentType || '',
      summary,
    })
  })

  return items
}

// ──────────────────────────────────────────────────────────────────────────────
// parseDetailPage
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Parses an individual press release page.
 * Extracts Dublin Core meta tags, keywords, body text.
 * Performs dollar amount extraction and minister entity scaffolding.
 *
 * @param html - Raw HTML of the detail page
 * @param url - Canonical URL of the page (used for ID derivation)
 * @returns Parsed press release record
 */
export function parseDetailPage(html: string, url: string): ParsedPressRelease {
  const sourceFileHash = createHash('sha256').update(html).digest('hex')
  const id = deriveId(url)

  let $: ReturnType<typeof load>
  try {
    $ = load(html)
  } catch {
    return buildFallback(id, url, sourceFileHash)
  }

  // ── Extract meta tags ─────────────────────────────────────────────────────

  const getMeta = (name: string): string | undefined => {
    // Try name= attribute (Dublin Core uses both name and property)
    const el = $(`meta[name="${name}"]`).first()
    if (el.length) return el.attr('content') ?? undefined
    // Try property= attribute
    const el2 = $(`meta[property="${name}"]`).first()
    return el2.attr('content') ?? undefined
  }

  const dcTitle = getMeta('dcterms.title') ?? getMeta('DC.title') ?? $('title').first().text().trim()
  const dcDescription = getMeta('dcterms.description') ?? getMeta('DC.description') ?? getMeta('description') ?? ''
  const dcCreator = getMeta('dcterms.creator') ?? getMeta('DC.creator') ?? getMeta('author') ?? ''
  const dcIssued = getMeta('dcterms.issued') ?? getMeta('DC.date') ?? ''
  const dcSubject = getMeta('dcterms.subject') ?? getMeta('DC.subject') ?? ''
  const dcAudience = getMeta('dcterms.audience') ?? ''
  const dcSpatial = getMeta('dcterms.spatial') ?? ''
  const dcType = getMeta('dcterms.type') ?? ''
  const dcMinister = getMeta('dcterms.minister') ?? ''
  const dcIdentifier = getMeta('dcterms.identifier') ?? ''
  const rawKeywords = getMeta('keywords') ?? ''

  // Collect all Dublin Core meta into rawData
  const rawData: Record<string, unknown> = {
    url,
    dcTitle,
    dcDescription,
    dcCreator,
    dcIssued,
    dcSubject,
    dcAudience,
    dcSpatial,
    dcType,
    dcMinister,
    dcIdentifier,
    keywords: rawKeywords,
  }

  // ── Parse arrays ──────────────────────────────────────────────────────────

  const ministers = splitMetaValue(dcMinister, /,/)
  const subjects = splitMetaValue(dcSubject, /[;,]/)
  const keywords = splitMetaValue(rawKeywords, /,/)

  // ── Extract body text ─────────────────────────────────────────────────────

  let bodyText: string | null = null

  // Try known content selectors in order of specificity
  const contentSelectors = [
    '.field-item',
    '#wb-cont',
    'main .mwsbodytext',
    'main article',
    'main',
    '#main-content',
  ]

  for (const selector of contentSelectors) {
    const el = $(selector).first()
    if (el.length) {
      const text = el.text().replace(/\s+/g, ' ').trim()
      if (text.length > 100) {
        bodyText = text
        break
      }
    }
  }

  // ── Extract dollar amounts ────────────────────────────────────────────────

  const dollarAmounts = bodyText ? extractDollarAmounts(bodyText) : []

  // ── Build minister entity scaffolds ──────────────────────────────────────

  const mentionedEntities: MentionedEntity[] = ministers.map((name) => ({
    name,
    type: 'politician' as const,
    confidence: 'metadata' as const,
  }))

  // ── Derive final fields ───────────────────────────────────────────────────

  const title = dcTitle || 'Untitled'
  const department = dcCreator || 'Government of Canada'
  const publishedDate = dcIssued ? dcIssued.slice(0, 10) : new Date().toISOString().slice(0, 10)
  const contentType = dcType || ''
  const summary = dcDescription || null
  const spatial = dcSpatial || null

  return {
    id,
    title,
    url,
    publishedDate,
    department,
    contentType: contentType || null,
    summary,
    ministers,
    keywords,
    subjects,
    spatial,
    bodyText,
    mentionedEntities,
    dollarAmounts,
    sourceUrl: url,
    sourceFileHash,
    rawData,
  }
}

/**
 * Builds a minimal fallback record when parsing fails entirely.
 */
function buildFallback(id: string, url: string, sourceFileHash: string): ParsedPressRelease {
  return {
    id,
    title: 'Parse failed',
    url,
    publishedDate: new Date().toISOString().slice(0, 10),
    department: 'Government of Canada',
    contentType: null,
    summary: null,
    ministers: [],
    keywords: [],
    subjects: [],
    spatial: null,
    bodyText: null,
    mentionedEntities: [],
    dollarAmounts: [],
    sourceUrl: url,
    sourceFileHash,
    rawData: { url },
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// parsePmRssFeed
// ──────────────────────────────────────────────────────────────────────────────

interface RssItem {
  title?: string
  link?: string
  description?: string
  pubDate?: string
  'dc:creator'?: string
  [key: string]: unknown
}

interface RssChannel {
  item?: RssItem | RssItem[]
  [key: string]: unknown
}

interface RssFeed {
  rss?: {
    channel?: RssChannel
  }
  [key: string]: unknown
}

/**
 * Parses the PM Office RSS 2.0 feed.
 * Maps each <item> to a ParsedListingItem.
 *
 * @param xml - Raw RSS XML string
 * @returns Array of parsed listing items
 */
export function parsePmRssFeed(xml: string): ParsedListingItem[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => name === 'item',
  })

  let feed: RssFeed
  try {
    feed = parser.parse(xml) as RssFeed
  } catch {
    return []
  }

  const channel = feed?.rss?.channel
  if (!channel) return []

  const items = Array.isArray(channel.item)
    ? channel.item
    : channel.item
      ? [channel.item]
      : []

  const results: ParsedListingItem[] = []

  for (const item of items) {
    const title = String(item.title ?? '').trim()
    const link = String(item.link ?? '').trim()
    const pubDate = String(item.pubDate ?? '').trim()
    const description = String(item.description ?? '').trim()

    if (!title || !link) continue

    // Convert RFC 2822 date to YYYY-MM-DD
    let date = ''
    if (pubDate) {
      try {
        const d = new Date(pubDate)
        if (!Number.isNaN(d.getTime())) {
          date = d.toISOString().slice(0, 10)
        }
      } catch {
        date = ''
      }
    }

    if (!date) continue

    // Infer content type from URL path
    let contentType = 'news releases'
    const lowerLink = link.toLowerCase()
    if (lowerLink.includes('/statements/')) contentType = 'statements'
    else if (lowerLink.includes('/media-advisories/')) contentType = 'media advisories'
    else if (lowerLink.includes('/readouts/')) contentType = 'readouts'
    else if (lowerLink.includes('/speeches/')) contentType = 'speeches'
    else if (lowerLink.includes('/backgrounders/')) contentType = 'backgrounders'

    // Strip HTML tags from description
    const summaryText = description.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 500)

    results.push({
      title,
      url: link,
      date,
      department: 'Office of the Prime Minister',
      contentType,
      summary: summaryText,
    })
  }

  return results
}
