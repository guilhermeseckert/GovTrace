import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { entities } from '@govtrace/db/schema/entities'

// ---------------------------------------------------------------------------
// Exported response types
// ---------------------------------------------------------------------------

export type GraphNode = {
  id: string
  name: string
  entityType: string
  depth: number
}

export type GraphEdge = {
  sourceId: string
  targetId: string
  connectionType: string
  totalValue: number | null
  transactionCount: number
}

export type GraphResponse = {
  rootEntityId: string
  nodes: GraphNode[]
  edges: GraphEdge[]
  truncated: boolean
}

export type MoneyFlowNode = { id: string; name: string; type: 'entity' | 'party' | 'department' }
export type MoneyFlowLink = { source: string; target: string; value: number }
export type MoneyFlowResponse = { nodes: MoneyFlowNode[]; links: MoneyFlowLink[] }

export type TimelineEvent = {
  date: string
  eventType: 'donation' | 'contract' | 'grant' | 'lobby_registration' | 'lobby_communication'
  description: string
  amount: number | null
}
export type TimelineResponse = { events: TimelineEvent[] }

// ---------------------------------------------------------------------------
// API-06: getGraphData — fast depth-1 query (no recursive CTE)
// ---------------------------------------------------------------------------

const GraphInputSchema = z.object({
  id: z.string().uuid(),
  depth: z.number().int().min(1).max(2).default(1),
  connectionTypes: z.array(z.string()).optional(),
})

export const getGraphData = createServerFn({ method: 'GET' })
  .inputValidator(GraphInputSchema)
  .handler(async ({ data }): Promise<GraphResponse> => {
    const db = getDb()
    const { id: entityId, connectionTypes } = data

    const typeFilter = connectionTypes && connectionTypes.length > 0
      ? sql`AND ec.connection_type = ANY(ARRAY[${sql.join(connectionTypes.map(t => sql`${t}`), sql`, `)}])`
      : sql``

    // Fast depth-1 query — no recursive CTE needed
    const rows = Array.from(await db.execute<{
      connected_id: string
      connection_type: string
      total_value: string | null
      transaction_count: string
      entity_name: string
      entity_type: string
    }>(sql`
      SELECT
        CASE WHEN ec.entity_a_id = ${entityId}::uuid THEN ec.entity_b_id ELSE ec.entity_a_id END AS connected_id,
        ec.connection_type,
        ec.total_value::text,
        ec.transaction_count::text,
        e.canonical_name AS entity_name,
        e.entity_type
      FROM entity_connections ec
      JOIN entities e ON e.id = CASE WHEN ec.entity_a_id = ${entityId}::uuid THEN ec.entity_b_id ELSE ec.entity_a_id END
      WHERE (ec.entity_a_id = ${entityId}::uuid OR ec.entity_b_id = ${entityId}::uuid)
        AND ec.is_stale = false
        ${typeFilter}
      ORDER BY ec.transaction_count DESC
      LIMIT 50
    `))

    // Root entity
    const rootRows = await db.select({ id: entities.id, canonicalName: entities.canonicalName, entityType: entities.entityType })
      .from(entities).where(eq(entities.id, entityId)).limit(1)
    const root = rootRows[0]

    const nodes: GraphNode[] = []
    if (root) {
      nodes.push({ id: root.id, name: root.canonicalName, entityType: root.entityType, depth: 0 })
    }

    const seenIds = new Set<string>([entityId])
    const edges: GraphEdge[] = []

    for (const row of rows) {
      if (!seenIds.has(row.connected_id)) {
        seenIds.add(row.connected_id)
        nodes.push({ id: row.connected_id, name: row.entity_name, entityType: row.entity_type, depth: 1 })
      }
      edges.push({
        sourceId: entityId,
        targetId: row.connected_id,
        connectionType: row.connection_type,
        totalValue: row.total_value !== null ? Number(row.total_value) : null,
        transactionCount: Number(row.transaction_count),
      })
    }

    return { rootEntityId: entityId, nodes, edges, truncated: rows.length >= 50 }
  })

// ---------------------------------------------------------------------------
// API-07: getMoneyFlow — Sankey diagram data
// ---------------------------------------------------------------------------

const MoneyFlowInputSchema = z.object({ id: z.string().uuid() })

export const getMoneyFlow = createServerFn({ method: 'GET' })
  .inputValidator(MoneyFlowInputSchema)
  .handler(async ({ data }): Promise<MoneyFlowResponse> => {
    const db = getDb()

    const rootRows = await db.select({ canonicalName: entities.canonicalName, entityType: entities.entityType })
      .from(entities).where(eq(entities.id, data.id)).limit(1)
    const rootName = rootRows[0]?.canonicalName ?? data.id
    const isPolitician = rootRows[0]?.entityType === 'politician'

    // For politicians: show who donated to them
    // For others: show who they donated to
    const donationRows = isPolitician
      ? Array.from(await db.execute<{ name: string; total: string }>(sql`
          SELECT contributor_name AS name, SUM(amount)::text AS total
          FROM donations
          WHERE recipient_name = ${rootName}
          GROUP BY contributor_name
          ORDER BY SUM(amount) DESC
          LIMIT 15
        `))
      : Array.from(await db.execute<{ name: string; total: string }>(sql`
          SELECT recipient_name AS name, SUM(amount)::text AS total
          FROM donations
          WHERE entity_id = ${data.id}::uuid
          GROUP BY recipient_name
          ORDER BY SUM(amount) DESC
          LIMIT 15
        `))

    if (donationRows.length === 0) return { nodes: [], links: [] }

    const sankeyNodes: MoneyFlowNode[] = [{ id: 'root', name: rootName, type: 'entity' }]
    const sankeyLinks: MoneyFlowLink[] = []

    for (const row of donationRows) {
      const nodeId = `party:${row.name}`
      sankeyNodes.push({ id: nodeId, name: row.name, type: isPolitician ? 'entity' : 'party' })
      sankeyLinks.push({
        source: isPolitician ? nodeId : 'root',
        target: isPolitician ? 'root' : nodeId,
        value: Number(row.total),
      })
    }

    return { nodes: sankeyNodes, links: sankeyLinks }
  })

// ---------------------------------------------------------------------------
// API-08: getTimeline — chronological events across datasets
// ---------------------------------------------------------------------------

const TimelineInputSchema = z.object({ id: z.string().uuid() })

export const getTimeline = createServerFn({ method: 'GET' })
  .inputValidator(TimelineInputSchema)
  .handler(async ({ data }): Promise<TimelineResponse> => {
    const db = getDb()

    // Check entity type for politician-aware donation query
    const entityRows = await db.select({ canonicalName: entities.canonicalName, entityType: entities.entityType })
      .from(entities).where(eq(entities.id, data.id)).limit(1)
    const isPolitician = entityRows[0]?.entityType === 'politician'
    const entityName = entityRows[0]?.canonicalName ?? ''

    // Build donation query based on entity type
    const donationQuery = isPolitician
      ? sql`(SELECT donation_date::text AS date, 'donation' AS event_type,
                    contributor_name AS description, amount::text
             FROM donations WHERE recipient_name = ${entityName}
             ORDER BY donation_date DESC LIMIT 100)`
      : sql`(SELECT donation_date::text AS date, 'donation' AS event_type,
                    recipient_name AS description, amount::text
             FROM donations WHERE entity_id = ${data.id}::uuid
             ORDER BY donation_date DESC LIMIT 100)`

    const rows = Array.from(await db.execute<{
      date: string | null
      event_type: string
      description: string | null
      amount: string | null
    }>(sql`
      ${donationQuery}
      UNION ALL
      (SELECT award_date::text AS date, 'contract' AS event_type,
              department AS description, value::text AS amount
       FROM contracts WHERE entity_id = ${data.id}::uuid
       ORDER BY award_date DESC LIMIT 100)
      UNION ALL
      (SELECT agreement_date::text AS date, 'grant' AS event_type,
              department AS description, amount::text
       FROM grants WHERE entity_id = ${data.id}::uuid
       ORDER BY agreement_date DESC LIMIT 100)
      UNION ALL
      (SELECT communication_date::text AS date, 'lobby_communication' AS event_type,
              public_official_name AS description, NULL::text AS amount
       FROM lobby_communications WHERE lobbyist_entity_id = ${data.id}::uuid
       ORDER BY communication_date DESC LIMIT 100)
      ORDER BY date DESC NULLS LAST
      LIMIT 200
    `))

    return {
      events: rows.map(r => ({
        date: r.date ?? '',
        eventType: r.event_type as TimelineEvent['eventType'],
        description: r.description ?? '',
        amount: r.amount !== null ? Number(r.amount) : null,
      })),
    }
  })
