import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { ingestionRuns } from '@govtrace/db/schema/jobs'
import { downloadGrants } from '../downloaders/grants.ts'
import { streamGrantsFile } from '../parsers/grants.ts'
import { upsertGrants } from '../upsert/grants.ts'

export async function runGrantsIngestion(): Promise<void> {
  const db = getDb()
  const destDir = join(tmpdir(), 'govtrace-ingestion', 'grants')

  const [run] = await db
    .insert(ingestionRuns)
    .values({
      source: 'grants',
      status: 'running',
      sourceFileUrl: 'https://open.canada.ca/data/dataset/432527ab-7aac-45b5-81d6-7597107a7013',
    })
    .returning()

  const runId = run.id
  let totalRecords = 0
  let totalInserted = 0

  try {
    console.log('Downloading federal grants CSV...')
    const { localPath, fileHash, fileSizeBytes } = await downloadGrants(destDir)
    console.log(`Downloaded ${(fileSizeBytes / 1024 / 1024).toFixed(1)} MB, hash: ${fileHash.slice(0, 8)}...`)

    console.log('Streaming CSV parse + upsert...')
    totalRecords = await streamGrantsFile(
      localPath, fileHash,
      async (batch) => {
        const result = await upsertGrants(batch)
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

    console.log('Grants ingestion complete.')
  } catch (error) {
    await db.update(ingestionRuns).set({
      status: 'failed', errorMessage: error instanceof Error ? error.message : String(error),
      completedAt: new Date(),
    }).where(sql`id = ${runId}`)
    throw error
  }
}
