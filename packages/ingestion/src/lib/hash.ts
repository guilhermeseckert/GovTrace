import { createHash } from 'node:crypto'

/**
 * Derives a deterministic, stable source key from a list of field values.
 * Used for idempotent upserts when no stable government-issued ID exists.
 * See Pitfall 2: Non-idempotent ingestion creates duplicate records.
 *
 * @param fields - An ordered array of field values that uniquely identify the record
 * @returns A lowercase hex SHA-256 hash of the joined fields
 */
export function deriveSourceKey(fields: string[]): string {
  const normalized = fields.map((f) => f.trim().toLowerCase()).join('|')
  return createHash('sha256').update(normalized, 'utf8').digest('hex')
}
