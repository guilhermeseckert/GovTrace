/**
 * GIC Appointments HTML parser
 * Source: federal-organizations.canada.ca org profile pages
 *
 * HTML structure (as of 2026-04-05):
 *   - Page header contains org name
 *   - Appointments are in HTML tables, grouped by position title (section header)
 *   - Each row: name, appointment type, tenure type, appointment date, expiry date
 *   - Names use "LastName, FirstName" format
 *   - Vacant positions show "Vacant" as the name
 */

import { load } from 'cheerio'
import { createHash } from 'node:crypto'
import { normalizeName } from '../normalizer/normalize.ts'

export interface ParsedAppointment {
  id: string // SHA256(orgCode + appointeeName + positionTitle)
  appointeeName: string // "LastName, FirstName" or "Vacant" — original format
  normalizedAppointeeName: string | null // "firstname lastname" normalized
  positionTitle: string
  organizationName: string
  organizationCode: string
  appointmentType: string | null // 'full-time' | 'part-time'
  tenureType: string | null // 'during_good_behaviour' | 'during_pleasure'
  appointmentDate: string | null // YYYY-MM-DD
  expiryDate: string | null // YYYY-MM-DD
  isVacant: boolean
  sourceUrl: string
  sourceFileHash: string
  rawData: Record<string, unknown>
}

/**
 * Derives a deterministic SHA256 ID from orgCode + appointeeName + positionTitle.
 */
function deriveId(orgCode: string, appointeeName: string, positionTitle: string): string {
  return createHash('sha256')
    .update(`${orgCode}|${appointeeName}|${positionTitle}`)
    .digest('hex')
}

/**
 * Parses "LastName, FirstName" into "FirstName LastName".
 * Returns the input unchanged if no comma is present.
 */
function parseCommaName(raw: string): string {
  const comma = raw.indexOf(',')
  if (comma === -1) return raw.trim()
  const last = raw.slice(0, comma).trim()
  const first = raw.slice(comma + 1).trim()
  if (!first) return last
  return `${first} ${last}`
}

/**
 * Normalizes appointment type text to a canonical value.
 */
function normalizeAppointmentType(raw: string): string | null {
  const lower = raw.toLowerCase()
  if (lower.includes('full')) return 'full-time'
  if (lower.includes('part')) return 'part-time'
  return null
}

/**
 * Normalizes tenure type text to a canonical value.
 */
function normalizeTenureType(raw: string): string | null {
  const lower = raw.toLowerCase()
  if (lower.includes('good behaviour') || lower.includes('bonne conduite')) return 'during_good_behaviour'
  if (lower.includes('pleasure') || lower.includes('bon plaisir')) return 'during_pleasure'
  return null
}

/**
 * Attempts to parse a date string to YYYY-MM-DD format.
 * Returns null if unparseable.
 */
function parseDate(raw: string): string | null {
  if (!raw || raw.trim() === '' || raw.trim() === '—' || raw.trim() === '-') return null
  const trimmed = raw.trim()
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  // Try parsing as a date
  const d = new Date(trimmed)
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10)
  }
  return null
}

/**
 * Parses one federal organization profile page.
 * Handles malformed HTML gracefully — logs warnings and skips unparseable rows.
 *
 * @param html - raw HTML of the profile page
 * @param orgCode - OrgID code (e.g. "CBC")
 * @returns array of parsed appointment records
 */
export function parseOrganizationProfile(html: string, orgCode: string): ParsedAppointment[] {
  const appointments: ParsedAppointment[] = []
  const sourceUrl = `https://federal-organizations.canada.ca/profil.php?OrgID=${orgCode}&lang=en`
  const sourceFileHash = createHash('sha256').update(html).digest('hex')

  let $: ReturnType<typeof load>
  try {
    $ = load(html)
  } catch (err) {
    console.warn(`  [gic-parser] Failed to load HTML for ${orgCode}: ${err instanceof Error ? err.message : String(err)}`)
    return []
  }

  // Extract organization name from page header (h1 or title)
  let organizationName = orgCode // fallback
  const h1Text = $('h1').first().text().trim()
  if (h1Text) organizationName = h1Text

  // Strategy: iterate through tables on the page.
  // Position title is typically in a section header above each table.
  // Some pages group all appointees in one table with a position column.
  // Fallback: look for any table containing appointee data.

  const tables = $('table')

  if (tables.length === 0) {
    // Try finding a list of appointees from the page structure
    return []
  }

  tables.each((_i, table) => {
    // Determine position title from preceding heading element or table caption
    let positionTitle = ''
    const caption = $(table).find('caption').first().text().trim()
    if (caption) {
      positionTitle = caption
    } else {
      // Walk backwards from the table to find a heading
      let prev = $(table).prev()
      let depth = 0
      while (prev.length > 0 && depth < 5) {
        const tag = prev[0]?.tagName?.toLowerCase() ?? ''
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
          positionTitle = prev.text().trim()
          break
        }
        prev = prev.prev()
        depth++
      }
    }

    // Parse table rows — skip header row
    const rows = $(table).find('tr')
    let hasPositionColumn = false
    let colMap: Record<string, number> = {}

    rows.each((rowIdx, row) => {
      const cells = $(row).find('th, td')
      const cellTexts = cells.map((_j, cell) => $(cell).text().trim()).get()

      // Detect header row
      const isHeader = $(row).find('th').length > 0 || rowIdx === 0

      if (isHeader) {
        // Build column map from header
        const lower = cellTexts.map((t) => t.toLowerCase())
        colMap = {}
        lower.forEach((t, idx) => {
          if (t.includes('name') || t.includes('nom')) colMap['name'] = idx
          else if (t.includes('position') || t.includes('poste') || t.includes('title') || t.includes('titre')) {
            colMap['position'] = idx
            hasPositionColumn = true
          }
          else if (t.includes('type') && t.includes('appointment')) colMap['appointmentType'] = idx
          else if (t.includes('type') && t.includes('tenure')) colMap['tenureType'] = idx
          else if (t.includes('appointment date') || t.includes('date de nomination')) colMap['appointmentDate'] = idx
          else if (t.includes('expiry') || t.includes('expiration')) colMap['expiryDate'] = idx
          // More flexible matching
          else if (Object.keys(colMap).length === 0 && t.includes('appoint')) colMap['appointmentType'] = idx
        })
        return
      }

      if (cellTexts.length === 0) return

      try {
        // Extract appointee name
        const nameIdx = colMap['name'] ?? 0
        const rawName = (cellTexts[nameIdx] ?? '').trim()

        if (!rawName) return // skip empty rows

        const isVacant = rawName.toLowerCase() === 'vacant' || rawName.toLowerCase().startsWith('vacant')

        // Extract position from column or use page-level positionTitle
        let position = positionTitle
        if (hasPositionColumn && colMap['position'] !== undefined) {
          const posIdx = colMap['position']
          position = (cellTexts[posIdx] ?? '').trim() || positionTitle
        }

        if (!position) position = 'Unknown Position'

        const aptTypeRaw = cellTexts[colMap['appointmentType'] ?? -1] ?? ''
        const tenureRaw = cellTexts[colMap['tenureType'] ?? -1] ?? ''
        const aptDateRaw = cellTexts[colMap['appointmentDate'] ?? -1] ?? ''
        const expDateRaw = cellTexts[colMap['expiryDate'] ?? -1] ?? ''

        const aptType = normalizeAppointmentType(aptTypeRaw)
        const tenure = normalizeTenureType(tenureRaw)
        const aptDate = parseDate(aptDateRaw)
        const expDate = parseDate(expDateRaw)

        // For non-vacant: parse "Last, First" -> "First Last" and normalize
        let normalizedName: string | null = null
        if (!isVacant) {
          const fullName = parseCommaName(rawName)
          normalizedName = normalizeName(fullName)
        }

        const id = deriveId(orgCode, rawName, position)

        appointments.push({
          id,
          appointeeName: rawName,
          normalizedAppointeeName: normalizedName,
          positionTitle: position,
          organizationName,
          organizationCode: orgCode,
          appointmentType: aptType,
          tenureType: tenure,
          appointmentDate: aptDate,
          expiryDate: expDate,
          isVacant,
          sourceUrl,
          sourceFileHash,
          rawData: {
            rawName,
            rawPosition: position,
            rawAppointmentType: aptTypeRaw,
            rawTenureType: tenureRaw,
            rawAppointmentDate: aptDateRaw,
            rawExpiryDate: expDateRaw,
            orgCode,
            organizationName,
          },
        })
      } catch (err) {
        console.warn(
          `  [gic-parser] Skipping unparseable row in ${orgCode} (row ${rowIdx}): ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    })
  })

  return appointments
}
