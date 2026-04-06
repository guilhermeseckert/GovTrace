/**
 * Canada.ca press releases ingestion pipeline
 *
 * Phases:
 *   A — Scrape listing pages from news-results.html (paginated by idx)
 *   B — Fetch individual detail pages for new URLs, extract Dublin Core metadata
 *   C — Fetch PM RSS feed, parse, deduplicate against Phase A URLs
 *   D — Entity matching — look up minister names in entities table
 *
 * Polite scraping:
 *   - 1500ms delay between page requests
 *   - USER_AGENT identifies GovTrace as civic tech
 *   - Stops Phase A after 3 months of content or known URLs
 */

import { createHash } from 'node:crypto'
import { sql, desc } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { ingestionRuns } from '@govtrace/db/schema/jobs'
import { pressReleases } from '@govtrace/db/schema/raw'
import { entities } from '@govtrace/db/schema/entities'
import { fetchListingPage, fetchDetailPage, fetchPmRssFeed } from '../downloaders/press-releases.ts'
import { parseListingPage, parseDetailPage, parsePmRssFeed } from '../parsers/press-releases.ts'
import { upsertPressReleases } from '../upsert/press-releases.ts'
import type { ParsedPressRelease, MentionedEntity } from '../parsers/press-releases.ts'

const POLITE_DELAY_MS = 1500
const LOG_EVERY_N_PAGES = 10
const LOG_EVERY_N_DETAIL = 50
const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isOlderThan3Months(dateStr: string): boolean {
  const d = new Date(`${dateStr}T12:00:00Z`)
  return Date.now() - d.getTime() > THREE_MONTHS_MS
}

// ──────────────────────────────────────────────────────────────────────────────
// runPressReleasesIngestion
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Runs the complete press releases ingestion pipeline.
 *
 * The --limit flag is read from RECORD_LIMIT global (set in index.ts).
 * When set, limits the number of detail pages fetched.
 */
export async function runPressReleasesIngestion(): Promise<void> {
  const db = getDb()

  // Read RECORD_LIMIT from CLI args (set in index.ts)
  const limitIdx = process.argv.indexOf('--limit')
  const recordLimit = limitIdx !== -1 ? Number(process.argv[limitIdx + 1]) : undefined

  const runs = await db
    .insert(ingestionRuns)
    .values({
      source: 'press-releases',
      status: 'running',
      sourceFileUrl: 'https://www.canada.ca/en/news/advanced-news-search/news-results.html',
    })
    .returning()

  const run = runs[0]
  if (!run) throw new Error('Failed to create ingestion run record')
  const runId = run.id

  const stats = {
    listingPagesScraped: 0,
    listingItemsFound: 0,
    detailPagesFetched: 0,
    detailPagesSkipped: 0,
    pmRssItems: 0,
    recordsUpserted: 0,
    entityMatchesFound: 0,
  }

  try {
    // =========================================================
    // Load existing URLs from DB for deduplication
    // =========================================================
    console.log('\n=== Loading existing press release URLs for deduplication ===')
    const existingRows = await db
      .select({ url: pressReleases.url, publishedDate: pressReleases.publishedDate })
      .from(pressReleases)
      .orderBy(desc(pressReleases.publishedDate))

    const existingUrls = new Set(existingRows.map((r) => r.url))
    console.log(`  Loaded ${existingUrls.size} existing URLs from DB`)

    // =========================================================
    // Phase A: Scrape listing pages
    // =========================================================
    console.log('\n=== Phase A: Scraping listing pages ===')

    const newListingItems: { title: string; url: string; date: string; department: string; contentType: string; summary: string }[] = []
    let stopListing = false
    let pageIdx = 0

    while (!stopListing) {
      let html: string
      try {
        html = await fetchListingPage(pageIdx)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('soft 404') || msg.includes('HTTP 404')) {
          console.log(`  Phase A: Reached end of pagination at idx=${pageIdx}`)
          break
        }
        console.warn(`  Phase A: Error fetching idx=${pageIdx}: ${msg}`)
        break
      }

      const items = parseListingPage(html)
      stats.listingPagesScraped++

      if (items.length === 0) {
        console.log(`  Phase A: No items at idx=${pageIdx}, stopping`)
        break
      }

      stats.listingItemsFound += items.length

      for (const item of items) {
        // Stop after 3 months of content
        if (isOlderThan3Months(item.date)) {
          console.log(`  Phase A: Reached content older than 3 months (${item.date}), stopping`)
          stopListing = true
          break
        }

        // Skip already-ingested URLs
        if (existingUrls.has(item.url)) {
          console.log(`  Phase A: Hit already-ingested URL at idx=${pageIdx}, stopping`)
          stopListing = true
          break
        }

        newListingItems.push(item)
      }

      if ((stats.listingPagesScraped) % LOG_EVERY_N_PAGES === 0) {
        console.log(`  Phase A progress: ${stats.listingPagesScraped} pages scraped, ${newListingItems.length} new items`)
      }

      if (stopListing) break

      // Check record limit for listing pages (limit controls detail fetches, be generous here)
      if (recordLimit && newListingItems.length >= recordLimit * 3) {
        console.log(`  Phase A: Collected ${newListingItems.length} new items, sufficient for limit=${recordLimit}`)
        break
      }

      pageIdx += 10
      await sleep(POLITE_DELAY_MS)
    }

    console.log(`  Phase A complete: ${stats.listingPagesScraped} pages, ${newListingItems.length} new items`)

    // =========================================================
    // Phase B: Fetch detail pages for new URLs
    // =========================================================
    console.log('\n=== Phase B: Fetching detail pages ===')

    const detailLimit = recordLimit ?? newListingItems.length
    const itemsToFetch = newListingItems.slice(0, detailLimit)
    const parsedRecords: ParsedPressRelease[] = []

    for (let i = 0; i < itemsToFetch.length; i++) {
      const item = itemsToFetch[i]
      if (!item) continue

      try {
        const detailHtml = await fetchDetailPage(item.url)
        const parsed = parseDetailPage(detailHtml, item.url)

        // Fill in listing data as fallback for fields not in meta tags
        if (!parsed.summary && item.summary) parsed.summary = item.summary
        if (parsed.department === 'Government of Canada' && item.department) parsed.department = item.department
        if (!parsed.contentType && item.contentType) parsed.contentType = item.contentType
        // Ensure publishedDate from listing is used if detail page doesn't have dcterms.issued
        if (parsed.publishedDate === new Date().toISOString().slice(0, 10) && item.date) {
          parsed.publishedDate = item.date
        }

        parsedRecords.push(parsed)
        stats.detailPagesFetched++

        if ((i + 1) % LOG_EVERY_N_DETAIL === 0) {
          console.log(`  Phase B progress: ${i + 1}/${itemsToFetch.length} detail pages fetched`)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`  Phase B: Skipping ${item.url}: ${msg}`)
        stats.detailPagesSkipped++
      }

      if (i < itemsToFetch.length - 1) {
        await sleep(POLITE_DELAY_MS)
      }
    }

    console.log(
      `  Phase B complete: ${stats.detailPagesFetched} fetched, ${stats.detailPagesSkipped} skipped`,
    )

    // =========================================================
    // Phase C: PM RSS feed
    // =========================================================
    console.log('\n=== Phase C: PM RSS feed ===')

    try {
      const rssXml = await fetchPmRssFeed()
      const pmItems = parsePmRssFeed(rssXml)
      stats.pmRssItems = pmItems.length
      console.log(`  PM RSS: ${pmItems.length} items`)

      for (const pmItem of pmItems) {
        // Skip if already ingested or already in this batch
        const inBatch = parsedRecords.some((r) => r.url === pmItem.url)
        if (existingUrls.has(pmItem.url) || inBatch) continue

        // For PM RSS items, we don't fetch detail pages (they're pm.gc.ca URLs)
        // Build a minimal record from RSS data
        const fallbackRecord: ParsedPressRelease = {
          id: createHash('sha256').update(pmItem.url).digest('hex'),
          title: pmItem.title,
          url: pmItem.url,
          publishedDate: pmItem.date,
          department: pmItem.department,
          contentType: pmItem.contentType,
          summary: pmItem.summary,
          ministers: [],
          keywords: [],
          subjects: [],
          spatial: null,
          bodyText: null,
          mentionedEntities: [],
          dollarAmounts: [],
          sourceUrl: pmItem.url,
          sourceFileHash: createHash('sha256').update(pmItem.url + pmItem.date).digest('hex'),
          rawData: { source: 'pm-rss', title: pmItem.title, url: pmItem.url, date: pmItem.date },
        }
        parsedRecords.push(fallbackRecord)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  Phase C: PM RSS failed: ${msg}`)
    }

    // =========================================================
    // Phase D: Entity matching for minister names
    // =========================================================
    console.log('\n=== Phase D: Entity matching for minister names ===')

    // Strip honorifics and normalize minister names for matching
    function normalizeMinisterName(name: string): string {
      return name
        .replace(/^(The\s+)?(Right\s+)?Hon(ourable|\.)\s+/i, '')
        .replace(/^L['']hon(orable|\.)\s+/i, '')
        .replace(/^Minister\s+/i, '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
        .toLowerCase()
        .trim()
    }

    // Collect all unique minister names from this batch
    const allMinisterNames = new Set<string>()
    const ministerNameMap = new Map<string, string>() // normalized -> original
    for (const record of parsedRecords) {
      for (const minister of record.ministers) {
        if (minister) {
          const normalized = normalizeMinisterName(minister)
          allMinisterNames.add(normalized)
          ministerNameMap.set(normalized, minister)
        }
      }
    }

    if (allMinisterNames.size > 0) {
      // Two-pass matching: exact normalized match, then fuzzy pg_trgm
      const ministerNamesArr = Array.from(allMinisterNames)

      // Pass 1: Exact normalized_name match
      const exactRows = await db
        .select({
          id: entities.id,
          canonicalName: entities.canonicalName,
          normalizedName: entities.normalizedName,
        })
        .from(entities)
        .where(
          sql`entity_type = 'politician' AND normalized_name = ANY(ARRAY[${sql.join(ministerNamesArr.map((n) => sql`${n}`), sql`, `)}])`,
        )

      const entityByNormalized = new Map(exactRows.map((e) => [e.normalizedName, e]))
      console.log(`  Pass 1 (exact): ${exactRows.length} matches for ${allMinisterNames.size} names`)

      // Pass 2: Fuzzy pg_trgm for unmatched names
      const unmatchedNames = ministerNamesArr.filter((n) => !entityByNormalized.has(n))
      if (unmatchedNames.length > 0) {
        for (const name of unmatchedNames) {
          const fuzzyRows = await db.execute<{ id: string; canonical_name: string; normalized_name: string; sim: number }>(
            sql`SELECT id, canonical_name, normalized_name, similarity(normalized_name, ${name}) as sim
                FROM entities
                WHERE entity_type = 'politician' AND similarity(normalized_name, ${name}) > 0.4
                ORDER BY sim DESC LIMIT 1`,
          )
          const best = Array.from(fuzzyRows)[0]
          if (best) {
            entityByNormalized.set(name, { id: best.id, canonicalName: best.canonical_name, normalizedName: best.normalized_name })
          }
        }
        const fuzzyMatched = unmatchedNames.filter((n) => entityByNormalized.has(n)).length
        console.log(`  Pass 2 (fuzzy): ${fuzzyMatched} additional matches for ${unmatchedNames.length} remaining names`)
      }

      stats.entityMatchesFound = entityByNormalized.size

      // Update mentionedEntities with entityId where matched
      for (const record of parsedRecords) {
        const updatedEntities: MentionedEntity[] = record.mentionedEntities.map((mention) => {
          if (mention.type === 'politician') {
            const normalized = normalizeMinisterName(mention.name)
            const matched = entityByNormalized.get(normalized)
            if (matched) {
              return { ...mention, entityId: matched.id }
            }
          }
          return mention
        })
        record.mentionedEntities = updatedEntities
      }
    }

    // =========================================================
    // Upsert all records
    // =========================================================
    if (parsedRecords.length > 0) {
      const result = await upsertPressReleases(parsedRecords)
      stats.recordsUpserted = result.inserted
      console.log(`\n  Upserted ${result.inserted} press releases`)
    } else {
      console.log('\n  No new press releases to upsert')
    }

    // =========================================================
    // Log ingestion run result
    // =========================================================
    await db
      .update(ingestionRuns)
      .set({
        status: 'completed',
        recordsProcessed: stats.detailPagesFetched + stats.pmRssItems,
        recordsInserted: stats.recordsUpserted,
        completedAt: new Date(),
        auditData: stats as unknown as Record<string, unknown>,
      })
      .where(sql`id = ${runId}`)

    console.log('\n=== Press releases ingestion complete ===')
    console.log(`  Listing pages scraped: ${stats.listingPagesScraped}`)
    console.log(`  New listing items found: ${stats.listingItemsFound}`)
    console.log(`  Detail pages fetched: ${stats.detailPagesFetched} (${stats.detailPagesSkipped} skipped)`)
    console.log(`  PM RSS items: ${stats.pmRssItems}`)
    console.log(`  Entity matches: ${stats.entityMatchesFound}`)
    console.log(`  Records upserted: ${stats.recordsUpserted}`)
  } catch (error) {
    await db
      .update(ingestionRuns)
      .set({
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error),
        completedAt: new Date(),
      })
      .where(sql`id = ${runId}`)
    throw error
  }
}
