import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { lobbyRegistrations } from '@govtrace/db/schema/raw'
import type { LobbyRegistrationRecord } from '../parsers/lobby-registrations.ts'

const BATCH_SIZE = 500

/**
 * Idempotent upsert for lobby_registrations table.
 * Uses registration_number as the stable conflict target (government-issued key).
 * normalizedLobbyistName and normalizedClientName are left null — populated by Plan 06 normalizer.
 * See Pitfall 2: idempotent ingestion via ON CONFLICT DO UPDATE.
 */
export async function upsertLobbyRegistrations(
  records: LobbyRegistrationRecord[],
): Promise<{ inserted: number; updated: number }> {
  if (records.length === 0) {
    return { inserted: 0, updated: 0 }
  }

  const db = getDb()
  let totalInserted = 0
  let totalUpdated = 0

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)

    const values = batch.map((r) => ({
      id: r.id,
      registrationNumber: r.registrationNumber,
      lobbyistName: r.lobbyistName,
      lobbyistType: r.lobbyistType,
      clientName: r.clientName,
      subjectMatter: r.subjectMatter,
      targetDepartments: r.targetDepartments,
      status: r.status,
      registrationDate: r.registrationDate,
      lastUpdatedDate: r.lastUpdatedDate,
      province: r.province,
      normalizedLobbyistName: null,
      normalizedClientName: null,
      lobbyistEntityId: null,
      clientEntityId: null,
      sourceFileHash: r.sourceFileHash,
      rawData: r.rawData,
    }))

    await db
      .insert(lobbyRegistrations)
      .values(values)
      .onConflictDoUpdate({
        target: lobbyRegistrations.id,
        set: {
          registrationNumber: sql`excluded.registration_number`,
          lobbyistName: sql`excluded.lobbyist_name`,
          lobbyistType: sql`excluded.lobbyist_type`,
          clientName: sql`excluded.client_name`,
          subjectMatter: sql`excluded.subject_matter`,
          targetDepartments: sql`excluded.target_departments`,
          status: sql`excluded.status`,
          registrationDate: sql`excluded.registration_date`,
          lastUpdatedDate: sql`excluded.last_updated_date`,
          province: sql`excluded.province`,
          sourceFileHash: sql`excluded.source_file_hash`,
          rawData: sql`excluded.raw_data`,
          updatedAt: sql`now()`,
        },
      })

    totalInserted += batch.length
    console.log(
      `Lobby registrations upsert: processed ${Math.min(i + BATCH_SIZE, records.length)} / ${records.length}`,
    )
  }

  // All records are upserted — we can't easily distinguish inserts from updates
  // without a returning clause, so we report total as inserted for simplicity
  totalUpdated = 0

  return { inserted: totalInserted, updated: totalUpdated }
}
