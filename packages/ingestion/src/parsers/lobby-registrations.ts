import { readFile } from 'node:fs/promises'
import Papa from 'papaparse'
import { detectAndTranscode } from '../lib/encoding.ts'

/**
 * Lobby registrations CSV parser.
 * The lobbyist registry uses free-text fields with inconsistent naming.
 * See Pitfall 7: Lobbying Registry Data Has Systematic Naming Inconsistencies.
 *
 * ID rule: registration_number from source is used directly as the record ID.
 * This is a stable government-issued key — no hash needed (unlike other sources).
 */

export interface LobbyRegistrationRecord {
  id: string // equal to registrationNumber — stable government key
  registrationNumber: string
  lobbyistName: string
  lobbyistType: string | null
  clientName: string | null // may be absent for in-house registrations
  subjectMatter: string | null
  targetDepartments: string[]
  status: string | null
  registrationDate: string | null
  lastUpdatedDate: string | null
  province: string | null
  normalizedLobbyistName: null // populated by Plan 06 normalizer
  normalizedClientName: null // populated by Plan 06 normalizer
  sourceFileHash: string
  rawData: Record<string, unknown>
}

/**
 * Resolves the column value by checking multiple possible column name variants.
 * The registry CSV uses inconsistent header names across export versions.
 */
function resolveColumn(
  row: Record<string, string>,
  candidates: string[],
): string | null {
  for (const candidate of candidates) {
    const value = row[candidate]
    if (value !== undefined && value !== null && value.trim() !== '') {
      return value.trim()
    }
  }
  return null
}

export async function parseLobbyRegistrationsFile(
  filePath: string,
  sourceFileHash: string,
): Promise<LobbyRegistrationRecord[]> {
  const buffer = await readFile(filePath)
  const { utf8Content, detectedEncoding } = await detectAndTranscode(buffer)

  console.log(`Lobby registrations: detected encoding ${detectedEncoding}`)

  const parsed = Papa.parse<Record<string, string>>(utf8Content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) =>
      header.trim().toLowerCase().replace(/\s+/g, '_'),
  })

  if (parsed.errors.length > 0) {
    const errorSummary = parsed.errors
      .slice(0, 5)
      .map((e) => e.message)
      .join('; ')
    console.warn(
      `Lobby registrations: ${parsed.errors.length} parse errors (showing first 5): ${errorSummary}`,
    )
  }

  const records: LobbyRegistrationRecord[] = []
  let skippedCount = 0

  for (const row of parsed.data) {
    const registrationNumber = resolveColumn(row, [
      'registration_number',
      'reg_number',
      'regnum',
    ])

    if (!registrationNumber) {
      skippedCount++
      continue
    }

    const lobbyistName = resolveColumn(row, [
      'registrant_name',
      'lobbyist_name',
      'firm_name',
      'consultant_name',
    ])

    if (!lobbyistName) {
      skippedCount++
      continue
    }

    const clientName = resolveColumn(row, [
      'client_name',
      'organization_name',
      'org_name',
      'client',
    ])

    if (clientName === null) {
      // Log a warning — absence may be valid (in-house registrations have no client)
      // but it could also signal an unrecognized column name
      console.warn(
        `Lobby registrations: no client_name found for registration ${registrationNumber} — ` +
          'may be an in-house registration or unrecognized column variant',
      )
    }

    const lobbyistType = resolveColumn(row, [
      'registrant_type',
      'lobbyist_type',
      'type',
      'reg_type',
    ])

    const subjectMatter = resolveColumn(row, [
      'subject_matter',
      'subject',
      'issue',
      'subject_matter_en',
    ])

    const statusValue = resolveColumn(row, ['status', 'reg_status', 'registration_status'])

    const registrationDate = resolveColumn(row, [
      'registration_date',
      'start_date',
      'reg_date',
      'effective_date',
    ])

    const lastUpdatedDate = resolveColumn(row, [
      'last_updated_date',
      'updated_date',
      'amend_date',
      'amendment_date',
      'last_modified_date',
    ])

    const province = resolveColumn(row, ['province', 'prov_code', 'province_code'])

    // Target departments: may be a pipe-delimited or semicolon-delimited list
    const deptRaw = resolveColumn(row, [
      'target_departments',
      'departments',
      'institutions',
      'government_institutions',
    ])
    const targetDepartments = deptRaw
      ? deptRaw
          .split(/[|;,]/)
          .map((d) => d.trim())
          .filter((d) => d.length > 0)
      : []

    records.push({
      id: registrationNumber,
      registrationNumber,
      lobbyistName,
      lobbyistType,
      clientName,
      subjectMatter,
      targetDepartments,
      status: statusValue,
      registrationDate,
      lastUpdatedDate,
      province,
      normalizedLobbyistName: null,
      normalizedClientName: null,
      sourceFileHash,
      rawData: row as Record<string, unknown>,
    })
  }

  if (skippedCount > 0) {
    console.warn(
      `Lobby registrations: skipped ${skippedCount} rows with missing required fields`,
    )
  }

  console.log(
    `Lobby registrations: parsed ${records.length} records from ${parsed.data.length} rows`,
  )

  return records
}
