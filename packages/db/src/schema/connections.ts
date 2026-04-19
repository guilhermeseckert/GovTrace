import { pgTable, text, integer, numeric, date, timestamp, uuid, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { entities } from './entities'

// Pre-computed relationship graph — MATCH-05
// Rebuilt after each ingestion run; never queried via runtime JOINs
export const entityConnections = pgTable('entity_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityAId: uuid('entity_a_id').notNull().references(() => entities.id),
  entityBId: uuid('entity_b_id').notNull().references(() => entities.id),
  connectionType: text('connection_type').notNull(),
  // Types: 'donor_to_party', 'vendor_to_department', 'grant_recipient_to_department',
  //        'lobbyist_to_official', 'lobbyist_client_to_official', 'lobbyist_to_client'
  totalValue: numeric('total_value', { precision: 15, scale: 2 }),
  transactionCount: integer('transaction_count').notNull().default(0),
  firstSeen: date('first_seen'),
  lastSeen: date('last_seen'),
  sourceRecordIds: text('source_record_ids').array(), // IDs from source tables
  sourceTable: text('source_table').notNull(), // which raw table this comes from
  isStale: boolean('is_stale').notNull().default(false), // true while awaiting rebuild after correction
  computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // Bidirectional lookup indexes — INFRA-07
  index('entity_connections_entity_a_id_idx').on(t.entityAId),
  index('entity_connections_entity_b_id_idx').on(t.entityBId),
  // Composite index for the most common query pattern: by entity + type — INFRA-07
  uniqueIndex('entity_connections_a_b_type_idx').on(t.entityAId, t.entityBId, t.connectionType),
  index('entity_connections_stale_idx').on(t.isStale),
])
