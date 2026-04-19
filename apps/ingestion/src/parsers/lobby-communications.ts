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
 *
 * Enrichment: when extractedFiles is provided, secondary CSVs from the same ZIP are parsed to
 * populate publicOfficialName/publicOfficialTitle/department (from Communication_DpohExport.csv)
 * and subjectMatter (from Codes_SubjectMatterTypesExport + Communication_SubjectMattersExport).
 * Join key is comlog_id (already extracted from PrimaryExport). All DPOHs stored in rawData.
 */

export interface LobbyCommunicationRecord {
  id: string // deriveSourceKey([comlogId]) or deriveSourceKey([registrationNumber, communicationDate, lobbyistName, publicOfficialName])
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

interface DpohRecord {
  name: string
  title: string | null
  department: string | null
  branch: string | null
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

/** Treat the CSV literal "null" as an absent value. */
function nullIfNullString(value: string | null | undefined): string | null {
  if (!value || value === 'null') return null
  const trimmed = value.trim()
  return trimmed === '' || trimmed === 'null' ? null : trimmed
}

/**
 * Parse a secondary CSV from extractedFiles into a Papa parse result.
 * Uses detectAndTranscode to handle Latin-1 encoding in government CSVs.
 */
async function parseSecondaryFile(
  filePath: string,
): Promise<Papa.ParseResult<Record<string, string>>> {
  const buffer = await readFile(filePath)
  const { utf8Content } = await detectAndTranscode(buffer)
  return Papa.parse<Record<string, string>>(utf8Content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) =>
      header.trim().toLowerCase().replace(/\s+/g, '_'),
  })
}

/**
 * Build enrichment maps from secondary CSV files.
 * Returns:
 *   dpohByComlogId      — Map<comlog_id, DpohRecord[]>
 *   subjectsByComlogId  — Map<comlog_id, string[]> of resolved English SMT names
 */
async function buildEnrichmentMaps(extractedFiles: Record<string, string>): Promise<{
  dpohByComlogId: Map<string, DpohRecord[]>
  subjectsByComlogId: Map<string, string[]>
}> {
  // 1. Build SMT code → English name lookup
  const subjectCodes = new Map<string, string>()
  const codesPath = extractedFiles['Codes_SubjectMatterTypesExport.csv']
  if (codesPath) {
    const codesParsed = await parseSecondaryFile(codesPath)
    for (const row of codesParsed.data) {
      const code = row.subject_code_objet
      const desc = row.smt_en_desc
      if (code && desc) {
        subjectCodes.set(code.trim(), desc.trim())
      }
    }
    console.log(`[lobby_communications] Loaded ${subjectCodes.size} SMT code entries`)
  }

  // 2. Build comlog_id → resolved subject matter names
  const subjectsByComlogId = new Map<string, string[]>()
  const smPath = extractedFiles['Communication_SubjectMattersExport.csv']
  if (smPath) {
    const smParsed = await parseSecondaryFile(smPath)
    for (const row of smParsed.data) {
      const comlogId = nullIfNullString(row.comlog_id)
      const code = nullIfNullString(row.subject_code_objet)
      if (!comlogId || !code) continue
      const resolved = subjectCodes.get(code) ?? code
      const existing = subjectsByComlogId.get(comlogId) ?? []
      existing.push(resolved)
      subjectsByComlogId.set(comlogId, existing)
    }
    console.log(
      `[lobby_communications] Loaded subject matters for ${subjectsByComlogId.size} communications`,
    )
  }

  // 3. Build comlog_id → DpohRecord[] (all DPOHs per communication)
  const dpohByComlogId = new Map<string, DpohRecord[]>()
  const dpohPath = extractedFiles['Communication_DpohExport.csv']
  if (dpohPath) {
    const dpohParsed = await parseSecondaryFile(dpohPath)
    for (const row of dpohParsed.data) {
      const comlogId = nullIfNullString(row.comlog_id)
      if (!comlogId) continue

      const firstName = nullIfNullString(row.dpoh_first_nm_prenom_tcpd) ?? ''
      const lastName = nullIfNullString(row.dpoh_last_nm_tcpd) ?? ''
      const name = `${firstName} ${lastName}`.trim()
      if (!name) continue

      const title = nullIfNullString(row.dpoh_title_titre_tcpd)
      const dept = nullIfNullString(row.institution)
      const branch = nullIfNullString(row.branch_unit_direction_service)

      const existing = dpohByComlogId.get(comlogId) ?? []
      existing.push({ name, title, department: dept, branch })
      dpohByComlogId.set(comlogId, existing)
    }
    console.log(
      `[lobby_communications] Loaded DPOH data for ${dpohByComlogId.size} communications`,
    )
  }

  return { dpohByComlogId, subjectsByComlogId }
}

export async function parseLobbyCommunicationsFile(
  filePath: string,
  sourceFileHash: string,
  extractedFiles?: Record<string, string>,
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

  // Build enrichment maps from secondary CSVs when available
  let dpohByComlogId: Map<string, DpohRecord[]> | null = null
  let subjectsByComlogId: Map<string, string[]> | null = null
  if (extractedFiles) {
    const maps = await buildEnrichmentMaps(extractedFiles)
    dpohByComlogId = maps.dpohByComlogId
    subjectsByComlogId = maps.subjectsByComlogId
  }

  const records: LobbyCommunicationRecord[] = []
  let skippedCount = 0
  let enrichedCount = 0

  for (const row of parsed.data) {
    // REQUIRED fields — skip row if any are missing
    const registrationNumber = resolveColumn(row, [
      'registrant_num_declarant',
      'registration_number',
      'reg_number',
      'regnum',
    ])

    const communicationDate = resolveColumn(row, [
      'comm_date',
      'communication_date',
      'date_of_communication',
      'meeting_date',
      'date',
    ])

    if (!communicationDate) {
      skippedCount++
      continue
    }

    // Build lobbyist name from first + last name columns
    const lobbyistLast = resolveColumn(row, ['rgstrnt_last_nm_dclrnt', 'lobbyist_last_name'])
    const lobbyistFirst = resolveColumn(row, ['rgstrnt_1st_nm_prenom_dclrnt', 'lobbyist_first_name'])
    const lobbyistName = lobbyistLast && lobbyistFirst
      ? `${lobbyistFirst} ${lobbyistLast}`
      : resolveColumn(row, ['registrant_name', 'lobbyist_name', 'consultant_name', 'firm_name'])

    if (!lobbyistName) {
      skippedCount++
      continue
    }

    // DPOH names come from the separate DpohExport.csv — in PrimaryExport they're linked by COMLOG_ID
    const publicOfficialNameFromPrimary = resolveColumn(row, [
      'dpoh_last_nm_tcpd',
      'public_office_holder',
      'poh_name',
      'dpoh_name',
      'official_name',
    ])

    // Deterministic ID — no stable government key for communications
    // IMPORTANT: use the same comlog_id-based key as the original parser to avoid duplicates (Pitfall 5)
    const regNum = registrationNumber ?? ''
    const comlogId = resolveColumn(row, ['comlog_id'])
    const fallbackOfficialName = publicOfficialNameFromPrimary ?? 'Unknown'
    const id = comlogId
      ? deriveSourceKey([comlogId])
      : deriveSourceKey([regNum, communicationDate, lobbyistName, fallbackOfficialName])

    const clientName = resolveColumn(row, [
      'en_client_org_corp_nm_an',
      'client_name',
      'organization_name',
      'org_name',
      'client',
    ])

    // ENRICHMENT from DpohExport: use first DPOH for flat fields, store all in rawData
    let publicOfficialName = fallbackOfficialName
    let publicOfficialTitle: string | null = null
    let department: string | null = null
    let dpohOfficials: DpohRecord[] = []

    if (comlogId && dpohByComlogId) {
      const dpohs = dpohByComlogId.get(comlogId)
      if (dpohs && dpohs.length > 0) {
        // dpohs.length > 0 guard ensures dpohs[0] exists; use non-null assertion for TS
        // biome-ignore lint/style/noNonNullAssertion: array length guard ensures element exists
        const primaryDpoh = dpohs[0]!
        publicOfficialName = primaryDpoh.name || fallbackOfficialName
        publicOfficialTitle = primaryDpoh.title ?? null
        department = primaryDpoh.department ?? null
        dpohOfficials = dpohs
        enrichedCount++
      }
    }

    // Fall back to primary CSV columns for title/department if enrichment not available
    if (!publicOfficialTitle) {
      publicOfficialTitle = resolveColumn(row, [
        'title_en',
        'public_office_holder_title',
        'position',
        'title',
        'poh_title',
      ])
    }
    if (!department) {
      department = resolveColumn(row, [
        'institution',
        'department_en',
        'institution_en',
        'department_name',
        'department',
      ])
    }

    // Subject matter: prefer secondary CSV (resolved SMT codes), fall back to primary CSV column
    let subjectMatter: string | null = null
    if (comlogId && subjectsByComlogId) {
      const subjects = subjectsByComlogId.get(comlogId)
      if (subjects && subjects.length > 0) {
        subjectMatter = subjects.join('; ')
      }
    }
    if (!subjectMatter) {
      subjectMatter = resolveColumn(row, [
        'subject_matter',
        'subject',
        'subject_matter_en',
      ])
    }

    const communicationMethod = resolveColumn(row, [
      'communication_method_en',
      'method',
      'communication_method',
      'communication_type',
    ])

    // Merge raw row with enrichment — dpoh_officials stored for full fidelity
    const rawData: Record<string, unknown> = { ...(row as Record<string, unknown>) }
    if (dpohOfficials.length > 0) {
      rawData.dpoh_officials = dpohOfficials
    }

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
      rawData,
    })
  }

  if (skippedCount > 0) {
    console.warn(
      `Lobby communications: skipped ${skippedCount} rows with missing required fields`,
    )
  }

  if (extractedFiles) {
    console.log(
      `Lobby communications: enriched ${enrichedCount} records with DPOH data from secondary CSV`,
    )
  }

  console.log(
    `Lobby communications: parsed ${records.length} records from ${parsed.data.length} rows`,
  )

  return records
}
