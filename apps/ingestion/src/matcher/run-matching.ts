import { sql } from 'drizzle-orm'
import { getDb } from '@govtrace/db/client'
import { entities } from '@govtrace/db/schema/entities'
import { normalizeName } from '../normalizer/normalize.ts'
import { createNewEntity } from './deterministic.ts'
import { runCrossDatasetMerge } from './cross-dataset-merge.ts'

export interface MatchingStats {
	total: number
	deterministic: number
	highConfidenceFuzzy: number
	mediumConfidenceQueued: number
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
	{ table: 'travel_disclosures', nameField: 'name', normalizedField: 'normalized_name', entityIdField: 'entity_id' },
	{ table: 'hospitality_disclosures', nameField: 'name', normalizedField: 'normalized_name', entityIdField: 'entity_id' },
]

const BATCH_SIZE = 1000

/**
 * Optimized batch matching pipeline.
 *
 * Old approach: 3+ DB queries per name × 665K names = millions of sequential queries (days).
 * New approach: pre-load entity lookup table into memory, batch fetch unmatched names,
 * O(1) in-memory lookup, batch UPDATE. ~100x faster.
 *
 * Steps per source table:
 *   1. Pre-load all entity normalized_name → id into a Map
 *   2. Fetch 1000 unmatched names at a time
 *   3. Normalize each name and look up in the Map (instant)
 *   4. Batch UPDATE matched rows
 *   5. Create new entities for truly unmatched names
 */
export async function runMatchingPipeline(): Promise<MatchingStats> {
	const stats: MatchingStats = {
		total: 0, deterministic: 0, highConfidenceFuzzy: 0, mediumConfidenceQueued: 0, newEntities: 0,
	}

	const db = getDb()

	// Pre-load all entity normalized names into a Map for O(1) lookup
	console.log('Loading entity lookup table...')
	const allEntities = await db.select({
		id: entities.id,
		normalizedName: entities.normalizedName,
	}).from(entities)

	const entityByNormalized = new Map<string, string>()
	for (const e of allEntities) {
		if (e.normalizedName) entityByNormalized.set(e.normalizedName, e.id)
	}
	console.log(`  Loaded ${entityByNormalized.size} entities into lookup`)

	for (const config of SOURCE_CONFIGS) {
		console.log(`\nMatching ${config.table}.${config.nameField}...`)

		// Count total unmatched
		const countResult = await db.execute<{ cnt: string }>(sql`
			SELECT COUNT(DISTINCT ${sql.raw(config.nameField)})::text AS cnt
			FROM ${sql.raw(config.table)}
			WHERE ${sql.raw(config.entityIdField)} IS NULL
				AND ${sql.raw(config.nameField)} IS NOT NULL
		`)
		const totalNames = Number(Array.from(countResult)[0]?.cnt ?? 0)
		console.log(`  ${totalNames.toLocaleString()} unmatched names to process`)

		if (totalNames === 0) continue

		let offset = 0
		let processed = 0
		let totalMatched = 0
		let totalNew = 0

		while (true) {
			// Fetch a batch of distinct unmatched names — no GROUP BY, no ORDER BY, just DISTINCT + LIMIT
			const batch = await db.execute<{ raw_name: string }>(sql`
				SELECT DISTINCT ${sql.raw(config.nameField)} AS raw_name
				FROM ${sql.raw(config.table)}
				WHERE ${sql.raw(config.entityIdField)} IS NULL
					AND ${sql.raw(config.nameField)} IS NOT NULL
					AND ${sql.raw(config.nameField)} != ''
					AND ${sql.raw(config.normalizedField)} IS NULL
				LIMIT ${BATCH_SIZE}
			`)

			const batchRows = Array.from(batch)
			if (batchRows.length === 0) break

			// Separate into matched vs unmatched using in-memory lookup
			const matched: { rawName: string; normalizedName: string; entityId: string }[] = []
			const unmatched: { rawName: string; normalizedName: string }[] = []

			for (const row of batchRows) {
				const normalized = normalizeName(row.raw_name)
				if (!normalized) {
					// Mark as processed so we don't loop on unnormalizable names
					try {
						await db.execute(sql`
							UPDATE ${sql.raw(config.table)}
							SET ${sql.raw(config.normalizedField)} = ''
							WHERE ${sql.raw(config.nameField)} = ${row.raw_name}
								AND ${sql.raw(config.entityIdField)} IS NULL
								AND ${sql.raw(config.normalizedField)} IS NULL
						`)
					} catch { /* skip */ }
					continue
				}

				const entityId = entityByNormalized.get(normalized)
				if (entityId) {
					matched.push({ rawName: row.raw_name, normalizedName: normalized, entityId })
				} else {
					unmatched.push({ rawName: row.raw_name, normalizedName: normalized })
				}
			}

			// Batch UPDATE all deterministic matches
			for (const m of matched) {
				try {
					await db.execute(sql`
						UPDATE ${sql.raw(config.table)}
						SET ${sql.raw(config.entityIdField)} = ${m.entityId}::uuid,
								${sql.raw(config.normalizedField)} = ${m.normalizedName}
						WHERE ${sql.raw(config.nameField)} = ${m.rawName}
							AND ${sql.raw(config.entityIdField)} IS NULL
					`)
					stats.deterministic++
				} catch (err) {
					console.error(`  Error updating match for "${m.rawName}":`, err instanceof Error ? err.message : err)
				}
			}

			// Create new entities for unmatched names and update rows
			for (const u of unmatched) {
				try {
					const entityId = await createNewEntity(u.rawName, config.table, config.nameField)
					entityByNormalized.set(u.normalizedName, entityId)
					await db.execute(sql`
						UPDATE ${sql.raw(config.table)}
						SET ${sql.raw(config.entityIdField)} = ${entityId}::uuid,
								${sql.raw(config.normalizedField)} = ${u.normalizedName}
						WHERE ${sql.raw(config.nameField)} = ${u.rawName}
							AND ${sql.raw(config.entityIdField)} IS NULL
					`)
					stats.newEntities++
				} catch (err) {
					console.error(`  Error creating entity for "${u.rawName}":`, err instanceof Error ? err.message : err)
				}
			}

			processed += batchRows.length
			totalMatched += matched.length
			totalNew += unmatched.length
			stats.total += batchRows.length

			console.log(`  ${processed.toLocaleString()}/${totalNames.toLocaleString()} names — batch: ${matched.length} matched, ${unmatched.length} new`)
		}

		console.log(`  ${config.table}.${config.nameField}: done (${totalMatched.toLocaleString()} matched, ${totalNew.toLocaleString()} new entities)`)
	}

	// Cross-dataset merge
	console.log('\nRunning cross-dataset entity merge...')
	const mergeStats = await runCrossDatasetMerge()
	console.log(`Merge: ${mergeStats.duplicateGroups} groups, ${mergeStats.entitiesMerged} merged, ${mergeStats.refsUpdated} refs updated`)

	return stats
}
