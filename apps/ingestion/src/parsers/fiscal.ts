import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import Papa from 'papaparse'

// Maps StatsCan series name strings to our internal series identifiers
// Match series by prefix — StatsCan appends formula references like ", (B - E)"
const SERIES_PREFIXES: Array<{ prefix: string; series: string }> = [
  { prefix: 'A. Federal debt (accumulated deficit)', series: 'accumulated_deficit' },
  { prefix: 'B. Net debt', series: 'federal_net_debt' },
]

const SCALAR_MULTIPLIERS: Record<string, number> = {
  MILLIONS: 1,
  THOUSANDS: 0.001,
  UNITS: 0.000001, // convert units to millions
  BILLIONS: 1000,
}

export interface FiscalSnapshotRow {
  id: string
  series: string
  refDate: string
  valueMillionsCad: string | null
  sourceTable: string
  sourceUrl: string
}

interface StatCanRow {
  REF_DATE: string
  GEO: string
  'Central government debt': string
  UOM: string
  SCALAR_FACTOR: string
  VALUE: string
  [key: string]: string
}

/**
 * Parses the Statistics Canada table 10-10-0002-01 CSV.
 *
 * The CSV is in long/tidy format — one row per series per date.
 * We filter to only the series we care about (accumulated_deficit and federal_net_debt).
 * See Research Pitfall 1: naively reading the full CSV gives 29+ mixed series.
 *
 * SCALAR_FACTOR handling: Stats Canada values may be "MILLIONS", "THOUSANDS", etc.
 * We normalise all values to millions CAD before storing.
 */
export function parseFiscalCsv(csvPath: string, _fileHash: string): FiscalSnapshotRow[] {
  // Strip BOM if present (StatsCan CSVs have UTF-8 BOM)
  const csvContent = readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '')

  const parseResult = Papa.parse<StatCanRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  })

  if (parseResult.errors.length > 0) {
    const firstError = parseResult.errors[0]
    console.warn(`CSV parse warnings (${parseResult.errors.length} total): ${firstError?.message ?? 'unknown'}`)
  }

  const rows: FiscalSnapshotRow[] = []

  for (const row of parseResult.data) {
    const seriesName = row['Central government debt']?.trim()
    if (!seriesName) continue
    const match = SERIES_PREFIXES.find((s) => seriesName.startsWith(s.prefix))
    if (!match) continue
    const internalSeries = match.series

    const refDate = row.REF_DATE?.trim()
    if (!refDate) continue

    // StatsCan REF_DATE is YYYY-MM — normalise to YYYY-MM-01
    const normalisedDate = refDate.length === 7 ? `${refDate}-01` : refDate

    const rawValue = row.VALUE?.trim()
    let valueMillionsCad: string | null = null

    if (rawValue && rawValue !== '' && rawValue.toUpperCase() !== 'NULL') {
      const numericValue = Number.parseFloat(rawValue)
      if (!Number.isNaN(numericValue)) {
        const scalarFactor = (row.SCALAR_FACTOR?.trim().toUpperCase()) || 'MILLIONS'
        const multiplier = SCALAR_MULTIPLIERS[scalarFactor] ?? 1
        valueMillionsCad = (numericValue * multiplier).toFixed(2)
      }
    }

    // Deterministic ID: SHA256(series + refDate)
    const id = createHash('sha256')
      .update(`${internalSeries}:${normalisedDate}`)
      .digest('hex')

    rows.push({
      id,
      series: internalSeries,
      refDate: normalisedDate,
      valueMillionsCad,
      sourceTable: '10-10-0002-01',
      sourceUrl: 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1010000201',
    })
  }

  return rows
}
