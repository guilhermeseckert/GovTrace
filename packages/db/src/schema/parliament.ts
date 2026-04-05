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
// Source: https://www.ourcommons.ca/members/en/votes/xml?parlSession={parliament}-{session}
// PK: "{parliament}-{session}-{divisionNumber}" e.g. "44-1-377"
export const parliamentVotes = pgTable('parliament_votes', {
  id: text('id').primaryKey(), // "{parliament}-{session}-{divisionNumber}"
  parliamentNumber: integer('parliament_number').notNull(),
  sessionNumber: integer('session_number').notNull(),
  parlSessionCode: text('parl_session_code').notNull(), // "44-1"
  divisionNumber: integer('division_number').notNull(),
  voteDate: date('vote_date').notNull(),
  voteDateTime: timestamp('vote_date_time', { withTimezone: true }),
  subject: text('subject').notNull(), // DecisionDivisionSubject
  resultName: text('result_name').notNull(), // "Agreed To" / "Negatived"
  yeasTotal: integer('yeas_total').notNull().default(0),
  naysTotal: integer('nays_total').notNull().default(0),
  pairedTotal: integer('paired_total').notNull().default(0),
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
])

// Individual MP ballot rows (1.8–2.4M rows total for full history)
// Source: https://www.ourcommons.ca/members/en/votes/{parliament}/{session}/{voteNumber}/xml
// PK: "{parliament}-{session}-{divisionNumber}-{personId}" e.g. "44-1-377-89156"
export const parliamentVoteBallots = pgTable('parliament_vote_ballots', {
  id: text('id').primaryKey(), // "{voteId}-{personId}"
  voteId: text('vote_id').notNull().references(() => parliamentVotes.id),
  personId: integer('person_id').notNull(), // ourcommons.ca PersonId — stable per person
  entityId: uuid('entity_id'), // FK to entities.id — set after matching
  parliamentNumber: integer('parliament_number').notNull(),
  sessionNumber: integer('session_number').notNull(),
  divisionNumber: integer('division_number').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  constituency: text('constituency'),
  province: text('province'),
  caucusShortName: text('caucus_short_name'), // "CPC", "LPC", "NDP", "BQ", "GPC", "IND"
  ballotValue: text('ballot_value').notNull(), // "Yea", "Nay", "Paired"
  isYea: boolean('is_yea').notNull().default(false),
  isNay: boolean('is_nay').notNull().default(false),
  isPaired: boolean('is_paired').notNull().default(false),
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('parliament_vote_ballots_vote_id_idx').on(t.voteId),
  index('parliament_vote_ballots_entity_id_idx').on(t.entityId),
  index('parliament_vote_ballots_person_id_idx').on(t.personId),
  index('parliament_vote_ballots_caucus_idx').on(t.caucusShortName),
  index('parliament_vote_ballots_ballot_value_idx').on(t.ballotValue),
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
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('mp_profiles_entity_id_idx').on(t.entityId),
  index('mp_profiles_normalized_name_idx').on(t.normalizedName),
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
