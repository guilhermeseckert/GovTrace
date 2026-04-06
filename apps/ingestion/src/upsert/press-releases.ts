import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { pressReleases } from '@govtrace/db/schema/raw'
import type { ParsedPressRelease } from '../parsers/press-releases.ts'

const BATCH_SIZE = 500

export interface UpsertResult {
  inserted: number
  total: number
}

/**
 * Upserts press release records using INSERT ... ON CONFLICT DO UPDATE.
 * Same record (same id) will update, not duplicate.
 * Processes in batches of 500 to manage memory and statement size.
 */
export async function upsertPressReleases(records: ParsedPressRelease[]): Promise<UpsertResult> {
  const db = getDb()
  let inserted = 0

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)

    const seen = new Set<string>()
    const uniqueBatch = batch.filter((r) => {
      if (seen.has(r.id)) return false
      seen.add(r.id)
      return true
    })

    const values = uniqueBatch.map((r) => ({
      id: r.id,
      title: r.title,
      url: r.url,
      publishedDate: r.publishedDate,
      department: r.department,
      contentType: r.contentType,
      summary: r.summary,
      ministers: r.ministers,
      keywords: r.keywords,
      subjects: r.subjects,
      spatial: r.spatial,
      bodyText: r.bodyText,
      mentionedEntities: r.mentionedEntities as unknown as Record<string, unknown>[],
      dollarAmounts: r.dollarAmounts as unknown as Record<string, unknown>[],
      sourceUrl: r.sourceUrl,
      sourceFileHash: r.sourceFileHash,
      rawData: r.rawData,
      updatedAt: new Date(),
    }))

    await db
      .insert(pressReleases)
      .values(values)
      .onConflictDoUpdate({
        target: pressReleases.id,
        set: {
          title: sql`excluded.title`,
          url: sql`excluded.url`,
          publishedDate: sql`excluded.published_date`,
          department: sql`excluded.department`,
          contentType: sql`excluded.content_type`,
          summary: sql`excluded.summary`,
          ministers: sql`excluded.ministers`,
          keywords: sql`excluded.keywords`,
          subjects: sql`excluded.subjects`,
          spatial: sql`excluded.spatial`,
          bodyText: sql`excluded.body_text`,
          mentionedEntities: sql`excluded.mentioned_entities`,
          dollarAmounts: sql`excluded.dollar_amounts`,
          sourceUrl: sql`excluded.source_url`,
          sourceFileHash: sql`excluded.source_file_hash`,
          rawData: sql`excluded.raw_data`,
          updatedAt: sql`excluded.updated_at`,
        },
      })

    inserted += uniqueBatch.length
  }

  return { inserted, total: records.length }
}
