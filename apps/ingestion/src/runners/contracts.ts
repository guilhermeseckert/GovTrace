import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { ingestionRuns } from '@govtrace/db/schema/jobs'
import { downloadContracts } from '../downloaders/contracts.ts'
import { streamContractsFile } from '../parsers/contracts.ts'
import { upsertContracts } from '../upsert/contracts.ts'

export async function runContractsIngestion(): Promise<void> {
  const db = getDb()
  const destDir = join(tmpdir(), 'govtrace-ingestion', 'contracts')

  const [run] = await db
    .insert(ingestionRuns)
    .values({
      source: 'contracts',
      status: 'running',
      sourceFileUrl: 'https://open.canada.ca/data/dataset/d8f85d91-7dec-4fd1-8055-483b77225d8b',
    })
    .returning()

  const runId = run.id
  let totalRecords = 0
  let totalInserted = 0

  try {
    console.log('Downloading federal contracts CSV...')
    const { localPath, fileHash, fileSizeBytes } = await downloadContracts(destDir)
    console.log(`Downloaded ${(fileSizeBytes / 1024 / 1024).toFixed(1)} MB, hash: ${fileHash.slice(0, 8)}...`)

    console.log('Streaming CSV parse + upsert...')
    totalRecords = await streamContractsFile(
      localPath, fileHash,
      async (batch) => {
        const result = await upsertContracts(batch)
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

    console.log('Contracts ingestion complete.')
  } catch (error) {
    await db.update(ingestionRuns).set({
      status: 'failed', errorMessage: error instanceof Error ? error.message : String(error),
      completedAt: new Date(),
    }).where(sql`id = ${runId}`)
    throw error
  }
}
