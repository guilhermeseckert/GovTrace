import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { ingestionRuns } from '@govtrace/db/schema/jobs'
import { downloadPublicAccountsCsv } from '../downloaders/public-accounts.ts'
import { parsePublicAccountsCsv } from '../parsers/public-accounts.ts'
import { upsertDepartmentExpenditures } from '../upsert/public-accounts.ts'

const SOURCE_FILE_URL =
  'https://open.canada.ca/data/dataset/a35cf382-690c-4221-a971-cf0fd189a46f/resource/27e54a33-3c39-42a9-8d58-46dd37c527e5/download/eso_eac_en.csv'

/**
 * Orchestrates the full Public Accounts ingestion pipeline:
 * 1. Download the "Expenditures by Standard Object" CSV from open.canada.ca
 * 2. Parse with PapaParse + Zod validation
 * 3. Upsert all rows into department_expenditures table
 * 4. Log the ingestion run with status and counts
 *
 * Mirrors the runFiscalIngestion pattern exactly.
 */
export async function runPublicAccountsIngestion(): Promise<void> {
  const db = getDb()
  const destDir = join(tmpdir(), 'govtrace-ingestion', 'public-accounts')

  const runs = await db
    .insert(ingestionRuns)
    .values({
      source: 'public_accounts',
      status: 'running',
      sourceFileUrl: SOURCE_FILE_URL,
    })
    .returning()

  const run = runs[0]
  if (!run) throw new Error('Failed to create ingestion run record')
  const runId = run.id
  let totalRecords = 0
  let totalInserted = 0

  try {
    console.log('Downloading Public Accounts of Canada CSV (Expenditures by Standard Object)...')
    const { localPath, fileHash } = await downloadPublicAccountsCsv(destDir)
    console.log(`Downloaded CSV to ${localPath}`)

    console.log('Parsing Public Accounts CSV...')
    const rows = parsePublicAccountsCsv(localPath, fileHash)
    totalRecords = rows.length
    console.log(`Parsed ${totalRecords} department expenditure rows across all fiscal years`)

    console.log('Upserting department expenditures...')
    totalInserted = await upsertDepartmentExpenditures(rows)
    console.log(`Upserted ${totalInserted} department expenditure rows`)

    await db.update(ingestionRuns).set({
      status: 'completed',
      sourceFileHash: fileHash.slice(0, 8),
      recordsProcessed: totalRecords,
      recordsInserted: totalInserted,
      completedAt: new Date(),
    }).where(sql`id = ${runId}`)

    console.log('Public Accounts ingestion complete.')
  } catch (error) {
    await db.update(ingestionRuns).set({
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
      completedAt: new Date(),
    }).where(sql`id = ${runId}`)
    throw error
  }
}
