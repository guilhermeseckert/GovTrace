import { readFile } from 'node:fs/promises'
import Papa from 'papaparse'
import { detectAndTranscode } from '../lib/encoding.ts'
import { deriveSourceKey } from '../lib/hash.ts'

/**
 * Lobby communications CSV parser.
 * Communication reports record individual meetings between lobbyists and public officials.
 * There is no stable government-issued key for communications, so a deterministic ID
 * is derived from the composite of: registrationNumber + communicationDate + lobbyistName + publicOfficialName.
 *
 * See Pitfall 7: Lobbying Registry Data Has Systematic Naming Inconsistencies.
 */

export interface LobbyCommunicationRecord {
  id: string // deriveSourceKey([registrationNumber, communicationDate, lobbyistName, publicOfficialName])
  registrationNumber: string
  communicationDate: string
  lobbyistName: string
  clientName: string | null
  publicOfficialName: string
  publicOfficialTitle: string | null
  department: string | null
  subjectMatter: string | null
  communicationMethod: string | null
  normalizedLobbyistName: null // populated by Plan 06 normalizer
  normalizedOfficialName: null // populated by Plan 06 normalizer
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

export async function parseLobbyCommunicationsFile(
  filePath: string,
  sourceFileHash: string,
): Promise<LobbyCommunicationRecord[]> {
  const buffer = await readFile(filePath)
  const { utf8Content, detectedEncoding } = await detectAndTranscode(buffer)

  console.log(`Lobby communications: detected encoding ${detectedEncoding}`)

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
      `Lobby communications: ${parsed.errors.length} parse errors (showing first 5): ${errorSummary}`,
    )
  }

  const records: LobbyCommunicationRecord[] = []
  let skippedCount = 0

  for (const row of parsed.data) {
    // REQUIRED fields — skip row if any are missing
    const registrationNumber = resolveColumn(row, [
      'registration_number',
      'reg_number',
      'regnum',
    ])

    const communicationDate = resolveColumn(row, [
      'communication_date',
      'date_of_communication',
      'meeting_date',
      'date',
    ])

    if (!communicationDate) {
      skippedCount++
      continue
    }

    const lobbyistName = resolveColumn(row, [
      'registrant_name',
      'lobbyist_name',
      'consultant_name',
      'firm_name',
    ])

    if (!lobbyistName) {
      skippedCount++
      continue
    }

    const publicOfficialName = resolveColumn(row, [
      'public_office_holder',
      'poh_name',
      'dpoh_name',
      'official_name',
      'dpoh',
      'public_official',
    ])

    if (!publicOfficialName) {
      skippedCount++
      continue
    }

    // Deterministic ID — no stable government key for communications
    const regNum = registrationNumber ?? ''
    const id = deriveSourceKey([regNum, communicationDate, lobbyistName, publicOfficialName])

    const clientName = resolveColumn(row, [
      'client_name',
      'organization_name',
      'org_name',
      'client',
    ])

    const publicOfficialTitle = resolveColumn(row, [
      'title_en',
      'public_office_holder_title',
      'position',
      'title',
      'poh_title',
    ])

    const department = resolveColumn(row, [
      'department_en',
      'institution_en',
      'department_name',
      'institution',
      'department',
    ])

    const subjectMatter = resolveColumn(row, [
      'subject_matter',
      'subject',
      'subject_matter_en',
    ])

    const communicationMethod = resolveColumn(row, [
      'communication_method_en',
      'method',
      'communication_method',
      'communication_type',
    ])

    records.push({
      id,
      registrationNumber: regNum,
      communicationDate,
      lobbyistName,
      clientName,
      publicOfficialName,
      publicOfficialTitle,
      department,
      subjectMatter,
      communicationMethod,
      normalizedLobbyistName: null,
      normalizedOfficialName: null,
      sourceFileHash,
      rawData: row as Record<string, unknown>,
    })
  }

  if (skippedCount > 0) {
    console.warn(
      `Lobby communications: skipped ${skippedCount} rows with missing required fields`,
    )
  }

  console.log(
    `Lobby communications: parsed ${records.length} records from ${parsed.data.length} rows`,
  )

  return records
}
