import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'

/**
 * Cross-dataset entity merge.
 *
 * After the matching pipeline runs on all 5 source tables, entities with identical
 * normalized_name but different entity_type exist as separate records. This happens
 * because inferEntityType() assigns different types per source (e.g., "person" for
 * donations, "company" for contracts).
 *
 * This step finds duplicate normalized_names, picks the best entity_id (the one
 * with the most connections), and repoints all raw table references to the winner.
 * The loser entity is deactivated.
 */

export interface MergeStats {
  duplicateGroups: number
  entitiesMerged: number
  refsUpdated: number
}

export async function runCrossDatasetMerge(): Promise<MergeStats> {
  const db = getDb()
  const stats: MergeStats = { duplicateGroups: 0, entitiesMerged: 0, refsUpdated: 0 }

  console.log('Cross-dataset entity merge: finding duplicates by normalized_name...')

  // Find normalized_names that map to multiple entity IDs
  const duplicates = await db.execute<{
    normalized_name: string
    entity_count: string
    entity_ids: string
  }>(sql`
    SELECT normalized_name,
           count(*) AS entity_count,
           array_agg(id ORDER BY created_at ASC)::text AS entity_ids
    FROM entities
    WHERE is_active = true
      AND normalized_name IS NOT NULL
      AND normalized_name != ''
    GROUP BY normalized_name
    HAVING count(*) > 1
    ORDER BY count(*) DESC
  `)

  const rows = Array.from(duplicates) as Array<{
    normalized_name: string
    entity_count: string
    entity_ids: string
  }>

  console.log(`Found ${rows.length} duplicate groups to merge`)
  stats.duplicateGroups = rows.length

  for (const row of rows) {
    // Parse the entity IDs from the postgres array string: {uuid1,uuid2,...}
    const ids = row.entity_ids
      .replace(/[{}]/g, '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)

    if (ids.length < 2) continue

    if (stats.duplicateGroups > 100 && (stats.entitiesMerged % 1000 === 0) && stats.entitiesMerged > 0) {
      console.log(`  Progress: ${stats.entitiesMerged.toLocaleString()} entities merged...`)
    }

    // Winner is the first (oldest) entity — it was created first and likely has the most references
    const winnerId = ids[0]
    const loserIds = ids.slice(1)

    for (const loserId of loserIds) {
      // Repoint all raw table references from loser → winner
      const tables = [
        { table: 'donations', field: 'entity_id' },
        { table: 'contracts', field: 'entity_id' },
        { table: 'grants', field: 'entity_id' },
        { table: 'lobby_registrations', field: 'lobbyist_entity_id' },
        { table: 'lobby_registrations', field: 'client_entity_id' },
        { table: 'lobby_communications', field: 'lobbyist_entity_id' },
        { table: 'lobby_communications', field: 'official_entity_id' },
      ]

      for (const { table, field } of tables) {
        const result = await db.execute(sql`
          UPDATE ${sql.raw(table)}
          SET ${sql.raw(field)} = ${winnerId}::uuid
          WHERE ${sql.raw(field)} = ${loserId}::uuid
        `)
        const updated = (result as unknown as { count?: number }).count ?? 0
        stats.refsUpdated += Number(updated)
      }

      // Repoint entity_connections — delete duplicates that would violate unique constraint,
      // then update the rest
      await db.execute(sql`
        DELETE FROM entity_connections
        WHERE entity_a_id = ${loserId}::uuid
          AND (entity_b_id, connection_type) IN (
            SELECT entity_b_id, connection_type FROM entity_connections WHERE entity_a_id = ${winnerId}::uuid
          )
      `)
      await db.execute(sql`
        DELETE FROM entity_connections
        WHERE entity_b_id = ${loserId}::uuid
          AND (entity_a_id, connection_type) IN (
            SELECT entity_a_id, connection_type FROM entity_connections WHERE entity_b_id = ${winnerId}::uuid
          )
      `)
      await db.execute(sql`
        UPDATE entity_connections
        SET entity_a_id = ${winnerId}::uuid
        WHERE entity_a_id = ${loserId}::uuid
      `)
      await db.execute(sql`
        UPDATE entity_connections
        SET entity_b_id = ${winnerId}::uuid
        WHERE entity_b_id = ${loserId}::uuid
      `)

      // Repoint entity_aliases — skip conflicts
      await db.execute(sql`
        UPDATE entity_aliases
        SET entity_id = ${winnerId}::uuid
        WHERE entity_id = ${loserId}::uuid
        AND NOT EXISTS (
          SELECT 1 FROM entity_aliases ea2
          WHERE ea2.entity_id = ${winnerId}::uuid
            AND ea2.raw_name = entity_aliases.raw_name
            AND ea2.source_table = entity_aliases.source_table
        )
      `)
      await db.execute(sql`
        DELETE FROM entity_aliases WHERE entity_id = ${loserId}::uuid
      `)

      // Repoint entity_matches_log — no unique constraint, safe to update
      await db.execute(sql`
        UPDATE entity_matches_log
        SET entity_a_id = ${winnerId}::uuid
        WHERE entity_a_id = ${loserId}::uuid
      `)
      await db.execute(sql`
        UPDATE entity_matches_log
        SET entity_b_id = ${winnerId}::uuid
        WHERE entity_b_id = ${loserId}::uuid
      `)

      // Repoint ai_summaries — delete loser's cached summary (will regenerate)
      await db.execute(sql`
        DELETE FROM ai_summaries WHERE entity_id = ${loserId}::uuid
      `)

      // Deactivate loser entity
      await db.execute(sql`
        UPDATE entities
        SET is_active = false
        WHERE id = ${loserId}::uuid
      `)

      stats.entitiesMerged++
    }
  }

  console.log(`Merge complete: ${stats.duplicateGroups} groups, ${stats.entitiesMerged} entities merged, ${stats.refsUpdated} refs updated`)

  return stats
}
