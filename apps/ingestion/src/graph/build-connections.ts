import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'

export interface ConnectionBuildResult {
  donorToParty: number
  vendorToDepartment: number
  grantRecipientToDepartment: number
  lobbyistToOfficial: number
  lobbyistClientToOfficial: number
  aidRecipientToDepartment: number
  appointeeToOrganization: number
  total: number
}

export async function buildEntityConnections(): Promise<ConnectionBuildResult> {
  const db = getDb()
  const result: ConnectionBuildResult = {
    donorToParty: 0, vendorToDepartment: 0, grantRecipientToDepartment: 0,
    lobbyistToOfficial: 0, lobbyistClientToOfficial: 0, aidRecipientToDepartment: 0,
    appointeeToOrganization: 0, total: 0,
  }

  console.log('Building entity_connections table...')

  // Step 1: Mark existing as stale
  await db.execute(sql.raw(`UPDATE entity_connections SET is_stale = true`))
  console.log('  Marked existing connections as stale')

  // DONATIONS: donor entity → recipient entity
  console.log('  Building donor → recipient connections...')
  await db.execute(sql.raw(`
    INSERT INTO entity_connections (
      entity_a_id, entity_b_id, connection_type,
      total_value, transaction_count, first_seen, last_seen,
      source_table, is_stale, computed_at
    )
    SELECT
      d.entity_id,
      e.id,
      'donor_to_party',
      SUM(d.amount::numeric),
      COUNT(*),
      MIN(d.donation_date),
      MAX(d.donation_date),
      'donations',
      false,
      NOW()
    FROM donations d
    JOIN entities e ON e.normalized_name = LOWER(TRIM(d.recipient_name)) AND e.entity_type = 'politician'
    WHERE d.entity_id IS NOT NULL
      AND d.recipient_name IS NOT NULL
    GROUP BY d.entity_id, e.id
    ON CONFLICT (entity_a_id, entity_b_id, connection_type)
    DO UPDATE SET
      total_value = EXCLUDED.total_value,
      transaction_count = EXCLUDED.transaction_count,
      first_seen = EXCLUDED.first_seen,
      last_seen = EXCLUDED.last_seen,
      is_stale = false,
      computed_at = NOW()
  `))
  console.log('  donor_to_party: done')

  // CONTRACTS: vendor entity → department entity
  console.log('  Building vendor → department connections...')
  await db.execute(sql.raw(`
    INSERT INTO entity_connections (
      entity_a_id, entity_b_id, connection_type,
      total_value, transaction_count, first_seen, last_seen,
      source_table, is_stale, computed_at
    )
    SELECT
      c.entity_id,
      e.id,
      'vendor_to_department',
      SUM(c.value::numeric),
      COUNT(*),
      MIN(c.award_date),
      MAX(c.award_date),
      'contracts',
      false,
      NOW()
    FROM contracts c
    JOIN entities e ON e.normalized_name = LOWER(TRIM(c.department))
    WHERE c.entity_id IS NOT NULL
      AND c.department IS NOT NULL
    GROUP BY c.entity_id, e.id
    ON CONFLICT (entity_a_id, entity_b_id, connection_type)
    DO UPDATE SET
      total_value = EXCLUDED.total_value,
      transaction_count = EXCLUDED.transaction_count,
      first_seen = EXCLUDED.first_seen,
      last_seen = EXCLUDED.last_seen,
      is_stale = false,
      computed_at = NOW()
  `))
  console.log('  vendor_to_department: done')

  // GRANTS: recipient entity → department entity
  console.log('  Building grant recipient → department connections...')
  await db.execute(sql.raw(`
    INSERT INTO entity_connections (
      entity_a_id, entity_b_id, connection_type,
      total_value, transaction_count, first_seen, last_seen,
      source_table, is_stale, computed_at
    )
    SELECT
      g.entity_id,
      e.id,
      'grant_recipient_to_department',
      SUM(g.amount::numeric),
      COUNT(*),
      MIN(g.agreement_date),
      MAX(g.agreement_date),
      'grants',
      false,
      NOW()
    FROM grants g
    JOIN entities e ON e.normalized_name = LOWER(TRIM(g.department))
    WHERE g.entity_id IS NOT NULL
      AND g.department IS NOT NULL
    GROUP BY g.entity_id, e.id
    ON CONFLICT (entity_a_id, entity_b_id, connection_type)
    DO UPDATE SET
      total_value = EXCLUDED.total_value,
      transaction_count = EXCLUDED.transaction_count,
      first_seen = EXCLUDED.first_seen,
      last_seen = EXCLUDED.last_seen,
      is_stale = false,
      computed_at = NOW()
  `))
  console.log('  grant_recipient_to_department: done')

  // INTERNATIONAL AID: implementer entity → funding department entity
  console.log('  Building aid recipient → department connections...')
  await db.execute(sql.raw(`
    INSERT INTO entity_connections (
      entity_a_id, entity_b_id, connection_type,
      total_value, transaction_count, first_seen, last_seen,
      source_table, is_stale, computed_at
    )
    SELECT
      ia.entity_id,
      e.id,
      'aid_recipient_to_department',
      SUM(ia.total_disbursed_cad::numeric),
      COUNT(*),
      MIN(ia.start_date),
      MAX(ia.end_date),
      'international_aid',
      false,
      NOW()
    FROM international_aid ia
    JOIN entities e ON e.normalized_name = LOWER(TRIM(ia.funding_department))
    WHERE ia.entity_id IS NOT NULL
      AND ia.funding_department IS NOT NULL
    GROUP BY ia.entity_id, e.id
    ON CONFLICT (entity_a_id, entity_b_id, connection_type)
    DO UPDATE SET
      total_value = EXCLUDED.total_value,
      transaction_count = EXCLUDED.transaction_count,
      first_seen = EXCLUDED.first_seen,
      last_seen = EXCLUDED.last_seen,
      is_stale = false,
      computed_at = NOW()
  `))
  console.log('  aid_recipient_to_department: done')

  // LOBBY: lobbyist → official (only where both entity IDs exist)
  console.log('  Building lobbyist → official connections...')
  await db.execute(sql.raw(`
    INSERT INTO entity_connections (
      entity_a_id, entity_b_id, connection_type,
      transaction_count, first_seen, last_seen,
      source_table, is_stale, computed_at
    )
    SELECT
      lc.lobbyist_entity_id,
      lc.official_entity_id,
      'lobbyist_to_official',
      COUNT(*),
      MIN(lc.communication_date),
      MAX(lc.communication_date),
      'lobby_communications',
      false,
      NOW()
    FROM lobby_communications lc
    WHERE lc.lobbyist_entity_id IS NOT NULL
      AND lc.official_entity_id IS NOT NULL
    GROUP BY lc.lobbyist_entity_id, lc.official_entity_id
    ON CONFLICT (entity_a_id, entity_b_id, connection_type)
    DO UPDATE SET
      transaction_count = EXCLUDED.transaction_count,
      first_seen = EXCLUDED.first_seen,
      last_seen = EXCLUDED.last_seen,
      is_stale = false,
      computed_at = NOW()
  `))
  console.log('  lobbyist_to_official: done')

  // GIC APPOINTMENTS: appointee entity → organization entity
  console.log('  Building appointee → organization connections...')
  await db.execute(sql.raw(`
    INSERT INTO entity_connections (
      entity_a_id, entity_b_id, connection_type,
      transaction_count, first_seen, last_seen,
      source_table, is_stale, computed_at
    )
    SELECT
      ga.entity_id,
      e.id,
      'appointee_to_organization',
      1,
      ga.appointment_date,
      ga.expiry_date,
      'gic_appointments',
      false,
      NOW()
    FROM gic_appointments ga
    JOIN entities e ON e.normalized_name = LOWER(TRIM(ga.organization_name))
    WHERE ga.entity_id IS NOT NULL
      AND ga.is_vacant = false
    ON CONFLICT (entity_a_id, entity_b_id, connection_type)
    DO UPDATE SET
      first_seen = EXCLUDED.first_seen,
      last_seen = EXCLUDED.last_seen,
      is_stale = false,
      computed_at = NOW()
  `))
  console.log('  appointee_to_organization: done')

  // Step 3: Delete stale
  await db.execute(sql.raw(`DELETE FROM entity_connections WHERE is_stale = true`))

  // Final count
  const countResult = await db.execute(sql`SELECT count(*) as c FROM entity_connections`)
  const totalRows = countResult as unknown as Array<{ c: string }>
  result.total = Number(totalRows[0]?.c ?? 0)

  console.log(`entity_connections built: ${result.total} total connections`)
  return result
}
