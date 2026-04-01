import { readFile } from 'node:fs/promises'
import Papa from 'papaparse'
import { detectAndTranscode } from '../lib/encoding.ts'
import { deriveSourceKey } from '../lib/hash.ts'

export interface ContractRecord {
  id: string // deterministic: contract_id from source or SHA-256 hash
  contractId: string | null
  vendorName: string
  department: string
  description: string | null
  value: string | null
  originalValue: string | null
  startDate: string | null
  endDate: string | null
  awardDate: string | null
  procurementMethod: string | null
  province: string | null
  sourceFileHash: string
  rawData: Record<string, unknown>
}

// Column aliases: each array lists known header variants across open.canada.ca schema versions
const COLUMN_ALIASES: Record<string, string[]> = {
  contractId: ['contract_id', 'contract_number'],
  vendorName: ['vendor_name', 'supplier_name', 'vendor'],
  department: ['department_name', 'department', 'owner_org_title', 'owner_org'],
  description: ['description_en', 'description', 'comments_en'],
  value: ['contract_value', 'value', 'total_value', 'amended_value'],
  originalValue: ['original_value', 'initial_value'],
  startDate: ['start_date', 'contract_start_date', 'effective_date'],
  endDate: ['end_date', 'contract_end_date', 'expiry_date'],
  awardDate: ['award_date', 'contract_date', 'date'],
  procurementMethod: ['procurement_method_en', 'procurement_method', 'instrument_type_en'],
  province: ['vendor_postal_code', 'province', 'vendor_province'],
}

function buildColumnMapping(headers: string[]): Map<string, number> {
  const mapping = new Map<string, number>()
  const normalizedHeaders = headers.map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))

  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    const normalizedAliases = aliases.map((a) => a.trim().toLowerCase().replace(/\s+/g, '_'))
    const idx = normalizedHeaders.findIndex((h) => normalizedAliases.includes(h))
    if (idx !== -1) {
      mapping.set(field, idx)
    }
  }
  return mapping
}

/**
 * Parses a federal contracts CSV file to ContractRecord[].
 * - Detects encoding and transcodes to UTF-8 before parsing
 * - Maps columns by header name, never by position
 * - Generates deterministic IDs for idempotent upserts
 * - Preserves full original CSV row in rawData (DATA-08)
 */
export async function parseContractsFile(
  csvPath: string,
  sourceFileHash: string,
  onProgress?: (count: number) => void,
): Promise<ContractRecord[]> {
  const rawBuffer = await readFile(csvPath)
  const { utf8Content, detectedEncoding } = await detectAndTranscode(rawBuffer)

  console.log(
    `Contracts CSV: detected encoding ${detectedEncoding}, size ${rawBuffer.length} bytes`,
  )

  const records: ContractRecord[] = []
  let columnMapping: Map<string, number> | null = null
  let isFirstRow = true

  const parseResult = Papa.parse<string[]>(utf8Content, {
    skipEmptyLines: true,
    header: false,
  })

  for (const row of parseResult.data) {
    if (isFirstRow) {
      columnMapping = buildColumnMapping(row)
      isFirstRow = false
      continue
    }

    if (!columnMapping) continue

    const get = (field: string): string | null => {
      const idx = columnMapping!.get(field)
      if (idx === undefined) return null
      const val = row[idx]
      return val !== undefined && val.trim() !== '' ? val.trim() : null
    }

    const vendorName = get('vendorName')
    const department = get('department')

    // Skip rows missing required fields
    if (!vendorName || !department) continue

    // Build raw data map from header-indexed row values
    const rawData: Record<string, unknown> = {}
    for (const [i, val] of row.entries()) {
      rawData[i.toString()] = val
    }

    const contractId = get('contractId')
    const value = get('value')
    const awardDate = get('awardDate')
    const description = get('description')

    // Deterministic ID: use government contract_id if available, otherwise hash
    const id =
      contractId !== null && contractId !== ''
        ? contractId
        : deriveSourceKey([
            vendorName,
            department,
            value ?? '',
            awardDate ?? '',
            description?.slice(0, 50) ?? '',
          ])

    const record: ContractRecord = {
      id,
      contractId,
      vendorName,
      department,
      description,
      value,
      originalValue: get('originalValue'),
      startDate: get('startDate'),
      endDate: get('endDate'),
      awardDate,
      procurementMethod: get('procurementMethod'),
      province: get('province'),
      sourceFileHash,
      rawData,
    }

    records.push(record)
    if (onProgress && records.length % 10000 === 0) {
      onProgress(records.length)
    }
  }

  return records
}
