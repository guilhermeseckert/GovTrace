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
 *
 * Enrichment: when extractedFiles is provided, secondary CSVs from the same ZIP
 * are parsed to populate subjectMatter (from Codes_SubjectMatterTypesExport +
 * Registration_SubjectMattersExport) and targetDepartments (from
 * Registration_GovernmentInstExport). Join key is reg_id_enr (NOT reg_num_enr).
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

/** Treat the CSV literal "null" as an absent value. */
function nullIfNullString(value: string | null | undefined): string | null {
  if (!value || value === 'null') return null
  return value
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
 * Build subject matter lookup maps from secondary CSV files.
 * Returns:
 *   subjectsByRegId  — Map<reg_id_enr, string[]> of resolved English SMT names
 *   deptsByRegId     — Map<reg_id_enr, string[]> of English institution names
 */
async function buildEnrichmentMaps(extractedFiles: Record<string, string>): Promise<{
  subjectsByRegId: Map<string, string[]>
  deptsByRegId: Map<string, string[]>
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
    console.log(`[lobby_registrations] Loaded ${subjectCodes.size} SMT code entries`)
  }

  // 2. Build reg_id_enr → resolved subject matter names
  const subjectsByRegId = new Map<string, string[]>()
  const smPath = extractedFiles['Registration_SubjectMattersExport.csv']
  if (smPath) {
    const smParsed = await parseSecondaryFile(smPath)
    for (const row of smParsed.data) {
      const regId = nullIfNullString(row.reg_id_enr)
      const code = nullIfNullString(row.subject_code_objet)
      if (!regId || !code) continue
      const resolved = subjectCodes.get(code) ?? code
      const existing = subjectsByRegId.get(regId) ?? []
      existing.push(resolved)
      subjectsByRegId.set(regId, existing)
    }
    console.log(
      `[lobby_registrations] Loaded subject matters for ${subjectsByRegId.size} registrations`,
    )
  }

  // 3. Build reg_id_enr → institution names
  const deptsByRegId = new Map<string, string[]>()
  const govInstPath = extractedFiles['Registration_GovernmentInstExport.csv']
  if (govInstPath) {
    const govInstParsed = await parseSecondaryFile(govInstPath)
    for (const row of govInstParsed.data) {
      const regId = nullIfNullString(row.reg_id_enr)
      // The English institution name column — try common variants
      const instName = nullIfNullString(
        row.en_institution_nm_inst_an ??
        row.institution_nm_inst_an ??
        row.institution_en ??
        row.institution,
      )
      if (!regId || !instName) continue
      const existing = deptsByRegId.get(regId) ?? []
      existing.push(instName)
      deptsByRegId.set(regId, existing)
    }
    console.log(
      `[lobby_registrations] Loaded target departments for ${deptsByRegId.size} registrations`,
    )
  }

  return { subjectsByRegId, deptsByRegId }
}

export async function parseLobbyRegistrationsFile(
  filePath: string,
  sourceFileHash: string,
  extractedFiles?: Record<string, string>,
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

  // Build enrichment maps from secondary CSVs when available
  let subjectsByRegId: Map<string, string[]> | null = null
  let deptsByRegId: Map<string, string[]> | null = null
  if (extractedFiles) {
    const maps = await buildEnrichmentMaps(extractedFiles)
    subjectsByRegId = maps.subjectsByRegId
    deptsByRegId = maps.deptsByRegId
  }

  const records: LobbyRegistrationRecord[] = []
  let skippedCount = 0
  let enrichedCount = 0

  for (const row of parsed.data) {
    const registrationNumber = resolveColumn(row, [
      'reg_num_enr',
      'registration_number',
      'reg_number',
      'regnum',
    ])

    if (!registrationNumber) {
      skippedCount++
      continue
    }

    // Build lobbyist name from first + last columns, or fall back to firm name
    const lobbyistLast = resolveColumn(row, ['rgstrnt_last_nm_dclrnt'])
    const lobbyistFirst = resolveColumn(row, ['rgstrnt_1st_nm_prenom_dclrnt'])
    const lobbyistName = lobbyistLast && lobbyistFirst
      ? `${lobbyistFirst} ${lobbyistLast}`
      : resolveColumn(row, ['en_firm_nm_firme_an', 'registrant_name', 'lobbyist_name', 'firm_name'])

    if (!lobbyistName) {
      skippedCount++
      continue
    }

    const clientName = resolveColumn(row, [
      'en_client_org_corp_nm_an',
      'client_name',
      'organization_name',
      'org_name',
      'client',
    ])

    // clientName may be null for in-house registrations — this is valid

    const lobbyistType = resolveColumn(row, [
      'reg_type_enr',
      'registrant_type',
      'lobbyist_type',
      'type',
      'reg_type',
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

    // ENRICHMENT: Use reg_id_enr (NOT reg_num_enr) to join secondary CSV data.
    // Both IDs are present in the primary CSV; secondary files only have reg_id_enr.
    const regIdEnr = nullIfNullString(row.reg_id_enr)

    // Subject matter: prefer secondary CSV (resolved SMT codes), fall back to primary CSV column
    let subjectMatter: string | null = null
    if (regIdEnr && subjectsByRegId) {
      const subjects = subjectsByRegId.get(regIdEnr)
      if (subjects && subjects.length > 0) {
        subjectMatter = subjects.join('; ')
      }
    }
    if (!subjectMatter) {
      subjectMatter = resolveColumn(row, [
        'subject_matter',
        'subject',
        'issue',
        'subject_matter_en',
      ])
    }

    // Target departments: prefer secondary CSV array, fall back to primary pipe-delimited column
    let targetDepartments: string[] = []
    if (regIdEnr && deptsByRegId) {
      const depts = deptsByRegId.get(regIdEnr)
      if (depts && depts.length > 0) {
        targetDepartments = depts
      }
    }
    if (targetDepartments.length === 0) {
      const deptRaw = resolveColumn(row, [
        'target_departments',
        'departments',
        'institutions',
        'government_institutions',
      ])
      if (deptRaw) {
        targetDepartments = deptRaw
          .split(/[|;,]/)
          .map((d) => d.trim())
          .filter((d) => d.length > 0)
      }
    }

    if (regIdEnr && (subjectsByRegId?.has(regIdEnr) ?? false)) {
      enrichedCount++
    }

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

  if (extractedFiles) {
    console.log(
      `Lobby registrations: enriched ${enrichedCount} records with secondary CSV data`,
    )
  }

  console.log(
    `Lobby registrations: parsed ${records.length} records from ${parsed.data.length} rows`,
  )

  return records
}
