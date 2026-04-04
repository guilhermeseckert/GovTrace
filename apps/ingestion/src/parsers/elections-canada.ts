import { createReadStream, readSync, openSync, closeSync } from 'node:fs'
import Papa from 'papaparse'
import chardet from 'chardet'
import iconv from 'iconv-lite'
import { deriveSourceKey } from '../lib/hash.ts'
import { buildColumnMapping } from './elections-canada-schemas.ts'
import type { ElectionsCanadaRow } from './elections-canada-schemas.ts'

export interface DonationRecord {
  id: string
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
 * Streams Elections Canada CSV, calling onBatch with chunks of parsed records.
 * PapaParse step callback is synchronous — we collect into batches and flush with pause/resume.
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

  const fileStream = createReadStream(csvPath)

  // For UTF-8 with BOM, use stripBOM transform; for other encodings, transcode
  let inputStream: NodeJS.ReadableStream
  if (encoding.toUpperCase() === 'UTF-8') {
    // Strip BOM if present by wrapping in iconv decode/encode roundtrip
    inputStream = fileStream.pipe(iconv.decodeStream('utf-8')).pipe(iconv.encodeStream('utf-8'))
  } else {
    inputStream = fileStream.pipe(iconv.decodeStream(encoding)).pipe(iconv.encodeStream('utf-8'))
  }

  let columnMapping: Map<keyof ElectionsCanadaRow, number> | null = null
  let isFirstRow = true
  let batch: DonationRecord[] = []
  let totalCount = 0
  let pendingFlush: Promise<void> | null = null

  return new Promise<number>((resolve, reject) => {
    Papa.parse(inputStream as NodeJS.ReadableStream, {
      skipEmptyLines: true,
      header: false,
      step: (result: Papa.ParseStepResult<string[]>, parser: Papa.Parser) => {
        const row = result.data

        if (isFirstRow) {
          // Strip BOM from first header cell if present
          if (row[0]) {
            row[0] = row[0].replace(/^\uFEFF/, '')
          }
          columnMapping = buildColumnMapping(row)
          console.log(`Column mapping: ${columnMapping.size} fields matched from ${row.length} headers`)
          if (columnMapping.size < 3) {
            console.log(`  Headers: ${row.slice(0, 5).join(', ')}...`)
          }
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
          const currentBatch = batch
          batch = []
          totalCount += currentBatch.length

          parser.pause()
          pendingFlush = onBatch(currentBatch).then(() => {
            if (onProgress) onProgress(totalCount)
            parser.resume()
          }).catch(reject)
        }
      },
      complete: () => {
        // Wait for any pending flush, then flush remaining
        const finish = async () => {
          if (pendingFlush) await pendingFlush
          if (batch.length > 0) {
            totalCount += batch.length
            await onBatch(batch)
            if (onProgress) onProgress(totalCount)
          }
          resolve(totalCount)
        }
        finish().catch(reject)
      },
      error: (error: Error) => {
        reject(error)
      },
    })
  })
}
