export interface BillRecord {
  id: string // "{parliament}-{session}-{billNumberFormatted}"
  billNumber: string
  billNumberFormatted: string
  parliamentNumber: number
  sessionNumber: number
  parlSessionCode: string
  shortTitleEn: string | null
  shortTitleFr: string | null
  longTitleEn: string | null
  longTitleFr: string | null
  billTypeEn: string | null
  sponsorEn: string | null
  currentStatusEn: string | null
  receivedRoyalAssentAt: string | null // ISO datetime string or null
  passedHouseThirdReadingAt: string | null
  rawData: Record<string, unknown>
}

interface LegisInfoBill {
  BillId?: number
  BillNumberFormatted?: string
  LongTitleEn?: string | null
  LongTitleFr?: string | null
  ShortTitleEn?: string | null
  ShortTitleFr?: string | null
  BillTypeEn?: string | null
  SponsorEn?: string | null
  CurrentStatusEn?: string | null
  ReceivedRoyalAssentDateTime?: string | null
  PassedHouseThirdReadingDateTime?: string | null
  ParlSessionCode?: string
  [key: string]: unknown
}

/**
 * Parses LEGISinfo JSON array into BillRecord array.
 * Handles null ShortTitleEn, null RoyalAssentDateTime, and constructs composite IDs.
 *
 * @param json - Raw JSON string from https://www.parl.ca/legisinfo/en/bills/json?parlsession={parliament}-{session}&Language=E
 * @param _parlSessionCode - Session code for context (individual bills use their own ParlSessionCode)
 */
export function parseBillsJson(json: string, _parlSessionCode: string): BillRecord[] {
  if (!json || json.trim().length === 0) return []

  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return []
  }

  if (!Array.isArray(data)) return []

  return data.map((raw: unknown): BillRecord => {
    const bill = raw as LegisInfoBill
    const billNumberFormatted = String(bill.BillNumberFormatted ?? '').trim()
    const sessionCode = String(bill.ParlSessionCode ?? _parlSessionCode).trim()

    // Parse session code to extract parliament and session numbers
    const sessionParts = sessionCode.split('-')
    const parliamentNumber = sessionParts[0] ? Number(sessionParts[0]) : 0
    const sessionNumber = sessionParts[1] ? Number(sessionParts[1]) : 0

    return {
      id: `${sessionCode}-${billNumberFormatted}`,
      billNumber: billNumberFormatted,
      billNumberFormatted,
      parliamentNumber,
      sessionNumber,
      parlSessionCode: sessionCode,
      shortTitleEn: bill.ShortTitleEn ?? null,
      shortTitleFr: bill.ShortTitleFr ?? null,
      longTitleEn: bill.LongTitleEn ?? null,
      longTitleFr: bill.LongTitleFr ?? null,
      billTypeEn: bill.BillTypeEn ?? null,
      sponsorEn: bill.SponsorEn ?? null,
      currentStatusEn: bill.CurrentStatusEn ?? null,
      receivedRoyalAssentAt: bill.ReceivedRoyalAssentDateTime ?? null,
      passedHouseThirdReadingAt: bill.PassedHouseThirdReadingDateTime ?? null,
      rawData: bill as Record<string, unknown>,
    }
  })
}
