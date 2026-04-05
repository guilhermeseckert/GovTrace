import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { ingestionRuns } from '@govtrace/db/schema/jobs'
import { downloadInternationalAid } from '../downloaders/international-aid.ts'
import { parseIatiFile } from '../parsers/international-aid.ts'
import { upsertInternationalAid } from '../upsert/international-aid.ts'

/**
 * Orchestrates the full international aid ingestion pipeline:
 * 1. Download all 4+ IATI XML files from Global Affairs Canada
 * 2. Parse each file with fast-xml-parser
 * 3. Upsert all activity records into the international_aid table
 * 4. Log the ingestion run with status and counts
 *
 * One ingestion_runs record for the whole run (not per file).
 * Source file hashes are concatenated as the sourceFileHash.
 */
export async function runInternationalAidIngestion(): Promise<void> {
  const db = getDb()
  const destDir = join(tmpdir(), 'govtrace-ingestion', 'international-aid')

  const runs = await db
    .insert(ingestionRuns)
    .values({
      source: 'international_aid',
      status: 'running',
      sourceFileUrl: 'https://open.canada.ca/data/en/dataset/2f7e22f0-88f6-430c-9723-547043f898ad',
    })
    .returning()

  const run = runs[0]
  if (!run) throw new Error('Failed to create ingestion run record')
  const runId = run.id
  let totalRecords = 0
  let totalInserted = 0

  try {
    console.log('Downloading IATI XML files from Global Affairs Canada...')
    const downloadResults = await downloadInternationalAid(destDir)
    console.log(`Downloaded ${downloadResults.length} files`)

    const allRecords = []
    for (const { name, localPath, fileHash } of downloadResults) {
      console.log(`Parsing ${name}...`)
      const records = parseIatiFile(localPath, fileHash)
      console.log(`  Parsed ${records.length} activities from ${name}`)
      allRecords.push(...records)
    }

    totalRecords = allRecords.length
    console.log(`Total activities parsed: ${totalRecords}`)

    console.log('Upserting records...')
    const upsertResult = await upsertInternationalAid(allRecords)
    totalInserted = upsertResult.inserted
    console.log(`Upserted ${totalInserted} records`)

    // Concatenate all file hashes as the combined sourceFileHash
    const combinedHash = downloadResults.map((r) => r.fileHash.slice(0, 8)).join('-')

    await db.update(ingestionRuns).set({
      status: 'completed',
      sourceFileHash: combinedHash,
      recordsProcessed: totalRecords,
      recordsInserted: totalInserted,
      completedAt: new Date(),
    }).where(sql`id = ${runId}`)

    console.log('International aid ingestion complete.')
  } catch (error) {
    await db.update(ingestionRuns).set({
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
      completedAt: new Date(),
    }).where(sql`id = ${runId}`)
    throw error
  }
}
