import {
  pgTable,
  text,
  integer,
  date,
  timestamp,
  jsonb,
  uuid,
  index,
  uniqueIndex,
  boolean,
  real,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// Bills from LEGISinfo (parl.ca)
// Source: https://www.parl.ca/legisinfo/en/bills/json?parlsession={parliament}-{session}&Language=E
// PK: "{parliament}-{session}-{BillNumberFormatted}" e.g. "44-1-C-69"
export const parliamentBills = pgTable('parliament_bills', {
  id: text('id').primaryKey(), // "{parliament}-{session}-{billNumberFormatted}"
  billNumber: text('bill_number').notNull(), // "C-69"
  billNumberFormatted: text('bill_number_formatted').notNull(), // "C-69"
  parliamentNumber: integer('parliament_number').notNull(),
  sessionNumber: integer('session_number').notNull(),
  parlSessionCode: text('parl_session_code').notNull(), // "44-1"
  shortTitleEn: text('short_title_en'),
  shortTitleFr: text('short_title_fr'),
  longTitleEn: text('long_title_en'),
  longTitleFr: text('long_title_fr'),
  billTypeEn: text('bill_type_en'), // "Government Bill", "Private Member's Bill", etc.
  sponsorEn: text('sponsor_en'),
  currentStatusEn: text('current_status_en'),
  receivedRoyalAssentAt: timestamp('received_royal_assent_at', { withTimezone: true }),
  passedHouseThirdReadingAt: timestamp('passed_house_third_reading_at', { withTimezone: true }),
  legisInfoUrl: text('legis_info_url'), // source link
  rawData: jsonb('raw_data').notNull(),
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('parliament_bills_bill_number_idx').on(t.billNumber),
  index('parliament_bills_parl_session_idx').on(t.parlSessionCode),
  // pg_trgm GIN index on bill_number_formatted for "search Bill C-69" (PARL-03)
  index('parliament_bills_bill_number_gin_idx').using('gin', sql`${t.billNumberFormatted} gin_trgm_ops`),
])

// Division-level vote summaries (one row per division)
// Source: https://www.ourcommons.ca/members/en/votes/xml?parlSession={parliament}-{session} (House)
//         https://sencanada.ca/en/in-the-chamber/votes/{parl}-{session} (Senate, HTML)
// PK: "{parliament}-{session}-{divisionNumber}" (House) or "senate-{parl}-{session}-{voteId}" (Senate)
export const parliamentVotes = pgTable('parliament_votes', {
  id: text('id').primaryKey(), // "{parliament}-{session}-{divisionNumber}"
  chamber: text('chamber').notNull().default('house'), // 'house' | 'senate'
  parliamentNumber: integer('parliament_number').notNull(),
  sessionNumber: integer('session_number').notNull(),
  parlSessionCode: text('parl_session_code').notNull(), // "44-1"
  divisionNumber: integer('division_number').notNull(),
  voteDate: date('vote_date').notNull(),
  voteDateTime: timestamp('vote_date_time', { withTimezone: true }),
  subject: text('subject').notNull(), // DecisionDivisionSubject
  resultName: text('result_name').notNull(), // "Agreed To" / "Negatived" (House) | "Adopted" / "Defeated" (Senate)
  yeasTotal: integer('yeas_total').notNull().default(0),
  naysTotal: integer('nays_total').notNull().default(0),
  pairedTotal: integer('paired_total').notNull().default(0),
  abstentionsTotal: integer('abstentions_total').notNull().default(0), // Senate only
  documentTypeName: text('document_type_name'), // "Legislative Process", "Supply", etc.
  billId: text('bill_id').references(() => parliamentBills.id), // nullable FK to bills
  billNumber: text('bill_number'), // denormalized for fast queries
  ballotsIngested: boolean('ballots_ingested').notNull().default(false), // resumable ingestion flag
  sourceFileHash: text('source_file_hash'),
  rawData: jsonb('raw_data').notNull(),
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('parliament_votes_session_division_idx').on(t.parlSessionCode, t.divisionNumber),
  index('parliament_votes_vote_date_idx').on(t.voteDate),
  index('parliament_votes_bill_id_idx').on(t.billId),
  index('parliament_votes_chamber_idx').on(t.chamber),
])

// Individual MP/Senator ballot rows (1.8–2.4M rows for House + ~56K for Senate)
// Source: https://www.ourcommons.ca/members/en/votes/{parliament}/{session}/{voteNumber}/xml (House)
//         https://sencanada.ca/en/in-the-chamber/votes/details/{voteId}/{parl}-{session} (Senate, HTML)
// PK: "{parliament}-{session}-{divisionNumber}-{personId}" (House) or "{senate-voteId}-{senatorId}" (Senate)
export const parliamentVoteBallots = pgTable('parliament_vote_ballots', {
  id: text('id').primaryKey(), // "{voteId}-{personId}"
  voteId: text('vote_id').notNull().references(() => parliamentVotes.id),
  chamber: text('chamber').notNull().default('house'), // 'house' | 'senate'
  personId: integer('person_id').notNull(), // ourcommons.ca PersonId (House) or sencanada.ca senatorId (Senate)
  entityId: uuid('entity_id'), // FK to entities.id — set after matching
  parliamentNumber: integer('parliament_number').notNull(),
  sessionNumber: integer('session_number').notNull(),
  divisionNumber: integer('division_number').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  constituency: text('constituency'),
  province: text('province'),
  caucusShortName: text('caucus_short_name'), // "CPC", "LPC", "NDP", "BQ", "GPC", "IND" (House) | "C", "ISG", "CSG", "PSG" (Senate)
  ballotValue: text('ballot_value').notNull(), // "Yea", "Nay", "Paired" (House) | "Yea", "Nay", "Abstention" (Senate)
  isYea: boolean('is_yea').notNull().default(false),
  isNay: boolean('is_nay').notNull().default(false),
  isPaired: boolean('is_paired').notNull().default(false),
  isAbstention: boolean('is_abstention').notNull().default(false), // Senate only
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('parliament_vote_ballots_vote_id_idx').on(t.voteId),
  index('parliament_vote_ballots_entity_id_idx').on(t.entityId),
  index('parliament_vote_ballots_person_id_idx').on(t.personId),
  index('parliament_vote_ballots_caucus_idx').on(t.caucusShortName),
  index('parliament_vote_ballots_ballot_value_idx').on(t.ballotValue),
  index('parliament_vote_ballots_chamber_idx').on(t.chamber),
])

// MP profiles — PersonId anchor for entity matching
// PersonId is stable per person across all sessions (Pitfall 3: same name ≠ same person)
export const mpProfiles = pgTable('mp_profiles', {
  personId: integer('person_id').primaryKey(), // ourcommons.ca PersonId — stable across sessions
  entityId: uuid('entity_id'), // matched entity (may be null if unmatched)
  canonicalFirstName: text('canonical_first_name').notNull(),
  canonicalLastName: text('canonical_last_name').notNull(),
  normalizedName: text('normalized_name'),
  matchMethod: text('match_method'), // 'deterministic', 'fuzzy', 'ai_verified', 'new_entity'
  matchConfidence: real('match_confidence'),
  // Summary fields computed from mp_tenures at Phase C.5 end
  parliamentsServed: integer('parliaments_served').notNull().default(0),
  firstElectedDate: date('first_elected_date'),
  lastServiceEndDate: date('last_service_end_date'), // NULL if currently sitting
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('mp_profiles_entity_id_idx').on(t.entityId),
  index('mp_profiles_normalized_name_idx').on(t.normalizedName),
])

// MP tenures — one row per (personId, parliamentNumber) capturing riding, party,
// and dates for that parliament. Populated from per-parliament ourcommons XML.
// Enables "Liberal MP for Papineau 2008–2025" storytelling and queries like
// "everyone who served in the 40th parliament" without scraping elsewhere.
export const mpTenures = pgTable('mp_tenures', {
  personId: integer('person_id')
    .notNull()
    .references(() => mpProfiles.personId, { onDelete: 'cascade' }),
  parliamentNumber: integer('parliament_number').notNull(),
  partyShortName: text('party_short_name'), // "Liberal", "Conservative", "NDP", "Bloc Québécois", "Independent", null
  ridingName: text('riding_name'), // "Papineau"
  ridingProvince: text('riding_province'), // "Québec" (full name as emitted by XML)
  startDate: date('start_date'), // FromDateTime (may be null if XML field missing)
  endDate: date('end_date'), // ToDateTime — null if currently sitting
  isCurrent: boolean('is_current').notNull().default(false), // true if endDate is null AND parliamentNumber = max
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('mp_tenures_person_parliament_idx').on(t.personId, t.parliamentNumber),
  index('mp_tenures_parliament_idx').on(t.parliamentNumber),
  index('mp_tenures_party_idx').on(t.partyShortName),
  index('mp_tenures_is_current_idx').on(t.isCurrent),
])

// Senator profiles — senatorId anchor for entity matching
// senatorId is the stable integer ID from sencanada.ca URL paths (e.g. /senator/207812/)
// Parallel to mp_profiles; senators serve up to age 75 so may appear across 20+ years of votes
export const senatorProfiles = pgTable('senator_profiles', {
  senatorId: integer('senator_id').primaryKey(), // from sencanada.ca URL — stable per person
  entityId: uuid('entity_id'), // matched entity (may be null if unmatched)
  canonicalFirstName: text('canonical_first_name').notNull(),
  canonicalLastName: text('canonical_last_name').notNull(),
  normalizedName: text('normalized_name'),
  province: text('province'),
  groupAffiliation: text('group_affiliation'), // C, ISG, CSG, PSG, Non-affiliated
  matchMethod: text('match_method'), // 'deterministic', 'fuzzy', 'ai_verified', 'new_entity'
  matchConfidence: real('match_confidence'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('senator_profiles_entity_id_idx').on(t.entityId),
  index('senator_profiles_normalized_name_idx').on(t.normalizedName),
])

// AI-generated bill summaries (parallel to ai_summaries for entities)
// Generated via claude-haiku-3-5 with grandpa-readable prompt (PARL-05)
export const billSummaries = pgTable('bill_summaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  billId: text('bill_id').notNull().references(() => parliamentBills.id, { onDelete: 'cascade' }),
  summaryText: text('summary_text').notNull(),
  model: text('model').notNull(), // 'claude-haiku-3-5' or 'claude-sonnet-4-5'
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  isStale: boolean('is_stale').notNull().default(false),
}, (t) => [
  uniqueIndex('bill_summaries_bill_id_idx').on(t.billId),
])
