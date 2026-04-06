import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { ingestionRuns } from '@govtrace/db/schema/jobs'
import { downloadHospitality } from '../downloaders/hospitality.ts'
import { streamHospitalityFile } from '../parsers/hospitality.ts'
import { upsertHospitalityDisclosures } from '../upsert/hospitality.ts'

export async function runHospitalityIngestion(): Promise<void> {
  const db = getDb()
  const destDir = join(tmpdir(), 'govtrace-ingestion', 'hospitality')

  const [run] = await db
    .insert(ingestionRuns)
    .values({
      source: 'hospitality-disclosures',
      status: 'running',
      sourceFileUrl: 'https://open.canada.ca/data/en/dataset/b9f51ef4-4605-4ef2-8231-62a2edda1b54',
    })
    .returning()

  const runId = run.id
  let totalRecords = 0
  let totalInserted = 0

  try {
    console.log('Downloading federal hospitality disclosures CSV...')
    const { localPath, fileHash, fileSizeBytes } = await downloadHospitality(destDir)
    console.log(`Downloaded ${(fileSizeBytes / 1024 / 1024).toFixed(1)} MB, hash: ${fileHash.slice(0, 8)}...`)

    console.log('Streaming CSV parse + upsert...')
    totalRecords = await streamHospitalityFile(
      localPath, fileHash,
      async (batch) => {
        const result = await upsertHospitalityDisclosures(batch)
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

    console.log('Hospitality disclosures ingestion complete.')
  } catch (error) {
    await db.update(ingestionRuns).set({
      status: 'failed', errorMessage: error instanceof Error ? error.message : String(error),
      completedAt: new Date(),
    }).where(sql`id = ${runId}`)
    throw error
  }
}
