import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { ingestionRuns } from '@govtrace/db/schema/jobs'
import { downloadLobbyRegistrations } from '../downloaders/lobby-registrations.ts'
import { parseLobbyRegistrationsFile } from '../parsers/lobby-registrations.ts'
import { upsertLobbyRegistrations } from '../upsert/lobby-registrations.ts'

/**
 * Orchestrates the full lobby registrations ingestion pipeline:
 * download → detect encoding → parse → upsert
 *
 * Audit log: source = 'lobby_registrations'
 */
export async function runLobbyRegistrationsIngestion(): Promise<void> {
  const db = getDb()

  const [run] = await db
    .insert(ingestionRuns)
    .values({
      source: 'lobby_registrations',
      status: 'running',
    })
    .returning()

  if (!run) {
    throw new Error('Failed to create ingestion run record')
  }

  console.log(`[lobby_registrations] Starting ingestion run ${run.id}`)

  try {
    // Download
    console.log('[lobby_registrations] Downloading CSV...')
    const { localPath, fileHash, fileSizeBytes } = await downloadLobbyRegistrations()
    console.log(
      `[lobby_registrations] Downloaded ${(fileSizeBytes / 1024).toFixed(1)} KB (hash: ${fileHash.slice(0, 8)}...)`,
    )

    // Parse (encoding detection happens inside the parser)
    console.log('[lobby_registrations] Parsing CSV...')
    const records = await parseLobbyRegistrationsFile(localPath, fileHash)
    console.log(`[lobby_registrations] Parsed ${records.length} records`)

    // Upsert
    console.log('[lobby_registrations] Upserting records...')
    const { inserted, updated } = await upsertLobbyRegistrations(records)

    // Mark run complete
    await db
      .update(ingestionRuns)
      .set({
        status: 'completed',
        sourceFileHash: fileHash,
        recordsProcessed: records.length,
        recordsInserted: inserted,
        recordsUpdated: updated,
        completedAt: sql`now()`,
      })
      .where(sql`id = ${run.id}`)

    console.log(
      `[lobby_registrations] Completed: ${records.length} processed, ${inserted} inserted, ${updated} updated`,
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    await db
      .update(ingestionRuns)
      .set({
        status: 'failed',
        errorMessage,
        completedAt: sql`now()`,
      })
      .where(sql`id = ${run.id}`)

    console.error(`[lobby_registrations] Failed: ${errorMessage}`)
    throw error
  }
}
