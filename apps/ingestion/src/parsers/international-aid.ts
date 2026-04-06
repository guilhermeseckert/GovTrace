import { readFileSync } from 'node:fs'
import { XMLParser } from 'fast-xml-parser'

export interface IatiActivityRecord {
  id: string
  projectTitle: string | null
  description: string | null
  implementerName: string | null
  fundingDepartment: string | null
  recipientCountry: string | null
  recipientRegion: string | null
  activityStatus: string | null
  startDate: string | null
  endDate: string | null
  totalBudgetCad: string | null
  totalDisbursedCad: string | null
  totalCommittedCad: string | null
  currency: string
  sectorCode: string | null
  normalizedImplementerName: string | null
  sourceFileHash: string
  rawData: Record<string, unknown>
}

const parser = new XMLParser({
  ignoreAttributes: false, // Need @code, @xml:lang, @iso-date, @ref, @role attributes
  attributeNamePrefix: '@_', // fast-xml-parser default prefix for attributes
  isArray: (name) =>
    [
      'iati-activity',
      'budget',
      'transaction',
      'participating-org',
      'activity-date',
      'recipient-country',
      'recipient-region',
      'sector',
      'narrative',
      'location',
      'policy-marker',
    ].includes(name),
  parseAttributeValue: false, // Keep values as strings — don't coerce "2" to number
  trimValues: true,
})

/**
 * Extract text from an IATI narrative array for the specified language.
 * Falls back to 'fr' when lang='en' is requested but absent.
 */
function extractNarrative(narratives: unknown, lang = 'en'): string | null {
  if (!Array.isArray(narratives)) return null

  const match = narratives.find((n) => {
    if (typeof n !== 'object' || n === null) return false
    return (n as Record<string, unknown>)['@_xml:lang'] === lang
  })

  if (match !== undefined) {
    const text = (match as Record<string, unknown>)['#text'] ?? match
    if (typeof text === 'string' && text.trim().length > 0) return text.trim()
    if (typeof text === 'number') return String(text)
  }

  // Fallback: if requesting 'en', try 'fr'
  if (lang === 'en') return extractNarrative(narratives, 'fr')

  return null
}

/**
 * Extract numeric value from a <value value-date="...">500000</value> element.
 * When element has attributes, fast-xml-parser stores text content as '#text'.
 */
function extractNumericValue(val: unknown): number {
  if (val === null || val === undefined) return 0
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const n = parseFloat(val)
    return isNaN(n) ? 0 : n
  }
  if (typeof val === 'object') {
    const text = (val as Record<string, unknown>)['#text']
    const n = parseFloat(String(text ?? '0'))
    return isNaN(n) ? 0 : n
  }
  return 0
}

/**
 * Sum values from budget elements by type code.
 * Handles single-element arrays (via isArray config) and #text value extraction.
 */
function sumBudgetsByType(budgets: unknown[], typeCode: string): number {
  return budgets
    .filter((b) => {
      if (typeof b !== 'object' || b === null) return false
      return String((b as Record<string, unknown>)['@_type']) === typeCode
    })
    .reduce((sum: number, b) => {
      const val = (b as Record<string, unknown>)['value']
      return sum + extractNumericValue(val)
    }, 0)
}

/**
 * Sum values from transaction elements by transaction-type code.
 * Includes negative values (valid reversals).
 */
function sumTransactionsByType(transactions: unknown[], typeCode: string): number {
  return transactions
    .filter((t) => {
      if (typeof t !== 'object' || t === null) return false
      const txType = (t as Record<string, unknown>)['transaction-type']
      if (typeof txType !== 'object' || txType === null) return false
      return String((txType as Record<string, unknown>)['@_code']) === typeCode
    })
    .reduce((sum: number, t) => {
      const val = (t as Record<string, unknown>)['value']
      return sum + extractNumericValue(val)
    }, 0)
}

/**
 * Extract an activity date by type code ('1'=planned start, '2'=actual start, '3'=planned end, '4'=actual end).
 */
function extractActivityDate(dates: unknown[], typeCode: string): string | null {
  if (!Array.isArray(dates)) return null
  const match = dates.find((d) => {
    if (typeof d !== 'object' || d === null) return false
    return String((d as Record<string, unknown>)['@_type']) === typeCode
  })
  if (!match) return null
  const isoDate = (match as Record<string, unknown>)['@_iso-date']
  return typeof isoDate === 'string' && isoDate.length > 0 ? isoDate : null
}

/**
 * Extract a participating-org name by role code.
 * role="4" = implementing org, role="3" = extending/funding org.
 */
function extractParticipatingOrg(orgs: unknown[], roleCode: string): string | null {
  if (!Array.isArray(orgs)) return null
  const match = orgs.find((o) => {
    if (typeof o !== 'object' || o === null) return false
    return String((o as Record<string, unknown>)['@_role']) === roleCode
  })
  if (!match) return null
  const narratives = (match as Record<string, unknown>)['narrative']
  return extractNarrative(narratives)
}

/**
 * Extract the first recipient-country code.
 */
function extractRecipientCountry(countries: unknown[]): string | null {
  if (!Array.isArray(countries) || countries.length === 0) return null
  const first = countries[0]
  if (typeof first !== 'object' || first === null) return null
  const code = (first as Record<string, unknown>)['@_code']
  return typeof code === 'string' && code.length > 0 ? code : null
}

/**
 * Extract the first recipient-region code.
 */
function extractRecipientRegion(regions: unknown[]): string | null {
  if (!Array.isArray(regions) || regions.length === 0) return null
  const first = regions[0]
  if (typeof first !== 'object' || first === null) return null
  const code = (first as Record<string, unknown>)['@_code']
  return typeof code === 'string' && code.length > 0 ? code : null
}

/**
 * Extract the OECD DAC sector code from sector elements.
 * Filters for vocabulary="1" (OECD DAC 5-digit codes) or no vocabulary attribute (defaults to DAC).
 * Returns the @_code attribute of the first matching element, or null if none found.
 */
function extractSectorCode(sectors: unknown[]): string | null {
  if (!Array.isArray(sectors) || sectors.length === 0) return null
  const dacSector = sectors.find((s) => {
    if (typeof s !== 'object' || s === null) return false
    const vocab = (s as Record<string, unknown>)['@_vocabulary']
    return vocab === '1' || vocab === undefined || vocab === null
  })
  if (!dacSector) return null
  const code = (dacSector as Record<string, unknown>)['@_code']
  return typeof code === 'string' && code.length > 0 ? code : null
}

type IatiActivityRaw = Record<string, unknown>

function extractActivity(act: IatiActivityRaw, sourceFileHash: string): IatiActivityRecord {
  const id = String(act['iati-identifier'] ?? '')
  const currency = String(act['@_default-currency'] ?? 'CAD')

  // Title: EN narrative, fallback to FR
  const titleElement = act['title'] as Record<string, unknown> | undefined
  const titleNarratives = titleElement?.['narrative']
  const projectTitle = extractNarrative(titleNarratives)

  // Description type="1"
  const descriptionRaw = act['description']
  let description: string | null = null
  if (Array.isArray(descriptionRaw)) {
    const desc1 = descriptionRaw.find(
      (d) => typeof d === 'object' && d !== null && String((d as Record<string, unknown>)['@_type']) === '1',
    )
    if (desc1) {
      description = extractNarrative((desc1 as Record<string, unknown>)['narrative'])
    }
  } else if (typeof descriptionRaw === 'object' && descriptionRaw !== null) {
    description = extractNarrative((descriptionRaw as Record<string, unknown>)['narrative'])
  }
  if (description && description.length > 2000) {
    description = description.slice(0, 2000)
  }

  // Participating orgs
  const orgs = act['participating-org'] as unknown[]
  const implementerName = extractParticipatingOrg(orgs, '4')
  const fundingDepartment = extractParticipatingOrg(orgs, '3')

  // Activity status
  const statusElement = act['activity-status'] as Record<string, unknown> | undefined
  const activityStatus = statusElement ? String(statusElement['@_code'] ?? '') || null : null

  // Dates — actual start (type=2) with fallback to planned (type=1)
  const dates = act['activity-date'] as unknown[]
  const startDate = extractActivityDate(dates, '2') ?? extractActivityDate(dates, '1')
  const endDate = extractActivityDate(dates, '4') ?? extractActivityDate(dates, '3')

  // Recipient country / region
  const countries = act['recipient-country'] as unknown[]
  const regions = act['recipient-region'] as unknown[]
  const recipientCountry = extractRecipientCountry(countries)
  const recipientRegion = recipientCountry ? null : extractRecipientRegion(regions)

  // Sector code — OECD DAC vocabulary="1"
  const sectors = (act['sector'] as unknown[]) ?? []
  const sectorCode = extractSectorCode(sectors)

  // Budget sums — type="1" (original)
  const budgets = (act['budget'] as unknown[]) ?? []
  const totalBudget = sumBudgetsByType(budgets, '1')

  // Transaction sums — type="2" (commitment), type="3" (disbursement)
  const transactions = (act['transaction'] as unknown[]) ?? []
  const totalCommitted = sumTransactionsByType(transactions, '2')
  const totalDisbursed = sumTransactionsByType(transactions, '3')

  const normalizedImplementerName = implementerName ? implementerName.toLowerCase().trim() : null

  const rawData: Record<string, unknown> = {
    title: projectTitle,
    implementer: implementerName,
    funder: fundingDepartment,
    country: recipientCountry ?? recipientRegion,
    status: activityStatus,
    sector: sectorCode,
  }

  return {
    id,
    projectTitle,
    description,
    implementerName,
    fundingDepartment,
    recipientCountry,
    recipientRegion,
    activityStatus,
    startDate,
    endDate,
    totalBudgetCad: totalBudget !== 0 ? totalBudget.toFixed(2) : null,
    totalDisbursedCad: totalDisbursed !== 0 ? totalDisbursed.toFixed(2) : '0.00',
    totalCommittedCad: totalCommitted !== 0 ? totalCommitted.toFixed(2) : null,
    currency,
    sectorCode,
    normalizedImplementerName,
    sourceFileHash,
    rawData,
  }
}

/**
 * Parse an IATI XML file and return an array of activity records.
 * Handles BOM at byte 0 (Pitfall 4).
 * Uses isArray config to handle single-element arrays correctly (Pitfall 1).
 * Uses #text extraction for value elements with attributes (Pitfall 2).
 */
export function parseIatiFile(filePath: string, sourceFileHash: string): IatiActivityRecord[] {
  let xmlContent = readFileSync(filePath, 'utf-8')

  // Strip BOM if present at byte 0
  if (xmlContent.charCodeAt(0) === 0xfeff) {
    xmlContent = xmlContent.slice(1)
  }

  const parsed = parser.parse(xmlContent) as Record<string, unknown>
  const root = parsed['iati-activities'] as Record<string, unknown> | undefined
  if (!root) return []

  const activities = (root['iati-activity'] as unknown[]) ?? []
  return activities.map((act) => extractActivity(act as IatiActivityRaw, sourceFileHash))
}
