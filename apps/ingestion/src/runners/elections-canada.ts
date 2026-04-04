import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { ingestionRuns } from '@govtrace/db/schema/jobs'
import { downloadElectionsCanada } from '../downloaders/elections-canada.ts'
import { streamElectionsCanadaFile } from '../parsers/elections-canada.ts'
import { upsertDonations } from '../upsert/donations.ts'

export async function runElectionsCanadaIngestion(): Promise<void> {
  const db = getDb()
  const destDir = join(tmpdir(), 'govtrace-ingestion', 'elections-canada')

  const [run] = await db
    .insert(ingestionRuns)
    .values({
      source: 'elections_canada',
      status: 'running',
      sourceFileUrl: 'https://www.elections.ca/fin/oda/od_cntrbtn_audt_e.zip',
    })
    .returning()

  const runId = run.id
  let totalRecords = 0
  let totalInserted = 0

  try {
    console.log('Downloading Elections Canada contributions ZIP...')
    const { localPath, fileHash, fileSizeBytes } = await downloadElectionsCanada(destDir)
    console.log(`Downloaded ${fileSizeBytes} bytes, hash: ${fileHash.slice(0, 8)}...`)

    console.log('Streaming CSV parse + upsert...')
    totalRecords = await streamElectionsCanadaFile(
      localPath,
      fileHash,
      async (batch) => {
        const result = await upsertDonations(batch)
        totalInserted += result.total
      },
      5000,
      (count) => {
        console.log(`  Processed ${count.toLocaleString()} records...`)
      },
    )

    console.log(`Total: ${totalRecords.toLocaleString()} records parsed, ${totalInserted.toLocaleString()} upserted`)

    await db
      .update(ingestionRuns)
      .set({
        status: 'completed',
        sourceFileHash: fileHash,
        recordsProcessed: totalRecords,
        recordsInserted: totalInserted,
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
