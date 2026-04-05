import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { fiscalSnapshots } from '@govtrace/db/schema/raw'
import type { FiscalSnapshotRow } from '../parsers/fiscal.ts'

const BATCH_SIZE = 500

/**
 * Upserts fiscal snapshot rows into the fiscal_snapshots table.
 * Uses INSERT ... ON CONFLICT DO UPDATE on the primary key.
 * Processes in batches of 500 to manage statement size.
 * Returns the total count of rows processed.
 */
export async function upsertFiscalSnapshots(rows: FiscalSnapshotRow[]): Promise<number> {
  const db = getDb()
  let upserted = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)

    // Deduplicate within batch by id (should not occur but defensive)
    const seen = new Set<string>()
    const uniqueBatch = batch.filter((r) => {
      if (seen.has(r.id)) return false
      seen.add(r.id)
      return true
    })

    await db
      .insert(fiscalSnapshots)
      .values(uniqueBatch)
      .onConflictDoUpdate({
        target: fiscalSnapshots.id,
        set: {
          series: sql`excluded.series`,
          refDate: sql`excluded.ref_date`,
          valueMillionsCad: sql`excluded.value_millions_cad`,
          sourceTable: sql`excluded.source_table`,
          sourceUrl: sql`excluded.source_url`,
        },
      })

    upserted += uniqueBatch.length
  }

  return upserted
}
