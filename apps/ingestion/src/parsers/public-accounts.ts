import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import Papa from 'papaparse'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DepartmentExpenditureRow {
  id: string
  fiscalYear: string
  orgId: number
  orgName: string
  standardObject: string
  expenditures: string // numeric string for Drizzle numeric column
  sourceFileHash: string
}

// ---------------------------------------------------------------------------
// Zod validation schema for CSV rows
// ---------------------------------------------------------------------------

const RawRowSchema = z.object({
  fy_ef: z.string().regex(/^\d{4}-\d{2}$/, 'Expected fiscal year format YYYY-YY'),
  org_id: z.coerce.number().int().positive(),
  org_name: z.string().min(1, 'org_name must not be empty'),
  sobj_en: z.string().min(1, 'sobj_en must not be empty'),
  // Can be negative (External/Internal revenues) — coerce string to number
  expenditures: z.coerce.number(),
})

type RawRow = z.infer<typeof RawRowSchema>

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parses the Public Accounts of Canada "Expenditures by Standard Object" CSV.
 *
 * Pitfall 1: CSV has UTF-8 BOM — strip before parsing.
 * Pitfall 3: Negative values are valid (External/Internal revenues) — do NOT filter.
 * Returns a typed array ready to insert into department_expenditures.
 */
export function parsePublicAccountsCsv(csvPath: string, fileHash: string): DepartmentExpenditureRow[] {
  // Strip UTF-8 BOM if present (Research Pitfall 1)
  const csvContent = readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '')

  const parseResult = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })

  if (parseResult.errors.length > 0) {
    const firstError = parseResult.errors[0]
    console.warn(`CSV parse warnings (${parseResult.errors.length} total): ${firstError?.message ?? 'unknown'}`)
  }

  const rows: DepartmentExpenditureRow[] = []
  let parseFailures = 0

  for (const raw of parseResult.data) {
    const result = RawRowSchema.safeParse(raw)
    if (!result.success) {
      parseFailures++
      if (parseFailures <= 5) {
        console.warn(`Row validation failed: ${result.error.issues.map((i) => i.message).join(', ')}`, raw)
      }
      continue
    }

    const row: RawRow = result.data

    // Deterministic ID: SHA256(fy_ef + ':' + org_id + ':' + sobj_en)
    const id = createHash('sha256')
      .update(`${row.fy_ef}:${row.org_id}:${row.sobj_en}`)
      .digest('hex')

    rows.push({
      id,
      fiscalYear: row.fy_ef,
      orgId: row.org_id,
      orgName: row.org_name,
      standardObject: row.sobj_en,
      expenditures: row.expenditures.toFixed(2),
      sourceFileHash: fileHash,
    })
  }

  if (parseFailures > 5) {
    console.warn(`... and ${parseFailures - 5} more row validation failures (total: ${parseFailures})`)
  }

  return rows
}
