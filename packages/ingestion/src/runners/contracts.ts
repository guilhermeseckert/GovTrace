import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { ingestionRuns } from '@govtrace/db/schema/jobs'
import { downloadContracts } from '../downloaders/contracts.ts'
import { parseContractsFile } from '../parsers/contracts.ts'
import { upsertContracts } from '../upsert/contracts.ts'

export async function runContractsIngestion(): Promise<void> {
  const db = getDb()
  const destDir = join(tmpdir(), 'govtrace-ingestion', 'contracts')

  const [run] = await db
    .insert(ingestionRuns)
    .values({
      source: 'contracts',
      status: 'running',
      sourceFileUrl:
        'https://open.canada.ca/data/dataset/d8f85d91-7dec-4fd1-8055-483b77225d8b/resource/fac950c0-00d5-4ec1-a4d3-9cbebf98a305/download/contracts.csv',
    })
    .returning()

  const runId = run.id

  try {
    console.log('Downloading federal contracts CSV...')
    const { localPath, fileHash, fileSizeBytes } = await downloadContracts(destDir)
    console.log(`Downloaded ${fileSizeBytes} bytes, hash: ${fileHash.slice(0, 8)}...`)

    console.log('Parsing CSV...')
    const records = await parseContractsFile(localPath, fileHash, (count) => {
      console.log(`  Parsed ${count.toLocaleString()} records...`)
    })
    console.log(`Parsed ${records.length.toLocaleString()} contract records`)

    console.log('Upserting to database...')
    const result = await upsertContracts(records)
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

    console.log('Contracts ingestion complete.')
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
