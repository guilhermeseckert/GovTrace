import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { ingestionRuns } from '@govtrace/db/schema/jobs'
import { downloadGrants } from '../downloaders/grants.ts'
import { parseGrantsFile } from '../parsers/grants.ts'
import { upsertGrants } from '../upsert/grants.ts'

export async function runGrantsIngestion(): Promise<void> {
  const db = getDb()
  const destDir = join(tmpdir(), 'govtrace-ingestion', 'grants')

  const [run] = await db
    .insert(ingestionRuns)
    .values({
      source: 'grants',
      status: 'running',
      sourceFileUrl:
        'https://open.canada.ca/data/dataset/432527ab-7aac-45b5-81d6-7597107a7013/resource/1d15a62f-5656-49ad-8c88-f40ce689d831/download/grants.csv',
    })
    .returning()

  const runId = run.id

  try {
    console.log('Downloading federal grants CSV...')
    const { localPath, fileHash, fileSizeBytes } = await downloadGrants(destDir)
    console.log(`Downloaded ${fileSizeBytes} bytes, hash: ${fileHash.slice(0, 8)}...`)

    console.log('Parsing CSV...')
    const records = await parseGrantsFile(localPath, fileHash, (count) => {
      console.log(`  Parsed ${count.toLocaleString()} records...`)
    })
    console.log(`Parsed ${records.length.toLocaleString()} grant records`)

    console.log('Upserting to database...')
    const result = await upsertGrants(records)
    console.log(`Upserted ${result.total.toLocaleString()} records`)

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

    console.log('Grants ingestion complete.')
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
