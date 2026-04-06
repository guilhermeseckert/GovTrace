import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { gazetteRegulations } from '@govtrace/db/schema/raw'
import type { ParsedGazetteRegulation } from '../parsers/gazette.ts'

const BATCH_SIZE = 500

export interface UpsertResult {
  inserted: number
  total: number
}

/**
 * Upserts gazette regulation records using INSERT ... ON CONFLICT DO UPDATE.
 * Same regulation (same id) will update, not duplicate.
 * Processes in batches of 500 to manage memory and statement size.
 */
export async function upsertGazetteRegulations(records: ParsedGazetteRegulation[]): Promise<UpsertResult> {
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
      sorNumber: r.sorNumber,
      title: r.title,
      gazettePart: r.gazettePart,
      publicationDate: r.publicationDate,
      registrationDate: r.registrationDate,
      responsibleDepartment: r.responsibleDepartment,
      enablingAct: r.enablingAct,
      gazetteUrl: r.gazetteUrl,
      lobbyingSubjectCategories: r.lobbyingSubjectCategories,
      sourceFileHash: r.sourceFileHash,
      rawData: r.rawData,
      updatedAt: new Date(),
    }))

    await db
      .insert(gazetteRegulations)
      .values(values)
      .onConflictDoUpdate({
        target: gazetteRegulations.id,
        set: {
          sorNumber: sql`excluded.sor_number`,
          title: sql`excluded.title`,
          gazettePart: sql`excluded.gazette_part`,
          publicationDate: sql`excluded.publication_date`,
          registrationDate: sql`excluded.registration_date`,
          responsibleDepartment: sql`excluded.responsible_department`,
          enablingAct: sql`excluded.enabling_act`,
          gazetteUrl: sql`excluded.gazette_url`,
          lobbyingSubjectCategories: sql`excluded.lobbying_subject_categories`,
          sourceFileHash: sql`excluded.source_file_hash`,
          rawData: sql`excluded.raw_data`,
          updatedAt: sql`excluded.updated_at`,
        },
      })

    inserted += uniqueBatch.length
  }

  return { inserted, total: records.length }
}
