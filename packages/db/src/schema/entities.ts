import { pgTable, text, timestamp, uuid, real, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// Resolved canonical entities — persons, companies, politicians, departments
export const entities = pgTable('entities', {
  id: uuid('id').primaryKey().defaultRandom(),
  canonicalName: text('canonical_name').notNull(),
  normalizedName: text('normalized_name').notNull(), // for pg_trgm search — GIN indexed
  entityType: text('entity_type').notNull(), // 'person', 'company', 'politician', 'department', 'organization'
  province: text('province'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // GIN index on normalized_name for pg_trgm fuzzy search — INFRA-07
  index('entities_normalized_name_gin_idx').using('gin', sql`${t.normalizedName} gin_trgm_ops`),
  uniqueIndex('entities_canonical_name_type_idx').on(t.canonicalName, t.entityType),
])

// All raw name variants and their match provenance — MATCH-04, prevents anti-pattern 3
export const entityAliases = pgTable('entity_aliases', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  rawName: text('raw_name').notNull(), // original name from source
  normalizedName: text('normalized_name').notNull(),
  sourceTable: text('source_table').notNull(), // 'donations', 'contracts', 'grants', 'lobby_registrations', 'lobby_communications'
  sourceField: text('source_field').notNull(), // which field in source table
  matchMethod: text('match_method').notNull(), // 'deterministic', 'fuzzy', 'ai_verified', 'manual'
  confidenceScore: real('confidence_score'), // 0.0–1.0
  aiReasoning: text('ai_reasoning'), // Claude's explanation for AI-verified matches
  isVerified: boolean('is_verified').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('entity_aliases_entity_id_idx').on(t.entityId),
  index('entity_aliases_normalized_name_idx').on(t.normalizedName),
  uniqueIndex('entity_aliases_raw_name_source_idx').on(t.rawName, t.sourceTable, t.sourceField),
])

// Full audit log of every match decision — MATCH-04
export const entityMatchesLog = pgTable('entity_matches_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityAId: uuid('entity_a_id'), // may be null if entity_a is a raw name candidate
  entityBId: uuid('entity_b_id'),
  rawNameA: text('raw_name_a').notNull(),
  rawNameB: text('raw_name_b').notNull(),
  normalizedNameA: text('normalized_name_a').notNull(),
  normalizedNameB: text('normalized_name_b').notNull(),
  matchMethod: text('match_method').notNull(), // 'deterministic', 'fuzzy', 'ai_batch', 'ai_sync'
  similarityScore: real('similarity_score'), // pg_trgm score
  aiModel: text('ai_model'), // e.g. 'claude-haiku-3-5'
  aiConfidence: real('ai_confidence'), // 0.0–1.0 from AI response
  aiReasoning: text('ai_reasoning'), // Claude's reasoning text
  decision: text('decision').notNull(), // 'match', 'no_match', 'uncertain'
  isFlaggedForReview: boolean('is_flagged_for_review').notNull().default(false),
  flagReason: text('flag_reason'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('entity_matches_log_entity_a_id_idx').on(t.entityAId),
  index('entity_matches_log_entity_b_id_idx').on(t.entityBId),
  index('entity_matches_log_flagged_idx').on(t.isFlaggedForReview),
])

// AI-generated summaries cache
export const aiSummaries = pgTable('ai_summaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  summaryText: text('summary_text').notNull(),
  model: text('model').notNull(),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  isStale: boolean('is_stale').notNull().default(false),
  dataSnapshotHash: text('data_snapshot_hash'), // hash of source data used to generate
}, (t) => [
  uniqueIndex('ai_summaries_entity_id_idx').on(t.entityId),
])

// Community error flags
export const flags = pgTable('flags', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').references(() => entities.id),
  matchLogId: uuid('match_log_id').references(() => entityMatchesLog.id),
  reporterEmail: text('reporter_email'),
  description: text('description').notNull(),
  status: text('status').notNull().default('pending'), // 'pending', 'reviewed', 'resolved', 'dismissed'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('flags_entity_id_idx').on(t.entityId),
  index('flags_status_idx').on(t.status),
])
