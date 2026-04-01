/**
 * Elections Canada CSV schemas differ across time periods.
 * Parse by header name, NEVER by column index position (Pitfall 3).
 * These mappings normalize different era column names to our internal schema.
 */
export interface ElectionsCanadaRow {
  contributorName: string
  contributorType: string | null
  amount: string // keep as string for precise numeric parsing
  donationDate: string
  ridingCode: string | null
  ridingName: string | null
  recipientName: string
  recipientType: string | null
  electionYear: number | null
  province: string | null
}

// Normalize raw CSV header → internal field name
// Each array contains known variants of the same field across eras
export const COLUMN_ALIASES: Record<keyof ElectionsCanadaRow, string[]> = {
  contributorName: [
    'contributor_name',
    'contributorname',
    'nom_du_donateur',
    'Contributor Name',
    'contributor',
    'donor_name',
    'Donor Name',
  ],
  contributorType: [
    'contributor_type',
    'contributor_type_desc',
    'type_donateur',
    'Type',
    'Contributor Type',
    'contributor_type_en',
  ],
  amount: [
    'amount',
    'montant',
    'Amount',
    'monetary_amount',
    'total_amount',
    'contribution_amount',
    'Contribution Amount',
  ],
  donationDate: [
    'contribution_date',
    'donation_date',
    'date',
    'Date',
    'date_contribution',
    'transaction_date',
    'Date of Contribution',
  ],
  ridingCode: [
    'electoral_district_number',
    'riding_code',
    'district_number',
    'ED Number',
    'electoral_district_code',
    'circonscription_code',
  ],
  ridingName: [
    'electoral_district_name',
    'riding_name',
    'district_name',
    'Riding',
    'electoral_district_name_english',
    'Electoral District',
  ],
  recipientName: [
    'recipient_name',
    'political_party_en',
    'candidate_name',
    'Recipient',
    'party_name',
    'Recipient Name',
    'recipient',
  ],
  recipientType: [
    'recipient_type',
    'recipient_type_desc',
    'type_beneficiaire',
    'Recipient Type',
    'recipient_type_en',
  ],
  electionYear: ['election_year', 'fiscal_year', 'year', 'Year', 'annee'],
  province: ['province', 'Province', 'province_en', 'prov_code', 'province_code'],
}

/**
 * Maps a raw CSV header row to the internal field names.
 * Returns a mapping of internal field → index in the CSV row.
 * Logs unmapped columns as warnings (not errors — unknown columns are preserved in rawData).
 */
export function buildColumnMapping(headers: string[]): Map<keyof ElectionsCanadaRow, number> {
  const mapping = new Map<keyof ElectionsCanadaRow, number>()
  const normalizedHeaders = headers.map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))

  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    const normalizedAliases = aliases.map((a) => a.trim().toLowerCase().replace(/\s+/g, '_'))
    const idx = normalizedHeaders.findIndex((h) => normalizedAliases.includes(h))
    if (idx !== -1) {
      mapping.set(field as keyof ElectionsCanadaRow, idx)
    }
  }
  return mapping
}
