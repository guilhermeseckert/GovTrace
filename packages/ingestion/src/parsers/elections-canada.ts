import { readFile } from 'node:fs/promises'
import Papa from 'papaparse'
import { detectAndTranscode } from '../lib/encoding.ts'
import { deriveSourceKey } from '../lib/hash.ts'
import { buildColumnMapping } from './elections-canada-schemas.ts'
import type { ElectionsCanadaRow } from './elections-canada-schemas.ts'

export interface DonationRecord {
  id: string // deterministic hash key
  contributorName: string
  contributorType: string | null
  amount: string
  donationDate: string
  ridingCode: string | null
  ridingName: string | null
  recipientName: string
  recipientType: string | null
  electionYear: number | null
  province: string | null
  sourceFileHash: string
  rawData: Record<string, unknown>
}

/**
 * Parses an Elections Canada CSV file (any era, any encoding) to DonationRecord[].
 * - Detects encoding and transcodes to UTF-8 before parsing (D-11, Pitfall 5)
 * - Maps columns by header name, never by position (Pitfall 3)
 * - Generates deterministic IDs for idempotent upserts (D-08, Pitfall 2)
 */
export async function parseElectionsCanadaFile(
  csvPath: string,
  sourceFileHash: string,
  onProgress?: (count: number) => void,
): Promise<DonationRecord[]> {
  // Step 1: Read raw bytes and detect encoding
  const rawBuffer = await readFile(csvPath)
  const { utf8Content, detectedEncoding } = await detectAndTranscode(rawBuffer)

  console.log(
    `Elections Canada CSV: detected encoding ${detectedEncoding}, size ${rawBuffer.length} bytes`,
  )

  // Step 2: Parse CSV using papaparse — header: false so we handle headers manually for multi-era support
  const records: DonationRecord[] = []
  let columnMapping: Map<keyof ElectionsCanadaRow, number> | null = null
  let isFirstRow = true

  const parseResult = Papa.parse<string[]>(utf8Content, {
    skipEmptyLines: true,
    header: false,
  })

  for (const row of parseResult.data) {
    if (isFirstRow) {
      // Build column mapping from actual header row — never by position (Pitfall 3)
      columnMapping = buildColumnMapping(row)
      isFirstRow = false
      continue
    }

    if (!columnMapping) continue

    const get = (field: keyof ElectionsCanadaRow): string | null => {
      const idx = columnMapping!.get(field)
      if (idx === undefined) return null
      const val = row[idx]
      return val !== undefined ? val.trim() : null
    }

    const contributorName = get('contributorName')
    const amount = get('amount')
    const donationDate = get('donationDate')
    const recipientName = get('recipientName')

    // Skip rows missing required fields
    if (!contributorName || !amount || !donationDate || !recipientName) continue

    // Deterministic key from source fields (D-08, Pitfall 2)
    const id = deriveSourceKey([
      contributorName,
      amount,
      donationDate,
      get('ridingCode') ?? '',
      recipientName,
      sourceFileHash.slice(0, 8), // partial hash to scope key to source file
    ])

    const electionYearStr = get('electionYear')
    const electionYear =
      electionYearStr !== null ? Number.parseInt(electionYearStr, 10) : null

    const record: DonationRecord = {
      id,
      contributorName,
      contributorType: get('contributorType'),
      amount,
      donationDate,
      ridingCode: get('ridingCode'),
      ridingName: get('ridingName'),
      recipientName,
      recipientType: get('recipientType'),
      electionYear: electionYear !== null && !Number.isNaN(electionYear) ? electionYear : null,
      province: get('province'),
      sourceFileHash,
      rawData: Object.fromEntries(row.map((val, idx) => [idx.toString(), val])), // preserve full raw row — DATA-08
    }

    records.push(record)
    if (onProgress && records.length % 10000 === 0) {
      onProgress(records.length)
    }
  }

  return records
}
