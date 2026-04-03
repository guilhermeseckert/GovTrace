import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { eq, sql, inArray } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { entityConnections } from '@govtrace/db/schema/connections'
import { entities } from '@govtrace/db/schema/entities'

// ---------------------------------------------------------------------------
// Exported response types for visualization components
// ---------------------------------------------------------------------------

export type GraphNode = {
  id: string
  name: string
  entityType: 'person' | 'politician' | 'organization' | 'company' | 'department'
  depth: number
}

export type GraphEdge = {
  sourceId: string
  targetId: string
  connectionType: string
  totalValue: number | null
  transactionCount: number
  firstSeen: string | null
  lastSeen: string | null
}

export type GraphResponse = {
  rootEntityId: string
  nodes: GraphNode[]
  edges: GraphEdge[]
  truncated: boolean
}

export type MoneyFlowNode = {
  id: string
  name: string
  type: 'entity' | 'party' | 'department'
}

export type MoneyFlowLink = {
  source: string
  target: string
  value: number
}

export type MoneyFlowResponse = {
  nodes: MoneyFlowNode[]
  links: MoneyFlowLink[]
}

export type TimelineEvent = {
  date: string
  eventType: 'donation' | 'contract' | 'grant' | 'lobby_registration' | 'lobby_communication'
  description: string
  amount: number | null
  relatedEntityName: string | null
  sourceUrl: string | null
}

export type TimelineResponse = {
  events: TimelineEvent[]
}

// ---------------------------------------------------------------------------
// API-06: getGraphData — recursive CTE depth-limited graph traversal
// ---------------------------------------------------------------------------

const GraphInputSchema = z.object({
  id: z.string().uuid(),
  depth: z.number().int().min(1).max(2).default(1),
  connectionTypes: z.array(z.string()).optional(),
})

// Raw row shapes from the recursive CTE
type GraphCteRow = {
  connected_id: string
  connection_id: string
  connection_type: string
  total_value: string | null
  transaction_count: string
  first_seen: string | null
  last_seen: string | null
  depth: string
  canonical_name: string
  entity_type: string
}

type CountRow = {
  total: string
}

export const getGraphData = createServerFn({ method: 'GET' })
  .inputValidator(GraphInputSchema)
  .handler(async ({ data }): Promise<GraphResponse> => {
    const db = getDb()
    const { id: entityId, depth, connectionTypes } = data

    // Build optional connection type filter for anchor query
    const typeFilter =
      connectionTypes && connectionTypes.length > 0
        ? sql`AND ec_anchor.connection_type = ANY(ARRAY[${sql.join(
            connectionTypes.map((t) => sql`${t}`),
            sql`, `,
          )}])`
        : sql``

    // Pre-check whether the result will be truncated
    const countResult = await db.execute<CountRow>(sql`
      WITH RECURSIVE graph AS (
        SELECT
          CASE WHEN entity_a_id = ${entityId}::uuid
               THEN entity_b_id ELSE entity_a_id END AS connected_id,
          1 AS depth
        FROM entity_connections ec_anchor
        WHERE (entity_a_id = ${entityId}::uuid OR entity_b_id = ${entityId}::uuid)
          AND is_stale = false
          ${typeFilter}

        UNION

        SELECT
          CASE WHEN ec.entity_a_id = g.connected_id
               THEN ec.entity_b_id ELSE ec.entity_a_id END,
          g.depth + 1
        FROM entity_connections ec
        JOIN graph g ON (ec.entity_a_id = g.connected_id OR ec.entity_b_id = g.connected_id)
        WHERE g.depth < ${depth}
          AND ec.is_stale = false
      )
      CYCLE connected_id SET is_cycle USING path
      SELECT COUNT(DISTINCT connected_id)::text AS total
      FROM graph
      WHERE NOT is_cycle
        AND connected_id != ${entityId}::uuid
    `)

    const rawCount = Number(Array.from(countResult)[0]?.total ?? 0)
    const truncated = rawCount > 150

    // Main query — limited to 150 nodes
    const cteResult = await db.execute<GraphCteRow>(sql`
      WITH RECURSIVE graph AS (
        SELECT
          CASE WHEN entity_a_id = ${entityId}::uuid
               THEN entity_b_id ELSE entity_a_id END AS connected_id,
          id AS connection_id,
          connection_type,
          total_value,
          transaction_count,
          first_seen,
          last_seen,
          1 AS depth
        FROM entity_connections ec_anchor
        WHERE (entity_a_id = ${entityId}::uuid OR entity_b_id = ${entityId}::uuid)
          AND is_stale = false
          ${typeFilter}

        UNION

        SELECT
          CASE WHEN ec.entity_a_id = g.connected_id
               THEN ec.entity_b_id ELSE ec.entity_a_id END,
          ec.id,
          ec.connection_type,
          ec.total_value,
          ec.transaction_count,
          ec.first_seen,
          ec.last_seen,
          g.depth + 1
        FROM entity_connections ec
        JOIN graph g ON (ec.entity_a_id = g.connected_id OR ec.entity_b_id = g.connected_id)
        WHERE g.depth < ${depth}
          AND ec.is_stale = false
      )
      CYCLE connected_id SET is_cycle USING path
      SELECT DISTINCT ON (g.connected_id)
        g.connected_id,
        g.connection_id,
        g.connection_type,
        g.total_value,
        g.transaction_count,
        g.first_seen,
        g.last_seen,
        g.depth,
        e.canonical_name,
        e.entity_type
      FROM graph g
      JOIN entities e ON e.id = g.connected_id
      WHERE NOT g.is_cycle
        AND g.connected_id != ${entityId}::uuid
      ORDER BY g.connected_id, g.depth
      LIMIT 150
    `)

    // Fetch the root entity to include as depth-0 node
    const rootRows = await db
      .select({ id: entities.id, canonicalName: entities.canonicalName, entityType: entities.entityType })
      .from(entities)
      .where(eq(entities.id, entityId))
      .limit(1)

    const rootEntity = rootRows[0]

    // Build nodes array (root at depth 0 + all connected nodes)
    const nodes: GraphNode[] = []

    if (rootEntity) {
      nodes.push({
        id: rootEntity.id,
        name: rootEntity.canonicalName,
        entityType: rootEntity.entityType as GraphNode['entityType'],
        depth: 0,
      })
    }

    const cteRows = Array.from(cteResult)
    for (const row of cteRows) {
      nodes.push({
        id: row.connected_id,
        name: row.canonical_name,
        entityType: row.entity_type as GraphNode['entityType'],
        depth: Number(row.depth),
      })
    }

    // Build edges — query entity_connections for all pairs involving root or connected nodes
    const connectedIds = cteRows.map((r) => r.connected_id)
    const edges: GraphEdge[] = []

    if (connectedIds.length > 0) {
      const allIds = [entityId, ...connectedIds]
      const edgeRows = await db
        .select({
          entityAId: entityConnections.entityAId,
          entityBId: entityConnections.entityBId,
          connectionType: entityConnections.connectionType,
          totalValue: entityConnections.totalValue,
          transactionCount: entityConnections.transactionCount,
          firstSeen: entityConnections.firstSeen,
          lastSeen: entityConnections.lastSeen,
        })
        .from(entityConnections)
        .where(
          sql`${entityConnections.entityAId} = ANY(${sql`ARRAY[${sql.join(allIds.map((id) => sql`${id}::uuid`), sql`, `)}]`})
              AND ${entityConnections.entityBId} = ANY(${sql`ARRAY[${sql.join(allIds.map((id) => sql`${id}::uuid`), sql`, `)}]`})
              AND ${entityConnections.isStale} = false`,
        )

      for (const edge of edgeRows) {
        edges.push({
          sourceId: edge.entityAId,
          targetId: edge.entityBId,
          connectionType: edge.connectionType,
          totalValue: edge.totalValue !== null ? Number(edge.totalValue) : null,
          transactionCount: edge.transactionCount,
          firstSeen: edge.firstSeen,
          lastSeen: edge.lastSeen,
        })
      }
    }

    return {
      rootEntityId: entityId,
      nodes,
      edges,
      truncated,
    }
  })

// ---------------------------------------------------------------------------
// API-07: getMoneyFlow — Sankey diagram data (donations → parties → departments)
// ---------------------------------------------------------------------------

const MoneyFlowInputSchema = z.object({
  id: z.string().uuid(),
})

type DonationAggRow = {
  recipient_name: string
  total_value: string
}

type ContractAggRow = {
  department: string
  total_value: string
}

export const getMoneyFlow = createServerFn({ method: 'GET' })
  .inputValidator(MoneyFlowInputSchema)
  .handler(async ({ data }): Promise<MoneyFlowResponse> => {
    const db = getDb()
    const { id: entityId } = data

    // Fetch root entity name
    const rootRows = await db
      .select({ canonicalName: entities.canonicalName })
      .from(entities)
      .where(eq(entities.id, entityId))
      .limit(1)

    const rootName = rootRows[0]?.canonicalName ?? entityId

    // Step 1: aggregate donations by recipientName, top 20 parties
    const donationAggs = await db.execute<DonationAggRow>(sql`
      SELECT recipient_name, SUM(amount)::text AS total_value
      FROM donations
      WHERE entity_id = ${entityId}::uuid
      GROUP BY recipient_name
      ORDER BY SUM(amount) DESC
      LIMIT 20
    `)

    const donationRows = Array.from(donationAggs)

    if (donationRows.length === 0) {
      return { nodes: [], links: [] }
    }

    // Step 2: resolve party entities by canonicalName
    const partyNames = donationRows.map((r) => r.recipient_name)
    const partyEntities = await db
      .select({ id: entities.id, canonicalName: entities.canonicalName })
      .from(entities)
      .where(inArray(entities.canonicalName, partyNames))

    const partyEntityIds = partyEntities.map((pe) => pe.id)

    // Step 3: aggregate contracts by department for those party entities
    const contractRows: ContractAggRow[] =
      partyEntityIds.length > 0
        ? Array.from(
            await db.execute<ContractAggRow>(sql`
              SELECT department, SUM(amount)::text AS total_value
              FROM contracts
              WHERE entity_id = ANY(${sql`ARRAY[${sql.join(partyEntityIds.map((id) => sql`${id}::uuid`), sql`, `)}]`})
              GROUP BY department
              ORDER BY SUM(amount) DESC
              LIMIT 20
            `),
          )
        : []

    // Build Sankey nodes
    const sankeyNodes: MoneyFlowNode[] = [{ id: 'root', name: rootName, type: 'entity' }]

    for (const row of donationRows) {
      sankeyNodes.push({ id: `party:${row.recipient_name}`, name: row.recipient_name, type: 'party' })
    }

    for (const row of contractRows) {
      sankeyNodes.push({ id: `dept:${row.department}`, name: row.department, type: 'department' })
    }

    // Need at least 3 nodes for a meaningful Sankey
    if (sankeyNodes.length < 3) {
      return { nodes: [], links: [] }
    }

    // Build Sankey links
    const sankeyLinks: MoneyFlowLink[] = []

    for (const row of donationRows) {
      sankeyLinks.push({
        source: 'root',
        target: `party:${row.recipient_name}`,
        value: Number(row.total_value),
      })
    }

    for (const row of contractRows) {
      sankeyLinks.push({
        source: `party:${row.department}`,
        target: `dept:${row.department}`,
        value: Number(row.total_value),
      })
    }

    return { nodes: sankeyNodes, links: sankeyLinks }
  })

// ---------------------------------------------------------------------------
// API-08: getTimeline — UNION across all 5 datasets ordered by date
// ---------------------------------------------------------------------------

const TimelineInputSchema = z.object({
  id: z.string().uuid(),
})

type TimelineRow = {
  date: string | null
  event_type: string
  description: string | null
  amount: string | null
  related_entity_name: string | null
  source_url: string | null
}

export const getTimeline = createServerFn({ method: 'GET' })
  .inputValidator(TimelineInputSchema)
  .handler(async ({ data }): Promise<TimelineResponse> => {
    const db = getDb()
    const { id: entityId } = data

    const result = await db.execute<TimelineRow>(sql`
      SELECT date, event_type, description, amount, related_entity_name, source_url
      FROM (
        SELECT
          donation_date::text AS date,
          'donation' AS event_type,
          recipient_name AS description,
          amount::text AS amount,
          NULL AS related_entity_name,
          source_url
        FROM donations
        WHERE entity_id = ${entityId}::uuid

        UNION ALL

        SELECT
          start_date::text AS date,
          'contract' AS event_type,
          department AS description,
          amount::text AS amount,
          NULL AS related_entity_name,
          source_url
        FROM contracts
        WHERE entity_id = ${entityId}::uuid

        UNION ALL

        SELECT
          start_date::text AS date,
          'grant' AS event_type,
          department AS description,
          amount::text AS amount,
          NULL AS related_entity_name,
          source_url
        FROM grants
        WHERE entity_id = ${entityId}::uuid

        UNION ALL

        SELECT
          start_date::text AS date,
          'lobby_registration' AS event_type,
          COALESCE(raw_data->>'subject', registration_number) AS description,
          NULL AS amount,
          NULL AS related_entity_name,
          NULL AS source_url
        FROM lobby_registrations
        WHERE lobbyist_entity_id = ${entityId}::uuid
           OR client_entity_id = ${entityId}::uuid

        UNION ALL

        SELECT
          date::text AS date,
          'lobby_communication' AS event_type,
          official_name AS description,
          NULL AS amount,
          NULL AS related_entity_name,
          NULL AS source_url
        FROM lobby_communications
        WHERE lobbyist_entity_id = ${entityId}::uuid
           OR client_entity_id = ${entityId}::uuid
      ) events
      ORDER BY date DESC NULLS LAST
      LIMIT 500
    `)

    const events: TimelineEvent[] = Array.from(result).map((row) => ({
      date: row.date ?? '',
      eventType: row.event_type as TimelineEvent['eventType'],
      description: row.description ?? '',
      amount: row.amount !== null ? Number(row.amount) : null,
      relatedEntityName: row.related_entity_name,
      sourceUrl: row.source_url,
    }))

    return { events }
  })
