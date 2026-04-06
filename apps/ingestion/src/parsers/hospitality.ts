import { createReadStream, readSync, openSync, closeSync } from 'node:fs'
import Papa from 'papaparse'
import chardet from 'chardet'
import iconv from 'iconv-lite'
import { deriveSourceKey } from '../lib/hash.ts'

export interface HospitalityRecord {
  id: string
  refNumber: string
  disclosureGroup: string | null
  name: string
  titleEn: string | null
  department: string
  departmentCode: string | null
  descriptionEn: string | null
  locationEn: string | null
  vendorEn: string | null
  startDate: string | null
  endDate: string | null
  employeeAttendees: number | null
  guestAttendees: number | null
  total: string
  normalizedName: string
  sourceFileHash: string
  rawData: Record<string, unknown>
}

const COLUMN_ALIASES: Record<string, string[]> = {
  refNumber: ['ref_number'],
  disclosureGroup: ['disclosure_group'],
  titleEn: ['title_en'],
  name: ['name'],
  descriptionEn: ['description_en'],
  startDate: ['start_date'],
  endDate: ['end_date'],
  locationEn: ['location_en'],
  vendorEn: ['vendor_en'],
  employeeAttendees: ['employee_attendees'],
  guestAttendees: ['guest_attendees'],
  total: ['total'],
  ownerOrg: ['owner_org'],
  ownerOrgTitle: ['owner_org_title'],
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

/**
 * Normalize official name from "Last, First" format to "first last".
 * If no comma exists, just trims and lowercases.
 */
function normalizeName(raw: string): string {
  const trimmed = raw.trim()
  const commaIdx = trimmed.indexOf(',')
  if (commaIdx !== -1) {
    const last = trimmed.slice(0, commaIdx).trim()
    const first = trimmed.slice(commaIdx + 1).trim()
    return `${first} ${last}`.toLowerCase()
  }
  return trimmed.toLowerCase()
}

/**
 * Extract English department name from bilingual owner_org_title.
 * "Accessibility Standards Canada | Normes d'accessibilite Canada" -> "Accessibility Standards Canada"
 */
function extractDepartmentEn(ownerOrgTitle: string): string {
  const pipeIdx = ownerOrgTitle.indexOf(' | ')
  if (pipeIdx !== -1) return ownerOrgTitle.slice(0, pipeIdx).trim()
  return ownerOrgTitle.trim()
}

/**
 * Parse money field: empty string -> null, numeric string -> keep as-is for Drizzle numeric column.
 */
function parseMoney(val: string | null): string | null {
  if (!val || val.trim() === '') return null
  const trimmed = val.trim()
  const n = Number(trimmed)
  if (Number.isNaN(n)) return null
  return trimmed
}

/**
 * Parse integer attendee count: empty string -> null.
 */
function parseAttendees(val: string | null): number | null {
  if (!val || val.trim() === '') return null
  const n = Number.parseInt(val.trim(), 10)
  if (Number.isNaN(n)) return null
  return n
}

export async function streamHospitalityFile(
  csvPath: string,
  sourceFileHash: string,
  onBatch: (records: HospitalityRecord[]) => Promise<void>,
  batchSize = 5000,
  onProgress?: (count: number) => void,
): Promise<number> {
  const encoding = detectFileEncoding(csvPath)
  console.log(`Hospitality CSV: detected encoding ${encoding}`)

  const fileStream = createReadStream(csvPath)
  const inputStream = fileStream.pipe(iconv.decodeStream(encoding)).pipe(iconv.encodeStream('utf-8'))

  let columnMapping: Map<string, number> | null = null
  let isFirstRow = true
  let batch: HospitalityRecord[] = []
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

        const name = get('name')
        const ownerOrg = get('ownerOrg')
        const ownerOrgTitle = get('ownerOrgTitle')
        const refNumber = get('refNumber')
        const total = parseMoney(get('total'))

        // Skip rows missing required fields
        if (!name || !ownerOrg || !refNumber || !total) return

        const department = ownerOrgTitle ? extractDepartmentEn(ownerOrgTitle) : ownerOrg
        const normalizedName = normalizeName(name)
        const id = deriveSourceKey([refNumber, ownerOrg])

        batch.push({
          id,
          refNumber,
          disclosureGroup: get('disclosureGroup'),
          name,
          titleEn: get('titleEn'),
          department,
          departmentCode: ownerOrg,
          descriptionEn: get('descriptionEn'),
          locationEn: get('locationEn'),
          vendorEn: get('vendorEn'),
          startDate: get('startDate'),
          endDate: get('endDate'),
          employeeAttendees: parseAttendees(get('employeeAttendees')),
          guestAttendees: parseAttendees(get('guestAttendees')),
          total,
          normalizedName,
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
