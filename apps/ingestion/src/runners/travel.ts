import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { ingestionRuns } from '@govtrace/db/schema/jobs'
import { downloadTravel } from '../downloaders/travel.ts'
import { streamTravelFile } from '../parsers/travel.ts'
import { upsertTravelDisclosures } from '../upsert/travel.ts'

export async function runTravelIngestion(): Promise<void> {
  const db = getDb()
  const destDir = join(tmpdir(), 'govtrace-ingestion', 'travel')

  const [run] = await db
    .insert(ingestionRuns)
    .values({
      source: 'travel-disclosures',
      status: 'running',
      sourceFileUrl: 'https://open.canada.ca/data/en/dataset/009f9a49-c2d9-4d29-a6d4-1a228da335ce',
    })
    .returning()

  const runId = run.id
  let totalRecords = 0
  let totalInserted = 0

  try {
    console.log('Downloading federal travel disclosures CSV...')
    const { localPath, fileHash, fileSizeBytes } = await downloadTravel(destDir)
    console.log(`Downloaded ${(fileSizeBytes / 1024 / 1024).toFixed(1)} MB, hash: ${fileHash.slice(0, 8)}...`)

    console.log('Streaming CSV parse + upsert...')
    totalRecords = await streamTravelFile(
      localPath, fileHash,
      async (batch) => {
        const result = await upsertTravelDisclosures(batch)
        totalInserted += result.total
      },
      5000,
      (count) => console.log(`  Processed ${count.toLocaleString()} records...`),
    )

    console.log(`Total: ${totalRecords.toLocaleString()} parsed, ${totalInserted.toLocaleString()} upserted`)

    await db.update(ingestionRuns).set({
      status: 'completed', sourceFileHash: fileHash,
      recordsProcessed: totalRecords, recordsInserted: totalInserted, completedAt: new Date(),
    }).where(sql`id = ${runId}`)

    console.log('Travel disclosures ingestion complete.')
  } catch (error) {
    await db.update(ingestionRuns).set({
      status: 'failed', errorMessage: error instanceof Error ? error.message : String(error),
      completedAt: new Date(),
    }).where(sql`id = ${runId}`)
    throw error
  }
}
