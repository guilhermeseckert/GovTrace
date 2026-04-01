import { readFile } from 'node:fs/promises'
import Papa from 'papaparse'
import { detectAndTranscode } from '../lib/encoding.ts'
import { deriveSourceKey } from '../lib/hash.ts'

export interface GrantRecord {
  id: string // deterministic SHA-256 hash (no government-assigned ID in public CSV)
  recipientName: string
  recipientLegalName: string | null
  department: string
  programName: string | null
  description: string | null
  amount: string | null
  agreementDate: string | null
  startDate: string | null
  endDate: string | null
  province: string | null
  city: string | null
  grantType: string | null
  sourceFileHash: string
  rawData: Record<string, unknown>
}

// Column aliases: each array lists known header variants across open.canada.ca schema versions
const COLUMN_ALIASES: Record<string, string[]> = {
  recipientName: ['recipient_name', 'legal_name_en', 'org_name_en', 'recipient'],
  recipientLegalName: ['legal_name_en', 'recipient_legal_name', 'full_name_en'],
  department: ['department_name_en', 'owner_org_title', 'department_name', 'owner_org'],
  programName: ['prog_name_en', 'program_name', 'prog_title_en'],
  description: ['description_en', 'project_summary_en', 'description', 'project_title_en'],
  amount: ['agreement_value', 'value', 'amount', 'contribution_amount', 'total_amount'],
  agreementDate: ['agreement_start_date', 'agreement_date', 'start_date', 'date'],
  startDate: ['agreement_start_date', 'start_date'],
  endDate: ['agreement_end_date', 'end_date'],
  province: ['recipient_province_en', 'province', 'recipient_province', 'prov_state_en'],
  city: ['recipient_city', 'city', 'recipient_city_en'],
  grantType: ['grant_type_en', 'type', 'grant_type', 'instrument_type_en'],
}

function buildColumnMapping(headers: string[]): Map<string, number> {
  const mapping = new Map<string, number>()
  const normalizedHeaders = headers.map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))

  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    // Avoid overwriting already-mapped fields (first match wins)
    if (mapping.has(field)) continue
    const normalizedAliases = aliases.map((a) => a.trim().toLowerCase().replace(/\s+/g, '_'))
    const idx = normalizedHeaders.findIndex((h) => normalizedAliases.includes(h))
    if (idx !== -1) {
      mapping.set(field, idx)
    }
  }
  return mapping
}

/**
 * Parses a federal grants CSV file to GrantRecord[].
 * - Detects encoding and transcodes to UTF-8 before parsing
 * - Maps columns by header name, never by position
 * - Generates deterministic IDs for idempotent upserts (no government-assigned grant ID)
 * - Preserves full original CSV row in rawData (DATA-08)
 */
export async function parseGrantsFile(
  csvPath: string,
  sourceFileHash: string,
  onProgress?: (count: number) => void,
): Promise<GrantRecord[]> {
  const rawBuffer = await readFile(csvPath)
  const { utf8Content, detectedEncoding } = await detectAndTranscode(rawBuffer)

  console.log(`Grants CSV: detected encoding ${detectedEncoding}, size ${rawBuffer.length} bytes`)

  const records: GrantRecord[] = []
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

    const recipientName = get('recipientName')
    const department = get('department')

    // Skip rows missing required fields
    if (!recipientName || !department) continue

    // Build raw data map from header-indexed row values
    const rawData: Record<string, unknown> = {}
    for (const [i, val] of row.entries()) {
      rawData[i.toString()] = val
    }

    const amount = get('amount')
    const agreementDate = get('agreementDate')
    const startDate = get('startDate')

    // Deterministic ID from source fields (no government-assigned grant ID in public CSV)
    const id = deriveSourceKey([
      recipientName,
      department,
      amount ?? '',
      agreementDate ?? startDate ?? '',
    ])

    const record: GrantRecord = {
      id,
      recipientName,
      recipientLegalName: get('recipientLegalName'),
      department,
      programName: get('programName'),
      description: get('description'),
      amount,
      agreementDate,
      startDate,
      endDate: get('endDate'),
      province: get('province'),
      city: get('city'),
      grantType: get('grantType'),
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
