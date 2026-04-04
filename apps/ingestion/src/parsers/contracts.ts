import { createReadStream, readSync, openSync, closeSync } from 'node:fs'
import Papa from 'papaparse'
import chardet from 'chardet'
import iconv from 'iconv-lite'
import { deriveSourceKey } from '../lib/hash.ts'

export interface ContractRecord {
  id: string
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

const COLUMN_ALIASES: Record<string, string[]> = {
  contractId: ['contract_id', 'contract_number', 'reference_number'],
  vendorName: ['vendor_name', 'supplier_name', 'vendor'],
  department: ['department_name', 'department', 'owner_org_title', 'owner_org'],
  description: ['description_en', 'description', 'comments_en'],
  value: ['contract_value', 'value', 'total_value', 'amended_value'],
  originalValue: ['original_value', 'initial_value'],
  startDate: ['start_date', 'contract_start_date', 'contract_period_start', 'effective_date'],
  endDate: ['end_date', 'contract_end_date', 'delivery_date', 'expiry_date'],
  awardDate: ['award_date', 'contract_date', 'date'],
  procurementMethod: ['procurement_method_en', 'procurement_method', 'solicitation_procedure_en', 'instrument_type_en'],
  province: ['vendor_postal_code', 'province', 'vendor_province'],
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

export async function streamContractsFile(
  csvPath: string,
  sourceFileHash: string,
  onBatch: (records: ContractRecord[]) => Promise<void>,
  batchSize = 5000,
  onProgress?: (count: number) => void,
): Promise<number> {
  const encoding = detectFileEncoding(csvPath)
  console.log(`Contracts CSV: detected encoding ${encoding}`)

  const fileStream = createReadStream(csvPath)
  const inputStream = fileStream.pipe(iconv.decodeStream(encoding)).pipe(iconv.encodeStream('utf-8'))

  let columnMapping: Map<string, number> | null = null
  let isFirstRow = true
  let batch: ContractRecord[] = []
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

        const vendorName = get('vendorName')
        const department = get('department')
        if (!vendorName || !department) return

        const contractId = get('contractId')
        const value = get('value')
        const awardDate = get('awardDate')
        const description = get('description')

        const id = contractId ?? deriveSourceKey([
          vendorName, department, value ?? '', awardDate ?? '', (description ?? '').slice(0, 50),
        ])

        batch.push({
          id, contractId, vendorName, department, description, value,
          originalValue: get('originalValue'), startDate: get('startDate'),
          endDate: get('endDate'), awardDate, procurementMethod: get('procurementMethod'),
          province: get('province'), sourceFileHash,
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
