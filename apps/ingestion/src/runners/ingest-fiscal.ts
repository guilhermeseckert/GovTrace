import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { ingestionRuns } from '@govtrace/db/schema/jobs'
import { downloadFiscalCsv } from '../downloaders/fiscal.ts'
import { parseFiscalCsv } from '../parsers/fiscal.ts'
import { upsertFiscalSnapshots } from '../upsert/fiscal.ts'

const SOURCE_FILE_URL =
  'https://www150.statcan.gc.ca/t1/wds/rest/getFullTableDownloadCSV/10100002/en'

/**
 * Orchestrates the full fiscal data ingestion pipeline:
 * 1. Download Statistics Canada table 10-10-0002-01 ZIP via WDS REST API
 * 2. Extract and parse the data CSV (filtering to accumulated_deficit and federal_net_debt series)
 * 3. Upsert all rows into the fiscal_snapshots table
 * 4. Log the ingestion run with status and counts
 *
 * Mirrors the runInternationalAidIngestion pattern exactly.
 */
export async function runFiscalIngestion(): Promise<void> {
  const db = getDb()
  const destDir = join(tmpdir(), 'govtrace-ingestion', 'fiscal')

  const runs = await db
    .insert(ingestionRuns)
    .values({
      source: 'fiscal_snapshots',
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
    console.log('Downloading Statistics Canada fiscal data (table 10-10-0002-01)...')
    const { localPath, fileHash } = await downloadFiscalCsv(destDir)
    console.log(`Downloaded CSV to ${localPath}`)

    console.log('Parsing fiscal CSV...')
    const rows = parseFiscalCsv(localPath, fileHash)
    totalRecords = rows.length
    console.log(`Parsed ${totalRecords} fiscal snapshot rows (accumulated_deficit + federal_net_debt)`)

    console.log('Upserting fiscal snapshots...')
    totalInserted = await upsertFiscalSnapshots(rows)
    console.log(`Upserted ${totalInserted} fiscal snapshot rows`)

    await db.update(ingestionRuns).set({
      status: 'completed',
      sourceFileHash: fileHash.slice(0, 8),
      recordsProcessed: totalRecords,
      recordsInserted: totalInserted,
      completedAt: new Date(),
    }).where(sql`id = ${runId}`)

    console.log('Fiscal ingestion complete.')
  } catch (error) {
    await db.update(ingestionRuns).set({
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
      completedAt: new Date(),
    }).where(sql`id = ${runId}`)
    throw error
  }
}
