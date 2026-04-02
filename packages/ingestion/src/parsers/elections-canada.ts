import { createReadStream, readSync, openSync, closeSync } from 'node:fs'
import Papa from 'papaparse'
import chardet from 'chardet'
import iconv from 'iconv-lite'
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
 * Detect file encoding by reading a sample (first 64KB).
 * Avoids loading the entire 2GB file into memory.
 */
function detectFileEncoding(filePath: string): string {
  const sampleSize = 65536
  const buffer = Buffer.alloc(sampleSize)
  const fd = openSync(filePath, 'r')
  try {
    readSync(fd, buffer, 0, sampleSize, 0)
  } finally {
    closeSync(fd)
  }
  return chardet.detect(buffer) ?? 'UTF-8'
}

/**
 * Streams an Elections Canada CSV file (any era, any encoding) and calls onBatch
 * with chunks of parsed DonationRecords. Never loads entire file into memory.
 */
export async function streamElectionsCanadaFile(
  csvPath: string,
  sourceFileHash: string,
  onBatch: (records: DonationRecord[]) => Promise<void>,
  batchSize = 5000,
  onProgress?: (count: number) => void,
): Promise<number> {
  const encoding = detectFileEncoding(csvPath)
  console.log(`Elections Canada CSV: detected encoding ${encoding}`)

  // Create a readable stream, transcoding from detected encoding to UTF-8
  const fileStream = createReadStream(csvPath)
  const utf8Stream = encoding.toUpperCase() === 'UTF-8'
    ? fileStream
    : fileStream.pipe(iconv.decodeStream(encoding)).pipe(iconv.encodeStream('utf-8'))

  let columnMapping: Map<keyof ElectionsCanadaRow, number> | null = null
  let isFirstRow = true
  let batch: DonationRecord[] = []
  let totalCount = 0

  return new Promise<number>((resolve, reject) => {
    Papa.parse(utf8Stream, {
      skipEmptyLines: true,
      header: false,
      step: async (result: Papa.ParseStepResult<string[]>, parser: Papa.Parser) => {
        const row = result.data

        if (isFirstRow) {
          columnMapping = buildColumnMapping(row)
          isFirstRow = false
          return
        }

        if (!columnMapping) return

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

        if (!contributorName || !amount || !donationDate || !recipientName) return

        const id = deriveSourceKey([
          contributorName,
          amount,
          donationDate,
          get('ridingCode') ?? '',
          recipientName,
          sourceFileHash.slice(0, 8),
        ])

        const electionYearStr = get('electionYear')
        const electionYear =
          electionYearStr !== null ? Number.parseInt(electionYearStr, 10) : null

        batch.push({
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
          rawData: Object.fromEntries(row.map((val, idx) => [idx.toString(), val])),
        })

        if (batch.length >= batchSize) {
          parser.pause()
          totalCount += batch.length
          await onBatch(batch)
          if (onProgress) onProgress(totalCount)
          batch = []
          parser.resume()
        }
      },
      complete: async () => {
        // Flush remaining batch
        if (batch.length > 0) {
          totalCount += batch.length
          await onBatch(batch)
          if (onProgress) onProgress(totalCount)
        }
        resolve(totalCount)
      },
      error: (error: Error) => {
        reject(error)
      },
    })
  })
}
