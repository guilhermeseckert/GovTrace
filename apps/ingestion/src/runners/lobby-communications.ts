import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { ingestionRuns } from '@govtrace/db/schema/jobs'
import { downloadLobbyCommunications } from '../downloaders/lobby-communications.ts'
import { parseLobbyCommunicationsFile } from '../parsers/lobby-communications.ts'
import { upsertLobbyCommunications } from '../upsert/lobby-communications.ts'

/**
 * Orchestrates the full lobby communications ingestion pipeline:
 * download → detect encoding → parse → upsert
 *
 * Audit log: source = 'lobby_communications'
 */
export async function runLobbyCommunicationsIngestion(): Promise<void> {
  const db = getDb()

  const [run] = await db
    .insert(ingestionRuns)
    .values({
      source: 'lobby_communications',
      status: 'running',
    })
    .returning()

  if (!run) {
    throw new Error('Failed to create ingestion run record')
  }

  console.log(`[lobby_communications] Starting ingestion run ${run.id}`)

  try {
    // Download
    console.log('[lobby_communications] Downloading CSV...')
    const destDir = join(tmpdir(), 'govtrace-ingestion', 'lobby-communications')
    const { localPath, fileHash, fileSizeBytes, extractedFiles } = await downloadLobbyCommunications(destDir)
    console.log(
      `[lobby_communications] Downloaded ${(fileSizeBytes / 1024).toFixed(1)} KB (hash: ${fileHash.slice(0, 8)}...) — ${Object.keys(extractedFiles).length} CSVs extracted`,
    )

    // Parse (encoding detection happens inside the parser; secondary CSVs enrich DPOH and subject matter)
    console.log('[lobby_communications] Parsing CSV with enrichment from secondary files...')
    const records = await parseLobbyCommunicationsFile(localPath, fileHash, extractedFiles)
    console.log(`[lobby_communications] Parsed ${records.length} records`)

    // Upsert
    console.log('[lobby_communications] Upserting records...')
    const result = await upsertLobbyCommunications(records)

    // Mark run complete
    await db
      .update(ingestionRuns)
      .set({
        status: 'completed',
        sourceFileHash: fileHash,
        recordsProcessed: records.length,
        recordsInserted: result.inserted,
        completedAt: new Date(),
      })
      .where(sql`id = ${run.id}`)

    console.log(
      `[lobby_communications] Completed: ${records.length} processed, ${result.inserted} upserted`,
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    await db
      .update(ingestionRuns)
      .set({
        status: 'failed',
        errorMessage,
        completedAt: new Date(),
      })
      .where(sql`id = ${run.id}`)

    console.error(`[lobby_communications] Failed: ${errorMessage}`)
    throw error
  }
}
