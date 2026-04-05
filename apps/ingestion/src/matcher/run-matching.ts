import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { entityMatchesLog } from '@govtrace/db/schema/entities'
import { normalizeName } from '../normalizer/normalize.ts'
import { findDeterministicMatch, createNewEntity } from './deterministic.ts'
import { findFuzzyMatches, storeHighConfidenceMatch } from './fuzzy.ts'
import { runCrossDatasetMerge } from './cross-dataset-merge.ts'

export interface MatchingStats {
  total: number
  deterministic: number
  highConfidenceFuzzy: number
  mediumConfidenceQueued: number // sent to AI in Plan 07
  newEntities: number
}

interface SourceConfig {
  table: string
  nameField: string
  normalizedField: string
  entityIdField: string
}

const SOURCE_CONFIGS: SourceConfig[] = [
  { table: 'donations', nameField: 'contributor_name', normalizedField: 'normalized_contributor_name', entityIdField: 'entity_id' },
  { table: 'contracts', nameField: 'vendor_name', normalizedField: 'normalized_vendor_name', entityIdField: 'entity_id' },
  { table: 'grants', nameField: 'recipient_name', normalizedField: 'normalized_recipient_name', entityIdField: 'entity_id' },
  { table: 'lobby_registrations', nameField: 'lobbyist_name', normalizedField: 'normalized_lobbyist_name', entityIdField: 'lobbyist_entity_id' },
  { table: 'lobby_registrations', nameField: 'client_name', normalizedField: 'normalized_client_name', entityIdField: 'client_entity_id' },
  { table: 'lobby_communications', nameField: 'lobbyist_name', normalizedField: 'normalized_lobbyist_name', entityIdField: 'lobbyist_entity_id' },
  { table: 'lobby_communications', nameField: 'public_official_name', normalizedField: 'normalized_official_name', entityIdField: 'official_entity_id' },
  { table: 'international_aid', nameField: 'implementer_name', normalizedField: 'normalized_implementer_name', entityIdField: 'entity_id' },
]

/**
 * Runs the two-stage matching pipeline (deterministic → fuzzy) across all source tables.
 * Stage 3 (Claude AI) handled separately.
 * Updates normalized_name and entity_id columns on source records after matching.
 * D-05: global pass after all sources are ingested.
 *
 * NOTE: Parliamentary MP matching is NOT handled here.
 * MPs use PersonId-anchored mp_profiles instead of this generic SOURCE_CONFIGS pipeline.
 * PersonId is the stable government identifier per person across all sessions —
 * without it, same-name MPs from different eras (e.g., two "Paul Martin"s) would be merged.
 * MP matching runs in runners/parliament.ts Phase C: deterministic → fuzzy → AI → new_entity.
 */
export async function runMatchingPipeline(): Promise<MatchingStats> {
  const stats: MatchingStats = {
    total: 0, deterministic: 0, highConfidenceFuzzy: 0, mediumConfidenceQueued: 0, newEntities: 0,
  }

  const db = getDb()

  for (const config of SOURCE_CONFIGS) {
    console.log(`Matching ${config.table}.${config.nameField}...`)

    // Fetch distinct unmatched names (not rows) — match each name once, bulk-update all rows
    const unmatched = await db.execute<{ raw_name: string; cnt: string }>(sql`
      SELECT ${sql.raw(config.nameField)} AS raw_name, count(*) AS cnt
      FROM ${sql.raw(config.table)}
      WHERE ${sql.raw(config.entityIdField)} IS NULL
        AND ${sql.raw(config.nameField)} IS NOT NULL
      GROUP BY ${sql.raw(config.nameField)}
      ORDER BY cnt DESC
    `)

    const unmatchedRows = unmatched as unknown as Array<{ raw_name: string; cnt: string }>
    const totalNames = unmatchedRows.length
    let processed = 0

    for (const row of unmatchedRows) {
      const rawName = row.raw_name
      stats.total++
      processed++

      if (processed % 5000 === 0) {
        console.log(`  ${config.table}.${config.nameField}: ${processed}/${totalNames} names processed`)
      }

      // Stage 1: Deterministic exact match
      const deterministicResult = await findDeterministicMatch(rawName, config.table, config.nameField)

      if (deterministicResult) {
        stats.deterministic++
        const normalizedName = normalizeName(rawName)
        await db.execute(sql`
          UPDATE ${sql.raw(config.table)}
          SET ${sql.raw(config.entityIdField)} = ${deterministicResult.entityId}::uuid,
              ${sql.raw(config.normalizedField)} = ${normalizedName}
          WHERE ${sql.raw(config.nameField)} = ${rawName}
            AND ${sql.raw(config.entityIdField)} IS NULL
        `)
        continue
      }

      // Stage 2: Fuzzy matching
      const candidates = await findFuzzyMatches(rawName)

      const top = candidates[0]
      if (top !== undefined) {
        if (top.isHighConfidence) {
          stats.highConfidenceFuzzy++
          await storeHighConfidenceMatch(rawName, top, config.table, config.nameField)
          const normalizedName = normalizeName(rawName)
          await db.execute(sql`
            UPDATE ${sql.raw(config.table)}
            SET ${sql.raw(config.entityIdField)} = ${top.entityId}::uuid,
                ${sql.raw(config.normalizedField)} = ${normalizedName}
            WHERE ${sql.raw(config.nameField)} = ${rawName}
              AND ${sql.raw(config.entityIdField)} IS NULL
          `)
        } else {
          stats.mediumConfidenceQueued++
          const normalizedName = normalizeName(rawName)
          await db.insert(entityMatchesLog).values({
            entityBId: top.entityId,
            rawNameA: rawName,
            rawNameB: top.entityName,
            normalizedNameA: normalizedName,
            normalizedNameB: normalizeName(top.entityName),
            matchMethod: 'fuzzy',
            similarityScore: top.similarityScore,
            decision: 'uncertain',
            isFlaggedForReview: false,
          })
        }
      } else {
        // No match found — create new entity
        stats.newEntities++
        const entityId = await createNewEntity(rawName, config.table, config.nameField)
        const normalizedName = normalizeName(rawName)
        await db.execute(sql`
          UPDATE ${sql.raw(config.table)}
          SET ${sql.raw(config.entityIdField)} = ${entityId}::uuid,
              ${sql.raw(config.normalizedField)} = ${normalizedName}
          WHERE ${sql.raw(config.nameField)} = ${rawName}
            AND ${sql.raw(config.entityIdField)} IS NULL
        `)
      }
    }
    console.log(`  ${config.table}.${config.nameField}: complete (${totalNames} distinct names)`)
  }

  // Stage 4: Cross-dataset merge — unify entities with same normalized_name but different entity_type
  console.log('\nRunning cross-dataset entity merge...')
  const mergeStats = await runCrossDatasetMerge()
  console.log(`Merge: ${mergeStats.duplicateGroups} groups, ${mergeStats.entitiesMerged} merged, ${mergeStats.refsUpdated} refs updated`)

  return stats
}
