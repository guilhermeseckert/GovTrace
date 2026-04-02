import { createReadStream, readSync, openSync, closeSync } from 'node:fs'
import Papa from 'papaparse'
import chardet from 'chardet'
import iconv from 'iconv-lite'
import { deriveSourceKey } from '../lib/hash.ts'

export interface GrantRecord {
  id: string
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
    const normalizedAliases = aliases.map((a) => a.trim().toLowerCase().replace(/\s+/g, '_'))
    const idx = normalizedHeaders.findIndex((h) => normalizedAliases.includes(h))
    if (idx !== -1) mapping.set(field, idx)
  }
  return mapping
}

function detectFileEncoding(filePath: string): string {
  const buffer = Buffer.alloc(65536)
  const fd = openSync(filePath, 'r')
  try { readSync(fd, buffer, 0, 65536, 0) } finally { closeSync(fd) }
  return chardet.detect(buffer) ?? 'UTF-8'
}

export async function streamGrantsFile(
  csvPath: string,
  sourceFileHash: string,
  onBatch: (records: GrantRecord[]) => Promise<void>,
  batchSize = 5000,
  onProgress?: (count: number) => void,
): Promise<number> {
  const encoding = detectFileEncoding(csvPath)
  console.log(`Grants CSV: detected encoding ${encoding}`)

  const fileStream = createReadStream(csvPath)
  const inputStream = fileStream.pipe(iconv.decodeStream(encoding)).pipe(iconv.encodeStream('utf-8'))

  let columnMapping: Map<string, number> | null = null
  let isFirstRow = true
  let batch: GrantRecord[] = []
  let totalCount = 0
  let pendingFlush: Promise<void> | null = null

  return new Promise<number>((resolve, reject) => {
    Papa.parse(inputStream as NodeJS.ReadableStream, {
      skipEmptyLines: true,
      header: false,
      step: (result: Papa.ParseStepResult<string[]>, parser: Papa.Parser) => {
        const row = result.data
        if (isFirstRow) {
          if (row[0]) row[0] = row[0].replace(/^\uFEFF/, '')
          columnMapping = buildColumnMapping(row)
          console.log(`Column mapping: ${columnMapping.size} fields matched from ${row.length} headers`)
          isFirstRow = false
          return
        }
        if (!columnMapping) return

        const get = (field: string): string | null => {
          const idx = columnMapping!.get(field)
          if (idx === undefined) return null
          const val = row[idx]
          return val !== undefined && val.trim() !== '' ? val.trim() : null
        }

        const recipientName = get('recipientName')
        const department = get('department')
        if (!recipientName || !department) return

        const amount = get('amount')
        const agreementDate = get('agreementDate')
        const description = get('description')

        const id = deriveSourceKey([
          recipientName, department, amount ?? '', agreementDate ?? '', (description ?? '').slice(0, 50),
        ])

        batch.push({
          id, recipientName, recipientLegalName: get('recipientLegalName'),
          department, programName: get('programName'), description, amount,
          agreementDate, startDate: get('startDate'), endDate: get('endDate'),
          province: get('province'), city: get('city'), grantType: get('grantType'),
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
      error: (error: Error) => reject(error),
    })
  })
}
