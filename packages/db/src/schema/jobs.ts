import { pgTable, text, integer, timestamp, uuid, jsonb, index } from 'drizzle-orm/pg-core'

// Audit log for each ingestion run
export const ingestionRuns = pgTable('ingestion_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  source: text('source').notNull(), // 'elections_canada', 'contracts', 'grants', 'lobby_registrations', 'lobby_communications'
  status: text('status').notNull(), // 'running', 'completed', 'failed'
  sourceFileUrl: text('source_file_url'),
  sourceFileHash: text('source_file_hash'),
  detectedEncoding: text('detected_encoding'), // DATA-06
  recordsProcessed: integer('records_processed').notNull().default(0),
  recordsInserted: integer('records_inserted').notNull().default(0),
  recordsUpdated: integer('records_updated').notNull().default(0),
  recordsSkipped: integer('records_skipped').notNull().default(0),
  errorMessage: text('error_message'),
  auditData: jsonb('audit_data'), // record counts by year, encoding log, etc.
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (t) => [
  index('ingestion_runs_source_idx').on(t.source),
  index('ingestion_runs_started_at_idx').on(t.startedAt),
])
