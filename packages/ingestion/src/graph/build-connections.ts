import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { entityConnections } from '@govtrace/db/schema/connections'

export interface ConnectionBuildResult {
  donorToParty: number
  vendorToDepartment: number
  grantRecipientToDepartment: number
  lobbyistToOfficial: number
  lobbyistClientToOfficial: number
  total: number
}

/**
 * Rebuilds the entity_connections table from all 5 source tables.
 * Full replace strategy: marks all existing rows as stale, inserts new, deletes stale.
 * This ensures no stale edges remain after a re-run (Pitfall 6).
 *
 * Only processes records where entity_id has been resolved (not null).
 * Must be run after runMatchingPipeline() and processBatchResults() complete.
 *
 * MATCH-05: aggregates (type, total value, transaction count, date range) per entity pair.
 */
export async function buildEntityConnections(): Promise<ConnectionBuildResult> {
  const db = getDb()
  const result: ConnectionBuildResult = {
    donorToParty: 0,
    vendorToDepartment: 0,
    grantRecipientToDepartment: 0,
    lobbyistToOfficial: 0,
    lobbyistClientToOfficial: 0,
    total: 0,
  }

  console.log('Building entity_connections table...')

  // Step 1: Mark all existing connections as stale (Pitfall 6)
  await db.update(entityConnections).set({ isStale: true })
  console.log('  Marked existing connections as stale')

  // Step 2: Build connections from each source table

  // DONATIONS: entity_id → recipient entity (donor to party/candidate/riding association)
  // Recipient entity is looked up by normalized name match.
  console.log('  Building donor connections...')
  const donorResult = await db.execute(sql`
    INSERT INTO entity_connections (
      entity_a_id, entity_b_id, connection_type,
      total_value, transaction_count, first_seen, last_seen,
      source_record_ids, source_table, is_stale, computed_at
    )
    SELECT
      d.entity_id AS entity_a_id,
      (SELECT e.id FROM entities e
       WHERE e.normalized_name = lower(regexp_replace(d.recipient_name, '\s+', ' ', 'g'))
       LIMIT 1) AS entity_b_id,
      'donor_to_party' AS connection_type,
      SUM(d.amount::numeric) AS total_value,
      COUNT(*) AS transaction_count,
      MIN(d.donation_date) AS first_seen,
      MAX(d.donation_date) AS last_seen,
      ARRAY_AGG(d.id) AS source_record_ids,
      'donations' AS source_table,
      false AS is_stale,
      NOW() AS computed_at
    FROM donations d
    WHERE d.entity_id IS NOT NULL
      AND d.recipient_name IS NOT NULL
    GROUP BY d.entity_id, lower(regexp_replace(d.recipient_name, '\s+', ' ', 'g'))
    HAVING (SELECT e.id FROM entities e
            WHERE e.normalized_name = lower(regexp_replace(d.recipient_name, '\s+', ' ', 'g'))
            LIMIT 1) IS NOT NULL
    ON CONFLICT (entity_a_id, entity_b_id, connection_type)
    DO UPDATE SET
      total_value = EXCLUDED.total_value,
      transaction_count = EXCLUDED.transaction_count,
      first_seen = EXCLUDED.first_seen,
      last_seen = EXCLUDED.last_seen,
      source_record_ids = EXCLUDED.source_record_ids,
      is_stale = false,
      computed_at = NOW()
  `)
  result.donorToParty = Number(donorResult.rowCount ?? 0)

  // CONTRACTS: entity_id → department entity (vendor to department)
  console.log('  Building contract connections...')
  const contractResult = await db.execute(sql`
    INSERT INTO entity_connections (
      entity_a_id, entity_b_id, connection_type,
      total_value, transaction_count, first_seen, last_seen,
      source_record_ids, source_table, is_stale, computed_at
    )
    SELECT
      c.entity_id AS entity_a_id,
      (SELECT e.id FROM entities e
       WHERE e.normalized_name = lower(c.department)
       LIMIT 1) AS entity_b_id,
      'vendor_to_department' AS connection_type,
      SUM(c.value::numeric) AS total_value,
      COUNT(*) AS transaction_count,
      MIN(c.award_date) AS first_seen,
      MAX(c.award_date) AS last_seen,
      ARRAY_AGG(c.id) AS source_record_ids,
      'contracts' AS source_table,
      false AS is_stale,
      NOW() AS computed_at
    FROM contracts c
    WHERE c.entity_id IS NOT NULL
      AND c.department IS NOT NULL
    GROUP BY c.entity_id, lower(c.department)
    HAVING (SELECT e.id FROM entities e
            WHERE e.normalized_name = lower(c.department)
            LIMIT 1) IS NOT NULL
    ON CONFLICT (entity_a_id, entity_b_id, connection_type)
    DO UPDATE SET
      total_value = EXCLUDED.total_value,
      transaction_count = EXCLUDED.transaction_count,
      first_seen = EXCLUDED.first_seen,
      last_seen = EXCLUDED.last_seen,
      source_record_ids = EXCLUDED.source_record_ids,
      is_stale = false,
      computed_at = NOW()
  `)
  result.vendorToDepartment = Number(contractResult.rowCount ?? 0)

  // GRANTS: entity_id → department entity (grant recipient to department)
  console.log('  Building grant connections...')
  const grantResult = await db.execute(sql`
    INSERT INTO entity_connections (
      entity_a_id, entity_b_id, connection_type,
      total_value, transaction_count, first_seen, last_seen,
      source_record_ids, source_table, is_stale, computed_at
    )
    SELECT
      g.entity_id AS entity_a_id,
      (SELECT e.id FROM entities e
       WHERE e.normalized_name = lower(g.department)
       LIMIT 1) AS entity_b_id,
      'grant_recipient_to_department' AS connection_type,
      SUM(g.amount::numeric) AS total_value,
      COUNT(*) AS transaction_count,
      MIN(g.agreement_date) AS first_seen,
      MAX(g.agreement_date) AS last_seen,
      ARRAY_AGG(g.id) AS source_record_ids,
      'grants' AS source_table,
      false AS is_stale,
      NOW() AS computed_at
    FROM grants g
    WHERE g.entity_id IS NOT NULL
      AND g.department IS NOT NULL
    GROUP BY g.entity_id, lower(g.department)
    HAVING (SELECT e.id FROM entities e
            WHERE e.normalized_name = lower(g.department)
            LIMIT 1) IS NOT NULL
    ON CONFLICT (entity_a_id, entity_b_id, connection_type)
    DO UPDATE SET
      total_value = EXCLUDED.total_value,
      transaction_count = EXCLUDED.transaction_count,
      first_seen = EXCLUDED.first_seen,
      last_seen = EXCLUDED.last_seen,
      source_record_ids = EXCLUDED.source_record_ids,
      is_stale = false,
      computed_at = NOW()
  `)
  result.grantRecipientToDepartment = Number(grantResult.rowCount ?? 0)

  // LOBBY COMMUNICATIONS: lobbyist_entity_id → official_entity_id (lobbyist to official)
  console.log('  Building lobby communication connections (lobbyist to official)...')
  const lobbyCommResult = await db.execute(sql`
    INSERT INTO entity_connections (
      entity_a_id, entity_b_id, connection_type,
      total_value, transaction_count, first_seen, last_seen,
      source_record_ids, source_table, is_stale, computed_at
    )
    SELECT
      lc.lobbyist_entity_id AS entity_a_id,
      lc.official_entity_id AS entity_b_id,
      'lobbyist_to_official' AS connection_type,
      NULL AS total_value,
      COUNT(*) AS transaction_count,
      MIN(lc.communication_date) AS first_seen,
      MAX(lc.communication_date) AS last_seen,
      ARRAY_AGG(lc.id) AS source_record_ids,
      'lobby_communications' AS source_table,
      false AS is_stale,
      NOW() AS computed_at
    FROM lobby_communications lc
    WHERE lc.lobbyist_entity_id IS NOT NULL
      AND lc.official_entity_id IS NOT NULL
    GROUP BY lc.lobbyist_entity_id, lc.official_entity_id
    ON CONFLICT (entity_a_id, entity_b_id, connection_type)
    DO UPDATE SET
      transaction_count = EXCLUDED.transaction_count,
      first_seen = EXCLUDED.first_seen,
      last_seen = EXCLUDED.last_seen,
      source_record_ids = EXCLUDED.source_record_ids,
      is_stale = false,
      computed_at = NOW()
  `)
  result.lobbyistToOfficial = Number(lobbyCommResult.rowCount ?? 0)

  // LOBBY COMMUNICATIONS: client_entity_id → official_entity_id (lobbyist client to official)
  // A lobby registration links a client to the lobbyist; communications show the actual contact.
  // Join lobby_registrations to lobby_communications via registration_number to get client → official links.
  console.log('  Building lobby client to official connections...')
  const lobbyClientResult = await db.execute(sql`
    INSERT INTO entity_connections (
      entity_a_id, entity_b_id, connection_type,
      total_value, transaction_count, first_seen, last_seen,
      source_record_ids, source_table, is_stale, computed_at
    )
    SELECT
      lr.client_entity_id AS entity_a_id,
      lc.official_entity_id AS entity_b_id,
      'lobbyist_client_to_official' AS connection_type,
      NULL AS total_value,
      COUNT(*) AS transaction_count,
      MIN(lc.communication_date) AS first_seen,
      MAX(lc.communication_date) AS last_seen,
      ARRAY_AGG(lc.id) AS source_record_ids,
      'lobby_communications' AS source_table,
      false AS is_stale,
      NOW() AS computed_at
    FROM lobby_communications lc
    JOIN lobby_registrations lr ON lr.registration_number = lc.registration_number
    WHERE lr.client_entity_id IS NOT NULL
      AND lc.official_entity_id IS NOT NULL
    GROUP BY lr.client_entity_id, lc.official_entity_id
    ON CONFLICT (entity_a_id, entity_b_id, connection_type)
    DO UPDATE SET
      transaction_count = EXCLUDED.transaction_count,
      first_seen = EXCLUDED.first_seen,
      last_seen = EXCLUDED.last_seen,
      source_record_ids = EXCLUDED.source_record_ids,
      is_stale = false,
      computed_at = NOW()
  `)
  result.lobbyistClientToOfficial = Number(lobbyClientResult.rowCount ?? 0)

  // Step 3: Delete all remaining stale rows (cleanup — Pitfall 6)
  const deleted = await db.execute(sql`DELETE FROM entity_connections WHERE is_stale = true`)
  console.log(`  Deleted ${deleted.rowCount ?? 0} stale connections`)

  result.total =
    result.donorToParty +
    result.vendorToDepartment +
    result.grantRecipientToDepartment +
    result.lobbyistToOfficial +
    result.lobbyistClientToOfficial

  console.log(`entity_connections built: ${result.total} total connections`)
  console.log(`  donor_to_party: ${result.donorToParty}`)
  console.log(`  vendor_to_department: ${result.vendorToDepartment}`)
  console.log(`  grant_recipient_to_department: ${result.grantRecipientToDepartment}`)
  console.log(`  lobbyist_to_official: ${result.lobbyistToOfficial}`)
  console.log(`  lobbyist_client_to_official: ${result.lobbyistClientToOfficial}`)

  return result
}
