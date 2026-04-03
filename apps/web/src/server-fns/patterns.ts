import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { entityConnections } from '@govtrace/db/schema/connections'
import { entities } from '@govtrace/db/schema/entities'
import { formatAmount } from '@/lib/connection-labels'

const TEMPORAL_CLUSTER_DAYS = 90
const HIGH_VALUE_THRESHOLD = 500_000
const MAX_CALLOUTS = 3

export type PatternCallout = {
  id: string
  question: string
  whyItMatters: string
  sourceEntityId: string
}

export const getPatternCallouts = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ entityId: z.string().uuid() }))
  .handler(async ({ data }): Promise<PatternCallout[]> => {
    const db = getDb()

    // Fetch entity name for use in questions
    const entityRow = await db
      .select({ canonicalName: entities.canonicalName })
      .from(entities)
      .where(eq(entities.id, data.entityId))
      .limit(1)

    const entityName = entityRow[0]?.canonicalName ?? 'This entity'

    const [multiDept, highValue, temporal, multiParty] = await Promise.all([
      detectMultiDepartmentContracts(db, data.entityId, entityName),
      detectHighValueConnection(db, data.entityId),
      detectTemporalClustering(db, data.entityId),
      detectMultiPartyDonor(db, data.entityId, entityName),
    ])

    const callouts: PatternCallout[] = []

    // Add monetary patterns first (high-value, multi-dept), then temporal, then multi-party
    if (highValue) callouts.push(highValue)
    if (multiDept) callouts.push(multiDept)
    if (temporal) callouts.push(temporal)
    if (multiParty) callouts.push(multiParty)

    return callouts.slice(0, MAX_CALLOUTS)
  })

type DbInstance = ReturnType<typeof getDb>

async function detectMultiDepartmentContracts(
  db: DbInstance,
  entityId: string,
  entityName: string,
): Promise<PatternCallout | null> {
  const result = await db.execute<{ dept_count: string }>(sql`
    SELECT COUNT(DISTINCT
      CASE
        WHEN entity_a_id = ${entityId} THEN entity_b_id
        ELSE entity_a_id
      END
    )::text AS dept_count
    FROM entity_connections
    WHERE (entity_a_id = ${entityId} OR entity_b_id = ${entityId})
      AND connection_type = 'vendor_to_department'
  `)

  const count = Number(Array.from(result)[0]?.dept_count ?? 0)
  if (count <= 1) return null

  return {
    id: `multi-dept-${entityId}`,
    question: `Did you know? ${entityName} has contracts with ${String(count)} different government departments`,
    whyItMatters: 'Multiple department relationships may indicate a large government vendor',
    sourceEntityId: entityId,
  }
}

async function detectHighValueConnection(
  db: DbInstance,
  entityId: string,
): Promise<PatternCallout | null> {
  const result = await db.execute<{
    connected_id: string
    connected_name: string
    total_value: string
  }>(sql`
    SELECT
      CASE
        WHEN ec.entity_a_id = ${entityId} THEN ec.entity_b_id
        ELSE ec.entity_a_id
      END AS connected_id,
      e.canonical_name AS connected_name,
      ec.total_value::text AS total_value
    FROM entity_connections ec
    JOIN entities e ON e.id = CASE
      WHEN ec.entity_a_id = ${entityId} THEN ec.entity_b_id
      ELSE ec.entity_a_id
    END
    WHERE (ec.entity_a_id = ${entityId} OR ec.entity_b_id = ${entityId})
      AND ec.total_value > ${HIGH_VALUE_THRESHOLD}
    ORDER BY ec.total_value DESC NULLS LAST
    LIMIT 1
  `)

  const row = Array.from(result)[0]
  if (!row) return null

  return {
    id: `high-value-${entityId}`,
    question: `Did you know? This entity has a ${formatAmount(row.total_value)} connection with ${row.connected_name}`,
    whyItMatters: 'This is among the highest-value connections in the dataset',
    sourceEntityId: row.connected_id,
  }
}

async function detectTemporalClustering(
  db: DbInstance,
  entityId: string,
): Promise<PatternCallout | null> {
  const result = await db.execute<{ vendor_connected_id: string }>(sql`
    SELECT DISTINCT
      CASE
        WHEN v.entity_a_id = ${entityId} THEN v.entity_b_id
        ELSE v.entity_a_id
      END AS vendor_connected_id
    FROM entity_connections l
    JOIN entity_connections v
      ON (v.entity_a_id = ${entityId} OR v.entity_b_id = ${entityId})
      AND v.connection_type = 'vendor_to_department'
      AND ABS(
        EXTRACT(EPOCH FROM (l.first_seen::timestamp - v.first_seen::timestamp))
      ) <= ${TEMPORAL_CLUSTER_DAYS * 86400}
    WHERE (l.entity_a_id = ${entityId} OR l.entity_b_id = ${entityId})
      AND l.connection_type IN ('lobbyist_to_official', 'lobbyist_client_to_official')
    LIMIT 1
  `)

  const row = Array.from(result)[0]
  if (!row) return null

  return {
    id: `temporal-cluster-${entityId}`,
    question: 'Did you know? Lobbying activity was registered within 90 days of a contract award',
    whyItMatters:
      'Temporal proximity between lobbying and contracts is a pattern civic researchers watch',
    sourceEntityId: row.vendor_connected_id,
  }
}

async function detectMultiPartyDonor(
  db: DbInstance,
  entityId: string,
  entityName: string,
): Promise<PatternCallout | null> {
  const result = await db.execute<{ party_count: string }>(sql`
    SELECT COUNT(DISTINCT
      CASE
        WHEN entity_a_id = ${entityId} THEN entity_b_id
        ELSE entity_a_id
      END
    )::text AS party_count
    FROM entity_connections
    WHERE (entity_a_id = ${entityId} OR entity_b_id = ${entityId})
      AND connection_type = 'donor_to_party'
  `)

  const count = Number(Array.from(result)[0]?.party_count ?? 0)
  if (count <= 2) return null

  return {
    id: `multi-party-${entityId}`,
    question: `Did you know? ${entityName} has donated to ${String(count)} different political parties or politicians`,
    whyItMatters: 'Donations to multiple parties may reflect broad political engagement',
    sourceEntityId: entityId,
  }
}
