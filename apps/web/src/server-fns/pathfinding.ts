import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'

// ---------------------------------------------------------------------------
// Exported response types
// ---------------------------------------------------------------------------

export type PathNode = {
  id: string
  name: string
  entityType: string
  isEndpoint: boolean
}

export type PathEdge = {
  sourceId: string
  targetId: string
  connectionType: string
  totalValue: number | null
  transactionCount: number
}

export type FoundPath = {
  nodes: string[]
  edges: PathEdge[]
  depth: number
}

export type PathResponse = {
  source: PathNode
  target: PathNode
  paths: FoundPath[]
  allNodes: PathNode[]
  allEdges: PathEdge[]
  found: boolean
}

// ---------------------------------------------------------------------------
// findPaths — WITH RECURSIVE BFS pathfinding between two entities
// ---------------------------------------------------------------------------

const FindPathsInputSchema = z.object({
  sourceId: z.string().uuid(),
  targetId: z.string().uuid(),
  maxDepth: z.number().int().min(1).max(3).default(3),
})

export const findPaths = createServerFn({ method: 'GET' })
  .inputValidator(FindPathsInputSchema)
  .handler(async ({ data }): Promise<PathResponse> => {
    const db = getDb()
    const { sourceId, targetId, maxDepth } = data

    // Short-circuit if source === target
    if (sourceId === targetId) {
      const entityRows = Array.from(await db.execute<{
        id: string
        canonical_name: string
        entity_type: string
      }>(sql`SELECT id, canonical_name, entity_type FROM entities WHERE id = ${sourceId}::uuid LIMIT 1`))

      const entity = entityRows[0]
      if (!entity) return { source: { id: sourceId, name: sourceId, entityType: 'unknown', isEndpoint: true }, target: { id: targetId, name: targetId, entityType: 'unknown', isEndpoint: true }, paths: [], allNodes: [], allEdges: [], found: false }

      const node: PathNode = { id: entity.id, name: entity.canonical_name, entityType: entity.entity_type, isEndpoint: true }
      return { source: node, target: node, paths: [], allNodes: [node], allEdges: [], found: false }
    }

    // Recursive BFS — WITH RECURSIVE + CYCLE guard via array membership check
    const rawPaths = Array.from(await db.execute<{
      path: string[]
      edge_ids: string[]
      depth: number
    }>(sql`
      WITH RECURSIVE paths AS (
        -- Base case: all direct neighbors of source
        SELECT
          CASE WHEN ec.entity_a_id = ${sourceId}::uuid THEN ec.entity_b_id ELSE ec.entity_a_id END AS current_node,
          ARRAY[${sourceId}::uuid, CASE WHEN ec.entity_a_id = ${sourceId}::uuid THEN ec.entity_b_id ELSE ec.entity_a_id END] AS path,
          ARRAY[ec.id] AS edge_ids,
          1 AS depth
        FROM entity_connections ec
        WHERE (ec.entity_a_id = ${sourceId}::uuid OR ec.entity_b_id = ${sourceId}::uuid)
          AND ec.is_stale = false

        UNION ALL

        -- Recursive step: extend by one hop, no revisiting nodes
        SELECT
          CASE WHEN ec.entity_a_id = p.current_node THEN ec.entity_b_id ELSE ec.entity_a_id END,
          p.path || CASE WHEN ec.entity_a_id = p.current_node THEN ec.entity_b_id ELSE ec.entity_a_id END,
          p.edge_ids || ec.id,
          p.depth + 1
        FROM paths p
        JOIN entity_connections ec
          ON (ec.entity_a_id = p.current_node OR ec.entity_b_id = p.current_node)
          AND ec.is_stale = false
        WHERE p.depth < ${maxDepth}
          AND NOT (
            CASE WHEN ec.entity_a_id = p.current_node THEN ec.entity_b_id ELSE ec.entity_a_id END = ANY(p.path)
          )
      )
      SELECT path, edge_ids, depth
      FROM paths
      WHERE current_node = ${targetId}::uuid
      ORDER BY depth ASC
      LIMIT 10
    `))

    // Hydrate all unique entity IDs across all paths
    const allEntityIds = new Set<string>()
    for (const row of rawPaths) {
      for (const id of row.path) {
        allEntityIds.add(id)
      }
    }
    // Always include source and target even if no paths
    allEntityIds.add(sourceId)
    allEntityIds.add(targetId)

    const entityIdList = Array.from(allEntityIds)

    const entityRows = entityIdList.length > 0
      ? Array.from(await db.execute<{
          id: string
          canonical_name: string
          entity_type: string
        }>(sql`
          SELECT id, canonical_name, entity_type
          FROM entities
          WHERE id = ANY(ARRAY[${sql.join(entityIdList.map(id => sql`${id}::uuid`), sql`, `)}])
        `))
      : []

    const entityMap = new Map<string, { id: string; canonical_name: string; entity_type: string }>()
    for (const row of entityRows) {
      entityMap.set(row.id, row)
    }

    // Hydrate all unique edge IDs across all paths
    const allEdgeIds = new Set<string>()
    for (const row of rawPaths) {
      for (const id of row.edge_ids) {
        allEdgeIds.add(id)
      }
    }

    const edgeIdList = Array.from(allEdgeIds)

    const edgeRows = edgeIdList.length > 0
      ? Array.from(await db.execute<{
          id: string
          entity_a_id: string
          entity_b_id: string
          connection_type: string
          total_value: string | null
          transaction_count: string
        }>(sql`
          SELECT id, entity_a_id, entity_b_id, connection_type, total_value::text, transaction_count::text
          FROM entity_connections
          WHERE id = ANY(ARRAY[${sql.join(edgeIdList.map(id => sql`${id}::uuid`), sql`, `)}])
        `))
      : []

    const edgeMap = new Map<string, typeof edgeRows[0]>()
    for (const row of edgeRows) {
      edgeMap.set(row.id, row)
    }

    // Build PathNode objects
    const makePathNode = (id: string): PathNode => {
      const e = entityMap.get(id)
      return {
        id,
        name: e?.canonical_name ?? id,
        entityType: e?.entity_type ?? 'unknown',
        isEndpoint: id === sourceId || id === targetId,
      }
    }

    const source = makePathNode(sourceId)
    const target = makePathNode(targetId)

    if (rawPaths.length === 0) {
      return { source, target, paths: [], allNodes: [source, target], allEdges: [], found: false }
    }

    // Build FoundPath objects, deduplicate allNodes and allEdges
    const allNodesMap = new Map<string, PathNode>()
    const allEdgesMap = new Map<string, PathEdge>()

    const paths: FoundPath[] = rawPaths.map(row => {
      const nodeIds: string[] = row.path.map(String)
      const pathEdges: PathEdge[] = []

      for (const edgeId of row.edge_ids) {
        const e = edgeMap.get(String(edgeId))
        if (!e) continue
        const pathEdge: PathEdge = {
          sourceId: e.entity_a_id,
          targetId: e.entity_b_id,
          connectionType: e.connection_type,
          totalValue: e.total_value !== null ? Number(e.total_value) : null,
          transactionCount: Number(e.transaction_count),
        }
        const edgeKey = `${e.entity_a_id}:${e.entity_b_id}:${e.connection_type}`
        if (!allEdgesMap.has(edgeKey)) {
          allEdgesMap.set(edgeKey, pathEdge)
        }
        pathEdges.push(pathEdge)
      }

      for (const nodeId of nodeIds) {
        if (!allNodesMap.has(nodeId)) {
          allNodesMap.set(nodeId, makePathNode(nodeId))
        }
      }

      return { nodes: nodeIds, edges: pathEdges, depth: Number(row.depth) }
    })

    const allNodes = Array.from(allNodesMap.values())
    const allEdges = Array.from(allEdgesMap.values())

    return { source, target, paths, allNodes, allEdges, found: true }
  })
