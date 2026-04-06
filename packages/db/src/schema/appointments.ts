import {
  pgTable,
  text,
  date,
  timestamp,
  jsonb,
  uuid,
  index,
  uniqueIndex,
  boolean,
} from 'drizzle-orm/pg-core'

// Governor in Council (GIC) appointments scraped from federal-organizations.canada.ca
// Source: https://federal-organizations.canada.ca/orgs.php?lang=en&t=1
// PK: SHA256(orgCode + appointeeName + positionTitle) — deterministic for idempotent re-ingestion
export const gicAppointments = pgTable('gic_appointments', {
  id: text('id').primaryKey(), // deterministic: SHA256(orgCode + appointeeName + positionTitle)
  appointeeName: text('appointee_name').notNull(), // "Bouchard, Marie-Philippe" or "Vacant"
  normalizedAppointeeName: text('normalized_appointee_name'), // "marie-philippe bouchard" — for matching pipeline
  positionTitle: text('position_title').notNull(), // "President", "Director", etc.
  organizationName: text('organization_name').notNull(), // "Canadian Broadcasting Corporation"
  organizationCode: text('organization_code').notNull(), // "CBC"
  appointmentType: text('appointment_type'), // 'full-time' | 'part-time'
  tenureType: text('tenure_type'), // 'during_good_behaviour' | 'during_pleasure'
  appointmentDate: date('appointment_date'), // YYYY-MM-DD
  expiryDate: date('expiry_date'), // YYYY-MM-DD
  isVacant: boolean('is_vacant').notNull().default(false), // vacant positions are listed on site
  entityId: uuid('entity_id'), // FK to entities.id — set after entity matching
  sourceUrl: text('source_url').notNull(), // full URL of scraped page
  sourceFileHash: text('source_file_hash').notNull(), // SHA256 of HTML at scrape time
  rawData: jsonb('raw_data').notNull(), // full scraped row data for debugging
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('gic_appointments_normalized_appointee_name_idx').on(t.normalizedAppointeeName),
  index('gic_appointments_entity_id_idx').on(t.entityId),
  index('gic_appointments_organization_code_idx').on(t.organizationCode),
  index('gic_appointments_appointment_date_idx').on(t.appointmentDate),
  uniqueIndex('gic_appointments_org_name_title_idx').on(t.organizationCode, t.appointeeName, t.positionTitle),
])
