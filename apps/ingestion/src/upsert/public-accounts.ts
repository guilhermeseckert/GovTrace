import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { departmentExpenditures } from '@govtrace/db/schema/raw'
import type { DepartmentExpenditureRow } from '../parsers/public-accounts.ts'

const BATCH_SIZE = 500

/**
 * Upserts department expenditure rows into the department_expenditures table.
 * Uses INSERT ... ON CONFLICT DO UPDATE on the primary key.
 * Processes in batches of 500 to manage statement size.
 * Returns the total count of rows processed.
 */
export async function upsertDepartmentExpenditures(rows: DepartmentExpenditureRow[]): Promise<number> {
  const db = getDb()
  let upserted = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)

    // Deduplicate within batch by id (defensive — SHA256 should be unique per row)
    const seen = new Set<string>()
    const uniqueBatch = batch.filter((r) => {
      if (seen.has(r.id)) return false
      seen.add(r.id)
      return true
    })

    await db
      .insert(departmentExpenditures)
      .values(uniqueBatch)
      .onConflictDoUpdate({
        target: departmentExpenditures.id,
        set: {
          fiscalYear: sql`excluded.fiscal_year`,
          orgId: sql`excluded.org_id`,
          orgName: sql`excluded.org_name`,
          standardObject: sql`excluded.standard_object`,
          expenditures: sql`excluded.expenditures`,
          sourceFileHash: sql`excluded.source_file_hash`,
        },
      })

    upserted += uniqueBatch.length
  }

  return upserted
}
