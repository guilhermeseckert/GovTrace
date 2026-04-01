import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { ingestionRuns } from '@govtrace/db/schema/jobs'
import { downloadElectionsCanada } from '../downloaders/elections-canada.ts'
import { parseElectionsCanadaFile } from '../parsers/elections-canada.ts'
import { upsertDonations } from '../upsert/donations.ts'

export async function runElectionsCanadaIngestion(): Promise<void> {
  const db = getDb()
  const destDir = join(tmpdir(), 'govtrace-ingestion', 'elections-canada')

  // Log ingestion run start
  const [run] = await db
    .insert(ingestionRuns)
    .values({
      source: 'elections_canada',
      status: 'running',
      sourceFileUrl: 'https://www.elections.ca/fin/oda/od_cntrbtn_audt_e.zip',
    })
    .returning()

  const runId = run.id

  try {
    console.log('Downloading Elections Canada contributions ZIP...')
    const { localPath, fileHash, fileSizeBytes } = await downloadElectionsCanada(destDir)
    console.log(`Downloaded ${fileSizeBytes} bytes, hash: ${fileHash.slice(0, 8)}...`)

    console.log('Parsing CSV...')
    const records = await parseElectionsCanadaFile(localPath, fileHash, (count) => {
      console.log(`  Parsed ${count.toLocaleString()} records...`)
    })
    console.log(`Parsed ${records.length.toLocaleString()} donation records`)

    console.log('Upserting to database...')
    const result = await upsertDonations(records)
    console.log(`Upserted ${result.total.toLocaleString()} records`)

    // Update run to completed
    await db
      .update(ingestionRuns)
      .set({
        status: 'completed',
        sourceFileHash: fileHash,
        recordsProcessed: records.length,
        recordsInserted: result.inserted,
        completedAt: new Date(),
      })
      .where(sql`id = ${runId}`)

    console.log('Elections Canada ingestion complete.')
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
