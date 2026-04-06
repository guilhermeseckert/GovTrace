import { pgTable, text, integer, numeric, date, timestamp, jsonb, uuid, index, uniqueIndex } from 'drizzle-orm/pg-core'

// Elections Canada political contributions (DATA-01)
// Source: https://www.elections.ca/fin/oda/od_cntrbtn_audt_e.zip
// Natural key: hash of (contributor_name, amount, date, riding_code, recipient_id) — D-08
export const donations = pgTable('donations', {
  id: text('id').primaryKey(), // deterministic hash: SHA256(source_key_fields) — D-08
  contributorName: text('contributor_name').notNull(),
  contributorType: text('contributor_type'), // 'individual', 'corporation', 'trade_union', etc.
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  donationDate: date('donation_date').notNull(),
  ridingCode: text('riding_code'),
  ridingName: text('riding_name'),
  recipientName: text('recipient_name').notNull(),
  recipientType: text('recipient_type'), // 'party', 'candidate', 'riding_association'
  electionYear: integer('election_year'),
  province: text('province'),
  normalizedContributorName: text('normalized_contributor_name'), // populated by normalizer
  entityId: uuid('entity_id'), // FK to entities.id — set after entity matching
  sourceFileHash: text('source_file_hash').notNull(), // hash of source CSV file
  rawData: jsonb('raw_data').notNull(), // full original CSV row — DATA-08
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('donations_normalized_contributor_name_idx').on(t.normalizedContributorName),
  index('donations_entity_id_idx').on(t.entityId),
  index('donations_donation_date_idx').on(t.donationDate),
  index('donations_election_year_idx').on(t.electionYear),
])

// Federal contracts from open.canada.ca (DATA-02)
// Dataset: d8f85d91-7dec-4fd1-8055-483b77225d8b
export const contracts = pgTable('contracts', {
  id: text('id').primaryKey(), // deterministic: contract_id from source or SHA256 hash
  contractId: text('contract_id'), // government-assigned contract number if available
  vendorName: text('vendor_name').notNull(),
  department: text('department').notNull(),
  description: text('description'),
  value: numeric('value', { precision: 15, scale: 2 }),
  originalValue: numeric('original_value', { precision: 15, scale: 2 }),
  startDate: date('start_date'),
  endDate: date('end_date'),
  awardDate: date('award_date'),
  procurementMethod: text('procurement_method'),
  province: text('province'),
  normalizedVendorName: text('normalized_vendor_name'),
  entityId: uuid('entity_id'),
  sourceFileHash: text('source_file_hash').notNull(),
  rawData: jsonb('raw_data').notNull(),
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('contracts_normalized_vendor_name_idx').on(t.normalizedVendorName),
  index('contracts_entity_id_idx').on(t.entityId),
  index('contracts_department_idx').on(t.department),
  index('contracts_award_date_idx').on(t.awardDate),
])

// Federal grants from open.canada.ca (DATA-03)
// Dataset: 432527ab-7aac-45b5-81d6-7597107a7013
export const grants = pgTable('grants', {
  id: text('id').primaryKey(),
  recipientName: text('recipient_name').notNull(),
  recipientLegalName: text('recipient_legal_name'),
  department: text('department').notNull(),
  programName: text('program_name'),
  description: text('description'),
  amount: numeric('amount', { precision: 15, scale: 2 }),
  agreementDate: date('agreement_date'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  province: text('province'),
  city: text('city'),
  grantType: text('grant_type'), // 'grant', 'contribution', 'other'
  normalizedRecipientName: text('normalized_recipient_name'),
  entityId: uuid('entity_id'),
  sourceFileHash: text('source_file_hash').notNull(),
  rawData: jsonb('raw_data').notNull(),
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('grants_normalized_recipient_name_idx').on(t.normalizedRecipientName),
  index('grants_entity_id_idx').on(t.entityId),
  index('grants_department_idx').on(t.department),
])

// Lobbyist registrations from lobbycanada.gc.ca (DATA-04)
export const lobbyRegistrations = pgTable('lobby_registrations', {
  id: text('id').primaryKey(), // registration_number from source
  registrationNumber: text('registration_number').notNull(),
  lobbyistName: text('lobbyist_name').notNull(),
  lobbyistType: text('lobbyist_type'), // 'consultant', 'in-house', 'organization'
  clientName: text('client_name'), // for consultant lobbyists
  subjectMatter: text('subject_matter'),
  targetDepartments: text('target_departments').array(),
  status: text('status'), // 'active', 'inactive', 'deregistered'
  registrationDate: date('registration_date'),
  lastUpdatedDate: date('last_updated_date'),
  province: text('province'),
  normalizedLobbyistName: text('normalized_lobbyist_name'),
  normalizedClientName: text('normalized_client_name'),
  lobbyistEntityId: uuid('lobbyist_entity_id'),
  clientEntityId: uuid('client_entity_id'),
  sourceFileHash: text('source_file_hash').notNull(),
  rawData: jsonb('raw_data').notNull(),
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('lobby_registrations_registration_number_idx').on(t.registrationNumber),
  index('lobby_registrations_normalized_lobbyist_name_idx').on(t.normalizedLobbyistName),
  index('lobby_registrations_normalized_client_name_idx').on(t.normalizedClientName),
  index('lobby_registrations_lobbyist_entity_id_idx').on(t.lobbyistEntityId),
  index('lobby_registrations_client_entity_id_idx').on(t.clientEntityId),
])

// International aid activities from Global Affairs Canada IATI files (DATA-06)
// Source: https://w05.international.gc.ca/projectbrowser-banqueprojets/iita-iati/
// Primary key: iati-identifier directly (globally unique and stable by IATI standard)
export const internationalAid = pgTable('international_aid', {
  id: text('id').primaryKey(), // iati-identifier, e.g., CA-3-A031268001
  projectTitle: text('project_title'),
  description: text('description'),
  implementerName: text('implementer_name'), // participating-org role="4" — entity to match
  fundingDepartment: text('funding_department'), // participating-org role="3"
  recipientCountry: text('recipient_country'), // ISO 3166-1 alpha-2
  recipientRegion: text('recipient_region'), // DAC region code (if no country)
  activityStatus: text('activity_status'), // 1=pipeline, 2=active, 3=finalisation, 4=closed, 5=cancelled
  startDate: date('start_date'), // actual start (type="2"), fallback to planned (type="1")
  endDate: date('end_date'), // actual end (type="4"), fallback to planned (type="3")
  totalBudgetCad: numeric('total_budget_cad', { precision: 15, scale: 2 }), // sum of budget type="1"
  totalDisbursedCad: numeric('total_disbursed_cad', { precision: 15, scale: 2 }), // sum of transaction type="3"
  totalCommittedCad: numeric('total_committed_cad', { precision: 15, scale: 2 }), // sum of transaction type="2"
  currency: text('currency').default('CAD'), // default-currency attribute from iati-activity
  normalizedImplementerName: text('normalized_implementer_name'), // populated by matching pipeline
  entityId: uuid('entity_id'), // FK to entities.id — set after entity matching
  sectorCode: text('sector_code'), // OECD DAC 5-digit sector code, e.g. "15110"
  sourceFileHash: text('source_file_hash').notNull(),
  rawData: jsonb('raw_data').notNull(), // key fields only, NOT full XML
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('international_aid_normalized_implementer_name_idx').on(t.normalizedImplementerName),
  index('international_aid_entity_id_idx').on(t.entityId),
  index('international_aid_recipient_country_idx').on(t.recipientCountry),
  index('international_aid_start_date_idx').on(t.startDate),
  index('international_aid_activity_status_idx').on(t.activityStatus),
  index('international_aid_sector_code_idx').on(t.sectorCode),
])

// National debt snapshots from Statistics Canada table 10-10-0002-01 (DEBT-01, DEBT-04)
// Source: https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1010000201
export const fiscalSnapshots = pgTable('fiscal_snapshots', {
  id: text('id').primaryKey(), // deterministic: SHA256(series + ref_date)
  series: text('series').notNull(), // 'federal_net_debt' | 'accumulated_deficit' | 'gross_liabilities'
  refDate: date('ref_date').notNull(), // YYYY-MM-01 — first of month per StatsCan convention
  valueMillionsCad: numeric('value_millions_cad', { precision: 15, scale: 2 }),
  sourceTable: text('source_table').notNull(), // '10-10-0002-01'
  sourceUrl: text('source_url').notNull(),
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('fiscal_snapshots_series_date_idx').on(t.series, t.refDate),
  index('fiscal_snapshots_ref_date_idx').on(t.refDate),
])

// Lobbyist communication reports (DATA-05)
export const lobbyCommunications = pgTable('lobby_communications', {
  id: text('id').primaryKey(),
  registrationNumber: text('registration_number').notNull(),
  communicationDate: date('communication_date').notNull(),
  lobbyistName: text('lobbyist_name').notNull(),
  clientName: text('client_name'),
  publicOfficialName: text('public_official_name').notNull(),
  publicOfficialTitle: text('public_official_title'),
  department: text('department'),
  subjectMatter: text('subject_matter'),
  communicationMethod: text('communication_method'),
  normalizedLobbyistName: text('normalized_lobbyist_name'),
  normalizedOfficialName: text('normalized_official_name'),
  lobbyistEntityId: uuid('lobbyist_entity_id'),
  officialEntityId: uuid('official_entity_id'),
  sourceFileHash: text('source_file_hash').notNull(),
  rawData: jsonb('raw_data').notNull(),
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('lobby_communications_registration_number_idx').on(t.registrationNumber),
  index('lobby_communications_normalized_lobbyist_name_idx').on(t.normalizedLobbyistName),
  index('lobby_communications_normalized_official_name_idx').on(t.normalizedOfficialName),
  index('lobby_communications_communication_date_idx').on(t.communicationDate),
])
