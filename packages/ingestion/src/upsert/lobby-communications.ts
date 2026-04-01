import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { lobbyCommunications } from '@govtrace/db/schema/raw'
import type { LobbyCommunicationRecord } from '../parsers/lobby-communications.ts'

const BATCH_SIZE = 500

export interface UpsertResult {
  inserted: number
  total: number
}

/**
 * Idempotent upsert for lobby_communications table.
 * Uses the deterministic composite ID (registrationNumber + date + names) as conflict target.
 * normalizedLobbyistName and normalizedOfficialName are left null — populated by Plan 06 normalizer.
 * See Pitfall 2: idempotent ingestion via ON CONFLICT DO UPDATE.
 */
export async function upsertLobbyCommunications(
  records: LobbyCommunicationRecord[],
): Promise<UpsertResult> {
  if (records.length === 0) {
    return { inserted: 0, total: 0 }
  }

  const db = getDb()
  let inserted = 0

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)

    const values = batch.map((r) => ({
      id: r.id,
      registrationNumber: r.registrationNumber,
      communicationDate: r.communicationDate,
      lobbyistName: r.lobbyistName,
      clientName: r.clientName,
      publicOfficialName: r.publicOfficialName,
      publicOfficialTitle: r.publicOfficialTitle,
      department: r.department,
      subjectMatter: r.subjectMatter,
      communicationMethod: r.communicationMethod,
      normalizedLobbyistName: null,
      normalizedOfficialName: null,
      lobbyistEntityId: null,
      officialEntityId: null,
      sourceFileHash: r.sourceFileHash,
      rawData: r.rawData,
      updatedAt: new Date(),
    }))

    await db
      .insert(lobbyCommunications)
      .values(values)
      .onConflictDoUpdate({
        target: lobbyCommunications.id,
        set: {
          registrationNumber: sql`excluded.registration_number`,
          communicationDate: sql`excluded.communication_date`,
          lobbyistName: sql`excluded.lobbyist_name`,
          clientName: sql`excluded.client_name`,
          publicOfficialName: sql`excluded.public_official_name`,
          publicOfficialTitle: sql`excluded.public_official_title`,
          department: sql`excluded.department`,
          subjectMatter: sql`excluded.subject_matter`,
          communicationMethod: sql`excluded.communication_method`,
          sourceFileHash: sql`excluded.source_file_hash`,
          rawData: sql`excluded.raw_data`,
          updatedAt: sql`excluded.updated_at`,
        },
      })

    inserted += batch.length
  }

  return { inserted, total: records.length }
}
